import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

/**
 * GET /api/orders
 * Returns a filtered, paginated list of orders for the active account + dynamic summary.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = request.headers.get("x-account-id");

    if (!accountId) {
      return NextResponse.json(
        { success: false, message: "Account context missing" },
        { status: 400 }
      );
    }

    // Pagination params
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const offset = (page - 1) * pageSize;

    // Filter params
    const platform = searchParams.get('platform');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const search = searchParams.get('search');

    let whereClauses = ['o.is_deleted = false', 'o.account_id = $1'];
    let params: any[] = [accountId];
    let paramIndex = 2;

    if (platform && platform !== 'all') {
      whereClauses.push(`o.platform = $${paramIndex++}`);
      params.push(platform);
    }

    if (fromDate) {
      whereClauses.push(`o.order_date >= $${paramIndex++}`);
      params.push(fromDate);
    }

    if (toDate) {
      whereClauses.push(`o.order_date <= $${paramIndex++}`);
      params.push(toDate);
    }

    if (search) {
      whereClauses.push(`(pv.variant_sku ILIKE $${paramIndex} OR ap.product_name ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereString = `WHERE ${whereClauses.join(' AND ')}`;

    // 1. Fetch Dynamic Summary (Total Orders and Revenue based on filters)
    const summaryQuery = `
      SELECT 
        COUNT(*)::int as total_orders,
        COALESCE(SUM(total_amount), 0)::numeric as total_revenue
      FROM orders o
      JOIN product_variants pv ON o.variant_id = pv.id
      JOIN allproducts ap ON pv.product_id = ap.id
      ${whereString}
    `;
    const summaryRes = await sql(summaryQuery, params);
    const summary = {
      totalOrders: Number(summaryRes[0]?.total_orders || 0),
      totalRevenue: Number(summaryRes[0]?.total_revenue || 0)
    };

    // 2. Fetch total count for pagination
    const countQuery = `
      SELECT COUNT(*) 
      FROM orders o
      JOIN product_variants pv ON o.variant_id = pv.id
      JOIN allproducts ap ON pv.product_id = ap.id
      ${whereString}
    `;
    const totalResult = await sql(countQuery, params);
    const totalRows = Number(totalResult[0]?.count || 0);

    // 3. Fetch order rows
    const dataQuery = `
      SELECT 
        o.id,
        o.order_date,
        o.platform,
        o.quantity,
        o.selling_price,
        o.total_amount,
        pv.variant_sku,
        ap.product_name
      FROM orders o
      JOIN product_variants pv ON o.variant_id = pv.id
      JOIN allproducts ap ON pv.product_id = ap.id
      ${whereString}
      ORDER BY o.order_date DESC, o.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    const orders = await sql(dataQuery, params);

    return NextResponse.json({
      success: true,
      summary,
      data: (orders || []).map((o: any) => ({
        ...o,
        quantity: Number(o.quantity || 0),
        selling_price: Number(o.selling_price || 0),
        total_amount: Number(o.total_amount || 0)
      })),
      totalRows,
      page,
      pageSize
    });

  } catch (error: any) {
    console.error("API Orders GET Error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch orders", error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orders
 */
export async function POST(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account not selected" }, { status: 400 });
    }

    const body = await request.json();
    const { order_date, platform, variant_id, quantity, selling_price } = body;

    if (!order_date || !platform || !variant_id || !quantity || selling_price === undefined) {
      return NextResponse.json({ success: false, message: "Missing required order fields" }, { status: 400 });
    }

    const total_amount = Number(quantity) * Number(selling_price);

    const result = await sql`
      INSERT INTO orders (
        order_date, 
        platform, 
        variant_id, 
        quantity, 
        selling_price, 
        total_amount, 
        account_id
      )
      VALUES (
        ${order_date}, 
        ${platform}, 
        ${variant_id}, 
        ${quantity}, 
        ${selling_price}, 
        ${total_amount}, 
        ${accountId}
      )
      RETURNING *;
    `;

    return NextResponse.json({ success: true, data: result[0] }, { status: 201 });

  } catch (error: any) {
    console.error("API Orders POST Error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create order", error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/orders
 */
export async function PUT(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    const body = await request.json();
    const { id, order_date, platform, variant_id, quantity, selling_price } = body;

    if (!id || !order_date || !platform || !variant_id || !quantity || selling_price === undefined) {
      return NextResponse.json({ success: false, message: "Missing required update fields" }, { status: 400 });
    }

    const total_amount = Number(quantity) * Number(selling_price);

    const result = await sql`
      UPDATE orders
      SET 
        order_date = ${order_date},
        platform = ${platform},
        variant_id = ${variant_id},
        quantity = ${quantity},
        selling_price = ${selling_price},
        total_amount = ${total_amount}
      WHERE id = ${id} 
      AND account_id = ${accountId} 
      AND is_deleted = false
      RETURNING *;
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, message: "Order not found or access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result[0] });

  } catch (error: any) {
    console.error("API Orders PUT Error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update order", error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orders
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const accountId = request.headers.get("x-account-id");

    if (!id || !accountId) {
      return NextResponse.json(
        { success: false, message: "Order ID and Account context required" },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE orders
      SET is_deleted = true
      WHERE id = ${id} 
      AND account_id = ${accountId}
      RETURNING id;
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, message: "Order not found or access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Order soft-deleted successfully" });

  } catch (error: any) {
    console.error("API Orders DELETE Error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete order", error: error.message },
      { status: 500 }
    );
  }
}

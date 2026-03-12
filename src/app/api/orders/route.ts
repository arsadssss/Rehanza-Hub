import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

/**
 * GET /api/orders
 * Returns a filtered, paginated list of orders for the active account.
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

    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const offset = (page - 1) * pageSize;

    const platform = searchParams.get('platform');
    const status = searchParams.get('status');
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

    if (status && status !== 'all') {
      whereClauses.push(`o.status = $${paramIndex++}`);
      params.push(status);
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
      whereClauses.push(`(pv.variant_sku ILIKE $${paramIndex} OR o.external_order_id ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereString = `WHERE ${whereClauses.join(' AND ')}`;

    // 1. Fetch Dynamic Summary
    const summaryQuery = `
      SELECT 
        COUNT(*)::int as total_orders,
        COALESCE(SUM(total_amount), 0)::numeric as total_revenue
      FROM orders o
      JOIN product_variants pv ON o.variant_id = pv.id
      ${whereString}
    `;
    const summaryRes = await sql(summaryQuery, params);
    const summary = {
      totalOrders: Number(summaryRes[0]?.total_orders || 0),
      totalRevenue: Number(summaryRes[0]?.total_revenue || 0)
    };

    // 2. Fetch count
    const countQuery = `SELECT COUNT(*) FROM orders o JOIN product_variants pv ON o.variant_id = pv.id ${whereString}`;
    const totalResult = await sql(countQuery, params);
    const totalRows = Number(totalResult[0]?.count || 0);

    // 3. Fetch data
    const dataQuery = `
      SELECT 
        o.id,
        o.external_order_id,
        o.order_date,
        o.platform,
        o.quantity,
        o.selling_price,
        o.total_amount,
        o.status,
        pv.variant_sku
      FROM orders o
      JOIN product_variants pv ON o.variant_id = pv.id
      ${whereString}
      ORDER BY o.order_date DESC, o.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    const orders = await sql(dataQuery, params);

    return NextResponse.json({
      success: true,
      summary,
      data: orders,
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

export async function POST(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) return NextResponse.json({ success: false, message: "Account not selected" }, { status: 400 });

    const body = await request.json();
    const { external_order_id, order_date, platform, variant_id, quantity, selling_price, status } = body;

    const existing = await sql`SELECT id FROM orders WHERE external_order_id = ${external_order_id} AND account_id = ${accountId} AND is_deleted = false LIMIT 1`;
    if (existing.length > 0) return NextResponse.json({ success: false, message: "Order ID already exists" }, { status: 400 });

    // Individual operations to prevent "multiple commands" error
    const insertRes = await sql`
      INSERT INTO orders (external_order_id, order_date, platform, variant_id, quantity, selling_price, total_amount, account_id, status)
      VALUES (${external_order_id}, ${order_date}, ${platform}, ${variant_id}, ${quantity}, ${selling_price}, ${quantity * selling_price}, ${accountId}, ${status || "PENDING"})
      RETURNING id;
    `;

    await sql`
      UPDATE product_variants 
      SET stock = stock - ${quantity}
      WHERE id = ${variant_id} AND account_id = ${accountId};
    `;

    return NextResponse.json({ success: true, id: insertRes[0].id }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) return NextResponse.json({ success: false, message: "Account missing" }, { status: 400 });

    const body = await request.json();
    const { id, external_order_id, order_date, platform, variant_id, quantity, selling_price, status } = body;

    const result = await sql`
      UPDATE orders
      SET external_order_id = ${external_order_id}, order_date = ${order_date}, platform = ${platform}, variant_id = ${variant_id}, quantity = ${quantity}, selling_price = ${selling_price}, total_amount = ${quantity * selling_price}, status = ${status}
      WHERE id = ${id} AND account_id = ${accountId} AND is_deleted = false
      RETURNING *;
    `;

    if (result.length === 0) return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: result[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const accountId = request.headers.get("x-account-id");

    const result = await sql`UPDATE orders SET is_deleted = true WHERE id = ${id} AND account_id = ${accountId} RETURNING id`;
    if (result.length === 0) return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

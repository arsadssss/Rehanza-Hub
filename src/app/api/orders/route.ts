import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

// GET paginated orders
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
  const platform = searchParams.get('platform');
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');
  const searchTerm = searchParams.get('search');

  const offset = (page - 1) * pageSize;

  try {
    let whereClauses = ['o.is_deleted = false'];
    let params = [];
    let paramIndex = 1;

    if (platform) {
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
    if (searchTerm) {
      whereClauses.push(`(pv.variant_sku ILIKE $${paramIndex} OR p.product_name ILIKE $${paramIndex})`);
      params.push(`%${searchTerm}%`);
      paramIndex++;
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    const query = `
      SELECT o.id, o.order_date, o.platform, o.quantity, o.selling_price, o.total_amount, pv.variant_sku, p.product_name
      FROM orders o
      LEFT JOIN product_variants pv ON o.variant_id = pv.id
      LEFT JOIN allproducts p ON pv.product_id = p.id
      ${whereString}
      ORDER BY o.order_date DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const countQuery = `
      SELECT COUNT(o.id)
      FROM orders o
      LEFT JOIN product_variants pv ON o.variant_id = pv.id
      LEFT JOIN allproducts p ON pv.product_id = p.id
      ${whereString}
    `;

    const [orders, total] = await Promise.all([
        sql(query, params),
        sql(countQuery, params)
    ]);

    return NextResponse.json({
        data: orders,
        totalRows: Number(total[0].count)
    });

  } catch (error: any) {
    console.error("API Orders GET Error:", error);
    return NextResponse.json({ message: "Failed to fetch orders", error: error.message }, { status: 500 });
  }
}


// POST new order
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { order_date, platform, variant_id, quantity, selling_price } = body;

        if (!order_date || !platform || !variant_id || !quantity || selling_price === null) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        const result = await sql`
            INSERT INTO orders (order_date, platform, variant_id, quantity, selling_price)
            VALUES (${order_date}, ${platform}, ${variant_id}, ${quantity}, ${selling_price})
            RETURNING *;
        `;
        
        return NextResponse.json(result[0], { status: 201 });
    } catch (error: any) {
        console.error("API Orders POST Error:", error);
        return NextResponse.json({ message: 'Failed to create order', error: error.message }, { status: 500 });
    }
}


// PUT update order
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, order_date, platform, variant_id, quantity, selling_price } = body;
        
        if (!id || !order_date || !platform || !variant_id || !quantity || selling_price === null) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        const result = await sql`
            UPDATE orders
            SET 
                order_date = ${order_date}, 
                platform = ${platform}, 
                variant_id = ${variant_id}, 
                quantity = ${quantity}, 
                selling_price = ${selling_price}
            WHERE id = ${id}
            RETURNING *;
        `;
        
        if (result.length === 0) {
            return NextResponse.json({ message: 'Order not found' }, { status: 404 });
        }

        return NextResponse.json(result[0]);
    } catch (error: any) {
        console.error("API Orders PUT Error:", error);
        return NextResponse.json({ message: 'Failed to update order', error: error.message }, { status: 500 });
    }
}


// DELETE (soft delete) an order
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ message: 'Order ID is required' }, { status: 400 });
        }

        const result = await sql`
            UPDATE orders
            SET is_deleted = true
            WHERE id = ${id}
            RETURNING id;
        `;
        
        if (result.length === 0) {
            return NextResponse.json({ message: 'Order not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Order deleted successfully' });
    } catch (error: any) {
        console.error("API Orders DELETE Error:", error);
        return NextResponse.json({ message: 'Failed to delete order', error: error.message }, { status: 500 });
    }
}


import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

// GET products (paginated/searched for table, or simple list for dropdowns)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  try {
    // For populating dropdowns in modals
    if (type === 'list' || type === 'variants') {
        const query = type === 'variants'
        ? sql`SELECT v.id, v.variant_sku, v.stock, a.meesho_price, a.flipkart_price, a.amazon_price FROM product_variants v JOIN allproducts a ON v.product_id = a.id ORDER BY v.variant_sku`
        : sql`SELECT id, sku FROM allproducts ORDER BY sku`;
        
        const data = await query;
        return NextResponse.json(data);
    }
    
    // For main products table with pagination and search
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const searchTerm = searchParams.get('search');
    const offset = (page - 1) * pageSize;

    let whereClauses = [];
    let params: string[] = [];
    let paramIndex = 1;

    if (searchTerm) {
        whereClauses.push(`(sku ILIKE $${paramIndex} OR product_name ILIKE $${paramIndex})`);
        params.push(`%${searchTerm}%`);
        paramIndex++;
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const dataQuery = `SELECT * FROM allproducts ${whereString} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
    const countQuery = `SELECT COUNT(*) FROM allproducts ${whereString}`;

    const [data, countResult] = await Promise.all([
        sql(dataQuery, params),
        sql(countQuery, params)
    ]);
    
    return NextResponse.json({ data, count: Number(countResult[0].count) });

  } catch (error: any) {
    console.error("API Products GET Error:", error);
    return NextResponse.json({ message: "Failed to fetch products", error: error.message }, { status: 500 });
  }
}


// POST new product
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { sku, product_name, category, cost_price, margin, low_stock_threshold, meesho_price, flipkart_price, amazon_price } = body;
        
        // Basic validation
        if (!sku || !product_name || !cost_price || !margin) {
            return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
        }

        const result = await sql`
            INSERT INTO allproducts (sku, product_name, category, cost_price, margin, low_stock_threshold, meesho_price, flipkart_price, amazon_price)
            VALUES (${sku}, ${product_name}, ${category}, ${cost_price}, ${margin}, ${low_stock_threshold}, ${meesho_price}, ${flipkart_price}, ${amazon_price})
            RETURNING *;
        `;
        
        return NextResponse.json(result[0], { status: 201 });
    } catch (error: any) {
        console.error("API Products POST Error:", error);
        if (error.message.includes('unique constraint')) {
            return NextResponse.json({ message: `Product with SKU already exists.` }, { status: 409 });
        }
        return NextResponse.json({ message: 'Failed to create product', error: error.message }, { status: 500 });
    }
}

// PUT update product
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, sku, product_name, category, cost_price, margin, low_stock_threshold, meesho_price, flipkart_price, amazon_price } = body;

        if (!id) {
            return NextResponse.json({ message: "Product ID is required for update" }, { status: 400 });
        }

        const result = await sql`
            UPDATE allproducts
            SET 
                product_name = ${product_name},
                category = ${category},
                cost_price = ${cost_price},
                margin = ${margin},
                low_stock_threshold = ${low_stock_threshold},
                meesho_price = ${meesho_price},
                flipkart_price = ${flipkart_price},
                amazon_price = ${amazon_price}
            WHERE id = ${id}
            RETURNING *;
        `;

        if (result.length === 0) {
            return NextResponse.json({ message: "Product not found" }, { status: 404 });
        }
        
        return NextResponse.json(result[0]);
    } catch (error: any) {
        console.error("API Products PUT Error:", error);
        return NextResponse.json({ message: 'Failed to update product', error: error.message }, { status: 500 });
    }
}

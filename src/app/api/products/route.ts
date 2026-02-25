
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

/**
 * GET products
 * Handles paginated list for the main table, simple list for dropdowns, 
 * and variants list for order/return modals.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  try {
    // For populating dropdowns in modals (sku only)
    if (type === 'list') {
        const data = await sql`SELECT id, sku FROM allproducts ORDER BY sku`;
        return NextResponse.json(data);
    }
    
    // For order/return modals (variants with pricing)
    if (type === 'variants') {
        const data = await sql`
          SELECT v.id, v.variant_sku, v.stock, a.meesho_price, a.flipkart_price, a.amazon_price 
          FROM product_variants v 
          JOIN allproducts a ON v.product_id = a.id 
          ORDER BY v.variant_sku
        `;
        return NextResponse.json(data);
    }
    
    // Main paginated products table
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const searchTerm = searchParams.get('search') || '';
    const offset = (page - 1) * pageSize;

    let data;
    let countResult;

    if (searchTerm) {
        const search = `%${searchTerm}%`;
        data = await sql`
            SELECT * FROM allproducts 
            WHERE sku ILIKE ${search} OR product_name ILIKE ${search}
            ORDER BY id DESC 
            LIMIT ${pageSize} OFFSET ${offset}
        `;
        countResult = await sql`
            SELECT COUNT(*) FROM allproducts 
            WHERE sku ILIKE ${search} OR product_name ILIKE ${search}
        `;
    } else {
        data = await sql`
            SELECT * FROM allproducts 
            ORDER BY id DESC 
            LIMIT ${pageSize} OFFSET ${offset}
        `;
        countResult = await sql`SELECT COUNT(*) FROM allproducts`;
    }
    
    return NextResponse.json({ 
        success: true,
        data, 
        count: Number(countResult[0].count) 
    });

  } catch (error: any) {
    console.error("API Products GET Error:", error);
    return NextResponse.json({ 
        success: false,
        message: "Failed to fetch products", 
        error: error.message 
    }, { status: 500 });
  }
}


/**
 * POST new product
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { 
            sku, product_name, category, cost_price, margin, low_stock_threshold, 
            promo_ads, tax_other, packing, amazon_ship, 
            meesho_price, flipkart_price, amazon_price 
        } = body;
        
        if (!sku || !product_name || cost_price === undefined || margin === undefined) {
            return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
        }

        const result = await sql`
            INSERT INTO allproducts (
                sku, product_name, category, cost_price, margin, low_stock_threshold, 
                promo_ads, tax_other, packing, amazon_ship, 
                meesho_price, flipkart_price, amazon_price
            )
            VALUES (
                ${sku}, ${product_name}, ${category}, ${cost_price}, ${margin}, ${low_stock_threshold}, 
                ${promo_ads}, ${tax_other}, ${packing}, ${amazon_ship}, 
                ${meesho_price}, ${flipkart_price}, ${amazon_price}
            )
            RETURNING *;
        `;
        
        return NextResponse.json({ success: true, data: result[0] }, { status: 201 });
    } catch (error: any) {
        console.error("API Products POST Error:", error);
        if (error.message.includes('unique constraint')) {
            return NextResponse.json({ message: `Product with SKU '${body.sku}' already exists.` }, { status: 409 });
        }
        return NextResponse.json({ message: 'Failed to create product', error: error.message }, { status: 500 });
    }
}

/**
 * PUT update product
 */
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { 
            id, product_name, category, cost_price, margin, low_stock_threshold, 
            promo_ads, tax_other, packing, amazon_ship, 
            meesho_price, flipkart_price, amazon_price 
        } = body;

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
                promo_ads = ${promo_ads},
                tax_other = ${tax_other},
                packing = ${packing},
                amazon_ship = ${amazon_ship},
                meesho_price = ${meesho_price},
                flipkart_price = ${flipkart_price},
                amazon_price = ${amazon_price}
            WHERE id = ${id}
            RETURNING *;
        `;

        if (result.length === 0) {
            return NextResponse.json({ message: "Product not found" }, { status: 404 });
        }
        
        return NextResponse.json({ success: true, data: result[0] });
    } catch (error: any) {
        console.error("API Products PUT Error:", error);
        return NextResponse.json({ message: 'Failed to update product', error: error.message }, { status: 500 });
    }
}

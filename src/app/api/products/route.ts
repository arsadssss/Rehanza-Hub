import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const accountId = request.headers.get("x-account-id");

  if (!accountId) {
    return NextResponse.json({ success: false, message: "Account not selected" }, { status: 400 });
  }

  try {
    // List for dropdowns
    if (type === 'list') {
        const data = await sql`SELECT id, sku, product_name FROM allproducts WHERE account_id = ${accountId} ORDER BY sku`;
        return NextResponse.json(data);
    }
    
    // Variants view
    if (type === 'variants') {
        const data = await sql`
          SELECT v.id, v.variant_sku, v.stock, v.color, v.size, a.sku as product_sku, a.product_name, a.meesho_price, a.flipkart_price, a.amazon_price 
          FROM product_variants v 
          JOIN allproducts a ON v.product_id = a.id 
          WHERE a.account_id = ${accountId}
          ORDER BY v.variant_sku
        `;
        return NextResponse.json(data);
    }
    
    // Main Products View
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const searchTerm = searchParams.get('search') || '';
    const offset = (page - 1) * pageSize;

    let data;
    let countResult;

    const searchPattern = `%${searchTerm}%`;

    data = await sql`
        SELECT 
            p.*, 
            COALESCE(SUM(v.stock), 0)::int as total_stock
        FROM allproducts p
        LEFT JOIN product_variants v ON p.id = v.product_id
        WHERE p.account_id = ${accountId} 
        AND (p.sku ILIKE ${searchPattern} OR p.product_name ILIKE ${searchPattern})
        GROUP BY p.id
        ORDER BY p.id DESC 
        LIMIT ${pageSize} OFFSET ${offset}
    `;

    countResult = await sql`
        SELECT COUNT(*) FROM allproducts 
        WHERE account_id = ${accountId} 
        AND (sku ILIKE ${searchPattern} OR product_name ILIKE ${searchPattern})
    `;
    
    return NextResponse.json({ 
        success: true,
        data: data.map(p => ({
            ...p,
            cost_price: Number(p.cost_price || 0),
            margin: Number(p.margin || 0),
            meesho_price: Number(p.meesho_price || 0),
            flipkart_price: Number(p.flipkart_price || 0),
            amazon_price: Number(p.amazon_price || 0),
            total_stock: Number(p.total_stock || 0)
        })), 
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

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const accountId = request.headers.get("x-account-id");
        const { 
            sku, product_name, category, cost_price, margin, low_stock_threshold, 
            promo_ads, tax_other, packing, amazon_ship, 
            meesho_price, flipkart_price, amazon_price 
        } = body;
        
        if (!sku || !product_name || cost_price === undefined || margin === undefined || !accountId) {
            return NextResponse.json({ message: "Missing required fields or account" }, { status: 400 });
        }

        const result = await sql`
            INSERT INTO allproducts (
                sku, product_name, category, cost_price, margin, low_stock_threshold, 
                promo_ads, tax_other, packing, amazon_ship, 
                meesho_price, flipkart_price, amazon_price, account_id
            )
            VALUES (
                ${sku}, ${product_name}, ${category}, ${cost_price}, ${margin}, ${low_stock_threshold}, 
                ${promo_ads}, ${tax_other}, ${packing}, ${amazon_ship}, 
                ${meesho_price}, ${flipkart_price}, ${amazon_price}, ${accountId}
            )
            RETURNING *;
        `;
        
        return NextResponse.json({ success: true, data: result[0] }, { status: 201 });
    } catch (error: any) {
        console.error("API Products POST Error:", error);
        return NextResponse.json({ message: 'Failed to create product', error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const accountId = request.headers.get("x-account-id");
        const { 
            id, product_name, category, cost_price, margin, low_stock_threshold, 
            promo_ads, tax_other, packing, amazon_ship, 
            meesho_price, flipkart_price, amazon_price 
        } = body;

        if (!id || !accountId) {
            return NextResponse.json({ message: "Product ID and Account are required" }, { status: 400 });
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
            WHERE id = ${id} AND account_id = ${accountId}
            RETURNING *;
        `;

        if (result.length === 0) {
            return NextResponse.json({ message: "Product not found or access denied" }, { status: 404 });
        }
        
        return NextResponse.json({ success: true, data: result[0] });
    } catch (error: any) {
        console.error("API Products PUT Error:", error);
        return NextResponse.json({ message: 'Failed to update product', error: error.message }, { status: 500 });
    }
}
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = request.headers.get("x-account-id");

  if (!accountId) {
    return NextResponse.json({ success: false, message: "Account not selected" }, { status: 400 });
  }

  try {
    const type = searchParams.get('type');
    
    // List for dropdowns (un-paginated, minimal fields)
    if (type === 'list') {
        const data = await sql`SELECT id, sku, product_name FROM allproducts WHERE account_id = ${accountId} AND is_deleted = false ORDER BY sku`;
        return NextResponse.json(data);
    }
    
    // Main Products View with Pagination & Filters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || 'all';
    const stockStatus = searchParams.get('stock_status') || 'all';
    const offset = (page - 1) * limit;

    const searchPattern = `%${search}%`;
    
    // Build dynamic where clause components
    let whereClause = sql`p.account_id = ${accountId} AND p.is_deleted = false`;
    
    if (search) {
      whereClause = sql`${whereClause} AND (p.sku ILIKE ${searchPattern} OR p.product_name ILIKE ${searchPattern})`;
    }
    
    if (category && category !== 'all') {
      whereClause = sql`${whereClause} AND p.category = ${category}`;
    }

    // We use a subquery to calculate total_stock first so we can filter by it
    const dataQuery = sql`
        SELECT 
            p.*, 
            COALESCE(SUM(CASE WHEN v.is_deleted = false THEN v.stock ELSE 0 END), 0)::int as total_stock
        FROM allproducts p
        LEFT JOIN product_variants v ON p.id = v.product_id
        WHERE ${whereClause}
        GROUP BY p.id
        HAVING 1=1
        ${stockStatus === 'in_stock' ? sql`AND COALESCE(SUM(CASE WHEN v.is_deleted = false THEN v.stock ELSE 0 END), 0) > 0` : stockStatus === 'out_of_stock' ? sql`AND COALESCE(SUM(CASE WHEN v.is_deleted = false THEN v.stock ELSE 0 END), 0) = 0` : sql``}
        ORDER BY p.id DESC 
        LIMIT ${limit} OFFSET ${offset}
    `;

    // For total count, we need a similar wrap to handle the HAVING clause correctly
    const countQuery = sql`
        SELECT COUNT(*) FROM (
          SELECT p.id
          FROM allproducts p
          LEFT JOIN product_variants v ON p.id = v.product_id
          WHERE ${whereClause}
          GROUP BY p.id
          HAVING 1=1
          ${stockStatus === 'in_stock' ? sql`AND COALESCE(SUM(CASE WHEN v.is_deleted = false THEN v.stock ELSE 0 END), 0) > 0` : stockStatus === 'out_of_stock' ? sql`AND COALESCE(SUM(CASE WHEN v.is_deleted = false THEN v.stock ELSE 0 END), 0) = 0` : sql``}
        ) as filtered_products
    `;
    
    const [data, countResult] = await Promise.all([dataQuery, countQuery]);
    const total = Number(countResult[0]?.count || 0);
    
    return NextResponse.json({ 
        success: true,
        data: data.map((p: any) => ({
            ...p,
            cost_price: Number(p.cost_price || 0),
            margin: Number(p.margin || 0),
            meesho_price: Number(p.meesho_price || 0),
            flipkart_price: Number(p.flipkart_price || 0),
            amazon_price: Number(p.amazon_price || 0),
            total_stock: Number(p.total_stock || 0)
        })), 
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
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
            WHERE id = ${id} AND account_id = ${accountId} AND is_deleted = false
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

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const accountId = request.headers.get("x-account-id");

    if (!id || !accountId) {
      return NextResponse.json({ message: "Product ID and Account are required" }, { status: 400 });
    }

    // 1. Check if any variant of this product is referenced in orders or returns
    const refCheck = await sql`
      SELECT 
        (SELECT COUNT(*) FROM orders WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id = ${id}) AND is_deleted = false) as order_count,
        (SELECT COUNT(*) FROM returns WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id = ${id}) AND is_deleted = false) as return_count
    `;

    const orderCount = Number(refCheck[0]?.order_count || 0);
    const returnCount = Number(refCheck[0]?.return_count || 0);

    if (orderCount > 0 || returnCount > 0) {
      return NextResponse.json({ 
        message: `Cannot archive product. It has ${orderCount} active orders and ${returnCount} active returns.` 
      }, { status: 400 });
    }

    // 2. Perform soft delete on product and all its variants
    await sql`
      UPDATE allproducts SET is_deleted = true WHERE id = ${id} AND account_id = ${accountId};
    `;
    await sql`
      UPDATE product_variants SET is_deleted = true WHERE product_id = ${id} AND account_id = ${accountId};
    `;

    return NextResponse.json({ success: true, message: "Product and its variants archived successfully." });
  } catch (error: any) {
    console.error("API Products DELETE Error:", error);
    return NextResponse.json({ message: 'Failed to archive product', error: error.message }, { status: 500 });
  }
}

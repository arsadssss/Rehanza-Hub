import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) return NextResponse.json({ message: "Account not selected" }, { status: 400 });

    const variants = await sql`
      SELECT v.id, v.variant_sku, v.color, v.size, v.stock, a.sku, a.product_name
      FROM product_variants v
      LEFT JOIN allproducts a ON v.product_id = a.id
      WHERE a.account_id = ${accountId}
      ORDER BY v.created_at DESC;
    `;

    const formattedData = variants.map((v: any) => ({
        id: v.id,
        variant_sku: v.variant_sku,
        color: v.color,
        size: v.size,
        stock: v.stock,
        allproducts: {
            sku: v.sku,
            product_name: v.product_name,
        }
    }));
    
    return NextResponse.json(formattedData);
  } catch (error: any) {
    console.error("API Variants GET Error:", error);
    return NextResponse.json({ message: "Failed to fetch variants", error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const accountId = request.headers.get("x-account-id");
        const { product_id, color, size, stock, variant_sku } = body;
        
        if (!product_id || !variant_sku || !accountId) {
            return NextResponse.json({ message: "Missing required fields or account" }, { status: 400 });
        }

        // Verify product belongs to account
        const productCheck = await sql`SELECT id FROM allproducts WHERE id = ${product_id} AND account_id = ${accountId}`;
        if (productCheck.length === 0) return NextResponse.json({ message: "Access denied" }, { status: 403 });

        const result = await sql`
            INSERT INTO product_variants (product_id, color, size, stock, variant_sku)
            VALUES (${product_id}, ${color}, ${size}, ${stock}, ${variant_sku})
            RETURNING *;
        `;
        
        return NextResponse.json(result[0], { status: 201 });
    } catch (error: any) {
        console.error("API Variants POST Error:", error);
        return NextResponse.json({ message: 'Failed to create variant', error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const accountId = request.headers.get("x-account-id");
        const { id, stock } = body;

        if (!id || stock === undefined || !accountId) {
            return NextResponse.json({ message: "Variant ID, stock and Account are required" }, { status: 400 });
        }

        // Verify variant belongs to account via product
        const variantCheck = await sql`
            SELECT v.id 
            FROM product_variants v
            JOIN allproducts a ON v.product_id = a.id
            WHERE v.id = ${id} AND a.account_id = ${accountId}
        `;
        if (variantCheck.length === 0) return NextResponse.json({ message: "Access denied" }, { status: 403 });

        const result = await sql`
            UPDATE product_variants
            SET stock = ${stock}
            WHERE id = ${id}
            RETURNING *;
        `;
        
        return NextResponse.json(result[0]);
    } catch (error: any) {
        console.error("API Variants PUT Error:", error);
        return NextResponse.json({ message: 'Failed to update variant', error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const accountId = request.headers.get("x-account-id");
        const { ids } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0 || !accountId) {
            return NextResponse.json({ message: 'IDs and Account are required' }, { status: 400 });
        }

        const result = await sql`
            DELETE FROM product_variants 
            WHERE id IN (
                SELECT v.id FROM product_variants v
                JOIN allproducts a ON v.product_id = a.id
                WHERE v.id = ANY(${ids}) AND a.account_id = ${accountId}
            )
            RETURNING id;
        `;

        return NextResponse.json({ message: `${result.length} variants deleted successfully` });
    } catch (error: any) {
        console.error("API Variants DELETE Error:", error);
        return NextResponse.json({ message: 'Failed to delete variants', error: error.message }, { status: 500 });
    }
}

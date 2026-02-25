import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

// GET all variants
export async function GET(request: Request) {
  try {
    const variants = await sql`
      SELECT v.id, v.variant_sku, v.color, v.size, v.stock, a.sku, a.product_name
      FROM product_variants v
      LEFT JOIN allproducts a ON v.product_id = a.id
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

// POST new variant
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { product_id, color, size, stock, variant_sku } = body;
        
        if (!product_id || !variant_sku) {
            return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
        }

        const result = await sql`
            INSERT INTO product_variants (product_id, color, size, stock, variant_sku)
            VALUES (${product_id}, ${color}, ${size}, ${stock}, ${variant_sku})
            RETURNING *;
        `;
        
        return NextResponse.json(result[0], { status: 201 });
    } catch (error: any) {
        console.error("API Variants POST Error:", error);
         if (error.message.includes('unique constraint')) {
            return NextResponse.json({ message: `Variant with SKU '${body.variant_sku}' already exists.` }, { status: 409 });
        }
        return NextResponse.json({ message: 'Failed to create variant', error: error.message }, { status: 500 });
    }
}

// PUT update variant stock
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, stock } = body;

        if (!id || stock === undefined) {
            return NextResponse.json({ message: "Variant ID and stock are required" }, { status: 400 });
        }

        const result = await sql`
            UPDATE product_variants
            SET stock = ${stock}
            WHERE id = ${id}
            RETURNING *;
        `;

        if (result.length === 0) {
            return NextResponse.json({ message: "Variant not found" }, { status: 404 });
        }
        
        return NextResponse.json(result[0]);
    } catch (error: any) {
        console.error("API Variants PUT Error:", error);
        return NextResponse.json({ message: 'Failed to update variant', error: error.message }, { status: 500 });
    }
}

// DELETE multiple variants
export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const { ids } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ message: 'Array of variant IDs is required' }, { status: 400 });
        }

        const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
        
        // Use standard function call for dynamic query string
        const result = await sql(
            `DELETE FROM product_variants WHERE id IN (${placeholders}) RETURNING id`,
            ids
        );

        return NextResponse.json({ message: `${result.length} variants deleted successfully` });
    } catch (error: any) {
        console.error("API Variants DELETE Error:", error);
        return NextResponse.json({ message: 'Failed to delete variants', error: error.message }, { status: 500 });
    }
}

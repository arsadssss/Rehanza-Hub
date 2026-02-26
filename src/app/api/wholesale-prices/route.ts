import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

export const revalidate = 0;

/**
 * GET /api/wholesale-prices
 * Retrieves wholesale pricing tiers.
 * Supports filtering by product_id query param.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("product_id");

    let rows;
    if (productId) {
      rows = await sql`
        SELECT
          wp.*,
          p.product_name,
          u.name as created_by_name
        FROM public.wholesale_prices wp
        LEFT JOIN public.allproducts p ON wp.product_id = p.id
        LEFT JOIN public.users u ON wp.created_by = u.id
        WHERE wp.product_id = ${productId}
        ORDER BY wp.min_quantity ASC;
      `;
    } else {
      rows = await sql`
        SELECT
          wp.*,
          p.product_name,
          u.name as created_by_name
        FROM public.wholesale_prices wp
        LEFT JOIN public.allproducts p ON wp.product_id = p.id
        LEFT JOIN public.users u ON wp.created_by = u.id
        ORDER BY p.product_name ASC, wp.min_quantity ASC;
      `;
    }

    return NextResponse.json({
      success: true,
      data: rows,
    });
  } catch (error: any) {
    console.error("Wholesale Prices GET Error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch wholesale prices", error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/wholesale-prices
 * Creates a new wholesale pricing tier.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { product_id, min_quantity, wholesale_price } = body;

    if (!product_id || min_quantity === undefined || wholesale_price === undefined) {
      return NextResponse.json(
        { success: false, message: "Missing required fields: product_id, min_quantity, or wholesale_price" },
        { status: 400 }
      );
    }

    const result = await sql`
      INSERT INTO public.wholesale_prices (
        product_id, 
        min_quantity, 
        wholesale_price, 
        created_by,
        created_at
      )
      VALUES (
        ${product_id}, 
        ${min_quantity}, 
        ${wholesale_price}, 
        ${session.user.id},
        NOW()
      )
      RETURNING *;
    `;

    return NextResponse.json({
      success: true,
      message: "Wholesale price tier created successfully",
      data: result[0],
    }, { status: 201 });
  } catch (error: any) {
    console.error("Wholesale Prices POST Error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create wholesale price tier", error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/wholesale-prices
 * Deletes a specific wholesale pricing tier by ID.
 */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "ID is required to delete a tier" },
        { status: 400 }
      );
    }

    const result = await sql`
      DELETE FROM public.wholesale_prices 
      WHERE id = ${id}
      RETURNING id;
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, message: "Wholesale price tier not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Wholesale price tier deleted successfully",
    });
  } catch (error: any) {
    console.error("Wholesale Prices DELETE Error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete wholesale price tier", error: error.message },
      { status: 500 }
    );
  }
}

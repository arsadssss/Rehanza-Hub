
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = request.headers.get("x-account-id");
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';

    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account missing" }, { status: 400 });
    }

    let whereClauses = [`o.account_id = $1`, `o.is_deleted = false`];
    let params: any[] = [accountId];
    let pIdx = 2;

    if (search) {
      whereClauses.push(`(o.external_order_id ILIKE $${pIdx} OR v.variant_sku ILIKE $${pIdx})`);
      params.push(`%${search}%`);
      pIdx++;
    }

    if (status !== 'all') {
      whereClauses.push(`o.status ILIKE $${pIdx}`);
      params.push(`${status}`);
      pIdx++;
    }

    const query = `
      SELECT 
        o.id,
        o.external_order_id,
        o.order_date,
        o.platform,
        o.quantity,
        o.selling_price,
        o.total_amount,
        o.status,
        v.variant_sku
      FROM orders o
      LEFT JOIN product_variants v ON o.variant_id = v.id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY o.order_date DESC
      LIMIT 100
    `;

    const data = await sql(query, params);

    return NextResponse.json({
      success: true,
      data: (data || []).map((o: any) => ({
        ...o,
        selling_price: Number(o.selling_price || 0),
        total_amount: Number(o.total_amount || 0),
        quantity: Number(o.quantity || 0)
      }))
    });

  } catch (error: any) {
    console.error("API Orders GET Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

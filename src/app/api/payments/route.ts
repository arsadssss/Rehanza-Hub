import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

/**
 * GET /api/payments
 * Fetches filtered total received and paginated payouts for the active account.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = request.headers.get("x-account-id");

    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const platform = searchParams.get('platform');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const offset = (page - 1) * pageSize;

    // 1. Build Filtered Conditions (Common for Sum and Count)
    let whereClauses = ['is_deleted = false', 'account_id = $1'];
    let params: any[] = [accountId];
    let paramIndex = 2;

    if (platform && platform !== 'all') {
      whereClauses.push(`platform = $${paramIndex++}`);
      params.push(platform);
    }

    if (fromDate) {
      whereClauses.push(`payout_date >= $${paramIndex++}`);
      params.push(fromDate);
    }

    if (toDate) {
      whereClauses.push(`payout_date <= $${paramIndex++}`);
      params.push(toDate);
    }

    const whereString = `WHERE ${whereClauses.join(' AND ')}`;

    // 2. Fetch Aggregated Metrics (Filtered Sum and Count)
    const [summaryRes, countRes] = await Promise.all([
      sql(`SELECT COALESCE(SUM(amount), 0)::numeric as total FROM platform_payouts ${whereString}`, params),
      sql(`SELECT COUNT(*) FROM platform_payouts ${whereString}`, params)
    ]);

    const totalPaymentReceived = Number(summaryRes[0]?.total || 0);
    const totalRows = Number(countRes[0]?.count || 0);

    // 3. Build version of where string with aliases for the list query
    let listWhereClauses = ['pp.is_deleted = false', 'pp.account_id = $1'];
    let listParams: any[] = [accountId];
    let lIdx = 2;

    if (platform && platform !== 'all') {
      listWhereClauses.push(`pp.platform = $${lIdx++}`);
      listParams.push(platform);
    }

    if (fromDate) {
      listWhereClauses.push(`pp.payout_date >= $${lIdx++}`);
      listParams.push(fromDate);
    }

    if (toDate) {
      listWhereClauses.push(`pp.payout_date <= $${lIdx++}`);
      listParams.push(toDate);
    }

    const listWhereString = `WHERE ${listWhereClauses.join(' AND ')}`;

    // 4. Fetch payout list with Account Name JOIN
    const dataQuery = `
      SELECT 
        pp.id,
        pp.payout_date,
        pp.platform,
        pp.reference,
        pp.amount,
        pp.gst_account,
        a.name as account_name
      FROM platform_payouts pp
      JOIN accounts a ON pp.account_id = a.id
      ${listWhereString}
      ORDER BY pp.payout_date DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    const payouts = await sql(dataQuery, listParams);

    return NextResponse.json({
      success: true,
      totalPaymentReceived,
      payouts: (payouts || []).map((p: any) => ({
        ...p,
        amount: Number(p.amount || 0)
      })),
      total: totalRows,
      page,
      pageSize
    });

  } catch (error: any) {
    console.error("API Payments GET Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch payments", error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/payments
 * Creates a new payout record injected with account context.
 */
export async function POST(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    const body = await request.json();
    const { gst_account, platform, amount, payout_date, reference } = body;

    if (!accountId) return NextResponse.json({ message: "Account not selected" }, { status: 400 });
    if (!platform || !amount || !payout_date) return NextResponse.json({ message: "Missing required fields" }, { status: 400 });

    const result = await sql`
      INSERT INTO platform_payouts (gst_account, platform, amount, payout_date, reference, account_id)
      VALUES (${gst_account}, ${platform}, ${amount}, ${payout_date}, ${reference}, ${accountId})
      RETURNING *;
    `;

    return NextResponse.json({ success: true, data: result[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: "Failed to create payout", error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/payments
 * Updates an existing payout record.
 */
export async function PUT(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    const body = await request.json();
    const { id, gst_account, platform, amount, payout_date, reference } = body;

    if (!id || !accountId) return NextResponse.json({ message: "ID and Account required" }, { status: 400 });

    const result = await sql`
      UPDATE platform_payouts
      SET gst_account = ${gst_account}, platform = ${platform}, amount = ${amount}, payout_date = ${payout_date}, reference = ${reference}
      WHERE id = ${id} AND account_id = ${accountId} AND is_deleted = false
      RETURNING *;
    `;

    if (result.length === 0) return NextResponse.json({ message: "Payout not found or access denied" }, { status: 404 });
    return NextResponse.json({ success: true, data: result[0] });
  } catch (error: any) {
    return NextResponse.json({ message: "Failed to update payout", error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/payments
 * Soft-deletes a payout record.
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const accountId = request.headers.get("x-account-id");

    if (!id || !accountId) return NextResponse.json({ message: "ID and Account required" }, { status: 400 });

    const result = await sql`
      UPDATE platform_payouts 
      SET is_deleted = true 
      WHERE id = ${id} AND account_id = ${accountId} 
      RETURNING id;
    `;

    if (result.length === 0) return NextResponse.json({ message: "Payout not found or access denied" }, { status: 404 });
    return NextResponse.json({ success: true, message: "Payout deleted" });
  } catch (error: any) {
    return NextResponse.json({ message: "Failed to delete payout", error: error.message }, { status: 500 });
  }
}

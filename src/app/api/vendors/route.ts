import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

/**
 * GET /api/vendors
 * Returns a complete dashboard summary and vendor list for the active account.
 * Computes all balances dynamically from raw purchases and payments.
 */
export async function GET(request: Request) {
    try {
        const accountId = request.headers.get("x-account-id");
        if (!accountId) {
            return NextResponse.json({ success: false, message: "Account not selected" }, { status: 400 });
        }

        // 1. Fetch Aggregated Vendor Data and Summary Stats in parallel
        const [summaryRes, vendors] = await Promise.all([
            // Global Account Summary (Top Cards)
            sql`
                SELECT 
                    (SELECT COALESCE(SUM(total_amount), 0) FROM vendor_purchases WHERE account_id = ${accountId} AND is_deleted = false) as total_purchase_value,
                    (SELECT COALESCE(SUM(amount), 0) FROM vendor_payments WHERE account_id = ${accountId} AND is_deleted = false) as total_paid_value
            `,
            // Per Vendor Detail
            sql`
                SELECT 
                    v.id, 
                    v.vendor_name,
                    COALESCE(p.total_purchase, 0)::numeric as total_purchase,
                    COALESCE(pm.total_paid, 0)::numeric as total_paid
                FROM vendors v
                LEFT JOIN (
                    SELECT vendor_id, SUM(total_amount) as total_purchase
                    FROM vendor_purchases
                    WHERE account_id = ${accountId} AND is_deleted = false
                    GROUP BY vendor_id
                ) p ON v.id = p.vendor_id
                LEFT JOIN (
                    SELECT vendor_id, SUM(amount) as total_paid
                    FROM vendor_payments
                    WHERE account_id = ${accountId} AND is_deleted = false
                    GROUP BY vendor_id
                ) pm ON v.id = pm.vendor_id
                WHERE v.account_id = ${accountId}
                ORDER BY v.vendor_name ASC;
            `
        ]);

        const totalInventoryPurchase = Number(summaryRes[0]?.total_purchase_value || 0);
        const totalPaidAll = Number(summaryRes[0]?.total_paid_value || 0);
        const totalDue = totalInventoryPurchase - totalPaidAll;

        const formattedVendors = vendors.map((v: any) => {
            const tp = Number(v.total_purchase);
            const tpaid = Number(v.total_paid);
            const balance = tp - tpaid;
            return {
                id: v.id,
                vendor_name: v.vendor_name,
                total_purchase: tp,
                total_paid: tpaid,
                balance_due: balance,
                status: balance > 0 ? "DUE" : "SETTLED"
            };
        });

        return NextResponse.json({
            success: true,
            totalDue,
            totalInventoryPurchase,
            vendors: formattedVendors,
            // Legacy/Frontend mapping compatibility
            summary: formattedVendors,
            totalDueAllVendors: totalDue,
            totalInventoryValue: totalInventoryPurchase
        });
    } catch (error: any) {
        console.error("API Vendors GET error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

/**
 * POST /api/vendors
 * Creates a new vendor record, strictly scoped to the active account.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const accountId = request.headers.get("x-account-id");
        const { vendor_name, contact_person, email, phone } = body;
        
        if (!vendor_name || !accountId) {
            return NextResponse.json({ success: false, message: 'Vendor name and Account are required' }, { status: 400 });
        }
        
        const result = await sql`
            INSERT INTO vendors (vendor_name, contact_person, email, phone, account_id)
            VALUES (${vendor_name}, ${contact_person}, ${email}, ${phone}, ${accountId})
            RETURNING *;
        `;
        
        return NextResponse.json({
            success: true,
            data: result[0]
        }, { status: 201 });
    } catch (error: any) {
        console.error("API Vendors POST error:", error);
        return NextResponse.json({ success: false, message: 'Failed to create vendor', error: error.message }, { status: 500 });
    }
}

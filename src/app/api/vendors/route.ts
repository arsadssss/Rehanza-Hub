import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request) {
    try {
        const accountId = request.headers.get("x-account-id");
        if (!accountId) return NextResponse.json({ success: false, message: "Account not selected" }, { status: 400 });

        const vendors = await sql`
            SELECT id, vendor_name, contact_person, email, phone 
            FROM vendors 
            WHERE account_id = ${accountId}
            ORDER BY vendor_name ASC
        `;
        return NextResponse.json({
            success: true,
            data: vendors
        });
    } catch (error: any) {
        console.error("API Vendors GET error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

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

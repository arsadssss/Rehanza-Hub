import { sql } from '@/lib/neon';
import { NextResponse } from 'next/server';

export const revalidate = 0;

/**
 * GET list of all active vendors
 */
export async function GET() {
    try {
        const vendors = await sql`
            SELECT id, vendor_name, contact_person, email, phone 
            FROM vendors 
            WHERE is_deleted = false 
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

/**
 * POST a new vendor
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { vendor_name, contact_person, email, phone } = body;
        
        if (!vendor_name) {
            return NextResponse.json({ success: false, message: 'Vendor name is required' }, { status: 400 });
        }
        
        const result = await sql`
            INSERT INTO vendors (vendor_name, contact_person, email, phone)
            VALUES (${vendor_name}, ${contact_person}, ${email}, ${phone})
            RETURNING *;
        `;
        
        return NextResponse.json({
            success: true,
            data: result[0]
        }, { status: 201 });
    } catch (error: any) {
        console.error("API Vendors POST error:", error);
        if (error.message.includes('unique constraint')) {
            return NextResponse.json({ success: false, message: `A vendor with the name "${body.vendor_name}" already exists.` }, { status: 409 });
        }
        return NextResponse.json({ success: false, message: 'Failed to create vendor', error: error.message }, { status: 500 });
    }
}

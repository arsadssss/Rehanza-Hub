
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { vendor_name, contact_person, email, phone } = body;
        if (!vendor_name) {
            return NextResponse.json({ message: 'Vendor name is required' }, { status: 400 });
        }
        
        const result = await sql`
            INSERT INTO vendors (vendor_name, contact_person, email, phone)
            VALUES (${vendor_name}, ${contact_person}, ${email}, ${phone})
            RETURNING *;
        `;
        
        return NextResponse.json(result[0], { status: 201 });
    } catch (error: any) {
        if (error.message.includes('unique constraint')) {
            return NextResponse.json({ message: `A vendor with the name "${body.vendor_name}" already exists.` }, { status: 409 });
        }
        return NextResponse.json({ message: 'Failed to create vendor', error: error.message }, { status: 500 });
    }
}

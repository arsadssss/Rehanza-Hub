
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET() {
  try {
    const settings = await sql`SELECT setting_key, setting_value FROM app_settings`;
    const formattedSettings = settings.reduce((acc, { setting_key, setting_value }) => {
        acc[setting_key] = setting_value;
        return acc;
    }, {} as Record<string, any>);
    return NextResponse.json(formattedSettings);
  } catch (error: any) {
    console.error("API Settings GET Error:", error);
    return NextResponse.json({ message: "Failed to fetch settings", error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { key, value } = body;

        if (!key || value === undefined) {
            return NextResponse.json({ message: 'Setting key and value are required' }, { status: 400 });
        }
        
        const result = await sql`
            INSERT INTO app_settings (setting_key, setting_value)
            VALUES (${key}, ${JSON.stringify(value)})
            ON CONFLICT (setting_key)
            DO UPDATE SET setting_value = EXCLUDED.setting_value
            RETURNING *;
        `;
        
        return NextResponse.json(result[0]);
    } catch (error: any) {
        console.error("API Settings POST Error:", error);
        return NextResponse.json({ message: 'Failed to save settings', error: error.message }, { status: 500 });
    }
}

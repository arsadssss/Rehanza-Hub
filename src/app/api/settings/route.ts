import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const revalidate = 0;

export async function GET() {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as any)?.id || session?.user?.email;

    const settings = await sql`SELECT setting_key, setting_value FROM app_settings`;
    const formattedSettings = settings.reduce((acc: any, { setting_key, setting_value }: any) => {
        acc[setting_key] = setting_value;
        return acc;
    }, {} as Record<string, any>);

    // If the authenticated user has a personalized preference, apply it
    if (userId && formattedSettings[`user_preferences_${userId}`]) {
      formattedSettings.preferences = formattedSettings[`user_preferences_${userId}`];
    }

    return NextResponse.json(formattedSettings);
  } catch (error: any) {
    console.error("API Settings GET Error:", error);
    return NextResponse.json({ message: "Failed to fetch settings", error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions).catch(() => null);
        const userId = (session?.user as any)?.id || session?.user?.email;

        const body = await request.json();
        const { key, value } = body;

        if (!key || value === undefined) {
            return NextResponse.json({ message: 'Setting key and value are required' }, { status: 400 });
        }
        
        // If updating preferences and user is authenticated, save per-user preference
        if (key === 'preferences' && userId) {
            await sql`
                INSERT INTO app_settings (setting_key, setting_value)
                VALUES (${'user_preferences_' + userId}, ${JSON.stringify(value)})
                ON CONFLICT (setting_key)
                DO UPDATE SET setting_value = EXCLUDED.setting_value;
            `;
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

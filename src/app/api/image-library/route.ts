
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const revalidate = 0;

/**
 * Image Library API
 * Handles storage and management of media links.
 */

function convertDriveLink(url: string) {
  // Support for files: /file/d/ID/view
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) {
    return `https://drive.google.com/uc?export=view&id=${fileMatch[1]}`;
  }
  
  // Support for direct IDs in query params: ?id=ID
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
  }

  // Folders and other links are returned as is (they won't preview but won't crash the converter)
  return url;
}

async function ensureTableExists() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS image_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        image_url TEXT NOT NULL,
        category TEXT NOT NULL,
        tags JSONB DEFAULT '[]',
        account_id UUID NOT NULL,
        created_by UUID NOT NULL,
        is_deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
  } catch (e) {
    console.error("Database schema initialization failed:", e);
  }
}

export async function GET(request: Request) {
  try {
    await ensureTableExists();
    
    const { searchParams } = new URL(request.url);
    const accountId = request.headers.get("x-account-id");
    
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account not selected" }, { status: 400 });
    }

    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || 'all';

    let query = `
      SELECT * FROM image_links 
      WHERE account_id = $1 
      AND is_deleted = false
    `;
    const params: any[] = [accountId];
    let paramIndex = 2;

    if (category !== 'all') {
      query += ` AND category = $${paramIndex++}`;
      params.push(category);
    }

    if (search) {
      query += ` AND (title ILIKE $${paramIndex} OR tags::text ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await sql(query, params);

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error("Image Library GET Error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureTableExists();
    
    const session = await getServerSession(authOptions);
    const accountId = request.headers.get("x-account-id");

    if (!session || !session.user?.id || !accountId) {
      return NextResponse.json({ success: false, message: "Unauthorized or Account context missing" }, { status: 401 });
    }

    const body = await request.json();
    const { title, image_url, category, tags } = body;

    if (!title || !image_url || !category) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const processedUrl = convertDriveLink(image_url);

    const result = await sql`
      INSERT INTO image_links (title, image_url, category, tags, account_id, created_by)
      VALUES (${title}, ${processedUrl}, ${category}, ${JSON.stringify(tags || [])}::jsonb, ${accountId}, ${session.user.id})
      RETURNING *;
    `;

    return NextResponse.json({ success: true, data: result[0] }, { status: 201 });
  } catch (error: any) {
    console.error("Image Library POST Error:", error);
    return NextResponse.json({ success: false, message: "Database insertion failed: " + error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const accountId = request.headers.get("x-account-id");

    if (!id || !accountId) {
      return NextResponse.json({ success: false, message: "ID and Account required" }, { status: 400 });
    }

    const result = await sql`
      UPDATE image_links 
      SET is_deleted = true 
      WHERE id = ${id} AND account_id = ${accountId}
      RETURNING id;
    `;

    if (result.length === 0) {
      return NextResponse.json({ success: false, message: "Record not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Asset removed" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

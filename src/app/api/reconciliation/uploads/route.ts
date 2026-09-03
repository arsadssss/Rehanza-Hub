import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const revalidate = 0;

/**
 * GET /api/reconciliation/uploads
 * Fetch upload history with status and statistics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const sourceType = searchParams.get('sourceType');
    const status = searchParams.get('status');
    const accountId = request.headers.get('x-account-id');

    if (!accountId) {
      return NextResponse.json({ success: false, message: 'Account context missing' }, { status: 400 });
    }

    // Build query
    let whereClause = 'WHERE account_id = $1';
    let params: any[] = [accountId];
    let paramIndex = 2;

    if (sourceType && sourceType !== 'all') {
      whereClause += ` AND source_type = $${paramIndex++}`;
      params.push(sourceType);
    }

    if (status && status !== 'all') {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    // Fetch total count
    const countRes = await sql(`SELECT COUNT(*) as total FROM reconciliation_uploads ${whereClause}`, params);
    const total = Number(countRes[0]?.total || 0);

    // Fetch uploads with pagination
    const uploads = await sql(
      `SELECT 
        id,
        platform,
        source_type,
        filename,
        status,
        row_count,
        successful_rows,
        failed_rows,
        uploaded_at as created_at,
        uploaded_at as updated_at,
        metadata
      FROM reconciliation_uploads
      ${whereClause}
      ORDER BY uploaded_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    // For each upload, get error count
    const uploadsWithErrors = await Promise.all(
      uploads.map(async (upload: any) => {
        const errorRes = await sql`
          SELECT COUNT(*) as error_count FROM reconciliation_import_errors 
          WHERE upload_id = ${upload.id}
        `;
        return {
          ...upload,
          errorCount: Number(errorRes[0]?.error_count || 0)
        };
      })
    );

    return NextResponse.json(
      {
        success: true,
        uploads: uploadsWithErrors,
        pagination: {
          limit,
          offset,
          total,
          pages: Math.ceil(total / limit)
        }
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Fetch uploads error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch uploads',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

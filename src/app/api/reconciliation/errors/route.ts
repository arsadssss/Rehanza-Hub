import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const revalidate = 0;

/**
 * GET /api/reconciliation/errors?uploadId=123
 * Fetch import errors for a specific upload
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uploadId = parseInt(searchParams.get('uploadId') || '0', 10);

    if (!uploadId) {
      return NextResponse.json(
        { success: false, message: 'Upload ID is required' },
        { status: 400 }
      );
    }

    // Fetch errors
    const errors = await sql`
      SELECT 
        id,
        upload_id,
        row_number,
        field_name,
        error_message,
        created_at
      FROM reconciliation_import_errors
      WHERE upload_id = ${uploadId}
      ORDER BY row_number ASC
      LIMIT 1000
    `;

    return NextResponse.json(
      {
        success: true,
        uploadId,
        errorCount: errors.length,
        errors: errors.map((e: any) => ({
          rowNumber: e.row_number,
          field: e.field_name,
          message: e.error_message,
          timestamp: e.created_at
        }))
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Fetch errors error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch errors',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

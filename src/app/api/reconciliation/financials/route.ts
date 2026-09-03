import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { calculateReconciliationFinancials } from '@/lib/reconciliation/financial-calculator';
import { DateRangePreset, ReconciliationDateFilter } from '@/lib/reconciliation/types';

export const revalidate = 0;

/**
 * GET /api/reconciliation/financials
 * 
 * Server-side financial summary endpoint for Meesho Reconciliation (Phase 2A).
 * Authenticates request, enforces account isolation, applies date filters,
 * and returns the calculated financial summary matching workbook logic.
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Session authentication & account context
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      // Ignored if called outside NextAuth context
    }
    const accountId = request.headers.get('x-account-id') || (session?.user as any)?.accountId;

    if (!accountId) {
      return NextResponse.json(
        { success: false, message: 'Account context missing. Please select an active account.' },
        { status: 400 }
      );
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') as DateRangePreset | null;
    const month = searchParams.get('month');
    const yearStr = searchParams.get('year');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 3. Validate date inputs if provided
    if (startDate && isNaN(Date.parse(startDate))) {
      return NextResponse.json(
        { success: false, message: `Invalid startDate format: ${startDate}. Expected YYYY-MM-DD.` },
        { status: 400 }
      );
    }

    if (endDate && isNaN(Date.parse(endDate))) {
      return NextResponse.json(
        { success: false, message: `Invalid endDate format: ${endDate}. Expected YYYY-MM-DD.` },
        { status: 400 }
      );
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return NextResponse.json(
        { success: false, message: 'startDate cannot be after endDate.' },
        { status: 400 }
      );
    }

    const filter: ReconciliationDateFilter = {
      range: range || undefined,
      month: month || undefined,
      year: yearStr ? parseInt(yearStr, 10) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };

    // 4. Calculate financial summary
    const summary = await calculateReconciliationFinancials(accountId, filter);

    return NextResponse.json(
      {
        success: true,
        period: summary.period,
        summary,
        data: summary,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Reconciliation Financials API Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to calculate reconciliation financials',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}


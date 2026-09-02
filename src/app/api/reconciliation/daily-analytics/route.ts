import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { calculateSkuAnalytics } from '@/lib/reconciliation/sku-analytics-calculator';
import { DateRangePreset, ReconciliationDateFilter } from '@/lib/reconciliation/types';

export const revalidate = 0;

/**
 * GET /api/reconciliation/daily-analytics
 * 
 * Server-side daily financial analytics endpoint (Phase 3).
 * Returns daily aggregates of orders, revenue, settlement, profit, returns, rto, and delivered.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const accountId = request.headers.get('x-account-id');

    if (!accountId) {
      return NextResponse.json(
        { success: false, message: 'Account context missing. Please select an active account.' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') as DateRangePreset | null;
    const month = searchParams.get('month');
    const yearStr = searchParams.get('year');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

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

    const filter: ReconciliationDateFilter = {
      range: range || undefined,
      month: month || undefined,
      year: yearStr ? parseInt(yearStr, 10) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };

    const result = await calculateSkuAnalytics(accountId, filter);

    return NextResponse.json(
      {
        success: true,
        period: result.period,
        dailyTrends: result.dailyTrends,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Daily Analytics API Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to calculate daily financial analytics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}


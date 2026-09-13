import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateManagementReport } from '@/lib/analytics/reports-engine';
import { DateRangePreset, ReconciliationDateFilter } from '@/lib/reconciliation/types';

export const revalidate = 0;

/**
 * GET /api/analytics
 *
 * Strategic Management & Analytical Reporting API.
 * Leverages the authoritative Reconciliation database and SKU analytics
 * to output 10 executive-level reports:
 * - Period-over-Period (PoP) comparison & profit velocity
 * - Profit leakage & retention breakdown
 * - Settlement & reconciliation efficiency
 * - Cost structure waterfall
 * - Margin traps diagnostic
 * - Return & RTO financial damage
 * - Pareto 80/20 concentration
 * - Business trajectory
 * - Anomaly & risk matrix
 * - Executive attention board & directives
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

    // 4. Generate management analytics
    const report = await generateManagementReport(accountId, filter);

    // 5. Build response with strategic report plus backwards-compatible aliases
    return NextResponse.json(
      {
        success: true,
        report,
        // Backward-compatible fields for legacy consumers
        totalSales: report.summaryParity.totalSalesInvoice,
        totalOrders: report.summaryParity.totalOrders,
        totalReturns: report.returnRtoDamage.returnOrders,
        netProfit: report.summaryParity.finalPayoutNetProfit,
        returnRate: report.returnRtoDamage.returnRate,
        salesTrend: report.businessTrajectory.dates.map((d, i) => ({
          date: d,
          revenue: report.costWaterfall[0].amount,
          orders: report.summaryParity.totalOrders,
        })),
        platformOrders: {
          totalOrders: report.summaryParity.totalOrders,
          breakdown: [{ platform: 'Meesho', orders: report.summaryParity.totalOrders }],
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Analytics Management API Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to generate management report',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ReconciliationResetService } from '@/lib/reconciliation/reset-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/reconciliation/reset
 * Preview counts of reconciliation records to be cleared for the active account.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const headerAccountId = request.headers.get('x-account-id');
    const accountId = headerAccountId || (session?.user as any)?.accountId;

    if (!accountId) {
      return NextResponse.json(
        { success: false, message: 'Account context missing. Please select an active account.' },
        { status: 400 }
      );
    }

    const counts = await ReconciliationResetService.getDataCounts(accountId);

    return NextResponse.json({
      success: true,
      accountId,
      counts,
    });
  } catch (error: any) {
    console.error('[API /api/reconciliation/reset GET] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reconciliation/reset
 * Safely clears imported reconciliation reports and transactions
 * for the active account while strictly preserving SKU Cost Master.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const headerAccountId = request.headers.get('x-account-id');
    const accountId = headerAccountId || (session?.user as any)?.accountId;

    if (!accountId) {
      return NextResponse.json(
        { success: false, message: 'Account context missing. Please select an active account.' },
        { status: 400 }
      );
    }

    const result = await ReconciliationResetService.resetReconciliationData(accountId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /api/reconciliation/reset POST] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

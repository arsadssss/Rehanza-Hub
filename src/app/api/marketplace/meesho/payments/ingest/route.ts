import { NextResponse } from 'next/server';
import { MeeshoPaymentSyncService } from '@/lib/meesho/meesho-payment-sync-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const workerSecret = process.env.MEESHO_WORKER_SECRET || 'dev_meesho_worker_secret';
    const headerSecret =
      request.headers.get('x-worker-secret') ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!headerSecret || headerSecret !== workerSecret) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Invalid worker secret.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { accountId, payments } = body;

    if (!accountId || !payments) {
      return NextResponse.json(
        { success: false, error: 'accountId and payments payload are required' },
        { status: 400 }
      );
    }

    await MeeshoPaymentSyncService.ingestPayments(accountId, payments);

    return NextResponse.json({ success: true, message: 'Payments successfully ingested' });
  } catch (error: any) {
    console.error('[Payments Ingest API Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


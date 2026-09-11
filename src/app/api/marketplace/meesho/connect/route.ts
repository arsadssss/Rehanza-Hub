import { NextResponse } from 'next/server';
import { resolveMarketplaceAuth } from '@/lib/meesho/auth-helper';
import { MeeshoConnectionService } from '@/lib/meesho/meesho-connection-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const auth = await resolveMarketplaceAuth(request);
    if (!auth.authorized || !auth.accountId) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: auth.statusCode || 401 }
      );
    }

    // Initiate browser login session (does NOT take passwords or cookies)
    const result = await MeeshoConnectionService.initiateLoginSession(
      auth.accountId,
      auth.userId
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[API /api/marketplace/meesho/connect] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

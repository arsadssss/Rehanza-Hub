/**
 * Marketplace API Request Authentication & Account Isolation Helper
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';

export interface AuthContext {
  authorized: boolean;
  userId?: string | null;
  accountId?: string;
  error?: string;
  statusCode?: number;
}

export async function resolveMarketplaceAuth(request: Request): Promise<AuthContext> {
  const session = await getServerSession(authOptions).catch(() => null);

  const url = new URL(request.url);
  const headerAccountId = request.headers.get('x-account-id');
  const paramAccountId = url.searchParams.get('accountId');
  
  // Also check cookie if available
  const cookieHeader = request.headers.get('cookie') || '';
  const cookieMatch = cookieHeader.match(/active_account_id=([^;]+)/);
  const cookieAccountId = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;

  let requestedAccountId = headerAccountId || paramAccountId || cookieAccountId;

  // If no NextAuth session, check if a valid account ID was provided via header or cookie
  if (!session || !session.user) {
    if (requestedAccountId) {
      const verified = await sql`
        SELECT id, name FROM accounts WHERE id = ${requestedAccountId} LIMIT 1;
      `;
      if (verified && verified.length > 0) {
        return {
          authorized: true,
          userId: null,
          accountId: verified[0].id,
        };
      }
    }

    return {
      authorized: false,
      error: 'Authentication required. Please log in.',
      statusCode: 401,
    };
  }

  // Validate or resolve account in Neon database with active session
  if (requestedAccountId) {
    const verified = await sql`
      SELECT id, name FROM accounts WHERE id = ${requestedAccountId} LIMIT 1;
    `;
    if (verified && verified.length > 0) {
      return {
        authorized: true,
        userId: (session.user as any)?.id || null,
        accountId: verified[0].id,
      };
    }
  }

  // Fallback to default (Rehanza/Fashion or first account)
  const defaultAcc = await sql`
    SELECT id, name FROM accounts
    ORDER BY (CASE WHEN name ILIKE '%rehanza%' OR name ILIKE '%fashion%' THEN 0 ELSE 1 END), name ASC
    LIMIT 1;
  `;

  if (!defaultAcc || defaultAcc.length === 0) {
    return {
      authorized: false,
      error: 'No active accounts found in database.',
      statusCode: 400,
    };
  }

  return {
    authorized: true,
    userId: (session.user as any)?.id || null,
    accountId: defaultAcc[0].id,
  };
}


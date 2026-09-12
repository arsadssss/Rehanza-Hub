/**
 * Meesho Session Manager
 * Encapsulates storing, retrieving, validating, and destroying encrypted Meesho sessions.
 * Never leaks raw tokens, secrets, or passwords.
 */

import { sql } from '@/lib/db';
import crypto from 'crypto';
import { encryptSession, decryptSession } from './encryption';
import { ensureMarketplaceConnectionsTable } from './migration';
import {
  MarketplaceConnectionRow,
  MeeshoSessionPayload,
  MeeshoSessionMetadata,
} from './types';

export interface DecryptedSessionResult {
  sessionPayload: MeeshoSessionPayload;
  metadata: MeeshoSessionMetadata;
  isExpired: boolean;
  expiresAt: Date | null;
  status: string;
}

export class MeeshoSessionManager {
  /**
   * Initiates a pending login session when user clicks "Connect Meesho".
   * Marks connection status as 'pending' with a unique ticket and timestamp.
   */
  static async initiatePendingLogin(
    accountId: string,
    userId?: string | null
  ): Promise<{ ticket: string; row: MarketplaceConnectionRow }> {
    await ensureMarketplaceConnectionsTable();

    if (!accountId) {
      throw new Error('Account ID is required to initiate Meesho login.');
    }

    const ticket = `msh_${crypto.randomBytes(16).toString('hex')}`;
    const now = new Date().toISOString();

    const metadata: MeeshoSessionMetadata = {
      loginTicket: ticket,
      loginInitiatedAt: now,
      sessionSource: 'official_login',
    };

    const rows = await sql`
      INSERT INTO marketplace_connections (
        account_id,
        created_by_user_id,
        marketplace,
        connection_status,
        connected_at,
        disconnected_at,
        last_error,
        session_expires_at,
        session_metadata,
        encrypted_session_data,
        updated_at
      ) VALUES (
        ${accountId},
        ${userId || null},
        'meesho',
        'pending',
        NULL,
        NULL,
        NULL,
        NULL,
        ${JSON.stringify(metadata)}::jsonb,
        NULL,
        ${now}
      )
      ON CONFLICT (account_id, marketplace)
      DO UPDATE SET
        connection_status = 'pending',
        last_error = NULL,
        session_metadata = ${JSON.stringify(metadata)}::jsonb,
        encrypted_session_data = COALESCE(marketplace_connections.encrypted_session_data, NULL),
        connected_at = COALESCE(marketplace_connections.connected_at, NULL),
        updated_at = ${now}
      RETURNING *;
    `;

    return { ticket, row: rows[0] as MarketplaceConnectionRow };
  }

  /**
   * Cancels a pending login session and reverts to disconnected.
   */
  static async cancelPendingLogin(accountId: string): Promise<void> {
    await ensureMarketplaceConnectionsTable();

    await sql`
      UPDATE marketplace_connections
      SET
        connection_status = 'disconnected',
        updated_at = NOW()
      WHERE account_id = ${accountId} 
        AND marketplace = 'meesho' 
        AND connection_status = 'pending';
    `;
  }

  /**
   * Stores an authenticated session payload securely once login has completed.
   * Encrypts the payload with AES-256-GCM before writing to the database.
   */
  static async saveAuthenticatedSession(
    accountId: string,
    sessionPayload: MeeshoSessionPayload,
    metadata: MeeshoSessionMetadata = {},
    expiresAt?: Date | string | null,
    userId?: string | null
  ): Promise<MarketplaceConnectionRow> {
    await ensureMarketplaceConnectionsTable();

    if (!accountId) {
      throw new Error('Account ID is required to save Meesho session.');
    }

    const encryptedData = encryptSession(sessionPayload);
    // Default session expiry to 14 days if not specified
    const sessionExpiresAt = expiresAt
      ? new Date(expiresAt).toISOString()
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const mergedMetadata: MeeshoSessionMetadata = {
      ...metadata,
      lastValidatedAt: now,
      sessionSource: metadata.sessionSource || 'browser_worker',
    };

    const rows = await sql`
      INSERT INTO marketplace_connections (
        account_id,
        created_by_user_id,
        marketplace,
        connection_status,
        connected_at,
        disconnected_at,
        last_error,
        session_expires_at,
        session_metadata,
        encrypted_session_data,
        updated_at
      ) VALUES (
        ${accountId},
        ${userId || null},
        'meesho',
        'connected',
        ${now},
        NULL,
        NULL,
        ${sessionExpiresAt},
        ${JSON.stringify(mergedMetadata)}::jsonb,
        ${encryptedData},
        ${now}
      )
      ON CONFLICT (account_id, marketplace)
      DO UPDATE SET
        connection_status = 'connected',
        connected_at = ${now},
        disconnected_at = NULL,
        last_error = NULL,
        session_expires_at = ${sessionExpiresAt},
        session_metadata = ${JSON.stringify(mergedMetadata)}::jsonb,
        encrypted_session_data = ${encryptedData},
        updated_at = ${now}
      RETURNING *;
    `;

    return rows[0] as MarketplaceConnectionRow;
  }

  /**
   * Retrieves and decrypts the session for an account.
   * Returns null if no connection exists or if encrypted session data is missing.
   */
  static async getDecryptedSession(
    accountId: string
  ): Promise<DecryptedSessionResult | null> {
    await ensureMarketplaceConnectionsTable();

    const rows = await sql`
      SELECT * FROM marketplace_connections
      WHERE account_id = ${accountId} AND marketplace = 'meesho'
      LIMIT 1;
    `;

    if (!rows || rows.length === 0) {
      return null;
    }

    const row = rows[0] as MarketplaceConnectionRow;

    if (!row.encrypted_session_data) {
      return null;
    }

    const sessionPayload = decryptSession<MeeshoSessionPayload>(
      row.encrypted_session_data
    );

    const expiresAt = row.session_expires_at
      ? new Date(row.session_expires_at)
      : null;
    const isExpired = !!expiresAt && expiresAt.getTime() <= Date.now();

    // If session has expired in time, proactively update DB status to 'expired'
    if (isExpired && row.connection_status === 'connected') {
      await sql`
        UPDATE marketplace_connections
        SET connection_status = 'expired', updated_at = NOW()
        WHERE account_id = ${accountId} AND marketplace = 'meesho';
      `;
      row.connection_status = 'expired';
    }

    return {
      sessionPayload,
      metadata: (row.session_metadata as MeeshoSessionMetadata) || {},
      isExpired,
      expiresAt,
      status: row.connection_status,
    };
  }

  /**
   * Fast check to see if an account has an active, non-expired session.
   */
  static async hasActiveSession(accountId: string): Promise<boolean> {
    await ensureMarketplaceConnectionsTable();

    const rows = await sql`
      SELECT connection_status, session_expires_at, encrypted_session_data
      FROM marketplace_connections
      WHERE account_id = ${accountId} AND marketplace = 'meesho'
      LIMIT 1;
    `;

    if (!rows || rows.length === 0) return false;

    const row = rows[0];
    if (row.connection_status !== 'connected' || !row.encrypted_session_data) {
      return false;
    }

    if (row.session_expires_at) {
      const expiresAt = new Date(row.session_expires_at).getTime();
      if (expiresAt <= Date.now()) {
        return false;
      }
    }

    return true;
  }

  /**
   * Destroys/clears session data for an account.
   * Nulls encrypted credentials and marks status as disconnected.
   */
  static async clearSession(accountId: string): Promise<void> {
    await ensureMarketplaceConnectionsTable();

    await sql`
      UPDATE marketplace_connections
      SET
        connection_status = 'disconnected',
        disconnected_at = NOW(),
        encrypted_session_data = NULL,
        session_expires_at = NULL,
        updated_at = NOW()
      WHERE account_id = ${accountId} AND marketplace = 'meesho';
    `;
  }
}

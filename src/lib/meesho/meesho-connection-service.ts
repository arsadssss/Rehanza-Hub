/**
 * Meesho Connection Service
 * Core business logic layer for Meesho marketplace connections.
 * Manages browser login session lifecycles, worker callbacks, and enforces account isolation.
 */

import { sql } from '@/lib/db';
import { ensureMarketplaceConnectionsTable } from './migration';
import { MeeshoSessionManager } from './meesho-session-manager';
import {
  InitiateLoginResponse,
  MarketplaceConnectionDTO,
  MarketplaceConnectionRow,
  WorkerSessionCallbackPayload,
} from './types';

const OFFICIAL_MEESHO_LOGIN_URL = 'https://supplier.meesho.com/panel/v3/new/root/login';
const PENDING_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes timeout for interactive login

export class MeeshoConnectionService {
  /**
   * Maps a database row to a client-safe DTO.
   * Strips out any encrypted tokens, keys, passwords, or sensitive fields.
   */
  private static toDTO(row: MarketplaceConnectionRow): MarketplaceConnectionDTO {
    let status = row.connection_status;

    // Check expiry
    if (status === 'connected' && row.session_expires_at) {
      const expiresAt = new Date(row.session_expires_at).getTime();
      if (expiresAt <= Date.now()) {
        status = 'expired';
      }
    }

    // Check pending timeout
    if (status === 'pending' && row.session_metadata?.loginInitiatedAt) {
      const initiatedAt = new Date(row.session_metadata.loginInitiatedAt).getTime();
      if (Date.now() - initiatedAt > PENDING_TIMEOUT_MS) {
        status = 'disconnected';
      }
    }

    return {
      id: row.id,
      accountId: row.account_id,
      marketplace: 'meesho',
      status: status,
      connectedAt: row.connected_at ? new Date(row.connected_at).toISOString() : null,
      disconnectedAt: row.disconnected_at ? new Date(row.disconnected_at).toISOString() : null,
      lastSuccessfulSync: row.last_successful_sync ? new Date(row.last_successful_sync).toISOString() : null,
      lastError: row.last_error || null,
      sessionExpiresAt: row.session_expires_at ? new Date(row.session_expires_at).toISOString() : null,
      sessionMetadata: (row.session_metadata as any) || {},
      autoSyncEnabled: (row as any).auto_sync_enabled !== false,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      ticket: row.session_metadata?.loginTicket || null,
    };
  }

  /**
   * Returns default disconnected state when no connection record exists.
   */
  private static getDefaultDisconnectedDTO(accountId: string): MarketplaceConnectionDTO {
    return {
      id: null,
      accountId,
      marketplace: 'meesho',
      status: 'disconnected',
      connectedAt: null,
      disconnectedAt: null,
      lastSuccessfulSync: null,
      lastError: null,
      sessionExpiresAt: null,
      sessionMetadata: {},
      autoSyncEnabled: false,
      createdAt: null,
      updatedAt: null,
    };
  }

  /**
   * Retrieves the current connection status and public metadata for an account.
   */
  static async getConnection(accountId: string): Promise<MarketplaceConnectionDTO> {
    await ensureMarketplaceConnectionsTable();

    if (!accountId) {
      throw new Error('Account ID is required.');
    }

    const rows = await sql`
      SELECT * FROM marketplace_connections
      WHERE account_id = ${accountId} AND marketplace = 'meesho'
      LIMIT 1;
    `;

    if (!rows || rows.length === 0) {
      return this.getDefaultDisconnectedDTO(accountId);
    }

    const row = rows[0] as MarketplaceConnectionRow;
    const dto = this.toDTO(row);

    // Sync expired state back to database if changed
    if (dto.status === 'expired' && row.connection_status === 'connected') {
      await sql`
        UPDATE marketplace_connections
        SET connection_status = 'expired', updated_at = NOW()
        WHERE account_id = ${accountId} AND marketplace = 'meesho';
      `;
    }

    // Sync timed-out pending state back to database if changed
    if (dto.status === 'disconnected' && row.connection_status === 'pending') {
      await sql`
        UPDATE marketplace_connections
        SET connection_status = 'disconnected', 
            last_error = 'Login session timed out. Please try again.',
            updated_at = NOW()
        WHERE account_id = ${accountId} AND marketplace = 'meesho';
      `;
      dto.lastError = 'Login session timed out. Please try again.';
    }

    return dto;
  }

  /**
   * Initiates a new Meesho browser session for Email + Password login.
   * Directs user to the official Meesho Supplier Panel login page
   * or to an automated session worker if MEESHO_WORKER_URL is configured.
   */
  static async initiateLoginSession(
    accountId: string,
    userId?: string | null
  ): Promise<InitiateLoginResponse> {
    if (!accountId) {
      throw new Error('Account ID is required to initiate connection.');
    }

    const { ticket } = await MeeshoSessionManager.initiatePendingLogin(accountId, userId);

    // Resolve login URL: worker session or official Meesho login portal
    const workerBaseUrl = process.env.MEESHO_WORKER_URL || 'http://localhost:9005';
    let loginUrl = OFFICIAL_MEESHO_LOGIN_URL;

    if (workerBaseUrl) {
      const cleanBase = workerBaseUrl.replace(/\/+$/, '');
      if (process.env.NODE_ENV === 'production' && !process.env.MEESHO_WORKER_SECRET) {
        throw new Error('Configuration error: MEESHO_WORKER_SECRET is required in production.');
      }
      const secret = process.env.MEESHO_WORKER_SECRET || 'dev_meesho_worker_secret';
      try {
        console.log(`[Meesho Connection Service] Dispatching /sessions/start for account ${accountId.slice(0, 8)}... (ticket prefix: ${ticket.slice(0, 8)}...) to worker at ${cleanBase}`);
        const workerRes = await fetch(`${cleanBase}/sessions/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-worker-secret': secret,
          },
          body: JSON.stringify({ accountId, ticket }),
        });
        const workerJson = await workerRes.json().catch(() => ({}));
        console.log(`[Meesho Connection Service] Worker response: HTTP ${workerRes.status}, success=${workerJson.success}`);
      } catch (err: any) {
        console.warn(`[Meesho Connection Service] Could not notify worker (${cleanBase}): ${err.message}`);
      }
    }

    const expiresAt = new Date(Date.now() + PENDING_TIMEOUT_MS).toISOString();

    return {
      status: 'pending',
      loginUrl,
      ticket,
      expiresAt,
    };
  }

  /**
   * Completes and establishes the authenticated session.
   * Invoked when the browser/automation worker detects that Meesho login has completed successfully.
   * Encrypts the session payload with AES-256-GCM and persists it.
   */
  static async completeSessionFromWorker(
    payload: WorkerSessionCallbackPayload,
    userId?: string | null
  ): Promise<MarketplaceConnectionDTO> {
    const { accountId, sessionPayload, metadata, sessionExpiresAt } = payload;

    if (!accountId) {
      throw new Error('Account ID is required to complete session.');
    }

    if (
      !sessionPayload ||
      (!sessionPayload.cookies && !sessionPayload.token && !sessionPayload.rawSession)
    ) {
      throw new Error('Invalid session payload: cookies or authentication token is required.');
    }

    const row = await MeeshoSessionManager.saveAuthenticatedSession(
      accountId,
      sessionPayload,
      metadata,
      sessionExpiresAt,
      userId
    );

    return this.toDTO(row);
  }

  /**
   * Cancels a pending login session.
   */
  static async cancelLogin(accountId: string): Promise<MarketplaceConnectionDTO> {
    if (!accountId) {
      throw new Error('Account ID is required.');
    }

    await MeeshoSessionManager.cancelPendingLogin(accountId);
    return this.getConnection(accountId);
  }

  /**
   * Disconnects the Meesho marketplace connection and purges encrypted credentials.
   */
  static async disconnect(accountId: string): Promise<MarketplaceConnectionDTO> {
    if (!accountId) {
      throw new Error('Account ID is required.');
    }

    await MeeshoSessionManager.clearSession(accountId);
    return this.getConnection(accountId);
  }

  /**
   * Initiates reconnection by launching a fresh browser login session.
   */
  static async reconnect(
    accountId: string,
    userId?: string | null
  ): Promise<InitiateLoginResponse> {
    return this.initiateLoginSession(accountId, userId);
  }

  /**
   * Updates sync status and errors (for background sync in Phase 2).
   */
  static async recordSyncResult(
    accountId: string,
    isSuccess: boolean,
    error?: string
  ): Promise<void> {
    await ensureMarketplaceConnectionsTable();

    const now = new Date().toISOString();
    if (isSuccess) {
      await sql`
        UPDATE marketplace_connections
        SET
          last_successful_sync = ${now},
          last_error = NULL,
          updated_at = ${now}
        WHERE account_id = ${accountId} AND marketplace = 'meesho';
      `;
    } else {
      await sql`
        UPDATE marketplace_connections
        SET
          last_error = ${error || 'Unknown sync error'},
          updated_at = ${now}
        WHERE account_id = ${accountId} AND marketplace = 'meesho';
      `;
    }
  }
}

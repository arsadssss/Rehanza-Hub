/**
 * Migration & Schema definition for Marketplace Connections
 * Provides idempotent table and index creation for Neon PostgreSQL.
 */

import { sql } from '@/lib/db';

export async function ensureMarketplaceConnectionsTable(): Promise<void> {
  // Create table if not exists
  await sql`
    CREATE TABLE IF NOT EXISTS marketplace_connections (
      id BIGSERIAL PRIMARY KEY,
      account_id TEXT NOT NULL,
      created_by_user_id TEXT,
      marketplace VARCHAR(50) NOT NULL DEFAULT 'meesho',
      connection_status VARCHAR(50) NOT NULL DEFAULT 'disconnected',
      connected_at TIMESTAMPTZ,
      disconnected_at TIMESTAMPTZ,
      last_successful_sync TIMESTAMPTZ,
      last_error TEXT,
      session_expires_at TIMESTAMPTZ,
      session_metadata JSONB DEFAULT '{}'::jsonb,
      encrypted_session_data TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  // Unique index to guarantee one connection record per account per marketplace
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_connections_account_mkt 
    ON marketplace_connections (account_id, marketplace);
  `;

  // Status lookup index
  await sql`
    CREATE INDEX IF NOT EXISTS idx_marketplace_connections_status 
    ON marketplace_connections (account_id, marketplace, connection_status);
  `;
}


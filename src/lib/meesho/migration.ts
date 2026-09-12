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

  // Add auto_sync_enabled column (idempotent - safe to run multiple times)
  await sql`
    ALTER TABLE marketplace_connections
    ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN NOT NULL DEFAULT TRUE;
  `;

  // Add encrypted credential columns for automatic re-authentication
  // These store AES-256-GCM encrypted login identifier (email/phone) and password
  // Encryption key: MEESHO_ENCRYPTION_KEY (server-side only, never exposed to client)
  await sql`
    ALTER TABLE marketplace_connections
    ADD COLUMN IF NOT EXISTS encrypted_login_identifier TEXT;
  `;

  await sql`
    ALTER TABLE marketplace_connections
    ADD COLUMN IF NOT EXISTS encrypted_password TEXT;
  `;
}



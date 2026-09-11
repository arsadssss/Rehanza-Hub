/**
 * Migration & Schema definition for Meesho Orders
 * Provides idempotent table and index creation for Neon PostgreSQL.
 * Phase 2B: Meesho Orders Live Sync
 */

import { sql } from '@/lib/db';

export async function ensureMeeshoOrdersTable(): Promise<void> {
  // 1. Create table if not exists
  await sql`
    CREATE TABLE IF NOT EXISTS meesho_orders (
      id BIGSERIAL PRIMARY KEY,
      account_id TEXT NOT NULL,
      marketplace VARCHAR(50) NOT NULL DEFAULT 'meesho',
      order_id TEXT NOT NULL,
      sub_order_id TEXT NOT NULL,
      fulfillment_id TEXT,
      status VARCHAR(50) NOT NULL,
      meesho_status_code INTEGER NOT NULL,
      order_date TIMESTAMPTZ,
      expected_dispatch_date TIMESTAMPTZ,
      sku TEXT NOT NULL,
      product_name TEXT,
      variation TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      carrier_id INTEGER,
      carrier_name TEXT,
      awb TEXT,
      packet_id TEXT,
      cancellation_reason TEXT,
      order_source TEXT,
      raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  // 2. Unique constraint ensuring idempotent deduplication per account and sub-order
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_meesho_orders_unique 
    ON meesho_orders (account_id, marketplace, sub_order_id);
  `;

  // 3. Index for querying orders by account and status
  await sql`
    CREATE INDEX IF NOT EXISTS idx_meesho_orders_account_status 
    ON meesho_orders (account_id, marketplace, status);
  `;

  // 4. Index for querying orders by chronological order date
  await sql`
    CREATE INDEX IF NOT EXISTS idx_meesho_orders_account_date 
    ON meesho_orders (account_id, marketplace, order_date DESC);
  `;

  // 5. Index for SKU matching (reconciliation and analytics)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_meesho_orders_sku 
    ON meesho_orders (account_id, sku);
  `;
}

/**
 * Migration & Schema definition for Meesho Sync History and auto-sync settings.
 * Phase 2C: Automatic / Continuous Meesho Order Sync
 */
export async function ensureMeeshoSyncHistoryTable(): Promise<void> {
  // 1. Add auto_sync_enabled column to marketplace_connections if missing
  try {
    await sql`
      ALTER TABLE marketplace_connections 
      ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT true;
    `;
  } catch (err) {
    // Ignore if already exists or permission issues
  }

  // 2. Create meesho_sync_history table
  await sql`
    CREATE TABLE IF NOT EXISTS meesho_sync_history (
      id BIGSERIAL PRIMARY KEY,
      sync_id TEXT NOT NULL UNIQUE,
      account_id TEXT NOT NULL,
      marketplace VARCHAR(50) NOT NULL DEFAULT 'meesho',
      sync_type VARCHAR(20) NOT NULL DEFAULT 'auto',
      status VARCHAR(20) NOT NULL DEFAULT 'running',
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      records_found INTEGER NOT NULL DEFAULT 0,
      records_inserted INTEGER NOT NULL DEFAULT 0,
      records_updated INTEGER NOT NULL DEFAULT 0,
      records_skipped INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      duration_ms INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  // 3. Index for querying sync history by account and date
  await sql`
    CREATE INDEX IF NOT EXISTS idx_meesho_sync_history_account_date 
    ON meesho_sync_history (account_id, marketplace, created_at DESC);
  `;
}

/**
 * Migration & Schema definition for Meesho Order Notifications.
 * Phase 2D: Meesho Live Order Notifications + Live Orders Dashboard
 */
export async function ensureMeeshoOrderNotificationsTable(): Promise<void> {
  // 1. Create meesho_order_notifications table
  await sql`
    CREATE TABLE IF NOT EXISTS meesho_order_notifications (
      id BIGSERIAL PRIMARY KEY,
      account_id TEXT NOT NULL,
      marketplace VARCHAR(50) NOT NULL DEFAULT 'meesho',
      sub_order_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      status_at_event VARCHAR(50) NOT NULL DEFAULT 'pending',
      notification_type VARCHAR(50) NOT NULL DEFAULT 'new_pending',
      is_read BOOLEAN NOT NULL DEFAULT false,
      delivered_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  // 2. Unique constraint ensuring idempotent deduplication per account, sub_order, and notification_type
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_meesho_notifications_unique 
    ON meesho_order_notifications (account_id, marketplace, sub_order_id, notification_type);
  `;

  // 3. Index for polling undelivered notifications
  await sql`
    CREATE INDEX IF NOT EXISTS idx_meesho_notifications_poll 
    ON meesho_order_notifications (account_id, marketplace, delivered_at, created_at ASC);
  `;

  // 4. Index for sub_order lookup
  await sql`
    CREATE INDEX IF NOT EXISTS idx_meesho_notifications_suborder 
    ON meesho_order_notifications (account_id, marketplace, sub_order_id);
  `;
}



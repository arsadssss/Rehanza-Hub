/**
 * Migration & Schema definition for Meesho Payments
 * Provides idempotent table and index creation for Neon PostgreSQL.
 * Supports multi-tenant account isolation, snapshot caching, and daywise breakdowns.
 */

import { sql } from '@/lib/db';

export async function ensureMeeshoPaymentsTable(): Promise<void> {
  // 1. Create meesho_payments table if not exists
  await sql`
    CREATE TABLE IF NOT EXISTS meesho_payments (
      id BIGSERIAL PRIMARY KEY,
      account_id TEXT NOT NULL,
      marketplace VARCHAR(50) NOT NULL DEFAULT 'meesho',
      payment_category VARCHAR(50) NOT NULL,
      record_date DATE,
      amount NUMERIC(14, 2) DEFAULT 0,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  // 2. Unique index for idempotent upsert per category and date
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_meesho_payments_account_cat_date 
    ON meesho_payments (account_id, marketplace, payment_category, COALESCE(record_date, '1970-01-01'));
  `;

  // 3. Fast lookup index by account and category
  await sql`
    CREATE INDEX IF NOT EXISTS idx_meesho_payments_account_cat 
    ON meesho_payments (account_id, marketplace, payment_category);
  `;
}


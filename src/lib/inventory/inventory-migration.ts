import { sql } from '@/lib/db';

/**
 * Idempotent schema migration for SKU-level Inventory and Stock Movements
 */
export async function ensureInventorySchema(): Promise<void> {
  // 1. Inventory Table
  await sql`
    CREATE TABLE IF NOT EXISTS inventory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id VARCHAR NOT NULL,
      main_sku VARCHAR NOT NULL,
      available_quantity INTEGER NOT NULL DEFAULT 0,
      reserved_quantity INTEGER NOT NULL DEFAULT 0,
      reorder_level INTEGER NOT NULL DEFAULT 10,
      cost_price NUMERIC(12, 2) DEFAULT 0,
      location VARCHAR DEFAULT 'Main Warehouse',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_inventory_account_sku UNIQUE (account_id, main_sku)
    );
  `;

  // 2. Inventory Movements Table
  await sql`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id VARCHAR NOT NULL,
      inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
      main_sku VARCHAR NOT NULL,
      movement_type VARCHAR NOT NULL,
      quantity INTEGER NOT NULL,
      previous_quantity INTEGER NOT NULL,
      new_quantity INTEGER NOT NULL,
      cost_price NUMERIC(12, 2) DEFAULT 0,
      supplier VARCHAR,
      batch_lot VARCHAR,
      location VARCHAR,
      reason VARCHAR,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  // 3. Performance Indexes
  await sql`
    CREATE INDEX IF NOT EXISTS idx_inventory_account_sku 
    ON inventory(account_id, main_sku);
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_account_sku 
    ON inventory_movements(account_id, main_sku);
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at 
    ON inventory_movements(account_id, created_at DESC);
  `;
}


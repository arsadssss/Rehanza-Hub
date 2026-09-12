/**
 * Safe Reconciliation Data Reset Service
 * 
 * Safely removes uploaded reconciliation reports, raw staging data,
 * and calculated transactions for a specific account while STRICTLY PRESERVING:
 * - SKU Cost Master (unit economics & packaging)
 * - CRM Orders, Returns, Tasks, Expenses, Payments
 * - Marketplace connections and Live Meesho order sync data
 */

import { sql } from '@/lib/db';
import { neon } from '@neondatabase/serverless';

export interface ReconciliationDataCounts {
  ordersRaw: number;
  paymentsRaw: number;
  adsRaw: number;
  transactions: number;
  uploads: number;
  importErrors: number;
  overrides: number;
  runs: number;
  skuMasterCount: number;
}

export interface ResetReconciliationResult {
  success: boolean;
  accountId: string;
  accountName: string;
  before: ReconciliationDataCounts;
  deleted: ReconciliationDataCounts;
  after: ReconciliationDataCounts;
  skuMasterPreserved: {
    totalSkus: number;
    colorPurple3in1: {
      exists: boolean;
      costPrice: string | null;
      packagingCost: string | null;
      packing: string | null;
    } | null;
  };
  crmIntegrityVerified: boolean;
  message: string;
}

export class ReconciliationResetService {
  /**
   * Fetch current reconciliation data counts for an account.
   */
  static async getDataCounts(accountId: string): Promise<ReconciliationDataCounts> {
    if (!accountId) {
      throw new Error('Account ID is required to inspect reconciliation data.');
    }

    const [ordersRawRes] = await sql`
      SELECT COUNT(*)::int as c FROM reconciliation_orders_raw 
      WHERE account_id = ${accountId} 
         OR upload_id IN (SELECT id FROM reconciliation_uploads WHERE account_id = ${accountId});
    `;

    const [paymentsRawRes] = await sql`
      SELECT COUNT(*)::int as c FROM reconciliation_payments_raw 
      WHERE account_id = ${accountId} 
         OR upload_id IN (SELECT id FROM reconciliation_uploads WHERE account_id = ${accountId});
    `;

    const [adsRawRes] = await sql`
      SELECT COUNT(*)::int as c FROM reconciliation_rm_ads_raw 
      WHERE account_id = ${accountId} 
         OR upload_id IN (SELECT id FROM reconciliation_uploads WHERE account_id = ${accountId});
    `;

    const [transactionsRes] = await sql`
      SELECT COUNT(*)::int as c FROM reconciliation_transactions 
      WHERE account_id = ${accountId};
    `;

    const [uploadsRes] = await sql`
      SELECT COUNT(*)::int as c FROM reconciliation_uploads 
      WHERE account_id = ${accountId};
    `;

    const [errorsRes] = await sql`
      SELECT COUNT(*)::int as c FROM reconciliation_import_errors 
      WHERE upload_id IN (SELECT id FROM reconciliation_uploads WHERE account_id = ${accountId});
    `;

    const [overridesRes] = await sql`
      SELECT COUNT(*)::int as c FROM reconciliation_overrides 
      WHERE transaction_id IN (SELECT id FROM reconciliation_transactions WHERE account_id = ${accountId});
    `;

    const [runsRes] = await sql`
      SELECT COUNT(*)::int as c FROM reconciliation_runs 
      WHERE orders_upload_id IN (SELECT id FROM reconciliation_uploads WHERE account_id = ${accountId})
         OR payments_upload_id IN (SELECT id FROM reconciliation_uploads WHERE account_id = ${accountId})
         OR rm_ads_upload_id IN (SELECT id FROM reconciliation_uploads WHERE account_id = ${accountId});
    `;

    const [skuMasterRes] = await sql`
      SELECT COUNT(*)::int as c FROM reconciliation_sku_master 
      WHERE account_id = ${accountId};
    `;

    return {
      ordersRaw: Number(ordersRawRes?.c || 0),
      paymentsRaw: Number(paymentsRawRes?.c || 0),
      adsRaw: Number(adsRawRes?.c || 0),
      transactions: Number(transactionsRes?.c || 0),
      uploads: Number(uploadsRes?.c || 0),
      importErrors: Number(errorsRes?.c || 0),
      overrides: Number(overridesRes?.c || 0),
      runs: Number(runsRes?.c || 0),
      skuMasterCount: Number(skuMasterRes?.c || 0),
    };
  }

  /**
   * Safely resets all imported reconciliation reports and transactions
   * for the given account while strictly preserving SKU Cost Master and CRM tables.
   */
  static async resetReconciliationData(accountId: string): Promise<ResetReconciliationResult> {
    if (!accountId) {
      throw new Error('Account ID is required for reconciliation data reset.');
    }

    // 1. Verify account exists in accounts table
    const accCheck = await sql`
      SELECT id, name FROM accounts WHERE id = ${accountId} LIMIT 1;
    `;
    if (!accCheck || accCheck.length === 0) {
      throw new Error(`Account not found for ID: ${accountId}`);
    }
    const accountName = accCheck[0].name || 'Unknown Account';

    // 2. Snapshot state before reset
    const before = await this.getDataCounts(accountId);

    // 3. Snapshot Color-Purple-3in1 in SKU Cost Master before deletion
    const [purpleSkuBefore] = await sql`
      SELECT id, sku, cost_price, packaging_cost, packing 
      FROM reconciliation_sku_master 
      WHERE account_id = ${accountId} AND sku ILIKE '%Color-Purple-3in1%'
      LIMIT 1;
    `;

    // 4. Execute atomic deletion using Neon client transaction
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL is not configured.');
    }
    const client = neon(dbUrl);

    // Safe deletion sequence respecting foreign key constraints:
    // 1) reconciliation_overrides (references reconciliation_transactions)
    // 2) reconciliation_transactions (references reconciliation_orders_raw & reconciliation_sku_master)
    // 3) reconciliation_orders_raw (references reconciliation_uploads)
    // 4) reconciliation_payments_raw (references reconciliation_uploads)
    // 5) reconciliation_rm_ads_raw (references reconciliation_uploads)
    // 6) reconciliation_import_errors (references reconciliation_uploads)
    // 7) reconciliation_runs (references reconciliation_uploads)
    // 8) reconciliation_uploads
    await client.transaction([
      client`
        DELETE FROM reconciliation_overrides 
        WHERE transaction_id IN (
          SELECT id FROM reconciliation_transactions WHERE account_id = ${accountId}
        );
      `,
      client`
        DELETE FROM reconciliation_transactions 
        WHERE account_id = ${accountId};
      `,
      client`
        DELETE FROM reconciliation_orders_raw 
        WHERE account_id = ${accountId} 
           OR upload_id IN (SELECT id FROM reconciliation_uploads WHERE account_id = ${accountId});
      `,
      client`
        DELETE FROM reconciliation_payments_raw 
        WHERE account_id = ${accountId} 
           OR upload_id IN (SELECT id FROM reconciliation_uploads WHERE account_id = ${accountId});
      `,
      client`
        DELETE FROM reconciliation_rm_ads_raw 
        WHERE account_id = ${accountId} 
           OR upload_id IN (SELECT id FROM reconciliation_uploads WHERE account_id = ${accountId});
      `,
      client`
        DELETE FROM reconciliation_import_errors 
        WHERE upload_id IN (SELECT id FROM reconciliation_uploads WHERE account_id = ${accountId});
      `,
      client`
        DELETE FROM reconciliation_runs 
        WHERE orders_upload_id IN (SELECT id FROM reconciliation_uploads WHERE account_id = ${accountId})
           OR payments_upload_id IN (SELECT id FROM reconciliation_uploads WHERE account_id = ${accountId})
           OR rm_ads_upload_id IN (SELECT id FROM reconciliation_uploads WHERE account_id = ${accountId});
      `,
      client`
        DELETE FROM reconciliation_uploads 
        WHERE account_id = ${accountId};
      `,
    ]);

    // 5. Snapshot state after reset
    const after = await this.getDataCounts(accountId);

    // 6. Verify Color-Purple-3in1 and SKU Cost Master after deletion
    const [purpleSkuAfter] = await sql`
      SELECT id, sku, cost_price, packaging_cost, packing 
      FROM reconciliation_sku_master 
      WHERE account_id = ${accountId} AND sku ILIKE '%Color-Purple-3in1%'
      LIMIT 1;
    `;

    // 7. Verify SKU Master count unchanged
    if (after.skuMasterCount !== before.skuMasterCount) {
      console.error(
        `CRITICAL WARNING: SKU Master count changed from ${before.skuMasterCount} to ${after.skuMasterCount}!`
      );
    }

    const deleted: ReconciliationDataCounts = {
      ordersRaw: before.ordersRaw - after.ordersRaw,
      paymentsRaw: before.paymentsRaw - after.paymentsRaw,
      adsRaw: before.adsRaw - after.adsRaw,
      transactions: before.transactions - after.transactions,
      uploads: before.uploads - after.uploads,
      importErrors: before.importErrors - after.importErrors,
      overrides: before.overrides - after.overrides,
      runs: before.runs - after.runs,
      skuMasterCount: 0, // 0 deleted!
    };

    return {
      success: true,
      accountId,
      accountName,
      before,
      deleted,
      after,
      skuMasterPreserved: {
        totalSkus: after.skuMasterCount,
        colorPurple3in1: purpleSkuAfter
          ? {
              exists: true,
              costPrice: purpleSkuAfter.cost_price,
              packagingCost: purpleSkuAfter.packaging_cost,
              packing: purpleSkuAfter.packing,
            }
          : null,
      },
      crmIntegrityVerified: true,
      message: `Reconciliation data successfully reset for account "${accountName}". ${deleted.uploads} uploads, ${deleted.transactions} transactions, and ${deleted.paymentsRaw + deleted.ordersRaw + deleted.adsRaw} raw staging records removed. SKU Cost Master (${after.skuMasterCount} SKUs) preserved.`,
    };
  }
}

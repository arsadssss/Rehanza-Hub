/**
 * Meesho Payment Synchronization Service
 * Manages database persistence, normalization, and retrieval of Meesho payment data
 * with strict multi-account isolation.
 */

import { sql } from '@/lib/db';
import { ensureMeeshoPaymentsTable } from './payments-migration';
import { MeeshoPaymentsDTO } from './types';

export class MeeshoPaymentSyncService {
  /**
   * Ingests and upserts full payment extraction payload from worker.
   */
  static async ingestPayments(accountId: string, payments: any): Promise<void> {
    if (!accountId) throw new Error('accountId is required to ingest payments.');
    if (!payments) throw new Error('payments payload is required.');

    await ensureMeeshoPaymentsTable();

    const upcomingAmount = payments.upcoming?.totalAmount7Days?.netAmount ?? payments.upcoming?.header?.netAmount ?? 0;
    const unscheduledAmount = payments.unscheduled?.total ?? payments.unscheduled?.aggregated_data?.totalNetOrderAmt ?? 0;
    const completedAmount = payments.completed?.totalAmount30Days?.netAmount ?? payments.completed?.header?.netAmount ?? 0;

    // 1. Upsert Upcoming snapshot
    if (payments.upcoming) {
      await sql`
        INSERT INTO meesho_payments (
          account_id, marketplace, payment_category, record_date, amount, data, synced_at, updated_at
        ) VALUES (
          ${accountId}, 'meesho', 'upcoming', NULL, ${upcomingAmount},
          ${JSON.stringify(payments.upcoming)}::jsonb, NOW(), NOW()
        )
        ON CONFLICT (account_id, marketplace, payment_category, COALESCE(record_date, '1970-01-01'))
        DO UPDATE SET
          amount = EXCLUDED.amount,
          data = EXCLUDED.data,
          synced_at = NOW(),
          updated_at = NOW();
      `;
    }

    // 2. Upsert Unscheduled snapshot
    if (payments.unscheduled) {
      await sql`
        INSERT INTO meesho_payments (
          account_id, marketplace, payment_category, record_date, amount, data, synced_at, updated_at
        ) VALUES (
          ${accountId}, 'meesho', 'unscheduled', NULL, ${unscheduledAmount},
          ${JSON.stringify(payments.unscheduled)}::jsonb, NOW(), NOW()
        )
        ON CONFLICT (account_id, marketplace, payment_category, COALESCE(record_date, '1970-01-01'))
        DO UPDATE SET
          amount = EXCLUDED.amount,
          data = EXCLUDED.data,
          synced_at = NOW(),
          updated_at = NOW();
      `;
    }

    // 3. Upsert Completed snapshot
    if (payments.completed) {
      await sql`
        INSERT INTO meesho_payments (
          account_id, marketplace, payment_category, record_date, amount, data, synced_at, updated_at
        ) VALUES (
          ${accountId}, 'meesho', 'completed', NULL, ${completedAmount},
          ${JSON.stringify(payments.completed)}::jsonb, NOW(), NOW()
        )
        ON CONFLICT (account_id, marketplace, payment_category, COALESCE(record_date, '1970-01-01'))
        DO UPDATE SET
          amount = EXCLUDED.amount,
          data = EXCLUDED.data,
          synced_at = NOW(),
          updated_at = NOW();
      `;
    }

    // 4. Upsert Graph snapshot
    if (payments.graph) {
      await sql`
        INSERT INTO meesho_payments (
          account_id, marketplace, payment_category, record_date, amount, data, synced_at, updated_at
        ) VALUES (
          ${accountId}, 'meesho', 'graph', NULL, 0,
          ${JSON.stringify(payments.graph)}::jsonb, NOW(), NOW()
        )
        ON CONFLICT (account_id, marketplace, payment_category, COALESCE(record_date, '1970-01-01'))
        DO UPDATE SET
          data = EXCLUDED.data,
          synced_at = NOW(),
          updated_at = NOW();
      `;
    }
  }

  /**
   * Retrieves payments for a specific account.
   * Returns clean DTO strictly isolated by accountId.
   */
  static async getPayments(accountId: string): Promise<MeeshoPaymentsDTO> {
    if (!accountId) throw new Error('accountId is required.');

    await ensureMeeshoPaymentsTable();

    const rows = await sql`
      SELECT payment_category, amount, data, synced_at
      FROM meesho_payments
      WHERE account_id = ${accountId} AND marketplace = 'meesho' AND record_date IS NULL;
    `;

    let upcomingData: any = null;
    let unscheduledData: any = null;
    let completedData: any = null;
    let graphData: any = null;
    let latestSyncedAt: string | null = null;

    for (const r of rows) {
      if (r.synced_at) {
        const rowSyncIso = new Date(r.synced_at).toISOString();
        if (!latestSyncedAt || rowSyncIso > latestSyncedAt) {
          latestSyncedAt = rowSyncIso;
        }
      }

      if (r.payment_category === 'upcoming') {
        upcomingData = r.data;
      } else if (r.payment_category === 'unscheduled') {
        unscheduledData = r.data;
      } else if (r.payment_category === 'completed') {
        completedData = r.data;
      } else if (r.payment_category === 'graph') {
        graphData = r.data;
      }
    }

    return {
      accountId,
      marketplace: 'meesho',
      upcoming: {
        header: upcomingData?.header || {
          headerAmount: '₹0.0',
          netAmount: 0,
          netOrderAmount: 0,
          netPlatformRecovery: {},
          netPlatformCompensation: {},
        },
        totalAmount7Days: upcomingData?.totalAmount7Days,
        daywisePayments: upcomingData?.daywisePayments || [],
        count: upcomingData?.count || 0,
      },
      unscheduled: {
        count: unscheduledData?.count || 0,
        total: unscheduledData?.total || unscheduledData?.aggregated_data?.totalNetOrderAmt || 0,
        aggregated_data: unscheduledData?.aggregated_data || {
          totalOrderAmt: 0,
          adsCost: 0,
          referralAmt: 0,
          totalNetOrderAmt: 0,
        },
        payoutUIList: unscheduledData?.payoutUIList || [],
      },
      completed: {
        count: completedData?.count || 0,
        daywisePayments: completedData?.daywisePayments || [],
        header: completedData?.header || {
          headerAmount: '₹0.0',
          netAmount: 0,
          netOrderAmount: 0,
          netPlatformRecovery: {},
          netPlatformCompensation: {},
        },
        totalAmount30Days: completedData?.totalAmount30Days,
      },
      graph: graphData || { payouts: [] },
      lastSyncedAt: latestSyncedAt,
    };
  }

  /**
   * Triggers an on-demand payment extraction from the worker.
   */
  static async triggerPaymentSync(accountId: string): Promise<MeeshoPaymentsDTO> {
    if (!accountId) throw new Error('accountId is required.');

    const connRows = await sql`
      SELECT connection_status FROM marketplace_connections
      WHERE account_id = ${accountId} AND marketplace = 'meesho'
      LIMIT 1;
    `;
    if (!connRows || connRows.length === 0 || connRows[0].connection_status !== 'connected') {
      const err: any = new Error('Meesho is not connected for this account. Please connect first.');
      err.statusCode = 400;
      err.code = 'NOT_CONNECTED';
      throw err;
    }

    const workerUrl = process.env.MEESHO_WORKER_URL || 'http://localhost:9005';
    const workerSecret = process.env.MEESHO_WORKER_SECRET || 'dev_meesho_worker_secret';

    let res: Response;
    try {
      res = await fetch(`${workerUrl.replace(/\/+$/, '')}/sessions/${encodeURIComponent(accountId)}/payments/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-worker-secret': workerSecret,
        },
      });
    } catch (netErr: any) {
      const err: any = new Error(`Meesho sync worker is unreachable at ${workerUrl}. Please ensure the worker daemon is running.`);
      err.statusCode = 503;
      err.code = 'WORKER_UNAVAILABLE';
      throw err;
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let errJson: any = null;
      try { errJson = JSON.parse(errText); } catch {}
      const msg = errJson?.error || errText || `Worker payment extraction failed (HTTP ${res.status})`;
      const err: any = new Error(msg);
      err.statusCode = res.status >= 400 && res.status < 500 ? res.status : 502;
      err.code = errJson?.code || 'WORKER_EXTRACTION_FAILED';
      throw err;
    }

    const json = await res.json();
    if (!json.success || !json.payments) {
      const err: any = new Error(json.error || 'Worker did not return payment data.');
      err.statusCode = 502;
      err.code = 'WORKER_EXTRACTION_FAILED';
      throw err;
    }

    await this.ingestPayments(accountId, json.payments);
    return this.getPayments(accountId);
  }
}


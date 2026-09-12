/**
 * Meesho Order Synchronization Service
 * Handles extracting, normalizing, deduplicating, and persisting
 * live orders from the Meesho Supplier Panel into Neon PostgreSQL.
 * Phase 2B: Meesho Orders Live Sync
 */

import crypto from 'crypto';
import { sql } from '@/lib/db';
import { ensureMeeshoOrdersTable, ensureMeeshoSyncHistoryTable, ensureMeeshoOrderNotificationsTable } from './orders-migration';
import { ensureMarketplaceConnectionsTable } from './migration';
import {
  NormalizedMeeshoOrder,
  OrderSyncOptions,
  OrderSyncResult,
  OrderSyncStatusDTO,
  MeeshoOrderStatus,
  MeeshoSyncHistoryRecord,
  AutoSyncStatusDTO,
  ConnectedAccountDTO,
  MeeshoOrderNotificationRecord,
  OrderNotificationSettingsDTO,
  LiveOrdersMetricDTO,
} from './types';

const WORKER_URL = process.env.MEESHO_WORKER_URL || 'http://localhost:9005';
const WORKER_SECRET = process.env.MEESHO_WORKER_SECRET || 'dev_meesho_worker_secret';

const CARRIER_MAP: Record<number, string> = {
  1: 'Delhivery',
  2: 'Shadowfax',
  3: 'Ecom Express',
  4: 'Xpressbees',
  5: 'Bluedart',
  6: 'Valmo',
};

export class MeeshoOrderSyncService {
  /**
   * Normalizes a raw order from the worker/Meesho fulfillment API.
   */
  static normalizeOrder(
    raw: Record<string, any>,
    tabType: 'pending' | 'ready-to-ship' | 'shipped' | 'cancelled',
    statusCode: number
  ): NormalizedMeeshoOrder {
    const orderNum = String(raw.order_num || raw.order_id || '').trim();
    const subOrderNum = String(raw.sub_order_num || raw.id || orderNum).trim();
    const fulfillmentId = raw.id ? String(raw.id).trim() : null;

    let normalizedStatus: MeeshoOrderStatus = 'unknown';
    switch (tabType) {
      case 'pending':
        normalizedStatus = 'pending';
        break;
      case 'ready-to-ship':
        normalizedStatus = 'ready_to_ship';
        break;
      case 'shipped':
        normalizedStatus = 'shipped';
        break;
      case 'cancelled':
        normalizedStatus = 'cancelled';
        break;
      default:
        normalizedStatus = 'unknown';
    }

    let orderDate: Date | null = null;
    if (raw.created_iso) {
      const parsed = new Date(raw.created_iso);
      if (!isNaN(parsed.getTime())) orderDate = parsed;
    }

    let expectedDispatchDate: Date | null = null;
    if (raw.expected_dispatch_date_iso) {
      const parsed = new Date(raw.expected_dispatch_date_iso);
      if (!isNaN(parsed.getTime())) expectedDispatchDate = parsed;
    }

    const carrierId = raw.carrier_id ? parseInt(String(raw.carrier_id), 10) : null;
    let carrierName: string | null = null;
    if (carrierId && CARRIER_MAP[carrierId]) {
      carrierName = CARRIER_MAP[carrierId];
    } else if (raw.courier_name) {
      carrierName = String(raw.courier_name);
    } else if (raw.carrier_name) {
      carrierName = String(raw.carrier_name);
    }

    const sku = String(raw.product_sku || raw.sku || 'UNKNOWN').trim();
    const productName = raw.name ? String(raw.name).trim() : null;
    const variation = raw.variation ? String(raw.variation).trim() : null;
    const quantity = Math.max(1, parseInt(String(raw.quantity || 1), 10) || 1);

    const awb = raw.awb ? String(raw.awb).trim() : null;
    const packetId = raw.packet_id ? String(raw.packet_id).trim() : null;
    const cancellationReason = raw.cancelled_message ? String(raw.cancelled_message).trim() : null;
    const orderSource = raw.sub_order_source ? String(raw.sub_order_source).trim() : null;

    return {
      orderId: orderNum,
      subOrderId: subOrderNum,
      fulfillmentId,
      status: normalizedStatus,
      meeshoStatusCode: statusCode,
      orderDate,
      expectedDispatchDate,
      sku,
      productName,
      variation,
      quantity,
      carrierId,
      carrierName,
      awb,
      packetId,
      cancellationReason,
      orderSource,
      rawData: raw,
    };
  }

  /**
   * Idempotently upserts a list of normalized orders into meesho_orders table.
   * Guarantees ZERO duplicates for the same (account_id, marketplace, sub_order_id).
   */
  static async upsertOrders(
    accountId: string,
    orders: NormalizedMeeshoOrder[]
  ): Promise<{ inserted: number; updated: number; total: number; newPendingCount: number }> {
    if (!accountId) throw new Error('accountId is required for upserting orders.');
    if (orders.length === 0) return { inserted: 0, updated: 0, total: 0, newPendingCount: 0 };

    await ensureMeeshoOrdersTable();
    await ensureMeeshoOrderNotificationsTable();

    // Query existing status of sub-orders to accurately detect new pending orders and track metrics
    const subOrderIds = orders.map((o) => o.subOrderId);
    const existingRows = await sql`
      SELECT sub_order_id, status FROM meesho_orders
      WHERE account_id = ${accountId}
        AND marketplace = 'meesho'
        AND sub_order_id = ANY(${subOrderIds});
    `;
    const existingMap = new Map<string, string>();
    existingRows.forEach((r: any) => existingMap.set(r.sub_order_id, r.status));

    let insertedCount = 0;
    let updatedCount = 0;
    let newPendingCount = 0;

    const BATCH_SIZE = 25;
    for (let i = 0; i < orders.length; i += BATCH_SIZE) {
      const batch = orders.slice(i, i + BATCH_SIZE);
      const notifQueries: any[] = [];
      const upsertQueries: any[] = [];

      for (const order of batch) {
        const isExisting = existingMap.has(order.subOrderId);
        const previousStatus = existingMap.get(order.subOrderId);

        if (isExisting) {
          updatedCount++;
        } else {
          insertedCount++;
        }

        // Check if this is a newly arrived pending order (brand-new OR transitioned to pending from a non-pending state)
        if (order.status === 'pending') {
          const isNewlyPending = !isExisting || (previousStatus && previousStatus !== 'pending');
          if (isNewlyPending) {
            notifQueries.push(sql`
              INSERT INTO meesho_order_notifications (
                account_id,
                marketplace,
                sub_order_id,
                order_id,
                status_at_event,
                notification_type
              ) VALUES (
                ${accountId},
                'meesho',
                ${order.subOrderId},
                ${order.orderId},
                'pending',
                'new_pending'
              )
              ON CONFLICT (account_id, marketplace, sub_order_id, notification_type)
              DO NOTHING
              RETURNING id;
            `);
          }
        }

        upsertQueries.push(sql`
          INSERT INTO meesho_orders (
            account_id,
            marketplace,
            order_id,
            sub_order_id,
            fulfillment_id,
            status,
            meesho_status_code,
            order_date,
            expected_dispatch_date,
            sku,
            product_name,
            variation,
            quantity,
            carrier_id,
            carrier_name,
            awb,
            packet_id,
            cancellation_reason,
            order_source,
            raw_data,
            synced_at,
            updated_at
          ) VALUES (
            ${accountId},
            'meesho',
            ${order.orderId},
            ${order.subOrderId},
            ${order.fulfillmentId},
            ${order.status},
            ${order.meeshoStatusCode},
            ${order.orderDate ? order.orderDate.toISOString() : null},
            ${order.expectedDispatchDate ? order.expectedDispatchDate.toISOString() : null},
            ${order.sku},
            ${order.productName},
            ${order.variation},
            ${order.quantity},
            ${order.carrierId},
            ${order.carrierName},
            ${order.awb},
            ${order.packetId},
            ${order.cancellationReason},
            ${order.orderSource},
            ${JSON.stringify(order.rawData)}::jsonb,
            NOW(),
            NOW()
          )
          ON CONFLICT (account_id, marketplace, sub_order_id)
          DO UPDATE SET
            fulfillment_id = COALESCE(EXCLUDED.fulfillment_id, meesho_orders.fulfillment_id),
            status = EXCLUDED.status,
            meesho_status_code = EXCLUDED.meesho_status_code,
            order_date = COALESCE(EXCLUDED.order_date, meesho_orders.order_date),
            expected_dispatch_date = COALESCE(EXCLUDED.expected_dispatch_date, meesho_orders.expected_dispatch_date),
            sku = EXCLUDED.sku,
            product_name = COALESCE(EXCLUDED.product_name, meesho_orders.product_name),
            variation = COALESCE(EXCLUDED.variation, meesho_orders.variation),
            quantity = EXCLUDED.quantity,
            carrier_id = COALESCE(EXCLUDED.carrier_id, meesho_orders.carrier_id),
            carrier_name = COALESCE(EXCLUDED.carrier_name, meesho_orders.carrier_name),
            awb = COALESCE(EXCLUDED.awb, meesho_orders.awb),
            packet_id = COALESCE(EXCLUDED.packet_id, meesho_orders.packet_id),
            cancellation_reason = COALESCE(EXCLUDED.cancellation_reason, meesho_orders.cancellation_reason),
            order_source = COALESCE(EXCLUDED.order_source, meesho_orders.order_source),
            raw_data = EXCLUDED.raw_data,
            synced_at = NOW(),
            updated_at = NOW();
        `);
      }

      if (notifQueries.length > 0) {
        try {
          const notifResults = await sql.transaction(notifQueries);
          for (const nr of notifResults) {
            if (nr && nr.length > 0) {
              newPendingCount++;
            }
          }
        } catch (notifErr: any) {
          console.warn('[Order Sync Service] Could not record pending order notification:', notifErr.message);
        }
      }

      if (upsertQueries.length > 0) {
        await sql.transaction(upsertQueries);
      }
    }

    return {
      inserted: insertedCount,
      updated: updatedCount,
      total: orders.length,
      newPendingCount,
    };
  }

  /**
   * Main synchronization routine:
   * 1. Checks account connection.
   * 2. Requests raw orders from worker.
   * 3. Normalizes all orders.
   * 4. Idempotently upserts into PostgreSQL.
  /**
   * Main synchronization routine:
   * 1. Checks account connection.
   * 2. Creates meesho_sync_history record.
   * 3. Requests raw orders from worker.
   * 4. Normalizes all orders.
   * 5. Idempotently upserts into PostgreSQL.
   * 6. Updates connection metadata and sync timestamps.
   * 7. Updates meesho_sync_history record with status and metrics.
   */
  static async syncOrders(
    accountId: string,
    options: OrderSyncOptions = {}
  ): Promise<OrderSyncResult> {
    const startTime = Date.now();
    await ensureMarketplaceConnectionsTable();
    await ensureMeeshoOrdersTable();
    await ensureMeeshoSyncHistoryTable();

    // 1. Verify connection
    const connRows = await sql`
      SELECT connection_status, session_metadata, last_successful_sync FROM marketplace_connections
      WHERE account_id = ${accountId} AND marketplace = 'meesho'
      LIMIT 1;
    `;

    if (!connRows || connRows.length === 0 || connRows[0].connection_status !== 'connected') {
      const err: any = new Error('Meesho is not connected for this account. Please connect first.');
      err.statusCode = 400;
      err.code = 'NOT_CONNECTED';
      throw err;
    }

    const syncId = 'sync_' + crypto.randomUUID();
    const syncType = options.syncType || 'manual';

    // 2. Insert initial running record in sync history
    try {
      await sql`
        INSERT INTO meesho_sync_history (
          sync_id, account_id, marketplace, sync_type, status, started_at
        ) VALUES (
          ${syncId}, ${accountId}, 'meesho', ${syncType}, 'running', NOW()
        );
      `;
    } catch (err: any) {
      console.warn('[Order Sync Service] Could not write initial sync history row:', err.message);
    }

    try {
      // 3. Request order extraction from worker
      const workerExtractUrl = `${WORKER_URL.replace(/\/+$/, '')}/sessions/${encodeURIComponent(accountId)}/orders/extract`;
      console.log(`[Order Sync Service] Requesting order extraction from worker: ${workerExtractUrl}`);

      let res: Response;
      try {
        res = await fetch(workerExtractUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-worker-secret': WORKER_SECRET,
          },
          body: JSON.stringify({
            limit: options.limit || 500,
            maxOrdersPerTab: options.maxOrdersPerTab,
            tabs: options.tabs,
            cutoffIso: options.cutoffIso,
          }),
        });
      } catch (fetchErr: any) {
        const err: any = new Error(`Meesho sync worker is unreachable at ${WORKER_URL}. Please ensure the worker daemon is running.`);
        err.statusCode = 503;
        err.code = 'WORKER_UNAVAILABLE';
        throw err;
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        let errJson: any = null;
        try { errJson = JSON.parse(errText); } catch {}
        const msg = errJson?.error || errText || `Worker order extraction failed (HTTP ${res.status})`;
        const err: any = new Error(msg);
        err.statusCode = res.status >= 400 && res.status < 500 ? res.status : 502;
        err.code = errJson?.code || 'WORKER_EXTRACTION_FAILED';
        throw err;
      }

      const workerJson = await res.json();
      if (!workerJson.success) {
        const err: any = new Error(workerJson.error || 'Worker failed to extract orders.');
        err.statusCode = 502;
        err.code = 'WORKER_EXTRACTION_FAILED';
        throw err;
      }

      const extractedOrders: Array<{
        raw: Record<string, any>;
        tabType: 'pending' | 'ready-to-ship' | 'shipped' | 'cancelled';
        statusCode: number;
      }> = workerJson.orders || [];

      console.log(`[Order Sync Service] Worker returned ${extractedOrders.length} raw orders. Normalizing...`);

      // 4. Normalize orders
      const normalizedOrders: NormalizedMeeshoOrder[] = extractedOrders.map((item) =>
        this.normalizeOrder(item.raw, item.tabType, item.statusCode)
      );

      // 5. Batch upsert into database
      const upsertResult = await this.upsertOrders(accountId, normalizedOrders);

      // 6. Query total order count in DB
      const countRows = await sql`
        SELECT COUNT(*) as count FROM meesho_orders
        WHERE account_id = ${accountId} AND marketplace = 'meesho';
      `;
      const totalInDb = parseInt(countRows[0]?.count || '0', 10);

      // 7. Update marketplace_connections sync timestamp & metadata
      const existingMeta = connRows[0].session_metadata || {};
      const updatedMeta = {
        ...existingMeta,
        totalOrdersSynced: totalInDb,
        lastSyncExtracted: extractedOrders.length,
        lastSyncInserted: upsertResult.inserted,
        lastSyncUpdated: upsertResult.updated,
        lastSyncAt: new Date().toISOString(),
      };

      await sql`
        UPDATE marketplace_connections
        SET
          last_successful_sync = NOW(),
          last_error = NULL,
          session_metadata = ${JSON.stringify(updatedMeta)}::jsonb,
          updated_at = NOW()
        WHERE account_id = ${accountId} AND marketplace = 'meesho';
      `;

      const durationMs = Date.now() - startTime;
      console.log(
        `[Order Sync Service] ✅ Sync complete in ${durationMs}ms: ${upsertResult.inserted} inserted, ${upsertResult.updated} updated, total in DB: ${totalInDb}`
      );

      // 8. Update sync history row to success
      try {
        await sql`
          UPDATE meesho_sync_history
          SET
            status = 'success',
            completed_at = NOW(),
            records_found = ${extractedOrders.length},
            records_inserted = ${upsertResult.inserted},
            records_updated = ${upsertResult.updated},
            duration_ms = ${durationMs}
          WHERE sync_id = ${syncId};
        `;
      } catch (histErr: any) {
        console.warn('[Order Sync Service] Could not update sync history row to success:', histErr.message);
      }

      return {
        success: true,
        totalExtracted: extractedOrders.length,
        inserted: upsertResult.inserted,
        updated: upsertResult.updated,
        newPendingCount: upsertResult.newPendingCount || 0,
        durationMs,
        syncId,
        ordersSample: normalizedOrders.slice(0, 5).map((o) => ({
          subOrderId: o.subOrderId,
          sku: o.sku,
          status: o.status,
          quantity: o.quantity,
        })),
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      // Record failure in sync history
      try {
        await sql`
          UPDATE meesho_sync_history
          SET
            status = 'failed',
            completed_at = NOW(),
            error_message = ${error.message || 'Unknown sync failure'},
            duration_ms = ${durationMs}
          WHERE sync_id = ${syncId};
        `;
      } catch {}

      // Update connection error
      try {
        await sql`
          UPDATE marketplace_connections
          SET
            last_error = ${error.message || 'Order sync failed'},
            updated_at = NOW()
          WHERE account_id = ${accountId} AND marketplace = 'meesho';
        `;
      } catch {}

      throw error;
    }
  }

  /**
   * Ingests orders directly extracted and submitted by the worker process.
   * Used by the worker continuous scheduler.
   */
  static async ingestOrders(
    accountId: string,
    extractedOrders: Array<{
      raw: Record<string, any>;
      tabType: 'pending' | 'ready-to-ship' | 'shipped' | 'cancelled';
      statusCode: number;
    }>,
    options: { syncType?: 'auto' | 'manual' | 'test'; durationMs?: number } = {}
  ): Promise<OrderSyncResult> {
    const startTime = Date.now();
    await ensureMarketplaceConnectionsTable();
    await ensureMeeshoOrdersTable();
    await ensureMeeshoSyncHistoryTable();

    // 1. Verify connection
    const connRows = await sql`
      SELECT connection_status, session_metadata FROM marketplace_connections
      WHERE account_id = ${accountId} AND marketplace = 'meesho'
      LIMIT 1;
    `;

    if (!connRows || connRows.length === 0 || connRows[0].connection_status !== 'connected') {
      throw new Error('Meesho is not connected for this account.');
    }

    const syncId = 'sync_' + crypto.randomUUID();
    const syncType = options.syncType || 'auto';

    // 2. Insert initial running record in sync history
    try {
      await sql`
        INSERT INTO meesho_sync_history (
          sync_id, account_id, marketplace, sync_type, status, started_at
        ) VALUES (
          ${syncId}, ${accountId}, 'meesho', ${syncType}, 'running', NOW()
        );
      `;
    } catch (err: any) {
      console.warn('[Order Sync Service] Could not write initial sync history row:', err.message);
    }

    try {
      // 3. Normalize orders
      const normalizedOrders: NormalizedMeeshoOrder[] = extractedOrders.map((item) =>
        this.normalizeOrder(item.raw, item.tabType, item.statusCode)
      );

      // 4. Batch upsert into database
      const upsertResult = await this.upsertOrders(accountId, normalizedOrders);

      // 5. Query total order count in DB
      const countRows = await sql`
        SELECT COUNT(*) as count FROM meesho_orders
        WHERE account_id = ${accountId} AND marketplace = 'meesho';
      `;
      const totalInDb = parseInt(countRows[0]?.count || '0', 10);

      // 6. Update marketplace_connections sync timestamp & metadata
      const existingMeta = connRows[0].session_metadata || {};
      const updatedMeta = {
        ...existingMeta,
        totalOrdersSynced: totalInDb,
        lastSyncExtracted: extractedOrders.length,
        lastSyncInserted: upsertResult.inserted,
        lastSyncUpdated: upsertResult.updated,
        lastSyncAt: new Date().toISOString(),
      };

      await sql`
        UPDATE marketplace_connections
        SET
          last_successful_sync = NOW(),
          last_error = NULL,
          session_metadata = ${JSON.stringify(updatedMeta)}::jsonb,
          updated_at = NOW()
        WHERE account_id = ${accountId} AND marketplace = 'meesho';
      `;

      const durationMs = options.durationMs || (Date.now() - startTime);

      // 7. Update sync history row to success
      try {
        await sql`
          UPDATE meesho_sync_history
          SET
            status = 'success',
            completed_at = NOW(),
            records_found = ${extractedOrders.length},
            records_inserted = ${upsertResult.inserted},
            records_updated = ${upsertResult.updated},
            duration_ms = ${durationMs}
          WHERE sync_id = ${syncId};
        `;
      } catch {}

      return {
        success: true,
        totalExtracted: extractedOrders.length,
        inserted: upsertResult.inserted,
        updated: upsertResult.updated,
        newPendingCount: upsertResult.newPendingCount || 0,
        durationMs,
        syncId,
        ordersSample: normalizedOrders.slice(0, 5).map((o) => ({
          subOrderId: o.subOrderId,
          sku: o.sku,
          status: o.status,
          quantity: o.quantity,
        })),
      };
    } catch (error: any) {
      const durationMs = options.durationMs || (Date.now() - startTime);
      try {
        await sql`
          UPDATE meesho_sync_history
          SET
            status = 'failed',
            completed_at = NOW(),
            error_message = ${error.message || 'Ingest failure'},
            duration_ms = ${durationMs}
          WHERE sync_id = ${syncId};
        `;
      } catch {}

      throw error;
    }
  }

  /**
   * Retrieves recent sync history items for an account.
   */
  static async getSyncHistory(accountId: string, limit: number = 10): Promise<MeeshoSyncHistoryRecord[]> {
    await ensureMeeshoSyncHistoryTable();
    const rows = await sql`
      SELECT
        sync_id, account_id, marketplace, sync_type, status,
        started_at, completed_at, records_found, records_inserted,
        records_updated, records_skipped, error_message, duration_ms, created_at
      FROM meesho_sync_history
      WHERE account_id = ${accountId} AND marketplace = 'meesho'
      ORDER BY created_at DESC
      LIMIT ${limit};
    `;

    return rows.map((r: any) => ({
      id: r.sync_id,
      accountId: r.account_id,
      marketplace: r.marketplace,
      syncType: r.sync_type,
      status: r.status,
      startedAt: new Date(r.started_at).toISOString(),
      completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
      recordsFound: Number(r.records_found) || 0,
      recordsInserted: Number(r.records_inserted) || 0,
      recordsUpdated: Number(r.records_updated) || 0,
      recordsSkipped: Number(r.records_skipped) || 0,
      errorMessage: r.error_message || null,
      durationMs: r.duration_ms !== null ? Number(r.duration_ms) : null,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  }

  /**
   * Updates auto-sync setting for an account.
   */
  static async setAutoSyncEnabled(accountId: string, enabled: boolean): Promise<boolean> {
    await ensureMarketplaceConnectionsTable();
    await ensureMeeshoSyncHistoryTable();

    await sql`
      UPDATE marketplace_connections
      SET auto_sync_enabled = ${enabled}, updated_at = NOW()
      WHERE account_id = ${accountId} AND marketplace = 'meesho';
    `;
    return enabled;
  }

  /**
   * Gets full auto-sync status and recent history for Settings UI.
   */
  static async getAutoSyncStatus(accountId: string): Promise<AutoSyncStatusDTO> {
    await ensureMarketplaceConnectionsTable();
    await ensureMeeshoSyncHistoryTable();

    const connRows = await sql`
      SELECT auto_sync_enabled, last_successful_sync, session_metadata
      FROM marketplace_connections
      WHERE account_id = ${accountId} AND marketplace = 'meesho'
      LIMIT 1;
    `;

    const enabled = connRows.length > 0 && connRows[0].auto_sync_enabled !== false;
    const lastSyncAt = connRows[0]?.last_successful_sync
      ? new Date(connRows[0].last_successful_sync).toISOString()
      : null;

    const history = await this.getSyncHistory(accountId, 5);
    const latest = history[0] || null;

    const intervalMinutes = parseInt(process.env.MEESHO_ORDER_SYNC_INTERVAL_MINUTES || '15', 10);
    let nextSyncAt: string | null = null;
    if (enabled && lastSyncAt) {
      nextSyncAt = new Date(new Date(lastSyncAt).getTime() + intervalMinutes * 60 * 1000).toISOString();
    } else if (enabled) {
      nextSyncAt = new Date(Date.now() + 60 * 1000).toISOString();
    }

    return {
      enabled,
      intervalMinutes,
      lastSyncAt,
      nextSyncAt,
      lastSyncStatus: latest?.status || 'idle',
      lastSyncInserted: latest?.recordsInserted || 0,
      lastSyncUpdated: latest?.recordsUpdated || 0,
      history,
    };
  }

  /**
   * Discovers all connected Meesho accounts for the worker scheduler recovery.
   */
  static async getConnectedAccounts(): Promise<ConnectedAccountDTO[]> {
    await ensureMarketplaceConnectionsTable();
    await ensureMeeshoSyncHistoryTable();

    const rows = await sql`
      SELECT account_id, session_metadata, last_successful_sync, auto_sync_enabled
      FROM marketplace_connections
      WHERE marketplace = 'meesho' AND connection_status = 'connected';
    `;

    return rows.map((r: any) => ({
      accountId: r.account_id,
      supplierId: r.session_metadata?.supplierId || null,
      supplierName: r.session_metadata?.supplierName || null,
      lastSuccessfulSync: r.last_successful_sync ? new Date(r.last_successful_sync).toISOString() : null,
      autoSyncEnabled: r.auto_sync_enabled !== false,
    }));
  }

  /**
   * Retrieves summary statistics for orders synced for this account.
   */
  static async getOrderSyncStatus(accountId: string): Promise<OrderSyncStatusDTO> {
    await ensureMeeshoOrdersTable();

    const connRows = await sql`
      SELECT last_successful_sync FROM marketplace_connections
      WHERE account_id = ${accountId} AND marketplace = 'meesho'
      LIMIT 1;
    `;
    const lastSync = connRows[0]?.last_successful_sync
      ? new Date(connRows[0].last_successful_sync).toISOString()
      : null;

    const breakdownRows = await sql`
      SELECT status, COUNT(*) as count
      FROM meesho_orders
      WHERE account_id = ${accountId} AND marketplace = 'meesho'
      GROUP BY status;
    `;

    const statusBreakdown = {
      pending: 0,
      ready_to_ship: 0,
      shipped: 0,
      cancelled: 0,
      other: 0,
    };

    let totalOrders = 0;
    for (const r of breakdownRows) {
      const count = parseInt(r.count, 10) || 0;
      totalOrders += count;
      const st = r.status as keyof typeof statusBreakdown;
      if (st in statusBreakdown) {
        statusBreakdown[st] = count;
      } else {
        statusBreakdown.other += count;
      }
    }

    return {
      totalOrders,
      lastSync,
      statusBreakdown,
    };
  }

  /**
   * Fetches undelivered notifications for an account.
   */
  static async getPendingNotifications(
    accountId: string,
    limit: number = 50
  ): Promise<MeeshoOrderNotificationRecord[]> {
    if (!accountId) return [];
    await ensureMeeshoOrderNotificationsTable();

    const rows = await sql`
      SELECT id, account_id, marketplace, sub_order_id, order_id, status_at_event, notification_type, is_read, delivered_at, created_at
      FROM meesho_order_notifications
      WHERE account_id = ${accountId}
        AND marketplace = 'meesho'
        AND delivered_at IS NULL
      ORDER BY created_at ASC
      LIMIT ${limit};
    `;

    return rows.map((r: any) => ({
      id: Number(r.id),
      accountId: r.account_id,
      marketplace: r.marketplace,
      subOrderId: r.sub_order_id,
      orderId: r.order_id,
      statusAtEvent: r.status_at_event,
      notificationType: r.notification_type,
      isRead: Boolean(r.is_read),
      deliveredAt: r.delivered_at ? new Date(r.delivered_at).toISOString() : null,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  }

  /**
   * Marks a list of notification IDs as delivered.
   */
  static async acknowledgeNotifications(
    accountId: string,
    notificationIds: number[]
  ): Promise<{ updated: number }> {
    if (!accountId || !notificationIds || notificationIds.length === 0) {
      return { updated: 0 };
    }
    await ensureMeeshoOrderNotificationsTable();

    const res = await sql`
      UPDATE meesho_order_notifications
      SET delivered_at = NOW(), is_read = true
      WHERE account_id = ${accountId}
        AND marketplace = 'meesho'
        AND id = ANY(${notificationIds})
      RETURNING id;
    `;

    return { updated: res.length };
  }

  /**
   * Retrieves notification settings for the account.
   */
  static async getNotificationSettings(
    accountId: string
  ): Promise<OrderNotificationSettingsDTO> {
    if (!accountId) return { enabled: true };
    await ensureMarketplaceConnectionsTable();

    // Check account connection metadata first
    const connRows = await sql`
      SELECT session_metadata FROM marketplace_connections
      WHERE account_id = ${accountId} AND marketplace = 'meesho'
      LIMIT 1;
    `;

    if (connRows.length > 0 && connRows[0].session_metadata) {
      const meta = connRows[0].session_metadata;
      if (typeof meta.browser_order_notifications === 'boolean') {
        return { enabled: meta.browser_order_notifications };
      }
    }

    // Fallback to app_settings table
    try {
      const appSettingsRows = await sql`
        SELECT setting_value FROM app_settings
        WHERE setting_key = 'order_notifications'
        LIMIT 1;
      `;
      if (appSettingsRows.length > 0 && appSettingsRows[0].setting_value) {
        const val = appSettingsRows[0].setting_value;
        if (typeof val.browser_order_notifications === 'boolean') {
          return { enabled: val.browser_order_notifications };
        }
      }
    } catch {}

    return { enabled: true };
  }

  /**
   * Updates notification settings for the account.
   */
  static async updateNotificationSettings(
    accountId: string,
    enabled: boolean
  ): Promise<OrderNotificationSettingsDTO> {
    if (!accountId) throw new Error('accountId is required.');
    await ensureMarketplaceConnectionsTable();

    // 1. Update marketplace_connections metadata
    try {
      await sql`
        UPDATE marketplace_connections
        SET session_metadata = jsonb_set(
          COALESCE(session_metadata, '{}'::jsonb),
          '{browser_order_notifications}',
          ${JSON.stringify(enabled)}::jsonb
        ),
        updated_at = NOW()
        WHERE account_id = ${accountId} AND marketplace = 'meesho';
      `;
    } catch {}

    // 2. Update app_settings
    try {
      await sql`
        INSERT INTO app_settings (setting_key, setting_value)
        VALUES ('order_notifications', ${JSON.stringify({ browser_order_notifications: enabled })}::jsonb)
        ON CONFLICT (setting_key)
        DO UPDATE SET setting_value = EXCLUDED.setting_value;
      `;
    } catch {}

    return { enabled };
  }

  /**
   * Returns real-time counts for Pending and Ready to Ship orders for the Live Orders Dashboard Card.
   */
  static async getLiveOrdersCounts(accountId: string): Promise<LiveOrdersMetricDTO> {
    if (!accountId) return { pending: 0, readyToShip: 0 };
    await ensureMeeshoOrdersTable();

    try {
      const rows = await sql`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'pending')::int as pending,
          COUNT(*) FILTER (WHERE status = 'ready_to_ship')::int as ready_to_ship
        FROM meesho_orders
        WHERE account_id = ${accountId} AND marketplace = 'meesho';
      `;

      return {
        pending: Number(rows[0]?.pending || 0),
        readyToShip: Number(rows[0]?.ready_to_ship || 0),
        lastUpdated: new Date().toISOString(),
      };
    } catch {
      return { pending: 0, readyToShip: 0, lastUpdated: new Date().toISOString() };
    }
  }
}

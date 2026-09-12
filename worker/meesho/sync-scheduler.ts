/**
 * Meesho Automatic / Continuous Order Sync Scheduler
 * Runs inside the persistent Playwright automation worker process.
 * 
 * Features:
 * - Configurable interval (default 15 minutes)
 * - Incremental overlap window (default 30 minutes)
 * - Per-account concurrency lock (mutex)
 * - Worker restart recovery (discovering connected accounts from Rehanza-Hub)
 * - Ingests extracted orders directly to Rehanza-Hub
 * - Safe on-demand test trigger
 */

import fs from 'fs';
import path from 'path';
import { MeeshoBrowserManager } from './browser-manager';

export interface SchedulerAccount {
  accountId: string;
  supplierId: string | null;
  supplierName: string | null;
  lastSuccessfulSync: string | null;
  nextSyncTime: number;
  autoSyncEnabled: boolean;
  consecutiveFailures: number;
}

export interface SyncSchedulerConfig {
  hubUrl: string;
  workerSecret: string;
  sessionsDir: string;
  intervalMinutes?: number;
  overlapMinutes?: number;
}

export class MeeshoSyncScheduler {
  private browserManager: MeeshoBrowserManager;
  private hubUrl: string;
  private workerSecret: string;
  private sessionsDir: string;
  private intervalMinutes: number;
  private overlapMinutes: number;

  private accounts = new Map<string, SchedulerAccount>();
  private runningSyncs = new Set<string>();
  private tickInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(browserManager: MeeshoBrowserManager, config: SyncSchedulerConfig) {
    this.browserManager = browserManager;
    this.hubUrl = config.hubUrl.replace(/\/+$/, '');
    this.workerSecret = config.workerSecret;
    this.sessionsDir = config.sessionsDir;
    this.intervalMinutes = config.intervalMinutes || parseInt(process.env.MEESHO_ORDER_SYNC_INTERVAL_MINUTES || '15', 10);
    this.overlapMinutes = config.overlapMinutes || parseInt(process.env.MEESHO_ORDER_SYNC_OVERLAP_MINUTES || '30', 10);
  }

  /**
   * Starts the continuous background scheduler.
   */
  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(`[Sync Scheduler] Starting automatic order sync scheduler...`);
    console.log(`[Sync Scheduler] Interval: ${this.intervalMinutes}m, Overlap: ${this.overlapMinutes}m`);

    // Initial discovery and recovery from Hub
    await this.recoverAndDiscoverAccounts();

    // Periodic tick to check scheduled syncs (every 10 seconds)
    this.tickInterval = setInterval(() => {
      this.tick();
    }, 10000);
  }

  /**
   * Stops the background scheduler gracefully.
   */
  async stop() {
    this.isRunning = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    console.log(`[Sync Scheduler] Scheduler stopped.`);
  }

  /**
   * Discovers all connected Meesho accounts from Rehanza-Hub.
   * Runs on worker startup and recovery.
   */
  async recoverAndDiscoverAccounts(): Promise<void> {
    try {
      console.log(`[Sync Scheduler] Querying Hub for connected accounts at ${this.hubUrl}/api/marketplace/meesho/connected-accounts...`);
      const res = await fetch(`${this.hubUrl}/api/marketplace/meesho/connected-accounts`, {
        headers: {
          'x-worker-secret': this.workerSecret,
        },
      });

      if (!res.ok) {
        console.warn(`[Sync Scheduler] Hub returned HTTP ${res.status} when discovering connected accounts.`);
        return;
      }

      const json = await res.json();
      if (!json.success || !Array.isArray(json.accounts)) {
        console.warn(`[Sync Scheduler] Invalid response format from Hub connected accounts.`);
        return;
      }

      const accountsList = json.accounts as Array<{
        accountId: string;
        supplierId: string | null;
        supplierName: string | null;
        lastSuccessfulSync: string | null;
        autoSyncEnabled: boolean;
      }>;

      console.log(`[Sync Scheduler] Discovered ${accountsList.length} connected account(s) from Hub.`);

      for (const item of accountsList) {
        this.registerAccount(item);
      }
    } catch (err: any) {
      console.warn(`[Sync Scheduler] Error during account recovery: ${err.message}`);
    }
  }

  /**
   * Registers or updates an account in the scheduler.
   */
  registerAccount(account: {
    accountId: string;
    supplierId?: string | null;
    supplierName?: string | null;
    lastSuccessfulSync?: string | null;
    autoSyncEnabled?: boolean;
  }) {
    const { accountId } = account;
    const storagePath = path.join(this.sessionsDir, `${accountId}.storageState.json`);

    // Only register if storage state file exists
    if (!fs.existsSync(storagePath)) {
      console.log(`[Sync Scheduler] [${accountId.slice(0, 8)}...] No storageState.json found on worker disk. Skipping registration.`);
      return;
    }

    const enabled = account.autoSyncEnabled !== false;
    const existing = this.accounts.get(accountId);

    let nextSyncTime: number;
    if (existing) {
      nextSyncTime = existing.nextSyncTime;
    } else if (account.lastSuccessfulSync) {
      const lastSyncMs = new Date(account.lastSuccessfulSync).getTime();
      const scheduledMs = lastSyncMs + this.intervalMinutes * 60 * 1000;
      // Stagger slightly if past due
      nextSyncTime = scheduledMs <= Date.now() ? Date.now() + 5000 : scheduledMs;
    } else {
      nextSyncTime = Date.now() + 10000; // First sync in 10s
    }

    this.accounts.set(accountId, {
      accountId,
      supplierId: account.supplierId || null,
      supplierName: account.supplierName || null,
      lastSuccessfulSync: account.lastSuccessfulSync || null,
      nextSyncTime,
      autoSyncEnabled: enabled,
      consecutiveFailures: 0,
    });

    const nextDateStr = new Date(nextSyncTime).toLocaleTimeString();
    console.log(
      `[Sync Scheduler] [${accountId.slice(0, 8)}...] Registered. Auto-sync: ${
        enabled ? 'ENABLED' : 'DISABLED'
      }. Next scheduled sync at: ${nextDateStr}`
    );
  }

  /**
   * Unregisters an account (e.g. after disconnection).
   */
  unregisterAccount(accountId: string) {
    if (this.accounts.has(accountId)) {
      this.accounts.delete(accountId);
      console.log(`[Sync Scheduler] [${accountId.slice(0, 8)}...] Unregistered from auto-sync.`);
    }
  }

  /**
   * Reloads account settings (e.g. after toggle from UI).
   */
  reloadAccount(accountId: string, enabled?: boolean) {
    const existing = this.accounts.get(accountId);
    if (existing) {
      if (typeof enabled === 'boolean') {
        existing.autoSyncEnabled = enabled;
      }
      console.log(`[Sync Scheduler] [${accountId.slice(0, 8)}...] Reloaded. Auto-sync is now ${existing.autoSyncEnabled ? 'ENABLED' : 'DISABLED'}.`);
    } else {
      this.registerAccount({ accountId, autoSyncEnabled: enabled });
    }
  }

  private lastDiscoveryAttempt = 0;

  /**
   * Main periodic tick. Checks all registered accounts and initiates sync if due.
   */
  private async tick() {
    if (!this.isRunning) return;

    const now = Date.now();

    // If no accounts registered yet (e.g. Hub was booting up when worker started), retry discovery periodically
    if (this.accounts.size === 0 && now - this.lastDiscoveryAttempt > 30000) {
      this.lastDiscoveryAttempt = now;
      this.recoverAndDiscoverAccounts().catch(() => {});
    }

    for (const [accountId, account] of Array.from(this.accounts.entries())) {
      if (!account.autoSyncEnabled) continue;

      if (now >= account.nextSyncTime) {
        // Execute sync in background (non-blocking for loop)
        this.syncAccount(accountId, { syncType: 'auto' }).catch((err) => {
          console.error(`[Sync Scheduler] [${accountId.slice(0, 8)}...] Background sync error:`, err.message);
        });
      }
    }
  }

  /**
   * Executes order sync for a specific account with concurrency lock.
   */
  async syncAccount(
    accountId: string,
    options: { force?: boolean; syncType?: 'auto' | 'manual' | 'test' } = {}
  ): Promise<{
    success: boolean;
    skipped?: boolean;
    reason?: string;
    totalExtracted?: number;
    inserted?: number;
    updated?: number;
    durationMs?: number;
    error?: string;
  }> {
    // 1. Concurrency Check (Per-Account Mutex)
    if (this.runningSyncs.has(accountId)) {
      console.warn(`[Sync Scheduler] [${accountId.slice(0, 8)}...] Sync already in progress. Skipping duplicate run.`);
      return {
        success: false,
        skipped: true,
        reason: 'Sync already in progress for this account.',
      };
    }

    const account = this.accounts.get(accountId);
    if (!account && !options.force) {
      return {
        success: false,
        error: `Account ${accountId} is not registered in scheduler.`,
      };
    }

    const storagePath = path.join(this.sessionsDir, `${accountId}.storageState.json`);
    if (!fs.existsSync(storagePath)) {
      return {
        success: false,
        error: `Session storage state not found on disk for account ${accountId}.`,
      };
    }

    // 2. Acquire Concurrency Lock
    this.runningSyncs.add(accountId);
    const startTime = Date.now();
    const syncType = options.syncType || 'auto';

    console.log(`[Sync Scheduler] [${accountId.slice(0, 8)}...] >>> Starting ${syncType.toUpperCase()} order sync <<<`);

    try {
      // 3. Compute Cutoff for Incremental Extraction
      let cutoffIso: string | undefined = undefined;
      const lastSyncStr = account?.lastSuccessfulSync;
      if (lastSyncStr) {
        const lastSyncMs = new Date(lastSyncStr).getTime();
        if (!isNaN(lastSyncMs)) {
          const cutoffMs = lastSyncMs - this.overlapMinutes * 60 * 1000;
          cutoffIso = new Date(cutoffMs).toISOString();
          console.log(
            `[Sync Scheduler] [${accountId.slice(0, 8)}...] Incremental cutoff: ${cutoffIso} (overlap: ${this.overlapMinutes}m)`
          );
        }
      }

      // 4. Extract Orders using Browser Manager
      const extractedOrders = await this.browserManager.extractOrders(accountId, {
        limit: 500,
        tabs: ['pending', 'ready-to-ship', 'shipped', 'cancelled'],
        cutoffIso,
      });

      console.log(
        `[Sync Scheduler] [${accountId.slice(0, 8)}...] Extracted ${extractedOrders.length} orders. Posting to Hub /orders/ingest...`
      );

      // 5. Post to Rehanza-Hub Ingest Endpoint
      const ingestRes = await fetch(`${this.hubUrl}/api/marketplace/meesho/orders/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-worker-secret': this.workerSecret,
        },
        body: JSON.stringify({
          accountId,
          orders: extractedOrders,
          syncType,
          durationMs: Date.now() - startTime,
        }),
      });

      if (!ingestRes.ok) {
        const errText = await ingestRes.text().catch(() => '');
        throw new Error(`Hub ingest failed (HTTP ${ingestRes.status}): ${errText}`);
      }

      const ingestJson = await ingestRes.json();
      if (!ingestJson.success) {
        throw new Error(ingestJson.error || 'Hub ingest rejected payload.');
      }

      const resultData = ingestJson.data || {};
      const durationMs = Date.now() - startTime;

      // 5.1 Also extract and ingest live payments
      try {
        console.log(`[Sync Scheduler] [${accountId.slice(0, 8)}...] Extracting payments...`);
        const payments = await this.browserManager.extractPayments(accountId);
        await fetch(`${this.hubUrl}/api/marketplace/meesho/payments/ingest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-worker-secret': this.workerSecret,
          },
          body: JSON.stringify({
            accountId,
            payments,
          }),
        }).catch((pErr) => {
          console.warn(`[Sync Scheduler] Payment ingest warning:`, pErr.message);
        });
      } catch (payErr: any) {
        console.warn(`[Sync Scheduler] [${accountId.slice(0, 8)}...] Payment extraction warning:`, payErr.message);
      }

      // 6. Update Account Schedule & Metrics
      if (account) {
        account.lastSuccessfulSync = new Date().toISOString();
        account.nextSyncTime = Date.now() + this.intervalMinutes * 60 * 1000;
        account.consecutiveFailures = 0;
      }

      console.log(
        `[Sync Scheduler] [${accountId.slice(0, 8)}...] ✅ Auto-sync complete in ${durationMs}ms: ` +
        `${resultData.inserted ?? 0} inserted, ${resultData.updated ?? 0} updated. ` +
        `Next sync in ${this.intervalMinutes}m.`
      );

      return {
        success: true,
        totalExtracted: extractedOrders.length,
        inserted: resultData.inserted ?? 0,
        updated: resultData.updated ?? 0,
        durationMs,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      console.error(`[Sync Scheduler] [${accountId.slice(0, 8)}...] ❌ Sync failed in ${durationMs}ms:`, err.message);

      if (account) {
        account.consecutiveFailures = (account.consecutiveFailures || 0) + 1;
        // Exponential backoff up to 15 minutes
        const backoffMinutes = Math.min(15, Math.pow(2, account.consecutiveFailures));
        account.nextSyncTime = Date.now() + backoffMinutes * 60 * 1000;
        console.warn(`[Sync Scheduler] [${accountId.slice(0, 8)}...] Backing off next sync to ${backoffMinutes}m.`);
      }

      return {
        success: false,
        durationMs,
        error: err.message,
      };
    } finally {
      // 7. Release Concurrency Lock
      this.runningSyncs.delete(accountId);
    }
  }

  /**
   * Returns scheduler status for an account.
   */
  getAccountStatus(accountId: string) {
    const account = this.accounts.get(accountId);
    const isRunning = this.runningSyncs.has(accountId);
    return {
      accountId,
      registered: !!account,
      autoSyncEnabled: account?.autoSyncEnabled ?? false,
      isRunning,
      intervalMinutes: this.intervalMinutes,
      overlapMinutes: this.overlapMinutes,
      lastSuccessfulSync: account?.lastSuccessfulSync || null,
      nextSyncTime: account?.nextSyncTime ? new Date(account.nextSyncTime).toISOString() : null,
      nextSyncInSeconds: account?.nextSyncTime ? Math.max(0, Math.round((account.nextSyncTime - Date.now()) / 1000)) : null,
    };
  }
}

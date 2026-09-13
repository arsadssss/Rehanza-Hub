/**
 * Meesho Browser Automation Worker - Standalone HTTP Server
 * Runs independently from Next.js.
 * Handles lifecycle commands for browser sessions and authenticates with Rehanza-Hub.
 */

import 'dotenv/config';
import http from 'http';
import path from 'path';
import { MeeshoBrowserManager } from './browser-manager';
import { MeeshoSyncScheduler } from './sync-scheduler';
import { WorkerConfig } from './types';

if (process.env.NODE_ENV === 'production' && !process.env.MEESHO_WORKER_SECRET) {
  throw new Error('FATAL: MEESHO_WORKER_SECRET environment variable is required in production.');
}

const PORT = parseInt(process.env.PORT || process.env.MEESHO_WORKER_PORT || '9005', 10);
const HUB_URL = process.env.MEESHO_HUB_URL || 'http://localhost:9002';
const WORKER_SECRET = process.env.MEESHO_WORKER_SECRET || 'dev_meesho_worker_secret';
// In local dev, default to headed (false) so user can see and interact with Meesho login
const HEADLESS = process.env.MEESHO_WORKER_HEADLESS === 'true';

const config: WorkerConfig = {
  port: PORT,
  hubUrl: HUB_URL,
  workerSecret: WORKER_SECRET,
  sessionsDir: path.join(__dirname, '.sessions'),
  headless: HEADLESS,
  loginTimeoutMs: 15 * 60 * 1000, // 15 minutes
  healthCheckIntervalMs: 60 * 1000,
};

const browserManager = new MeeshoBrowserManager(config);
const scheduler = new MeeshoSyncScheduler(browserManager, {
  hubUrl: HUB_URL,
  workerSecret: WORKER_SECRET,
  sessionsDir: config.sessionsDir,
});

function sendJson(res: http.ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-worker-secret, authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(JSON.stringify(data));
}

function parseBody<T = any>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : ({} as T));
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function verifyWorkerSecret(req: http.IncomingMessage): boolean {
  const headerSecret =
    req.headers['x-worker-secret'] ||
    (typeof req.headers.authorization === 'string'
      ? req.headers.authorization.replace(/^Bearer\s+/i, '')
      : null);
  return headerSecret === WORKER_SECRET;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const method = req.method?.toUpperCase();

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, x-worker-secret, authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    return res.end();
  }

  try {
    // Health Check (Public)
    if (method === 'GET' && pathname === '/health') {
      return sendJson(res, 200, {
        status: 'ok',
        service: 'meesho-browser-worker',
        activeSessions: browserManager.getActiveSessionCount(),
        uptime: process.uptime(),
      });
    }

    // Authenticated Endpoints Check
    if (!verifyWorkerSecret(req)) {
      return sendJson(res, 401, {
        success: false,
        error: 'Unauthorized. Missing or invalid x-worker-secret.',
      });
    }

    // Start Session: POST /sessions/start
    if (method === 'POST' && pathname === '/sessions/start') {
      const body = await parseBody<{ accountId: string; ticket: string }>(req);
      if (!body.accountId || !body.ticket) {
        return sendJson(res, 400, {
          success: false,
          error: 'accountId and ticket are required.',
        });
      }

      const session = await browserManager.startLoginSession(body.accountId, body.ticket);
      return sendJson(res, 200, { success: true, session });
    }

    // Get Session Status: GET /sessions/:accountId/status
    const statusMatch = pathname.match(/^\/sessions\/([^/]+)\/status$/);
    if (method === 'GET' && statusMatch) {
      const accountId = decodeURIComponent(statusMatch[1]);
      const session = browserManager.getSessionStatus(accountId);
      return sendJson(res, 200, { success: true, session });
    }

    // Check Session Health: GET /sessions/:accountId/check
    const checkMatch = pathname.match(/^\/sessions\/([^/]+)\/check$/);
    if (method === 'GET' && checkMatch) {
      const accountId = decodeURIComponent(checkMatch[1]);
      const session = await browserManager.checkSessionHealth(accountId);
      return sendJson(res, 200, { success: true, session });
    }

    // Close Session: POST /sessions/:accountId/close
    const closeMatch = pathname.match(/^\/sessions\/([^/]+)\/close$/);
    if (method === 'POST' && closeMatch) {
      const accountId = decodeURIComponent(closeMatch[1]);
      const session = await browserManager.closeSession(accountId);
      scheduler.unregisterAccount(accountId);
      return sendJson(res, 200, { success: true, session });
    }

    // Extract Orders: POST /sessions/:accountId/orders/extract
    const extractMatch = pathname.match(/^\/sessions\/([^/]+)\/orders\/extract$/);
    if (method === 'POST' && extractMatch) {
      const accountId = decodeURIComponent(extractMatch[1]);
      const body = await parseBody<{
        limit?: number;
        maxOrdersPerTab?: number;
        tabs?: Array<'pending' | 'ready-to-ship' | 'shipped' | 'cancelled'>;
        cutoffIso?: string;
      }>(req);

      console.log(`[Meesho Worker] Received order extraction request for account: ${accountId}`);
      const orders = await browserManager.extractOrders(accountId, body);
      return sendJson(res, 200, {
        success: true,
        count: orders.length,
        orders,
      });
    }

    // Extract Payments: POST /sessions/:accountId/payments/extract
    const extractPaymentsMatch = pathname.match(/^\/sessions\/([^/]+)\/payments\/extract$/);
    if (method === 'POST' && extractPaymentsMatch) {
      const accountId = decodeURIComponent(extractPaymentsMatch[1]);
      console.log(`[Meesho Worker] Received payment extraction request for account: ${accountId}`);
      const payments = await browserManager.extractPayments(accountId);
      return sendJson(res, 200, {
        success: true,
        payments,
      });
    }

    // Trigger On-Demand Auto-Sync (Dev/Test or Manual): POST /sessions/:accountId/autosync/trigger
    const autoTriggerMatch = pathname.match(/^\/sessions\/([^/]+)\/autosync\/trigger$/);
    if (method === 'POST' && autoTriggerMatch) {
      const accountId = decodeURIComponent(autoTriggerMatch[1]);
      const body = await parseBody<{ force?: boolean }>(req);
      console.log(`[Meesho Worker] Received on-demand auto-sync trigger for account: ${accountId}`);
      const result = await scheduler.syncAccount(accountId, {
        force: body.force ?? true,
        syncType: 'test',
      });
      return sendJson(res, result.skipped ? 409 : 200, result);
    }

    // Auto-Sync Status: GET /sessions/:accountId/autosync/status
    const autoStatusMatch = pathname.match(/^\/sessions\/([^/]+)\/autosync\/status$/);
    if (method === 'GET' && autoStatusMatch) {
      const accountId = decodeURIComponent(autoStatusMatch[1]);
      const status = scheduler.getAccountStatus(accountId);
      return sendJson(res, 200, { success: true, status });
    }

    // Reload Account Schedule: POST /sessions/:accountId/autosync/reload
    const autoReloadMatch = pathname.match(/^\/sessions\/([^/]+)\/autosync\/reload$/);
    if (method === 'POST' && autoReloadMatch) {
      const accountId = decodeURIComponent(autoReloadMatch[1]);
      const body = await parseBody<{ enabled?: boolean }>(req);
      scheduler.reloadAccount(accountId, body.enabled);
      return sendJson(res, 200, { success: true });
    }

    // Auto Re-Auth: POST /sessions/:accountId/reauth
    const reauthMatch = pathname.match(/^\/sessions\/([^/]+)\/reauth$/);
    if (method === 'POST' && reauthMatch) {
      const accountId = decodeURIComponent(reauthMatch[1]);
      console.log(`[Meesho Worker] Received auto re-auth request for account: ${accountId}`);
      const success = await browserManager.attemptAutoReauth(accountId);
      return sendJson(res, success ? 200 : 503, {
        success,
        error: success ? undefined : 'Auto re-auth failed. Check worker logs for details.',
      });
    }

    // Not Found
    return sendJson(res, 404, { success: false, error: 'Endpoint not found.' });


  } catch (error: any) {
    console.error('[Meesho Worker] Server Error:', error);
    const msg = error.message || 'Internal server error';
    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';

    if (msg.includes('No authenticated session state found')) {
      statusCode = 400;
      errorCode = 'SESSION_NOT_FOUND';
    } else if (msg.includes('supplier identity could not be resolved')) {
      statusCode = 422;
      errorCode = 'IDENTITY_UNRESOLVED';
    }

    return sendJson(res, statusCode, {
      success: false,
      error: msg,
      code: errorCode,
    });
  }
});

const isMainScript = process.argv[1] && (
  process.argv[1].endsWith('server.ts') ||
  process.argv[1].endsWith('server.js')
);

if (isMainScript && process.env.NODE_ENV !== 'test' && !process.env.IS_WORKER_TEST) {
  server.listen(PORT, '0.0.0.0', async () => {
    console.log(`====================================================`);
    console.log(`🚀 MEESHO BROWSER WORKER STARTED`);
    console.log(`📡 Port: ${PORT}`);
    console.log(`🔗 Hub URL: ${HUB_URL}`);
    console.log(`🖥️  Mode: ${HEADLESS ? 'Headless' : 'Headed (Visual Browser Window)'}`);
    console.log(`====================================================`);

    // Start background auto-sync scheduler
    scheduler.start().catch((err) => {
      console.warn('[Meesho Worker] Scheduler failed to start:', err.message);
    });
  });
}

// Graceful shutdown
const shutdown = async () => {
  console.log('\n[Meesho Worker] Received termination signal. Closing server...');
  server.close(async () => {
    await scheduler.stop().catch(() => {});
    await browserManager.shutdown();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { server, browserManager, scheduler };


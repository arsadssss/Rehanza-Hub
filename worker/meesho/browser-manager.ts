/**
 * Meesho Browser Automation Manager
 * Manages persistent Playwright browser instances and multi-tenant isolated contexts.
 * Detects authenticated Supplier Panel sessions and communicates with Rehanza-Hub.
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { WorkerConfig, WorkerSession, WorkerSessionState, WorkerSessionStatusDTO } from './types';
import {
  extractMeeshoOrders,
  ExtractedMeeshoOrder,
  ExtractOrdersOptions,
  SupplierDetails,
} from './order-extractor';


const OFFICIAL_MEESHO_LOGIN_URL = 'https://supplier.meesho.com/panel/v3/new/root/login';
const MEESHO_PANEL_BASE = 'https://supplier.meesho.com/panel/v3/new/';

export class MeeshoBrowserManager {
  private browser: Browser | null = null;
  private sessions: Map<string, WorkerSession> = new Map();
  private config: WorkerConfig;

  constructor(config: WorkerConfig) {
    this.config = config;
    // Ensure sessions directory exists
    if (!fs.existsSync(config.sessionsDir)) {
      fs.mkdirSync(config.sessionsDir, { recursive: true });
    }
  }

  /**
   * Initializes the shared Chromium browser instance if not already running.
   */
  async ensureBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      console.log('[Meesho Worker] Launching Chromium browser instance...');
      this.browser = await chromium.launch({
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
        ],
      });
      console.log('[Meesho Worker] Chromium browser launched successfully.');
    }
    return this.browser;
  }

  /**
   * Starts a new login session for a specific account.
   * Creates an isolated BrowserContext and navigates to the official Meesho login page.
   */
  async startLoginSession(accountId: string, ticket: string): Promise<WorkerSessionStatusDTO> {
    if (!accountId || !ticket) {
      throw new Error('accountId and ticket are required.');
    }

    // Close any previous session for this account to guarantee freshness
    if (this.sessions.has(accountId)) {
      await this.closeSession(accountId);
    }

    const browser = await this.ensureBrowser();
    const storagePath = path.join(this.config.sessionsDir, `${accountId}.storageState.json`);

    console.log(`[Meesho Worker] Initializing isolated context for account: ${accountId}`);

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    const session: WorkerSession = {
      accountId,
      ticket,
      state: 'STARTING',
      browserContext: context,
      page,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      storageStatePath: storagePath,
    };

    this.sessions.set(accountId, session);

    // Track any new tabs / popups opened within this context
    context.on('page', (newPage) => {
      console.log(`[Meesho Worker] [${accountId.slice(0, 8)}...] New tab/window opened in context. Current URL: ${newPage.url()}`);
      session.page = newPage;
      newPage.on('close', () => {
        console.log(`[Meesho Worker] [${accountId.slice(0, 8)}...] A tab was closed in context.`);
      });
    });

    // Navigate to official login portal
    session.state = 'WAITING_FOR_LOGIN';
    console.log(`[Meesho Worker] [${accountId.slice(0, 8)}...] Navigating to Meesho login portal...`);

    try {
      await page.goto(OFFICIAL_MEESHO_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (err: any) {
      console.warn(`[Meesho Worker] [${accountId.slice(0, 8)}...] Initial page navigation warning: ${err.message}`);
    }

    // Begin background monitoring for authenticated state
    this.monitorSessionAuthentication(session);

    return this.toStatusDTO(session);
  }

  /**
   * Monitors the page for successful login detection.
   * Checks URL changes, session cookies, and dashboard navigation.
   */
  private async monitorSessionAuthentication(session: WorkerSession) {
    const { accountId, ticket, browserContext } = session;
    const maxWaitTime = this.config.loginTimeoutMs;
    const startTime = Date.now();
    const checkInterval = 2000; // Check every 2 seconds

    console.log(
      `[Meesho Worker] [${accountId.slice(0, 8)}...] Listening for user login (timeout: ${Math.round(
        maxWaitTime / 60000
      )}m, ticket prefix: ${ticket.slice(0, 8)}...)...`
    );

    const intervalId = setInterval(async () => {
      // Check if session was terminated or closed
      const current = this.sessions.get(accountId);
      if (!current || current !== session || session.state === 'DISCONNECTED') {
        clearInterval(intervalId);
        return;
      }

      // Check timeout
      if (Date.now() - startTime > maxWaitTime) {
        clearInterval(intervalId);
        console.warn(`[Meesho Worker] [${accountId.slice(0, 8)}...] Login session timed out.`);
        session.state = 'ERROR';
        session.error = 'Login session timed out.';
        return;
      }

      try {
        // Inspect all open pages in the context
        const openPages = (browserContext?.pages() || []).filter((p) => !p.isClosed());
        if (openPages.length === 0) {
          // If all tabs/windows were closed by the user
          clearInterval(intervalId);
          console.warn(`[Meesho Worker] [${accountId.slice(0, 8)}...] All browser tabs were closed by user.`);
          session.state = 'DISCONNECTED';
          session.error = 'Browser closed before authentication completed.';
          return;
        }

        // Check context cookies (SAFE: check names only, never log values)
        const cookies = await browserContext?.cookies();
        const cookieNames = (cookies || []).map((c) => c.name);

        const hasAuthCookies = (cookies || []).some((c) => {
          const n = c.name.toLowerCase();
          return (
            n.includes('token') ||
            n.includes('session') ||
            n.includes('supplier') ||
            n.includes('auth') ||
            n.includes('jwt') ||
            n.includes('sid')
          );
        });

        // Evaluate all open pages for authenticated state
        for (const activePage of openPages) {
          const currentUrl = activePage.url();

          // 1. URL Authentication Signal
          const isNotLoginUrl =
            !currentUrl.includes('/login') &&
            !currentUrl.includes('/signup') &&
            !currentUrl.endsWith('/root');

          const isPanelUrl =
            currentUrl.startsWith(MEESHO_PANEL_BASE) ||
            currentUrl.includes('supplier.meesho.com/panel/v3/new/');

          const hasDashboardPath =
            currentUrl.includes('/growth/') ||
            currentUrl.includes('/home') ||
            currentUrl.includes('/orders') ||
            currentUrl.includes('/payments') ||
            currentUrl.includes('/catalogs') ||
            currentUrl.includes('/returns');

          const isAuthUrlMatch = isPanelUrl && isNotLoginUrl;

          // 2. DOM Signals: Inspect page without capturing sensitive data
          let hasAuthDom = false;
          let supplierName: string | undefined;
          let supplierId: string | undefined;

          try {
            // Check if password inputs are gone
            const passwordInputs = await activePage.$$('input[type="password"]');
            const hasNoPasswordInputs = passwordInputs.length === 0;

            // Check for navigation / dashboard shell
            const shellElement = await activePage.$(
              'nav, aside, header, [data-testid*="supplier"], [class*="Supplier"], [class*="profile"], [class*="dashboard"]'
            );

            if (shellElement && hasNoPasswordInputs && isNotLoginUrl) {
              hasAuthDom = true;
            }

            // Extract supplier display name if visible
            const nameEl = await activePage.$(
              '[data-testid="supplier-name"], [class*="SupplierName"], [class*="profile-name"], [class*="supplierName"]'
            );
            if (nameEl) {
              const text = await nameEl.innerText();
              if (text) supplierName = text.trim();
            }
          } catch {
            // DOM inspection is non-blocking
          }

          // Extract supplierId from URL (e.g. /growth/4zy6k/home)
          const growthMatch = currentUrl.match(/\/growth\/([a-zA-Z0-9_-]+)\//);
          if (growthMatch) {
            supplierId = growthMatch[1];
          }

          // Positive authentication condition:
          // Either URL indicates panel dashboard (and not login), or (on meesho domain with auth cookies and auth DOM)
          if (
            (isAuthUrlMatch && (hasDashboardPath || hasAuthCookies || hasAuthDom)) ||
            (currentUrl.includes('supplier.meesho.com') && hasAuthCookies && hasAuthDom && isNotLoginUrl)
          ) {
            clearInterval(intervalId);

            // Redact query params for clean safe logging
            const safeUrl = currentUrl.split('?')[0];
            const pageTitle = await activePage.title().catch(() => 'Meesho Supplier Panel');

            console.log(
              `[Meesho Worker] [${accountId.slice(0, 8)}...] ✅ Successful authentication detected!`
            );
            console.log(`[Meesho Worker] [${accountId.slice(0, 8)}...] Page Title: "${pageTitle}"`);
            console.log(`[Meesho Worker] [${accountId.slice(0, 8)}...] Post-Login URL: ${safeUrl}`);
            console.log(
              `[Meesho Worker] [${accountId.slice(0, 8)}...] Cookie names present: [${cookieNames.join(', ')}]`
            );
            if (supplierId) {
              console.log(`[Meesho Worker] [${accountId.slice(0, 8)}...] Detected Supplier ID: ${supplierId}`);
            }

            session.state = 'AUTHENTICATING';
            session.supplierId = supplierId;
            session.supplierName = supplierName;
            session.page = activePage;

            // Save Playwright storage state locally
            await browserContext?.storageState({ path: session.storageStatePath });

            // Transmit session to Rehanza-Hub
            await this.notifyRehanzaHub(session, cookies || []);
            return;
          }
        }
      } catch (err: any) {
        // Suppress transient check errors during page transitions
      }
    }, checkInterval);
  }

  /**
   * Notifies Rehanza-Hub via /api/marketplace/meesho/session-callback.
   */
  private async notifyRehanzaHub(session: WorkerSession, cookies: any[]) {
    const { accountId, ticket } = session;
    console.log(
      `[Meesho Worker] [${accountId.slice(0, 8)}...] Transmitting authenticated session to Rehanza-Hub (ticket prefix: ${ticket.slice(0, 8)}...)...`
    );

    try {
      // Format cookies string
      const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

      // Read saved storage state
      let storageStateObj: any = null;
      if (fs.existsSync(session.storageStatePath)) {
        try {
          storageStateObj = JSON.parse(fs.readFileSync(session.storageStatePath, 'utf8'));
        } catch {}
      }

      const callbackUrl = `${this.config.hubUrl.replace(/\/+$/, '')}/api/marketplace/meesho/session-callback`;
      console.log(`[Meesho Worker] [${accountId.slice(0, 8)}...] Target callback URL: ${callbackUrl}`);

      const res = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-worker-secret': this.config.workerSecret,
        },
        body: JSON.stringify({
          accountId,
          ticket,
          sessionPayload: {
            cookies: cookieString,
            rawSession: JSON.stringify(storageStateObj || {}),
          },
          metadata: {
            supplierId: session.supplierId,
            supplierName: session.supplierName,
            sessionSource: 'browser_worker',
          },
        }),
      });

      const resText = await res.text().catch(() => '');
      let json: any = {};
      try {
        json = JSON.parse(resText);
      } catch {}

      console.log(
        `[Meesho Worker] [${accountId.slice(0, 8)}...] Callback HTTP status: ${res.status} ${res.statusText}`
      );

      if (res.ok && json.success) {
        session.state = 'CONNECTED';
        session.lastActivityAt = Date.now();
        console.log(
          `[Meesho Worker] [${accountId.slice(0, 8)}...] ✅ Rehanza-Hub acknowledged authenticated session! Status: CONNECTED`
        );
      } else {
        session.state = 'ERROR';
        const errMsg = json.error || resText || `HTTP ${res.status}`;
        session.error = `Hub rejected session (status: ${res.status}): ${errMsg}`;
        console.error(
          `[Meesho Worker] [${accountId.slice(0, 8)}...] ❌ Rehanza-Hub rejected session (status ${res.status}):`,
          errMsg
        );
      }
    } catch (err: any) {
      session.state = 'ERROR';
      session.error = `Failed to contact Rehanza-Hub: ${err.message}`;
      console.error(
        `[Meesho Worker] [${accountId.slice(0, 8)}...] ❌ Callback communication error:`,
        err.message
      );
    }
  }

  /**
   * Performs an active health check on a connected session.
   * Verifies that the session context is still valid and not redirected to login.
   */
  async checkSessionHealth(accountId: string): Promise<WorkerSessionStatusDTO> {
    const session = this.sessions.get(accountId);
    if (!session) {
      return {
        accountId,
        state: 'DISCONNECTED',
        startedAt: 0,
        lastActivityAt: 0,
      };
    }

    if (session.state !== 'CONNECTED' || !session.page || session.page.isClosed()) {
      return this.toStatusDTO(session);
    }

    try {
      const currentUrl = session.page.url();
      if (currentUrl.includes('/login')) {
        session.state = 'SESSION_EXPIRED';
        session.error = 'Session redirected to login portal.';
        console.warn(`[Meesho Worker] [${accountId}] Session expired: redirected to login.`);
      } else {
        session.lastActivityAt = Date.now();
      }
    } catch (err: any) {
      session.state = 'SESSION_EXPIRED';
      session.error = err.message;
    }

    return this.toStatusDTO(session);
  }

  /**
   * Closes the browser session for an account and deletes local storage state.
   */
  async closeSession(accountId: string): Promise<WorkerSessionStatusDTO> {
    const session = this.sessions.get(accountId);
    if (!session) {
      return {
        accountId,
        state: 'DISCONNECTED',
        startedAt: 0,
        lastActivityAt: 0,
      };
    }

    try {
      if (session.page && !session.page.isClosed()) {
        await session.page.close().catch(() => {});
      }
      if (session.browserContext) {
        await session.browserContext.close().catch(() => {});
      }
    } catch (err: any) {
      console.warn(`[Meesho Worker] [${accountId}] Cleanup error: ${err.message}`);
    }

    // Remove local storage state file
    if (fs.existsSync(session.storageStatePath)) {
      try {
        fs.unlinkSync(session.storageStatePath);
      } catch {}
    }

    session.state = 'DISCONNECTED';
    this.sessions.delete(accountId);
    console.log(`[Meesho Worker] [${accountId}] Session closed and cleaned up.`);

    return this.toStatusDTO(session);
  }

  /**
   * Retrieves status of an active session.
   */
  getSessionStatus(accountId: string): WorkerSessionStatusDTO {
    const session = this.sessions.get(accountId);
    if (!session) {
      return {
        accountId,
        state: 'DISCONNECTED',
        startedAt: 0,
        lastActivityAt: 0,
      };
    }
    return this.toStatusDTO(session);
  }

  /**
   * Extracts orders from Meesho Supplier Panel for the specified account.
   * Leverages active browser context or saved storage state.
   */
  async extractOrders(accountId: string, options: ExtractOrdersOptions = {}): Promise<ExtractedMeeshoOrder[]> {
    if (!accountId) {
      throw new Error('accountId is required for order extraction.');
    }

    let session = this.sessions.get(accountId);
    let tempContext: BrowserContext | null = null;
    let tempPage: Page | null = null;
    let page: Page | null = null;

    const storagePath = path.join(this.config.sessionsDir, `${accountId}.storageState.json`);
    if (!fs.existsSync(storagePath)) {
      throw new Error(`No authenticated session state found for account ${accountId}. Please connect Meesho first.`);
    }

    const browser = await this.ensureBrowser();

    if (session && session.page && !session.page.isClosed()) {
      page = session.page;
    } else {
      console.log(`[Meesho Worker] [${accountId.slice(0, 8)}...] Creating context from saved storage state for extraction...`);
      tempContext = await browser.newContext({
        storageState: storagePath,
        viewport: { width: 1280, height: 800 },
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      });
      tempPage = await tempContext.newPage();
      page = tempPage;
    }

    try {
      // Resolve supplier details
      let supplierIdentifier = session?.supplierId || '4zy6k';
      let supplierId = 4768417;
      let supplierName = session?.supplierName || 'Rehanza Lifestyle';

      // Ensure page is on panel
      if (!page.url().includes('supplier.meesho.com')) {
        await page.goto(`https://supplier.meesho.com/panel/v3/new/fulfillment/${supplierIdentifier}/orders/pending`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        await page.waitForTimeout(2000);
      }

      // Try prefetch to get exact IDs dynamically
      try {
        const prefetch = await page.evaluate(async (ident) => {
          const res = await fetch('/api/container/supplier/prefetch-supply-data', {
            method: 'POST',
            headers: { 'content-type': 'application/json', identifier: ident },
          }).catch(() => null);
          return res ? await res.json().catch(() => null) : null;
        }, supplierIdentifier);

        if (prefetch?.registrationStatus?.decodedToken) {
          const dt = prefetch.registrationStatus.decodedToken;
          if (dt.supplier_identifiers?.[0]) {
            supplierIdentifier = dt.supplier_identifiers[0];
          }
          if (dt.supplier_identifier_to_id_mapping?.[supplierIdentifier]) {
            supplierId = dt.supplier_identifier_to_id_mapping[supplierIdentifier];
          }
        }
      } catch {}

      const supplierDetails: SupplierDetails = {
        id: supplierId,
        identifier: supplierIdentifier,
        name: supplierName,
      };

      const extracted = await extractMeeshoOrders(page, supplierDetails, options);
      if (session) {
        session.lastActivityAt = Date.now();
      }
      return extracted;
    } finally {
      if (tempPage && !tempPage.isClosed()) {
        await tempPage.close().catch(() => {});
      }
      if (tempContext) {
        await tempContext.close().catch(() => {});
      }
    }
  }

  /**
   * Returns count of active sessions.
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Graceful shutdown of all browser sessions and Chromium.
   */
  async shutdown() {
    console.log('[Meesho Worker] Shutting down worker...');
    for (const accountId of Array.from(this.sessions.keys())) {
      await this.closeSession(accountId);
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
    console.log('[Meesho Worker] Worker shutdown complete.');
  }

  private toStatusDTO(session: WorkerSession): WorkerSessionStatusDTO {
    return {
      accountId: session.accountId,
      state: session.state,
      startedAt: session.startedAt,
      lastActivityAt: session.lastActivityAt,
      error: session.error,
      supplierId: session.supplierId,
      supplierName: session.supplierName,
    };
  }
}


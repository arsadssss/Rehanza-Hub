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
import {
  extractMeeshoPayments,
  ExtractedMeeshoPayments,
} from './payment-extractor';
import { performAutoReauth, ReauthConfig } from './auto-reauth';


const OFFICIAL_MEESHO_LOGIN_URL = 'https://supplier.meesho.com/panel/v3/new/root/login';
const MEESHO_PANEL_BASE = 'https://supplier.meesho.com/panel/v3/new/';

export class MeeshoBrowserManager {
  private browser: Browser | null = null;
  private sessions: Map<string, WorkerSession> = new Map();
  private config: WorkerConfig;
  /** Per-account re-auth lock — prevents concurrent re-auth for the same account */
  private reauthing: Set<string> = new Set();

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
      session.page = newPage;
      const initialUrl = newPage.url().split('?')[0];
      console.log(`[Meesho Worker] [${accountId.slice(0, 8)}...] New tab/window opened in context. URL: ${initialUrl}`);
      newPage.on('framenavigated', (frame) => {
        if (frame === newPage.mainFrame()) {
          const safeNavUrl = newPage.url().split('?')[0];
          console.log(`[Meesho Worker] [${accountId.slice(0, 8)}...] Page navigated: ${safeNavUrl}`);
        }
      });
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
        const cookies = await browserContext?.cookies().catch(() => []);
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
          if (activePage.isClosed()) continue;
          const currentUrl = activePage.url();

          // 1. URL Authentication Signal: Identify login paths specifically
          const isLoginUrl =
            currentUrl.includes('/login') ||
            currentUrl.includes('/signin') ||
            currentUrl.includes('/signup') ||
            currentUrl.includes('/register') ||
            currentUrl.includes('/auth/otp') ||
            currentUrl.includes('/root/login');

          const isNotLoginUrl = !isLoginUrl;

          const isPanelUrl =
            currentUrl.includes('supplier.meesho.com/panel/') ||
            currentUrl.startsWith(MEESHO_PANEL_BASE);

          const hasDashboardPath =
            currentUrl.includes('/growth') ||
            currentUrl.includes('/fulfillment') ||
            currentUrl.includes('/home') ||
            currentUrl.includes('/orders') ||
            currentUrl.includes('/payments') ||
            currentUrl.includes('/payouts') ||
            currentUrl.includes('/catalogs') ||
            currentUrl.includes('/returns') ||
            currentUrl.includes('/root');

          const isAuthUrlMatch = isPanelUrl && isNotLoginUrl;

          // 2. DOM Signals: Inspect page without capturing sensitive data
          let hasAuthDom = false;
          let hasNoPasswordInputs = true;
          let supplierName: string | undefined;

          try {
            const passwordInputs = await activePage.$$('input[type="password"]');
            hasNoPasswordInputs = passwordInputs.length === 0;

            const shellElement = await activePage.$(
              'nav, aside, header, [data-testid*="supplier"], [class*="Supplier"], [class*="profile"], [class*="dashboard"], [data-testid*="header"], [data-testid*="sidebar"]'
            );

            if (shellElement && hasNoPasswordInputs && isNotLoginUrl) {
              hasAuthDom = true;
            }

            // Extract supplier display name if visible
            const nameEl = await activePage.$(
              '[data-testid="supplier-name"], [class*="SupplierName"], [class*="profile-name"], [class*="supplierName"], [data-testid*="user-name"]'
            );
            if (nameEl) {
              const text = await nameEl.innerText().catch(() => '');
              if (text) supplierName = text.trim();
            }
          } catch {
            // DOM inspection is non-blocking
          }

          // 3. Storage Signals: Inspect localStorage & sessionStorage for auth tokens
          let hasStorageAuth = false;
          let storageSupplierId: string | undefined;
          let storageSupplierName: string | undefined;
          try {
            const storageData = await activePage.evaluate(() => {
              try {
                let authFound = false;
                let sId: string | undefined;
                let sName: string | undefined;

                const checkStorage = (store: Storage) => {
                  for (let i = 0; i < store.length; i++) {
                    const k = store.key(i);
                    if (!k) continue;
                    const val = store.getItem(k) || '';
                    const lk = k.toLowerCase();
                    if (
                      lk.includes('token') ||
                      lk.includes('auth') ||
                      lk.includes('session') ||
                      lk.includes('user') ||
                      lk.includes('supplier')
                    ) {
                      if (val && val.length > 5) authFound = true;
                    }
                    if (val.includes('supplier_id') || val.includes('identifier')) {
                      try {
                        const parsed = JSON.parse(val);
                        if (parsed.supplier_id) sId = String(parsed.supplier_id);
                        if (parsed.identifier) sId = sId || parsed.identifier;
                        if (parsed.name || parsed.supplier_name) sName = parsed.name || parsed.supplier_name;
                      } catch {}
                    }
                  }
                };

                checkStorage(localStorage);
                checkStorage(sessionStorage);
                return { authFound, sId, sName };
              } catch {
                return { authFound: false };
              }
            }).catch(() => null);

            if (storageData?.authFound) hasStorageAuth = true;
            if (storageData?.sId) storageSupplierId = storageData.sId;
            if (storageData?.sName) storageSupplierName = storageData.sName;
          } catch {
            // Storage inspection is non-blocking
          }

          // Dynamically detect supplier details from URL
          let detectedIdentifier: string | undefined = storageSupplierId;
          let detectedNumericId: number | undefined;
          let detectedSupplierName: string | undefined = supplierName || storageSupplierName;

          const panelMatch = currentUrl.match(
            /\/panel\/v3\/new\/(?:growth|fulfillment|payouts|home|pricing|catalog|notices|inventory|root)\/([a-zA-Z0-9_-]+)/
          );
          if (panelMatch && panelMatch[1] && !['root', 'login', 'signup', 'signin'].includes(panelMatch[1])) {
            detectedIdentifier = panelMatch[1];
          }

          try {
            const parsedUrl = new URL(currentUrl);
            const queryIdent = parsedUrl.searchParams.get('identifier') || parsedUrl.searchParams.get('supplier_id');
            if (queryIdent && !detectedIdentifier) {
              detectedIdentifier = queryIdent;
            }
          } catch {}

          // Positive authentication condition:
          // Either URL indicates panel dashboard (and not login), or on meesho domain with auth cookies/storage and panel DOM
          const isPositiveAuth =
            (isAuthUrlMatch && (hasDashboardPath || hasAuthCookies || hasStorageAuth || hasAuthDom)) ||
            (currentUrl.includes('supplier.meesho.com') && (hasAuthCookies || hasStorageAuth) && hasAuthDom && isNotLoginUrl) ||
            (currentUrl.includes('supplier.meesho.com') && (hasAuthCookies || hasStorageAuth) && hasDashboardPath && isNotLoginUrl);

          if (isPositiveAuth) {
            clearInterval(intervalId);

            // Fetch prefetch-supply-data directly on activePage to extract exact supplier metadata
            try {
              const prefetch = await activePage.evaluate(async (ident) => {
                const headers: Record<string, string> = { 'content-type': 'application/json' };
                if (ident) headers['identifier'] = ident;
                const res = await fetch('/api/container/supplier/prefetch-supply-data', {
                  method: 'POST',
                  headers,
                  body: ident ? JSON.stringify({ identifier: ident }) : JSON.stringify({}),
                }).catch(() => null);
                return res && res.ok ? await res.json().catch(() => null) : null;
              }, detectedIdentifier).catch(() => null);

              if (prefetch?.supplier) {
                if (prefetch.supplier.identifier) detectedIdentifier = prefetch.supplier.identifier;
                if (prefetch.supplier.supplier_id) detectedNumericId = Number(prefetch.supplier.supplier_id);
                if (prefetch.supplier.name) detectedSupplierName = prefetch.supplier.name;
              }

              if (prefetch?.registrationStatus?.decodedToken) {
                const dt = prefetch.registrationStatus.decodedToken;
                if (!detectedIdentifier && dt.supplier_identifiers?.[0]) {
                  detectedIdentifier = dt.supplier_identifiers[0];
                }
                if (detectedIdentifier && dt.supplier_identifier_to_id_mapping?.[detectedIdentifier]) {
                  detectedNumericId = Number(dt.supplier_identifier_to_id_mapping[detectedIdentifier]);
                }
              }
            } catch {}

            // Extract from cookies if available
            const sidCookie = (cookies || []).find((c: any) => c.name === 's_id' || c.name === 'supplier_id');
            if (!detectedNumericId && sidCookie?.value && /^\d+$/.test(sidCookie.value)) {
              detectedNumericId = Number(sidCookie.value);
            }
            const azCookie = (cookies || []).find((c: any) => c.name === 'current_az_identifier');
            if (!detectedIdentifier && azCookie?.value) {
              detectedIdentifier = azCookie.value;
            }

            // Extract from window.__NEXT_DATA__ if available
            try {
              const pageMeta = await activePage.evaluate(() => {
                const w = window as any;
                const nextProps = w.__NEXT_DATA__?.props?.pageProps;
                return {
                  sId: nextProps?.supplierId || nextProps?.supplier_id || nextProps?.supplier?.id || nextProps?.supplier_details?.id,
                  ident: nextProps?.supplierIdentifier || nextProps?.supplier_identifier || nextProps?.identifier,
                  name: nextProps?.supplierName || nextProps?.supplier?.name,
                };
              }).catch(() => null);
              if (pageMeta) {
                if (!detectedNumericId && pageMeta.sId && /^\d+$/.test(String(pageMeta.sId))) {
                  detectedNumericId = Number(pageMeta.sId);
                }
                if (!detectedIdentifier && pageMeta.ident) {
                  detectedIdentifier = pageMeta.ident;
                }
                if (!detectedSupplierName && pageMeta.name) {
                  detectedSupplierName = pageMeta.name;
                }
              }
            } catch {}

            // Ensure numeric ID is parsed if possible
            if (!detectedNumericId && detectedIdentifier && /^\d+$/.test(detectedIdentifier)) {
              detectedNumericId = Number(detectedIdentifier);
            }

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
            if (detectedIdentifier || detectedNumericId) {
              console.log(
                `[Meesho Worker] [${accountId.slice(0, 8)}...] Detected Supplier: ${detectedSupplierName || 'Unknown'} (Identifier: ${detectedIdentifier || 'N/A'}, ID: ${detectedNumericId || 'N/A'})`
              );
            }

            session.state = 'AUTHENTICATING';
            session.supplierId = detectedNumericId
              ? String(detectedNumericId)
              : (detectedIdentifier || 'meesho_supplier');
            session.supplierName = detectedSupplierName || 'Meesho Supplier';
            session.identifier = detectedIdentifier || null;
            session.supplierNumericId = detectedNumericId;
            session.page = activePage;

            // Save Playwright storage state locally
            try {
              await browserContext?.storageState({ path: session.storageStatePath });
            } catch (storageErr: any) {
              console.warn(`[Meesho Worker] Could not save storageState: ${storageErr.message}`);
            }

            // Persist metadata file alongside storage state
            const metaPath = path.join(this.config.sessionsDir, `${accountId}.meta.json`);
            try {
              fs.writeFileSync(
                metaPath,
                JSON.stringify(
                  {
                    supplierId: session.supplierId,
                    supplierName: session.supplierName,
                    identifier: session.identifier,
                    supplierNumericId: session.supplierNumericId,
                  },
                  null,
                  2
                )
              );
            } catch {}

            // Transmit session to Rehanza-Hub with retry mechanism
            await this.notifyRehanzaHub(session, cookies || [], openPages.length);
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
   * Employs retry with exponential backoff and structured safe logging.
   */
  private async notifyRehanzaHub(session: WorkerSession, cookies: any[], pageCount: number = 1) {
    const { accountId, ticket } = session;
    console.log(
      `[Meesho Worker] [${accountId.slice(0, 8)}...] Transmitting authenticated session to Rehanza-Hub (ticket prefix: ${ticket.slice(0, 8)}...)...`
    );

    const callbackUrl = `${this.config.hubUrl.replace(/\/+$/, '')}/api/marketplace/meesho/session-callback`;
    const cookieString = (cookies || []).map((c) => `${c.name}=${c.value}`).join('; ');

    let storageStateObj: any = null;
    if (fs.existsSync(session.storageStatePath)) {
      try {
        storageStateObj = JSON.parse(fs.readFileSync(session.storageStatePath, 'utf8'));
      } catch {}
    }

    const payload = {
      accountId,
      ticket,
      sessionPayload: {
        cookies: cookieString,
        rawSession: JSON.stringify(storageStateObj || {}),
      },
      metadata: {
        supplierId: session.supplierId,
        supplierName: session.supplierName,
        identifier: session.identifier,
        supplierNumericId: session.supplierNumericId,
        sessionSource: 'browser_worker',
      },
    };

    let attempt = 0;
    const maxAttempts = 3;
    let callbackSuccess = false;
    let lastError: string | null = null;

    while (attempt < maxAttempts && !callbackSuccess) {
      attempt++;
      try {
        console.log(
          `[Meesho Worker] [${accountId.slice(0, 8)}...] Callback attempt ${attempt}/${maxAttempts} -> ${callbackUrl}`
        );

        const res = await fetch(callbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-worker-secret': this.config.workerSecret,
          },
          body: JSON.stringify(payload),
        });

        const resText = await res.text().catch(() => '');
        let json: any = {};
        try {
          json = JSON.parse(resText);
        } catch {}

        if (res.ok && json.success) {
          callbackSuccess = true;
          session.state = 'CONNECTED';
          session.lastActivityAt = Date.now();
          console.log(
            `[MEESHO_CONNECT] accountId=${accountId.slice(0, 8)}... ticketId=${ticket.slice(0, 8)}... pageCount=${pageCount} authenticated=true supplierIdentityFound=${!!(session.supplierId || session.identifier)} callbackStatus=CONNECTED`
          );
          console.log(
            `[Meesho Worker] [${accountId.slice(0, 8)}...] ✅ Rehanza-Hub acknowledged authenticated session! Status: CONNECTED`
          );
          return;
        } else {
          lastError = json.error || resText || `HTTP ${res.status}`;
          console.warn(
            `[Meesho Worker] [${accountId.slice(0, 8)}...] Callback attempt ${attempt} rejected (status ${res.status}): ${lastError}`
          );
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          }
        }
      } catch (err: any) {
        lastError = err.message;
        console.warn(
          `[Meesho Worker] [${accountId.slice(0, 8)}...] Callback attempt ${attempt} network error: ${err.message}`
        );
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    if (!callbackSuccess) {
      session.state = 'ERROR';
      session.error = `Hub rejected session after ${maxAttempts} attempts: ${lastError}`;
      console.error(
        `[MEESHO_CONNECT] accountId=${accountId.slice(0, 8)}... ticketId=${ticket.slice(0, 8)}... pageCount=${pageCount} authenticated=true supplierIdentityFound=${!!(session.supplierId || session.identifier)} callbackStatus=ERROR error="${lastError}"`
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
    const storagePath = path.join(this.config.sessionsDir, `${accountId}.storageState.json`);
    const metaPath = path.join(this.config.sessionsDir, `${accountId}.meta.json`);

    // Always purge on-disk session artifacts
    if (fs.existsSync(storagePath)) {
      try { fs.unlinkSync(storagePath); } catch {}
    }
    if (fs.existsSync(metaPath)) {
      try { fs.unlinkSync(metaPath); } catch {}
    }

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
      // === Resolve supplier identity from .meta.json (same approach as extractPayments) ===
      let supplierIdentifier: string | undefined;
      let supplierId: number | undefined;
      let supplierName: string | undefined;

      const metaPath = path.join(this.config.sessionsDir, `${accountId}.meta.json`);
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          supplierIdentifier = meta.identifier || (meta.supplierId && !/^\d+$/.test(meta.supplierId) ? meta.supplierId : undefined);
          supplierId = meta.supplierNumericId
            ? Number(meta.supplierNumericId)
            : (meta.supplierId && /^\d+$/.test(meta.supplierId) ? Number(meta.supplierId) : undefined);
          supplierName = meta.supplierName || undefined;
          console.log(
            `[Meesho Worker] [${accountId.slice(0, 8)}...] Orders: Resolved from .meta.json: ` +
            `identifier=${supplierIdentifier || 'N/A'}, id=${supplierId || 'N/A'}`
          );
        } catch {
          console.warn(`[Meesho Worker] [${accountId.slice(0, 8)}...] Could not read .meta.json for orders, will use prefetch.`);
        }
      }

      // Fall back to in-memory session fields
      if (!supplierIdentifier && session?.identifier) supplierIdentifier = session.identifier;
      if (!supplierId && session?.supplierNumericId) supplierId = session.supplierNumericId;
      if (!supplierName && session?.supplierName) supplierName = session.supplierName;

      // Extract from cookies if available
      if (!supplierId || !supplierIdentifier) {
        try {
          const cookies = await (page.context ? page.context().cookies() : []).catch(() => []);
          const sidCookie = cookies.find((c: any) => c.name === 's_id' || c.name === 'supplier_id');
          if (!supplierId && sidCookie?.value && /^\d+$/.test(sidCookie.value)) {
            supplierId = Number(sidCookie.value);
          }
          const azCookie = cookies.find((c: any) => c.name === 'current_az_identifier');
          if (!supplierIdentifier && azCookie?.value) {
            supplierIdentifier = azCookie.value;
          }
        } catch {}
      }

      // Ensure page is on panel for prefetch to work
      if (!page.url().includes('supplier.meesho.com')) {
        const navUrl = supplierIdentifier
          ? `https://supplier.meesho.com/panel/v3/new/fulfillment/${supplierIdentifier}/orders/pending`
          : `https://supplier.meesho.com/panel/v3/new/home`;
        await page.goto(navUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
      }

      // Check window.__NEXT_DATA__
      if (!supplierId || !supplierIdentifier) {
        try {
          const pageMeta = await page.evaluate(() => {
            const w = window as any;
            const nextProps = w.__NEXT_DATA__?.props?.pageProps;
            return {
              sId: nextProps?.supplierId || nextProps?.supplier_id || nextProps?.supplier?.id || nextProps?.supplier_details?.id,
              ident: nextProps?.supplierIdentifier || nextProps?.supplier_identifier || nextProps?.identifier,
              name: nextProps?.supplierName || nextProps?.supplier?.name,
            };
          }).catch(() => null);
          if (pageMeta) {
            if (!supplierId && pageMeta.sId && /^\d+$/.test(String(pageMeta.sId))) supplierId = Number(pageMeta.sId);
            if (!supplierIdentifier && pageMeta.ident) supplierIdentifier = pageMeta.ident;
            if (!supplierName && pageMeta.name) supplierName = pageMeta.name;
          }
        } catch {}
      }

      // Live prefetch to fill any missing identity fields
      if (!supplierIdentifier || !supplierId) {
        try {
          const prefetch = await page.evaluate(async (ident) => {
            const headers: Record<string, string> = {
              'content-type': 'application/json',
              'client-type': 'd-web',
              'client-package-version': '1.0.4',
            };
            if (ident) headers['identifier'] = ident;
            const res = await fetch('/api/container/supplier/prefetch-supply-data', {
              method: 'POST',
              headers,
              body: ident ? JSON.stringify({ identifier: ident }) : JSON.stringify({}),
            }).catch(() => null);
            return res && res.ok ? res.json().catch(() => null) : null;
          }, supplierIdentifier);

          if (prefetch?.supplier) {
            if (!supplierIdentifier && prefetch.supplier.identifier) supplierIdentifier = prefetch.supplier.identifier;
            if (!supplierId && prefetch.supplier.supplier_id) supplierId = Number(prefetch.supplier.supplier_id);
            if (!supplierName && prefetch.supplier.name) supplierName = prefetch.supplier.name;
          }
          if (prefetch?.registrationStatus?.decodedToken) {
            const dt = prefetch.registrationStatus.decodedToken;
            if (!supplierIdentifier && dt.supplier_identifiers?.[0]) {
              supplierIdentifier = dt.supplier_identifiers[0];
            }
            if (supplierIdentifier && !supplierId && dt.supplier_identifier_to_id_mapping?.[supplierIdentifier]) {
              supplierId = Number(dt.supplier_identifier_to_id_mapping[supplierIdentifier]);
            }
          }
        } catch {}
      }

      // Soften / Finalize identity:
      if (!supplierId && supplierIdentifier && /^\d+$/.test(supplierIdentifier)) {
        supplierId = Number(supplierIdentifier);
      }
      if (!supplierIdentifier && supplierId) {
        supplierIdentifier = String(supplierId);
      }

      // Only fail if NEITHER identifier NOR supplierId could be resolved
      if (!supplierIdentifier && !supplierId) {
        throw new Error(
          `Cannot extract orders for account ${accountId}: supplier identity could not be resolved. ` +
          `identifier=${supplierIdentifier || 'missing'}, supplierId=${supplierId || 'missing'}. ` +
          `Please ensure the account is fully connected with a completed login.`
        );
      }

      // Default numeric ID to 0 if only slug identifier is known (avoids 500 crashes)
      if (!supplierId) {
        supplierId = 0;
      }

      // Cache resolved identity back to .meta.json
      try {
        fs.writeFileSync(
          metaPath,
          JSON.stringify(
            {
              supplierId: String(supplierId || supplierIdentifier),
              supplierName: supplierName || 'Meesho Supplier',
              identifier: supplierIdentifier,
              supplierNumericId: supplierId || null,
            },
            null,
            2
          )
        );
      } catch {}

      const supplierDetails: SupplierDetails = {
        id: supplierId,
        identifier: supplierIdentifier,
        name: supplierName || supplierIdentifier,
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
   * Extracts payment data (Upcoming, Unscheduled, Completed, Overview graph)
   * from Meesho Supplier Panel for the specified account.
   * Supplier identity is resolved from persisted .meta.json (written on login),
   * with live prefetch as fallback. Never falls back to hardcoded values.
   */
  async extractPayments(accountId: string): Promise<ExtractedMeeshoPayments> {
    if (!accountId) {
      throw new Error('accountId is required for payment extraction.');
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
      console.log(`[Meesho Worker] [${accountId.slice(0, 8)}...] Creating context from storage state for payment extraction...`);
      tempContext = await browser.newContext({
        storageState: storagePath,
        viewport: { width: 1440, height: 900 },
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      });
      tempPage = await tempContext.newPage();
      page = tempPage;
    }

    try {
      // === STEP 1: Resolve supplier identity from .meta.json (written on successful login) ===
      let supplierIdentifier: string | undefined;
      let supplierId: number | undefined;
      let supplierName: string | undefined;

      const metaPath = path.join(this.config.sessionsDir, `${accountId}.meta.json`);
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          supplierIdentifier = meta.identifier || (meta.supplierId && !/^\d+$/.test(meta.supplierId) ? meta.supplierId : undefined);
          supplierId = meta.supplierNumericId
            ? Number(meta.supplierNumericId)
            : (meta.supplierId && /^\d+$/.test(meta.supplierId) ? Number(meta.supplierId) : undefined);
          supplierName = meta.supplierName || undefined;
          console.log(
            `[Meesho Worker] [${accountId.slice(0, 8)}...] Payments: Resolved from .meta.json: ` +
            `identifier=${supplierIdentifier || 'N/A'}, id=${supplierId || 'N/A'}, name=${supplierName || 'N/A'}`
          );
        } catch {
          console.warn(`[Meesho Worker] [${accountId.slice(0, 8)}...] Could not read .meta.json, will use prefetch.`);
        }
      }

      // Also try in-memory session fields (populated on active login)
      if (!supplierIdentifier && session?.identifier) {
        supplierIdentifier = session.identifier;
      }
      if (!supplierId && session?.supplierNumericId) {
        supplierId = session.supplierNumericId;
      }
      if (!supplierName && session?.supplierName) {
        supplierName = session.supplierName;
      }

      // Extract from cookies if available
      if (!supplierId || !supplierIdentifier) {
        try {
          const cookies = await (page.context ? page.context().cookies() : []).catch(() => []);
          const sidCookie = cookies.find((c: any) => c.name === 's_id' || c.name === 'supplier_id');
          if (!supplierId && sidCookie?.value && /^\d+$/.test(sidCookie.value)) {
            supplierId = Number(sidCookie.value);
          }
          const azCookie = cookies.find((c: any) => c.name === 'current_az_identifier');
          if (!supplierIdentifier && azCookie?.value) {
            supplierIdentifier = azCookie.value;
          }
        } catch {}
      }

      // === STEP 2: Ensure page is on Meesho panel (navigate if needed) ===
      const pageUrl = page.url();
      if (!pageUrl.includes('supplier.meesho.com')) {
        const navUrl = supplierIdentifier
          ? `https://supplier.meesho.com/panel/v3/new/payouts/${supplierIdentifier}/payments`
          : `https://supplier.meesho.com/panel/v3/new/home`;
        console.log(`[Meesho Worker] [${accountId.slice(0, 8)}...] Navigating to panel: ${navUrl.split('?')[0]}`);
        await page.goto(navUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
      }

      // Check window.__NEXT_DATA__
      if (!supplierId || !supplierIdentifier) {
        try {
          const pageMeta = await page.evaluate(() => {
            const w = window as any;
            const nextProps = w.__NEXT_DATA__?.props?.pageProps;
            return {
              sId: nextProps?.supplierId || nextProps?.supplier_id || nextProps?.supplier?.id || nextProps?.supplier_details?.id,
              ident: nextProps?.supplierIdentifier || nextProps?.supplier_identifier || nextProps?.identifier,
              name: nextProps?.supplierName || nextProps?.supplier?.name,
            };
          }).catch(() => null);
          if (pageMeta) {
            if (!supplierId && pageMeta.sId && /^\d+$/.test(String(pageMeta.sId))) supplierId = Number(pageMeta.sId);
            if (!supplierIdentifier && pageMeta.ident) supplierIdentifier = pageMeta.ident;
            if (!supplierName && pageMeta.name) supplierName = pageMeta.name;
          }
        } catch {}
      }

      // === STEP 3: Live prefetch to fill any missing identity fields ===
      if (!supplierIdentifier || !supplierId) {
        console.log(`[Meesho Worker] [${accountId.slice(0, 8)}...] Fetching supplier identity via prefetch-supply-data...`);
        try {
          const prefetch = await page.evaluate(async (ident) => {
            const headers: Record<string, string> = {
              'content-type': 'application/json',
              'client-type': 'd-web',
              'client-package-version': '1.0.4',
            };
            if (ident) headers['identifier'] = ident;
            const res = await fetch('/api/container/supplier/prefetch-supply-data', {
              method: 'POST',
              headers,
              body: ident ? JSON.stringify({ identifier: ident }) : JSON.stringify({}),
            }).catch(() => null);
            return res && res.ok ? res.json().catch(() => null) : null;
          }, supplierIdentifier);

          if (prefetch?.supplier) {
            if (!supplierIdentifier && prefetch.supplier.identifier) {
              supplierIdentifier = prefetch.supplier.identifier;
            }
            if (!supplierId && prefetch.supplier.supplier_id) {
              supplierId = Number(prefetch.supplier.supplier_id);
            }
            if (!supplierName && prefetch.supplier.name) {
              supplierName = prefetch.supplier.name;
            }
          }

          if (prefetch?.registrationStatus?.decodedToken) {
            const dt = prefetch.registrationStatus.decodedToken;
            if (!supplierIdentifier && dt.supplier_identifiers?.[0]) {
              supplierIdentifier = dt.supplier_identifiers[0];
            }
            if (supplierIdentifier && !supplierId && dt.supplier_identifier_to_id_mapping?.[supplierIdentifier]) {
              supplierId = Number(dt.supplier_identifier_to_id_mapping[supplierIdentifier]);
            }
          }

          console.log(
            `[Meesho Worker] [${accountId.slice(0, 8)}...] Prefetch result: ` +
            `identifier=${supplierIdentifier || 'N/A'}, id=${supplierId || 'N/A'}, name=${supplierName || 'N/A'}`
          );
        } catch {
          // Prefetch failure is non-fatal
        }
      }

      // Soften / Finalize identity:
      if (!supplierId && supplierIdentifier && /^\d+$/.test(supplierIdentifier)) {
        supplierId = Number(supplierIdentifier);
      }
      if (!supplierIdentifier && supplierId) {
        supplierIdentifier = String(supplierId);
      }

      // === STEP 4: Guard — only fail if NEITHER identifier NOR supplierId could be resolved ===
      if (!supplierIdentifier && !supplierId) {
        throw new Error(
          `Cannot extract payments for account ${accountId}: supplier identity could not be resolved. ` +
          `identifier=${supplierIdentifier || 'missing'}, supplierId=${supplierId || 'missing'}. ` +
          `Please ensure the account is fully connected with a completed login.`
        );
      }

      // Default numeric ID to 0 if only slug identifier is known (avoids 500 crashes)
      if (!supplierId) {
        supplierId = 0;
      }

      // Cache resolved identity back to .meta.json
      try {
        fs.writeFileSync(
          metaPath,
          JSON.stringify(
            {
              supplierId: String(supplierId || supplierIdentifier),
              supplierName: supplierName || 'Meesho Supplier',
              identifier: supplierIdentifier,
              supplierNumericId: supplierId || null,
            },
            null,
            2
          )
        );
      } catch {}

      const supplierDetails: SupplierDetails = {
        id: supplierId,
        identifier: supplierIdentifier,
        name: supplierName || supplierIdentifier,
      };

      console.log(
        `[Meesho Worker] [${accountId.slice(0, 8)}...] Extracting payments for: ` +
        `${supplierDetails.name} (${supplierDetails.identifier} / ID: ${supplierDetails.id})`
      );

      const extracted = await extractMeeshoPayments(page, supplierDetails);
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
   * Attempts automatic re-authentication for an account using stored credentials.
   * Uses a per-account lock to prevent concurrent re-auth storms.
   * If re-auth succeeds, updates the in-memory session and notifies Rehanza-Hub.
   *
   * @returns true if re-auth was successful, false otherwise.
   */
  async attemptAutoReauth(accountId: string): Promise<boolean> {
    if (this.reauthing.has(accountId)) {
      console.log(`[Meesho Worker] [${accountId.slice(0, 8)}...] Re-auth already in progress. Waiting for completion...`);
      // Wait for ongoing reauth to finish (poll up to 60s)
      const deadline = Date.now() + 60000;
      while (this.reauthing.has(accountId) && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
      }
      // Check if storage state now exists (indicating reauth succeeded)
      const storagePath = path.join(this.config.sessionsDir, `${accountId}.storageState.json`);
      return fs.existsSync(storagePath);
    }

    this.reauthing.add(accountId);
    try {
      const browser = await this.ensureBrowser();
      const reauthConfig: ReauthConfig = {
        hubUrl: this.config.hubUrl,
        workerSecret: this.config.workerSecret,
        sessionsDir: this.config.sessionsDir,
        loginTimeoutMs: 90000,
      };

      const result = await performAutoReauth(accountId, browser, reauthConfig);

      if (result.success) {
        console.log(`[Meesho Worker] [${accountId.slice(0, 8)}...] ✅ Auto re-auth succeeded.`);

        // Update or create in-memory session entry
        const storagePath = path.join(this.config.sessionsDir, `${accountId}.storageState.json`);
        const existingSession = this.sessions.get(accountId);
        if (existingSession) {
          existingSession.state = 'CONNECTED';
          existingSession.identifier = result.identifier;
          existingSession.supplierNumericId = result.supplierNumericId;
          existingSession.supplierName = result.supplierName;
          existingSession.supplierId = result.supplierNumericId
            ? String(result.supplierNumericId)
            : result.identifier;
          existingSession.lastActivityAt = Date.now();
          delete existingSession.error;
        }

        // Notify Hub that session is refreshed
        try {
          const callbackUrl = `${this.config.hubUrl.replace(/\/+$/, '')}/api/marketplace/meesho/session-callback`;
          const storageStateObj = fs.existsSync(storagePath)
            ? JSON.parse(fs.readFileSync(storagePath, 'utf8'))
            : {};

          await fetch(callbackUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-worker-secret': this.config.workerSecret,
            },
            body: JSON.stringify({
              accountId,
              ticket: existingSession?.ticket || `reauth_${Date.now()}`,
              sessionPayload: {
                cookies: '',
                rawSession: JSON.stringify(storageStateObj),
              },
              metadata: {
                supplierId: result.supplierNumericId ? String(result.supplierNumericId) : result.identifier,
                supplierName: result.supplierName,
                identifier: result.identifier,
                supplierNumericId: result.supplierNumericId,
                sessionSource: 'auto_reauth',
              },
            }),
          }).catch((e) => {
            console.warn(`[Meesho Worker] [${accountId.slice(0, 8)}...] Hub reauth callback warning: ${e.message}`);
          });
        } catch (notifyErr: any) {
          console.warn(`[Meesho Worker] [${accountId.slice(0, 8)}...] Could not notify Hub after reauth: ${notifyErr.message}`);
        }

        return true;
      } else {
        console.warn(`[Meesho Worker] [${accountId.slice(0, 8)}...] ❌ Auto re-auth failed: ${result.reason}`);

        // Mark session as error state
        const existingSession = this.sessions.get(accountId);
        if (existingSession) {
          existingSession.state = 'ERROR';
          existingSession.error = `Auto re-auth failed: ${result.reason}`;
        }

        return false;
      }
    } finally {
      this.reauthing.delete(accountId);
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


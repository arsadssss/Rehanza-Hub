/**
 * Meesho Automatic Re-Authentication Module
 *
 * When an existing browser session is detected as expired or invalid,
 * this module uses stored encrypted credentials (fetched from Rehanza-Hub)
 * to perform an automated re-login, saving a fresh authenticated session.
 *
 * SECURITY:
 * - Credentials are fetched from Hub via worker-secret-authenticated endpoint.
 * - Credentials travel over loopback (localhost) only.
 * - Credentials are NEVER logged.
 * - Credentials are used only in browser automation context (filled into page fields).
 * - Per-account lock prevents concurrent re-auth storms.
 * - Maximum 1 automatic retry per sync cycle — no infinite loops.
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';

const OFFICIAL_MEESHO_LOGIN_URL = 'https://supplier.meesho.com/panel/v3/new/root/login';
const MEESHO_PANEL_BASE = 'https://supplier.meesho.com/panel/v3/new/';

export interface ReauthConfig {
  hubUrl: string;
  workerSecret: string;
  sessionsDir: string;
  loginTimeoutMs?: number;
}

export interface ReauthResult {
  success: boolean;
  reason?: string;
  identifier?: string;
  supplierNumericId?: number;
  supplierName?: string;
}

/**
 * Fetches decrypted credentials from Rehanza-Hub for an account.
 * Only accessible with valid worker secret.
 * Returns null if credentials are not stored.
 */
async function fetchStoredCredentials(
  accountId: string,
  hubUrl: string,
  workerSecret: string
): Promise<{ loginIdentifier: string; password: string } | null> {
  try {
    const url = `${hubUrl.replace(/\/+$/, '')}/api/marketplace/meesho/credentials/worker?accountId=${encodeURIComponent(accountId)}`;
    const res = await fetch(url, {
      headers: { 'x-worker-secret': workerSecret },
    });

    if (res.status === 404) {
      // No credentials stored — not an error, user just hasn't set them yet
      return null;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Hub credentials endpoint returned HTTP ${res.status}: ${text}`);
    }

    const json = await res.json();
    if (!json.success || !json.loginIdentifier || !json.password) {
      return null;
    }

    return { loginIdentifier: json.loginIdentifier, password: json.password };
  } catch (err: any) {
    console.error(`[Auto Re-Auth] [${accountId.slice(0, 8)}...] Failed to fetch credentials: ${err.message}`);
    return null;
  }
}

/**
 * Performs automated Meesho login using stored credentials.
 *
 * Steps:
 * 1. Fetch credentials from Hub.
 * 2. Launch isolated browser context.
 * 3. Navigate to official Meesho login.
 * 4. Fill login identifier + password and submit.
 * 5. Wait for authenticated panel.
 * 6. Save fresh storage state + meta.
 *
 * @returns ReauthResult indicating success/failure and resolved supplier identity.
 */
export async function performAutoReauth(
  accountId: string,
  browser: Browser,
  config: ReauthConfig
): Promise<ReauthResult> {
  const { hubUrl, workerSecret, sessionsDir, loginTimeoutMs = 90000 } = config;
  const logPrefix = `[Auto Re-Auth] [${accountId.slice(0, 8)}...]`;

  console.log(`${logPrefix} Starting automatic re-authentication...`);

  // 1. Fetch stored credentials from Hub
  const credentials = await fetchStoredCredentials(accountId, hubUrl, workerSecret);
  if (!credentials) {
    return {
      success: false,
      reason: 'No stored credentials found. Please use "Update Credentials" in Marketplace settings to enable auto re-auth.',
    };
  }

  const storagePath = path.join(sessionsDir, `${accountId}.storageState.json`);
  const metaPath = path.join(sessionsDir, `${accountId}.meta.json`);

  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    // 2. Create isolated browser context (no pre-existing cookies)
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    });
    page = await context.newPage();

    // 3. Navigate to official Meesho login page
    console.log(`${logPrefix} Navigating to official Meesho login portal...`);
    await page.goto(OFFICIAL_MEESHO_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 4. Fill login identifier (email or phone)
    console.log(`${logPrefix} Filling login form...`);
    try {
      // Try email/phone input — Meesho uses different selectors depending on version
      const identifierSelectors = [
        'input[type="email"]',
        'input[type="tel"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="phone" i]',
        'input[placeholder*="mobile" i]',
        'input[name="email"]',
        'input[name="phone"]',
        'input[name="login"]',
        'input[autocomplete="email"]',
        'input[autocomplete="tel"]',
      ];

      let identifierFilled = false;
      for (const selector of identifierSelectors) {
        const el = await page.$(selector);
        if (el) {
          await el.click({ timeout: 3000 }).catch(() => {});
          await el.fill(credentials.loginIdentifier);
          identifierFilled = true;
          console.log(`${logPrefix} Login identifier filled using selector: ${selector}`);
          break;
        }
      }

      if (!identifierFilled) {
        // Try the first visible text-type input on the form
        const inputs = await page.$$('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
        for (const input of inputs) {
          const visible = await input.isVisible().catch(() => false);
          if (visible) {
            await input.fill(credentials.loginIdentifier).catch(() => {});
            identifierFilled = true;
            console.log(`${logPrefix} Login identifier filled into first visible input.`);
            break;
          }
        }
      }

      if (!identifierFilled) {
        throw new Error('Could not locate login identifier input field on Meesho login page.');
      }

      await page.waitForTimeout(800);

      // Some Meesho flows require clicking "Continue" or "Next" before showing password field
      const continueSelectors = [
        'button[type="submit"]',
        'button:has-text("Continue")',
        'button:has-text("Next")',
        'button:has-text("Login")',
        'button:has-text("Sign in")',
      ];
      for (const sel of continueSelectors) {
        const btn = await page.$(sel);
        if (btn) {
          const visible = await btn.isVisible().catch(() => false);
          if (visible) {
            await btn.click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(1500);
            break;
          }
        }
      }

      // 5. Fill password
      const passwordSelectors = [
        'input[type="password"]',
        'input[name="password"]',
        'input[autocomplete="current-password"]',
        'input[placeholder*="password" i]',
      ];

      let passwordFilled = false;
      for (const selector of passwordSelectors) {
        const el = await page.$(selector);
        if (el) {
          const visible = await el.isVisible().catch(() => false);
          if (visible) {
            await el.fill(credentials.password);
            passwordFilled = true;
            console.log(`${logPrefix} Password filled.`);
            break;
          }
        }
      }

      if (!passwordFilled) {
        console.warn(`${logPrefix} Could not find password field. Login may require OTP or different flow.`);
        // Do not error — allow the loop below to detect authentication naturally
      }

      await page.waitForTimeout(500);

      // 6. Submit the login form
      const submitSelectors = [
        'button[type="submit"]',
        'button:has-text("Login")',
        'button:has-text("Sign in")',
        'button:has-text("Continue")',
        'input[type="submit"]',
      ];

      for (const sel of submitSelectors) {
        const btn = await page.$(sel);
        if (btn) {
          const visible = await btn.isVisible().catch(() => false);
          if (visible) {
            await btn.click({ timeout: 3000 }).catch(() => {});
            console.log(`${logPrefix} Login form submitted.`);
            break;
          }
        }
      }
    } catch (formErr: any) {
      console.warn(`${logPrefix} Form automation warning: ${formErr.message}`);
    }

    // 7. Wait for authenticated panel state (poll URL + cookies)
    console.log(`${logPrefix} Waiting for authenticated panel state (timeout: ${loginTimeoutMs / 1000}s)...`);
    const startTime = Date.now();
    let authenticated = false;
    let detectedIdentifier: string | undefined;
    let detectedNumericId: number | undefined;
    let detectedSupplierName: string | undefined;

    while (!authenticated && Date.now() - startTime < loginTimeoutMs) {
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      const isPanelUrl = currentUrl.startsWith(MEESHO_PANEL_BASE);
      const isNotLoginUrl =
        !currentUrl.includes('/login') &&
        !currentUrl.includes('/signup') &&
        !currentUrl.endsWith('/root');

      if (isPanelUrl && isNotLoginUrl) {
        // Detect supplier identity from URL
        const panelMatch = currentUrl.match(
          /\/panel\/v3\/new\/(?:growth|fulfillment|payouts|home|pricing|catalog|notices|inventory)\/([a-zA-Z0-9_-]+)/
        );
        if (panelMatch && panelMatch[1] && !['root', 'login', 'signup'].includes(panelMatch[1])) {
          detectedIdentifier = panelMatch[1];
        }

        // Try prefetch for full identity
        try {
          const prefetch = await page.evaluate(async (ident) => {
            const headers: Record<string, string> = { 'content-type': 'application/json' };
            if (ident) headers['identifier'] = ident;
            const res = await fetch('/api/container/supplier/prefetch-supply-data', {
              method: 'POST',
              headers,
              body: ident ? JSON.stringify({ identifier: ident }) : JSON.stringify({}),
            }).catch(() => null);
            return res && res.ok ? res.json().catch(() => null) : null;
          }, detectedIdentifier);

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
            if (detectedIdentifier && !detectedNumericId && dt.supplier_identifier_to_id_mapping?.[detectedIdentifier]) {
              detectedNumericId = Number(dt.supplier_identifier_to_id_mapping[detectedIdentifier]);
            }
          }
        } catch {}

        authenticated = true;
        console.log(
          `${logPrefix} ✅ Re-authentication successful! ` +
          `identifier=${detectedIdentifier || 'N/A'}, id=${detectedNumericId || 'N/A'}, name=${detectedSupplierName || 'N/A'}`
        );
      } else if (currentUrl.includes('/login') && Date.now() - startTime > 15000) {
        // Still on login page after 15s — credentials may be wrong or OTP required
        console.warn(`${logPrefix} Still on login page after ${Math.round((Date.now() - startTime) / 1000)}s.`);
      }
    }

    if (!authenticated) {
      return {
        success: false,
        reason: `Auto re-auth timed out after ${loginTimeoutMs / 1000}s. Credentials may be incorrect, or manual OTP/verification is required.`,
      };
    }

    // 8. Save fresh storage state and meta
    await context.storageState({ path: storagePath });

    const meta = {
      supplierId: detectedNumericId ? String(detectedNumericId) : detectedIdentifier,
      supplierName: detectedSupplierName,
      identifier: detectedIdentifier,
      supplierNumericId: detectedNumericId,
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    console.log(`${logPrefix} Fresh session state saved to disk.`);

    return {
      success: true,
      identifier: detectedIdentifier,
      supplierNumericId: detectedNumericId,
      supplierName: detectedSupplierName,
    };
  } catch (err: any) {
    console.error(`${logPrefix} Re-auth error: ${err.message}`);
    return { success: false, reason: err.message };
  } finally {
    // Clean up isolated context (do NOT close the shared browser)
    try {
      if (page && !page.isClosed()) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
    } catch {}
  }
}

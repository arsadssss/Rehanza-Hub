import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ACCOUNT_ID = '1323beea-04db-4d44-a1ca-3ab7a1556f09';
const SESSIONS_DIR = path.join(__dirname, '.sessions');
const STORAGE_PATH = path.join(SESSIONS_DIR, `${ACCOUNT_ID}.storageState.json`);

async function inspectLiveMeeshoNetwork() {
  console.log('>>> Launching stealth browser to inspect live Meesho orders page...');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const context = await browser.newContext({
    storageState: STORAGE_PATH,
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  // Intercept all requests and responses
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/') && !url.includes('/analytics') && !url.includes('/telemetry') && !url.includes('hotjar') && !url.includes('datadog')) {
      console.log(`[REQ] ${req.method()} ${url}`);
      const postData = req.postData();
      if (postData) {
        console.log('  Payload:', postData.slice(0, 300));
      }
    }
  });

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/api/fulfillment/') || url.includes('/order') || url.includes('orders')) {
      console.log(`[RES] HTTP ${res.status()} ${url}`);
      try {
        const json = await res.json();
        console.log('  Response Keys:', Object.keys(json));
        if (json.data) console.log('  Data Keys:', Object.keys(json.data));
        if (json.total_count !== undefined) console.log('  total_count:', json.total_count);
        fs.writeFileSync(
          path.join(__dirname, `captured_${Date.now()}_${res.status()}.json`),
          JSON.stringify({ url, status: res.status(), json }, null, 2)
        );
      } catch (err: any) {
        console.log('  Could not parse JSON:', err.message);
      }
    }
  });

  console.log('>>> Navigating to Ready to Ship page...');
  await page.goto('https://supplier.meesho.com/panel/v3/new/fulfillment/4zy6k/orders/ready-to-ship', {
    waitUntil: 'networkidle',
    timeout: 45000,
  });

  console.log('Page title:', await page.title());
  console.log('Page URL:', page.url());

  // Wait a few seconds for data to load
  await page.waitForTimeout(5000);

  // Take screenshot
  const ssPath = path.join(__dirname, 'screenshots', 'ready_to_ship_live_view.png');
  await page.screenshot({ path: ssPath, fullPage: true });
  console.log('Screenshot saved to:', ssPath);

  await browser.close();
  process.exit(0);
}

inspectLiveMeeshoNetwork().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});


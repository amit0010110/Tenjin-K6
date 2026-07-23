import { logger } from '../lib/logger.js';
import type { BrowserLauncher } from '../lib/recorder/playwright.js';

/**
 * Dynamic import of Playwright to keep it as an optional dependency.
 * If playwright is not installed, this throws a helpful error.
 */
let playwrightModule: any = null;

async function ensurePlaywright(): Promise<any> {
  if (!playwrightModule) {
    try {
      playwrightModule = await import('playwright');
    } catch {
      throw new Error(
        'Interactive Browser engine (Playwright) is not installed. Run: npm install playwright && npx playwright install chromium'
      );
    }
  }
  return playwrightModule;
}

export const playwrightLauncher: BrowserLauncher = async ({ browserType, headless }) => {
  const pw = await ensurePlaywright();
  const browserTypeFn = pw[browserType];
  if (!browserTypeFn) {
    throw new Error(`Unsupported browser type: ${browserType}. Use chromium, firefox, or webkit.`);
  }

  logger.info({ browserType, headless }, 'Launching Playwright browser');

  const server = await browserTypeFn.launchServer({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const wsEndpoint = server.wsEndpoint();
  const browser = await browserTypeFn.connect({ wsEndpoint });

  const context = await browser.newContext({
    recordVideo: undefined,
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  logger.info({ wsEndpoint }, 'Playwright browser launched');

  return { browser, page, wsEndpoint, server };
};

export async function getInstalledBrowsers(): Promise<Array<{ name: string; executablePath: string }>> {
  try {
    const pw = await ensurePlaywright();
    const browsers: Array<{ name: string; executablePath: string }> = [];

    for (const name of ['chromium', 'firefox', 'webkit'] as const) {
      try {
        const executablePath = pw[name].executablePath();
        browsers.push({ name, executablePath });
      } catch {
        // Browser not installed — skip
      }
    }
    return browsers;
  } catch {
    return [];
  }
}

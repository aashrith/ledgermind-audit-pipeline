import { test as base, expect, chromium, type BrowserContext } from '@playwright/test';

/**
 * Test fixture that optionally connects to an existing Chrome over the DevTools Protocol.
 *
 * - Default: uses the Playwright-managed browser from the project config.
 * - `E2E_CDP_URL` set (e.g. `http://localhost:9222`): connects over CDP and reuses the
 *   live browser context — handy for driving a real Chrome you already have open.
 *
 * Launch Chrome for CDP with:
 *   chrome --remote-debugging-port=9222
 */
export const test = base.extend<{ context: BrowserContext }>({
  context: async ({ browser }, use) => {
    const cdpUrl = process.env.E2E_CDP_URL;
    if (cdpUrl) {
      const cdpBrowser = await chromium.connectOverCDP(cdpUrl);
      const context = cdpBrowser.contexts()[0] ?? (await cdpBrowser.newContext());
      await use(context);
      // Leave the user's browser open; only disconnect.
      await cdpBrowser.close();
    } else {
      const context = await browser.newContext();
      await use(context);
      await context.close();
    }
  },
});

export { expect };

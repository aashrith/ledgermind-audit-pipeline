import { test, expect } from './fixtures';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';

/**
 * End-to-end coverage of the required audit flows. Assumes the stack is running and seeded
 * (`docker compose up --build` runs the one-shot seed automatically).
 */
test.describe('LedgerMind audit flows', () => {
  test('1 · dashboard loads with seeded entries', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole('heading', { name: /LedgerMind Audit Pipeline/ })).toBeVisible();
    await expect(page.getByTestId('entry-row').first()).toBeVisible({ timeout: 20_000 });
  });

  test('2 · Scenario A — entries enrich asynchronously to completed', async ({ page }) => {
    await page.goto(BASE);
    // The worker drains the queue; at least one row should reach "completed".
    await expect
      .poll(() => page.locator('[data-testid="entry-status"][data-status="completed"]').count(), {
        timeout: 40_000,
        intervals: [1000, 2000],
      })
      .toBeGreaterThan(0);
  });

  test('3 · diagnostics modal shows risk, anomalies, vectors', async ({ page }) => {
    await page.goto(BASE);
    await page.getByTestId('diagnostics-btn').first().click();
    const modal = page.getByTestId('detail-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Baseline ledger')).toBeVisible();
    await expect(modal.getByText('Vector diagnostics')).toBeVisible();
    await expect(modal.getByText('Similar transactions')).toBeVisible();
  });

  test('4 · similarity search returns matches across strategies', async ({ page }) => {
    await page.goto(BASE);
    // A duplicated-vendor seed row guarantees near neighbours.
    await page.getByTestId('search').fill('JE-800001');
    await expect(page.getByTestId('entry-row')).toHaveCount(1, { timeout: 15_000 });
    await page.getByTestId('diagnostics-btn').first().click();
    const modal = page.getByTestId('detail-modal');
    await expect(modal.getByTestId('similar-item').first()).toBeVisible({ timeout: 15_000 });
    await modal.getByTestId('similarity-strategy').selectOption('financial');
    await expect(modal.getByTestId('similar-item').first()).toBeVisible({ timeout: 15_000 });
  });

  test('5 · Scenario B — core update triggers recomputation', async ({ page }) => {
    await page.goto(BASE);
    await page.getByTestId('search').fill('JE-100001');
    await page.getByTestId('diagnostics-btn').first().click();
    const modal = page.getByTestId('detail-modal');

    const newAmount = String(100000 + Math.floor(Math.random() * 800000));
    await modal.getByTestId('core-amount').fill(newAmount);
    await modal.getByTestId('save-core').click();

    await expect(modal.getByText(/recomputation enqueued/i)).toBeVisible({ timeout: 10_000 });
    // The modal polls; the entry should return to "completed" after re-enrichment.
    await expect(modal.getByText('completed').first()).toBeVisible({ timeout: 30_000 });
  });

  test('6 · Scenario E — metadata-only update bypasses enrichment', async ({ page }) => {
    await page.goto(BASE);
    await page.getByTestId('search').fill('JE-100002');
    await page.getByTestId('diagnostics-btn').first().click();
    const modal = page.getByTestId('detail-modal');

    await modal.getByTestId('meta-status').selectOption('in_review');
    await modal.getByTestId('save-meta').click();
    await expect(modal.getByText(/no recomputation/i)).toBeVisible({ timeout: 10_000 });
  });

  test('7 · race guard — save disables while in flight', async ({ page }) => {
    await page.goto(BASE);
    await page.getByTestId('search').fill('JE-100003');
    await page.getByTestId('diagnostics-btn').first().click();
    const modal = page.getByTestId('detail-modal');

    const save = modal.getByTestId('save-core');
    await modal.getByTestId('core-amount').fill('4242');
    await save.click();
    // The in-flight guard disables the button, preventing a double-submit.
    await expect(save).toBeDisabled();
  });
});

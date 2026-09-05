/**
 * Suite A — READ-ONLY checks for the customer-detail-tabs feature
 * (branch feat/customer-detail-tabs, commit 3a2784b).
 *
 * SAFETY: this app writes to LIVE production Google Sheets. Every test in
 * this file must perform zero writes. Do not add a submit/confirm click for
 * any form here — write flows live in customer-detail-tabs.write.spec.ts and
 * stay skipped.
 *
 * Requires the dev server serving BOTH the Vite frontend and the /api
 * serverless functions on the same origin:
 *   npx vercel dev --listen 3102
 * (see README/SETUP in the final report for how this was confirmed).
 *
 * Run: npx playwright test --config=tests/e2e/playwright.config.ts
 */
import { test, expect } from '@playwright/test';
import {
  shot,
  attachConsoleCapture,
  tabButton,
  CUSTOMER_A,
  CUSTOMER_B,
  CUSTOMER_INVOICES,
  CUSTOMER_ZERO_PACKAGES,
} from './helpers';

test.describe('Suite A - read-only', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    attachConsoleCapture(page, testInfo.title);
  });

  test('1. Orders tab is the default and ListContainer header renders', async ({ page }) => {
    await page.goto(`/#/customers/${CUSTOMER_A.id}/orders`);
    await expect(tabButton(page, 'Orders')).toHaveClass(/border-white/);
    await page.locator('article[role="button"]').first().waitFor({ timeout: 15_000 });

    await expect(page.getByText('Order History')).toBeVisible();
    await expect(page.getByText(/\d+ orders/i)).toBeVisible();
    await expect(page.getByLabel('Refresh order history')).toBeVisible();
    // Collapse chevron is the material-symbols "expand_more" glyph rendered
    // because OrderList passes `collapsible` to ListContainer.
    await expect(page.locator('span:has-text("expand_more")')).toBeVisible();

    await page.screenshot({ path: shot('01-orders-tab-390.png') });
  });

  test('2. Tab bar sits above the customer info card in DOM order', async ({ page }) => {
    await page.goto(`/#/customers/${CUSTOMER_A.id}/orders`);
    await expect(page.getByText(CUSTOMER_A.name).first()).toBeVisible({ timeout: 15_000 });

    const order = await page.evaluate(() => {
      const tabbar = document.querySelector('div.bg-primary.w-full');
      const card = [...document.querySelectorAll('p')].find((p) => p.textContent?.trim().length);
      if (!tabbar || !card) return 'not-found';
      const pos = tabbar.compareDocumentPosition(card);
      // Node.DOCUMENT_POSITION_FOLLOWING === 4: card comes after tabbar.
      return (pos & 4) === 4 ? 'tabbar-before-card' : 'tabbar-after-card';
    });
    expect(order).toBe('tabbar-before-card');

    await page.screenshot({ path: shot('05-tabbar-customercard-390.png') });
  });

  test('3. Fallback routes land on Orders tab with no crash', async ({ page }) => {
    await page.goto(`/#/customers/${CUSTOMER_A.id}`);
    await expect(tabButton(page, 'Orders')).toHaveClass(/border-white/, { timeout: 10_000 });
    await expect(page.getByText('Order History')).toBeVisible();
    await page.screenshot({ path: shot('check-fallback-bare-customerid.png') });

    await page.goto(`/#/customers/${CUSTOMER_A.id}/garbage`);
    await expect(tabButton(page, 'Orders')).toHaveClass(/border-white/, { timeout: 10_000 });
    await expect(page.getByText('Order History')).toBeVisible();
    await page.screenshot({ path: shot('check-fallback-garbage-tab.png') });
  });

  test('4. /customers/new opens create-customer page, not the detail page', async ({ page }) => {
    await page.goto('/#/customers/new');
    // Create-customer page heading (Thai: "เพิ่มลูกค้าใหม่" = "Add new customer").
    await expect(page.getByText('เพิ่มลูกค้าใหม่')).toBeVisible({ timeout: 10_000 });
    // Must NOT render the tab bar / customer-detail chrome.
    await expect(page.locator('div.bg-primary.w-full button')).toHaveCount(0);
    await page.screenshot({ path: shot('check-customers-new.png') });
  });

  test('5. Packages tab shows Buy button targeting the create overlay, pre-filled', async ({ page }) => {
    await page.goto(`/#/customers/${CUSTOMER_A.id}/packages`);
    const buy = page.getByRole('button', { name: 'Buy' });
    await expect(buy).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: shot('02-packages-tab-390.png') });

    await buy.click();
    await expect(page.getByText('Create customer package')).toBeVisible({ timeout: 5_000 });
    // Overlay is mounted inline over the customer-detail route with a query
    // flag — NOT a navigation to /customer-packages/create?customerId=...
    // (that standalone route exists, but Buy here does not use it).
    await expect(page).toHaveURL(new RegExp(`#/customers/${CUSTOMER_A.id}/packages\\?buyPackage=1$`));
    // Scope to the overlay's own form, not page.getByText() unscoped — the
    // customer name is ALSO present on the dimmed customer card behind the
    // overlay, so an unscoped match can pass even while the overlay itself
    // is still showing the raw customerId (observed: it renders the id
    // first and swaps to the name only once the async customer fetch
    // resolves, ~1-3s later here against the live backend).
    const overlayForm = page.locator('.form-overlay');
    await expect(overlayForm.getByText(CUSTOMER_A.name)).toBeVisible({ timeout: 8_000 });
    await page.screenshot({ path: shot('check-buy-overlay.png') });

    // Navigate back WITHOUT submitting.
    await page.getByLabel('Close').click();
    await expect(page).toHaveURL(new RegExp(`#/customers/${CUSTOMER_A.id}/packages$`));
  });

  test('6. Invoices tab loads or shows a clean empty state', async ({ page }) => {
    await page.goto(`/#/customers/${CUSTOMER_A.id}/invoices`);
    await expect(tabButton(page, 'Invoices')).toHaveClass(/border-white/);
    // Either outcome is a pass. This runs against live Sheets, so whether this
    // customer has invoices changes over time — pinning it to the empty state
    // made the test fail the moment one was issued. What matters is that the
    // tab renders a list or an empty state, and never an error.
    await expect(
      page.getByText('No invoices').or(page.locator('article').filter({ hasText: /^INV|Issued/ }).first()),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Unable to load/i)).toHaveCount(0);
    await page.screenshot({ path: shot('03-invoices-tab-390.png') });
  });

  test('7a. A package row opens package detail (read-only)', async ({ page }) => {
    await page.goto(`/#/customers/${CUSTOMER_A.id}/packages`);
    const row = page.locator('ul li button').first();
    await row.waitFor({ timeout: 15_000 });
    await row.click();
    await expect(page).toHaveURL(/#\/customer-packages\/[^/?]+$/, { timeout: 10_000 });
    await page.screenshot({ path: shot('check-package-detail.png') });
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`#/customers/${CUSTOMER_A.id}/packages$`));
  });

  test('7b. An invoice row opens invoice detail (read-only)', async ({ page }) => {
    await page.goto(`/#/customers/${CUSTOMER_INVOICES.id}/invoices`);
    const row = page.locator('article[role="button"]').first();
    await row.waitFor({ timeout: 15_000 });
    await row.click();
    await expect(page).toHaveURL(/#\/invoices\/[^/?]+$/, { timeout: 10_000 });
    await page.screenshot({ path: shot('check-invoice-detail.png') });
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`#/customers/${CUSTOMER_INVOICES.id}/invoices$`));
  });

  test('8. Tab switching uses replace: one Back skips all tabs, lands on customer list', async ({ page }) => {
    // Establish a real history entry for "customer list" first.
    await page.goto('/#/customers');
    await page.waitForTimeout(1000);
    await page.goto(`/#/customers/${CUSTOMER_A.id}/orders`);
    await expect(tabButton(page, 'Orders')).toBeVisible({ timeout: 10_000 });

    await tabButton(page, 'Packages').click();
    await expect(page).toHaveURL(new RegExp(`#/customers/${CUSTOMER_A.id}/packages$`));
    await tabButton(page, 'Invoices').click();
    await expect(page).toHaveURL(new RegExp(`#/customers/${CUSTOMER_A.id}/invoices$`));

    await page.goBack();
    // Must land on the customer list — NOT step back to the packages tab.
    await expect(page).toHaveURL(/#\/customers$/, { timeout: 10_000 });
    await page.screenshot({ path: shot('check-tab-switch-back-to-list.png') });
  });

  test('9. Order sheet: URL gains ?order=, tab bar is inert while open, Back closes it cleanly', async ({ page }) => {
    await page.goto(`/#/customers/${CUSTOMER_A.id}/orders`);
    const orderRow = page.locator('article[role="button"]').first();
    await orderRow.waitFor({ timeout: 15_000 });
    await orderRow.click();
    await expect(page).toHaveURL(/\?order=[^&]+$/, { timeout: 10_000 });
    // Sheet has a 200-220ms slide-in transition (BaseOverlay.vue); wait for
    // it to settle so the screenshot isn't a mid-animation frame.
    await page.getByText(/^Order$/, { exact: true }).waitFor({ timeout: 5_000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: shot('04-order-sheet-390.png') });

    // The sheet is a native <dialog>.showModal(); by native modal semantics
    // this makes everything outside it (including the tab bar) inert. A real
    // tap on "Packages" cannot reach the button while the sheet is open —
    // verify that empirically rather than assuming the plan's wording that
    // "switching tabs closes the sheet" is reachable by tapping the tab bar.
    const packagesTab = tabButton(page, 'Packages');
    let tabClickBlocked = false;
    try {
      await packagesTab.click({ timeout: 4_000 });
    } catch {
      tabClickBlocked = true;
    }
    await page.screenshot({ path: shot('check-tab-switch-blocked-by-sheet.png') });
    expect(tabClickBlocked).toBe(true);
    // URL must be unchanged — the click never landed on the tab.
    await expect(page).toHaveURL(/\?order=[^&]+$/);

    // Close via the X control clears the query.
    await page.getByLabel('Close').click();
    await expect(page).toHaveURL(new RegExp(`#/customers/${CUSTOMER_A.id}/orders$`), { timeout: 5_000 });

    // Reopen, then Back: sheet closes, no page skipped.
    await orderRow.click();
    await expect(page).toHaveURL(/\?order=[^&]+$/, { timeout: 5_000 });
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`#/customers/${CUSTOMER_A.id}/orders$`), { timeout: 10_000 });
  });

  test('10. KeepAlive cache isolation: customer B packages must not show customer A rows', async ({ page }) => {
    await page.goto('/#/customers');
    await expect(page.getByText(CUSTOMER_A.name).first()).toBeVisible({ timeout: 15_000 });
    await page.getByText(CUSTOMER_A.name, { exact: false }).first().click();
    await expect(page).toHaveURL(new RegExp(`#/customers/${CUSTOMER_A.id}/orders$`), { timeout: 10_000 });

    await tabButton(page, 'Packages').click();
    const rowsA = page.locator('ul li button');
    await rowsA.first().waitFor({ timeout: 15_000 });
    const textsA = await rowsA.allInnerTexts();
    expect(textsA.every((t) => t.includes(CUSTOMER_A.name))).toBe(true);

    // In-app Back to the list (header back button), not a page.goto reload —
    // a hard reload would trivially "pass" this check without exercising the
    // KeepAlive cache the check exists to catch.
    await page.getByLabel('Go back').click();
    await expect(page).toHaveURL(/#\/customers$/, { timeout: 10_000 });

    await page.getByText(CUSTOMER_B.name, { exact: false }).first().click();
    await expect(page).toHaveURL(new RegExp(`#/customers/${CUSTOMER_B.id}/orders$`), { timeout: 10_000 });
    await tabButton(page, 'Packages').click();
    const rowsB = page.locator('ul li button');
    await rowsB.first().waitFor({ timeout: 15_000 });
    const textsB = await rowsB.allInnerTexts();

    await page.screenshot({ path: shot('check-keepalive-customerB-packages.png') });

    expect(textsB.some((t) => t.includes(CUSTOMER_A.name))).toBe(false);
    expect(textsB.every((t) => t.includes(CUSTOMER_B.name))).toBe(true);
  });

  test('11. Header Back returns from customer detail to the customer list', async ({ page }) => {
    await page.goto('/#/customers');
    await page.waitForTimeout(1000);
    await page.goto(`/#/customers/${CUSTOMER_A.id}/orders`);
    await expect(page.getByLabel('Go back')).toBeVisible({ timeout: 10_000 });
    await page.getByLabel('Go back').click();
    await expect(page).toHaveURL(/#\/customers$/, { timeout: 10_000 });
    await page.screenshot({ path: shot('check-header-back-to-list.png') });
  });

  test('extra (read-only, from Suite B item 3): zero active packages hides the use-package action', async ({ page }) => {
    await page.goto(`/#/customers/${CUSTOMER_ZERO_PACKAGES.id}/orders`);
    const orderRow = page.locator('article[role="button"]').first();
    await orderRow.waitFor({ timeout: 15_000 });
    await orderRow.click();
    await expect(page).toHaveURL(/\?order=[^&]+$/, { timeout: 10_000 });
    await expect(page.getByText(/use package/i)).toHaveCount(0);
  });
});

test.describe('Desktop viewport comparison (1280x800), same 5 views', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }, testInfo) => {
    attachConsoleCapture(page, testInfo.title);
  });

  test('Orders tab at 1280x800', async ({ page }) => {
    await page.goto(`/#/customers/${CUSTOMER_A.id}/orders`);
    await page.locator('article[role="button"]').first().waitFor({ timeout: 15_000 });
    await page.screenshot({ path: shot('06-orders-tab-1280.png') });
  });

  test('Packages tab (with Buy button) at 1280x800', async ({ page }) => {
    await page.goto(`/#/customers/${CUSTOMER_A.id}/packages`);
    await page.getByRole('button', { name: 'Buy' }).waitFor({ timeout: 15_000 });
    await page.screenshot({ path: shot('07-packages-tab-1280.png') });
  });

  test('Invoices tab at 1280x800', async ({ page }) => {
    await page.goto(`/#/customers/${CUSTOMER_A.id}/invoices`);
    // List or empty state — see the 390px counterpart; live data decides which.
    await expect(
      page.getByText('No invoices').or(page.locator('article').filter({ hasText: /^INV|Issued/ }).first()),
    ).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: shot('08-invoices-tab-1280.png') });
  });

  test('Order sheet open at 1280x800', async ({ page }) => {
    await page.goto(`/#/customers/${CUSTOMER_A.id}/orders`);
    const orderRow = page.locator('article[role="button"]').first();
    await orderRow.waitFor({ timeout: 15_000 });
    await orderRow.click();
    await expect(page).toHaveURL(/\?order=[^&]+$/, { timeout: 10_000 });
    await page.getByText(/^Order$/, { exact: true }).waitFor({ timeout: 5_000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: shot('09-order-sheet-1280.png') });
  });

  test('Tab bar + customer card at 1280x800', async ({ page }) => {
    await page.goto(`/#/customers/${CUSTOMER_A.id}/orders`);
    await expect(page.getByText(CUSTOMER_A.name).first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: shot('10-tabbar-customercard-1280.png') });
  });
});

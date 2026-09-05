/**
 * Suite B — WRITE flows for the customer-detail-tabs feature.
 *
 * DO NOT UNSKIP AND RUN THESE without explicit authorization from the user.
 *
 * This app has no test database and no fixture mode. Every test below writes
 * real rows to LIVE production Google Sheets:
 *   - "Buy package" appends to CustomerPackages, PackageTransactions,
 *     Invoices and InvoiceItems. Invoices are immutable — there is no delete
 *     path, so this is not reversible.
 *   - "Record package usage" appends a real PackageTransactions ledger row
 *     against a real order. The credit amount the user enters is negated on
 *     submit (a positive "credits used" becomes a negative creditChange) and
 *     a failed write with unknown certainty (see
 *     CustomerDetailPage.vue's `usageRetryBlocked` / "certainty === 'unknown'"
 *     branch) blocks retry in the UI — a naive test retry on failure would
 *     double-deduct the package's remaining credit. Do not add retry logic
 *     here even if a first attempt fails.
 *
 * Known open issue (not a bug in this suite): the schema registry declares
 * invoice billing_type as ORDER | CYCLE only, while the package-purchase flow
 * writes PACKAGE. A real purchase may fail at the write stage until the
 * registry/sheet validation is updated. That is a pre-existing, already
 * reported gap — if these tests were run and failed there, this is why.
 */
import { test, expect } from '@playwright/test';
import { tabButton, shot, CUSTOMER_A } from './helpers';

test.describe('Suite B - write flows (DO NOT RUN without explicit authorization)', () => {
  test.skip(
    true,
    'Writes to live production Google Sheets (CustomerPackages, PackageTransactions, ' +
      'Invoices, InvoiceItems). Not reversible — invoices have no delete path. Awaiting ' +
      'explicit authorization to run.',
  );

  test('Buy package: creates a customer package and a PACKAGE-type invoice', async ({ page }) => {
    await page.goto(`/#/customers/${CUSTOMER_A.id}/packages`);
    await page.getByRole('button', { name: 'Buy' }).click();
    await expect(page.getByText('Create customer package')).toBeVisible();

    // Pick the first available active package from the catalog select.
    const packageSelect = page.locator('#customer-package-code');
    await packageSelect.selectOption({ index: 1 });

    // There is no logged-in user anywhere in this app — createdBy is
    // hardcoded to 'admin' in CustomerPackageCreatePage.vue for the
    // auto-invoice (customer-scoped) path, so no staff field to fill here.
    await page.getByRole('button', { name: 'Buy package' }).click();

    // Expect a purchase result (invoice + package created), then verify both
    // surfaces reflect it.
    await expect(page.getByText('Invoice and customer package created.')).toBeVisible({ timeout: 20_000 });
    await page.getByLabel('Close').click();

    await expect(page).toHaveURL(new RegExp(`#/customers/${CUSTOMER_A.id}/packages$`));
    // New package should now appear in the list.
    await page.screenshot({ path: shot('write-buy-package-result.png') });

    await tabButton(page, 'Invoices').click();
    await expect(page.locator('article[role="button"]').first()).toBeVisible({ timeout: 15_000 });
    // Assert a PACKAGE-billing-type invoice is present — left as a manual
    // follow-up once this suite is authorized: InvoiceCard does not
    // currently surface billingType as visible text, so this assertion needs
    // either a data-testid or an API cross-check added before running.
  });

  test('Record package usage: package credit drops, ledger row references the order', async ({ page }) => {
    await page.goto(`/#/customers/${CUSTOMER_A.id}/orders`);
    const orderRow = page.locator('article[role="button"]').first();
    await orderRow.waitFor({ timeout: 15_000 });
    await orderRow.click();

    await page.getByText(/use package/i).click();
    // Pick an active package and enter a positive credit amount.
    // NOTE: submitUsage() in CustomerDetailPage.vue negates creditsUsed into
    // a negative creditChange, and blocks retry entirely if the write result
    // has certainty === 'unknown' (see usageRetryBlocked). If this test's
    // first submit fails with an ambiguous result, STOP — do not click
    // submit again. Reconcile manually before re-running.
    await page.locator('select').first().selectOption({ index: 1 });
    await page.locator('input[type="number"]').fill('1');
    await page.getByRole('button', { name: /submit|save/i }).click();

    // Verify remaining credit dropped and a USAGE/ORDER ledger row exists.
    // Left as a manual follow-up once authorized — needs the pre-submit
    // remaining-credit value captured first for an exact before/after diff.
  });

  test('Zero active packages: use-package action hidden — READ-ONLY, may run if authorized customer found', async () => {
    // This one is read-only in practice (see Suite A "extra" test in
    // customer-detail-tabs.spec.ts, which already covers this case against
    // CUSTOMER_ZERO_PACKAGES). Kept here only per the plan's structure;
    // do not duplicate — see that test for the actual run.
    test.fixme(true, 'Already covered read-only in customer-detail-tabs.spec.ts (extra test).');
  });
});

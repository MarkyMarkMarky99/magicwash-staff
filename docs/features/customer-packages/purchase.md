# Customer package creation

The create form opened from a customer's Packages tab keeps that customer fixed and offers
“Issue an invoice” at the bottom of the form, below Notes, enabled by default.

With the switch enabled, the form creates a CYCLE invoice for one package at its catalog price,
using the package's start and expiry dates as the billing period. Only after invoice persistence
is confirmed does it create the customer package, linking the invoice number.

With the switch disabled, the form creates the customer package and opening-credit transaction
through the existing customer-package endpoint. An optional shared `FormToggleInput` lets staff
enter an existing invoice number; it is saved as `invoiceId`. Leaving the field blank or switching
it off saves `invoiceId: null`. It makes no invoice request. Turning automatic invoicing back on
clears the manual number and the purchase links the newly generated invoice instead.
The customer, active package, and validity dates must still be valid.

The invoice choice is available before submission. Once an invoice purchase attempt exists, the
form shows its outcome and existing resume/reconciliation actions; users cannot switch to a
package-only purchase to bypass a partially persisted or uncertain attempt. The switch is disabled
while a package-only request is in progress.

The form opened from the customer-package list keeps its existing behavior: select a customer,
optionally enter an existing invoice number with the same `FormToggleInput`, and create a package without generating an invoice.

Closing or completing either flow keeps the existing navigation behavior. Live writes require
the configured Google workbook bindings and credentials.

## Verification

Run the isolated browser suite against a production build:

```sh
npm run build
npx playwright test --config=tests/web/browser/playwright.config.ts
```

The suite mocks API responses and Google Fonts; it never writes to live sheets. It checks both
invoice choices, invoice-first ordering and linkage, retrying without a duplicate invoice, and the
existing list-form flow. It uses Playwright's installed Chromium by default; set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` to use the cloud machine's system browser.

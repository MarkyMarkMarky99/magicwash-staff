# Customer package creation

The create form opened from a customer's Packages tab keeps that customer fixed and offers
one shared `FormToggleInput` labeled “Invoice already created” at the bottom, below Notes.
It starts off. Opening it replaces the label with an optional “Invoice number” field.

With the switch off, the customer-detail flow creates a CYCLE invoice for one package at its
catalog price, using the package's start and expiry dates as the billing period. Only after
invoice persistence is confirmed does it create the customer package, linking the invoice number.

With the switch on, the form creates the customer package and opening-credit transaction through
the existing customer-package endpoint without generating an invoice. A supplied number is trimmed
and saved as `invoiceId`; leaving the input blank saves `invoiceId: null`. The switch's state is
independent of the text value, so an open but empty input still skips automatic invoice creation.
Switching off clears the manual number and restores automatic invoicing.

The invoice choice is available before submission. Once an invoice purchase attempt exists, the
form shows its outcome and existing resume/reconciliation actions; users cannot change the choice
to bypass a partially persisted or uncertain attempt. The control is disabled while a package-only
request is in progress. Customer, active package, and validity dates must still be valid.

The form opened from the customer-package list uses the same optional input but never generates
an invoice: select a customer and optionally supply an existing invoice number.

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

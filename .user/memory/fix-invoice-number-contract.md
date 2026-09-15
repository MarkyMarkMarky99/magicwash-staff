# `fix/invoice-number-contract`

## Why

The Invoices sheet holds two invoice-number shapes. The invoice number is built on the client, and
there are two builders:

- `src/features/invoices/pages/InvoiceCreatePage.vue:71` — `INV` + YY + MM + 8 random digits.
- `src/features/customer-packages/stores/customer-package-purchase.store.ts:53` —
  `INV<YYYYMMDD>-<uuid v4>`.

The server never generates or replaces the number; `InvoiceService.create()` persists whatever
arrives. Nothing validated the format.

## Done on this branch

- Added `invoiceNumberSchema` (`/^INV\d{12}$/`) in `contracts/invoices/invoice-api.schema.ts` and
  applied it to the create request only.
- Read, update, and number-check responses stay unconstrained so the four legacy rows still parse.
- Create-path test fixtures moved to conforming numbers; three new contract tests cover accept,
  reject, and legacy-read tolerance.
- Both client builders now call one shared `generateInvoiceNumber()` in
  `src/data/invoices/invoice-number.utils.ts`. Implemented by codex `gpt-5.6-sol`, diff reviewed line
  by line and re-verified.

## Not done

- Not browser-verified. Package purchase and manual invoice create both need a real browser run
  before merge.
- Server-side generation and dropping `invoiceNumber` from the create payload are not started.
- db-contracts untouched by the user's instruction.
- No canonical doc owns the invoice-number format; `docs/features/invoices/` does not exist.

## Known tradeoff

The package store used to mint a uuid, which could never collide. It now uses 8 random digits and
relies on the server preflight at `server/modules/invoices/invoice.service.ts:351` and the header
append, same as the manual path. A collision surfaces as a `validation_error`, and the store has no
client-side duplicate warning of its own.

## Legacy rows to decide on

Four rows dated 2026-09-05 to 2026-09-15 use the uuid shape and are referenced as `invoiceId` on
customer-package rows, so renaming them touches two sheets plus `InvoiceItems` and `Payments`.

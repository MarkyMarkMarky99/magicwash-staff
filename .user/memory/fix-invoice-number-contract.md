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

## Not done

- The package store still sends the bad shape, so package purchase now fails validation on this
  branch. Fixing the two client callers is the next round.
- Server-side generation and dropping `invoiceNumber` from the create payload are not started.
- db-contracts untouched by the user's instruction.
- No canonical doc owns the invoice-number format; `docs/features/invoices/` does not exist.

## Legacy rows to decide on

Four rows dated 2026-09-05 to 2026-09-15 use the uuid shape and are referenced as `invoiceId` on
customer-package rows, so renaming them touches two sheets plus `InvoiceItems` and `Payments`.

# Branch `claude/eager-ritchie-pvgp9f`

- Adds a "Print invoice" button to the invoice-created result panel in `InvoiceCreatePage.vue`.
- It sends the new invoice to the print server (`POST /api/invoice-prints`), same as invoice detail.
- Print logic now lives in `src/features/invoices/composables/useInvoicePrint.ts`; both pages use it.
- Checked with mocked APIs only; still needs a real print from the shop printer.
- Owner declined the full redesign (on-screen invoice preview, LINE share card); only the button was wanted.

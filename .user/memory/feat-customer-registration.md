# feat/customer-registration

- Goal: staff register a new customer; server assigns CustomerID and a free 3-letter label from CustomerIDMapping.
- Decided: system picks the label, duplicate phone blocks create, no LINE notify, no Apps Script.
- Open: locking approach; recommended append-then-read-back on Customers (earlier row wins, loser re-picks), no external store.
- Existing UI to review before design: `src/features/customers/components/CustomerCreateForm.vue`, `pages/CustomerCreatePage.vue`.
- Next: write the design doc under `docs/` for user review.

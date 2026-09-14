# refactor/data-layer-round-2

- Scope: dedupe price-list/customer queries, reactive shared stores, missing invalidations, 2000-row customer cap signal, customer-order-history race.
- Decided: customer history keeps `/api/orders`.
- Decided: customer list persistence stays as is (localStorage, 1h).
- Implementer: Codex gpt-5.6-sol medium; brief in session scratchpad.
- Next: Claude reviews diff, then user browser-tests before merge.

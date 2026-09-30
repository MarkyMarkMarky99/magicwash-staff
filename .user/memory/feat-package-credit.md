# feat/package-credit

- Plan: `docs/plans/package-credit-accounting.md` (reviewed by gpt-6-sol as accountant + engineer, 2026-09-30).
- Packages are monthly plans (like a phone plan); credits are a usage counter, not money.
- Phase 1 built: PriceList CREDIT group, "ราคาเครดิต" tab, POST /api/price-list for existing item codes; awaiting owner test on Preview.
- PriceList form "new item" mode cannot save (POST needs an existing itemCode); item creation belongs to Items.

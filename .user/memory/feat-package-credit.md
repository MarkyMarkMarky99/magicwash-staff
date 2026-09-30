# feat/package-credit
- Plan: `docs/plans/package-credit-accounting.md` (reviewed by gpt-6-sol as accountant + engineer, 2026-09-30).
- Packages are monthly plans (like a phone plan); credits are a usage counter, not money.
- Phases 1–4 built (credit rates, order USAGE with manual fallback, monthly CYCLE bill, renewal); reviewed by gpt-6-sol and browser-tested with writes mocked.
- Before real use: load CREDIT rate rows (25 candidates in `.user/memory/credit-rates-candidates.csv`) only after the code is on production.
- Orders before ~2026-09-27 use legacy item codes (AA104…); staff enter credits by hand; cash items of those orders must be added to the bill by hand.
- Owner decisions still open: PERSONAL +10 on cash items, prepaid bill combining new fee with last month, partial overage billing.
- Not built: staff payment recording (owner plans it separately); bill warnings show raw ids in English.
- Two items in order 33dd511b have no DEFAULT WSIR price in PriceList.
- Test customer `0102e46b` (ZZ ลูกค้าทดสอบแพ็กเกจ) exists in live Customers for Preview tests.

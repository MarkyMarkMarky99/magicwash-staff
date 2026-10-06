# Branch — `feat/package-credit`

## Resume

- Held by owner on 2026-10-06; Preview verification remains pending and requires confirmed sign-in on an authorized host.
- Reopen this branch's `docs/plans/package-credit-accounting.md`; phases 1–4 are implemented but not proven with real writes.
- Prior branch browser checks used mocked writes; re-run verification before production use.
- Load CREDIT rates only after production deployment; candidates remain in this branch's `.user/memory/credit-rates-candidates.csv`.
- Legacy order item codes require manual credit entry and manual cash-item billing.

## Open decisions

- Choose an authoritative PERSONAL classification before applying the cash-item uplift.
- Define package-period ownership for prepaid bills combining a new fee with prior-month items.
- Define credit-counter handling for partial or edited overage invoices.
- Choose where to persist the credit usage summary shown by the bill preview.
- Staff payment recording remains separate owner-planned work.

## External verification

- Recheck the reported missing DEFAULT WSIR prices for two items in order `33dd511b`.
- Confirm live test customer `0102e46b` still exists before Preview tests.

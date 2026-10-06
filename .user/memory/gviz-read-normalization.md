# GViz read normalization — deferred

## Owner decision

- Deferred by the user on 2026-09-11 because a shared read-layer change could break unknown call sites.
- Do not start or re-propose it as the next task without user direction.
- Preserve frontend compensation until its replacement has been verified against live responses.

## Resume

- Compare `server/shared/repositories/sheet.repository.ts` and `server/shared/repositories/utils/gviz-reader.ts` with `docs/conventions/datetime.md`.
- The proposed read-boundary normalization uses DB-contract field types, not value shape or write intent.
- Duplicate date normalizers remain in `src/shared/utils/sheet-date.ts` and `shared/utils/bangkok-datetime.ts`.
- Check the partial price-list normalizer and Bangkok-today helpers before consolidating them.
- Customer-package frontend coercion remains in `src/data/customer-packages/customer-package.service.ts`; backend assembly also stringifies fields.
- String coercion cannot restore a lost phone-number leading zero; verify Plain Text sheet formatting separately.

## Verification blockers if revived

- Recheck live API date leaks and customer string fields; earlier live reports are not current verification.
- Review `tests/server/unit/sheets/service-wiring.dry-test.ts` for expectations that preserve raw GViz dates.
- Recheck invoice date filtering in `server/modules/invoices/invoice.service.ts` against current assembly and live values before calling it a defect.
- Verify normalizer tests and live responses before removing frontend compensation, one feature at a time.

# GViz read normalization — proposed, DEFERRED by the user

## Status

**Deferred 2026-09-11. Do not start this without the user saying so.**

The user read the proposal below and agreed it is the correct direction, but not now. Their reason,
in their own terms: this changes a shared layer that every module reads through, and we do not know
how clean every call site is. Columns that display correctly today could break, and the blast radius
is not knowable in advance from the code alone.

So: **do not propose this again as a next step.** Raise it only when the user asks about GViz types,
date duplication, or numeric coercion — and when raising it, lead with the fact that it was already
deferred and why, not with the design.

Until then the compensating code in the frontend stays. Do not delete it piecemeal "since it is
redundant" — some of it is the only thing preventing a runtime throw.

## The problem this would solve

Two symptoms, one cause: GViz returns values whose type does not match what the db-contract
declares, and nothing corrects it at the read boundary. `gviz-reader.ts:84` copies `cell.v`
verbatim; `BaseCrudService.project` copies fields with no coercion.

**Dates.** `docs/conventions/datetime.md` forbids the API emitting `Date(...)`. Appointments,
orders and invoices emit it anyway (verified live: `"createdAt":"Date(2026,8,10,17,26,54)"`).
The frontend compensates, and the compensation itself has diverged:

- Two functions named `normalizeSheetDate` with identical signatures and different behaviour —
  `src/shared/utils/sheet-date.ts:63` and `shared/utils/bangkok-datetime.ts:16`.
  `Date(2025,1,31)` gives `null` on the frontend and `"2025-02-31"` on the backend.
  `2025-10-27T18:00:00Z` gives `2025-10-28` (Bangkok) on the frontend and `2025-10-27`
  (`slice(0,10)`) on the backend.
- A third partial clone, `normalizePriceListDate` (`price-list.module.ts:176`).
- Three copies of "today in Bangkok": `todaySheetDate`, `bangkokToday`, and `bangkokDate` in
  `waiting-pickup.filter.ts:38`.

**Numbers typed as strings.** GViz types a numeric-looking string cell as a number, so a phone
stored as `0851344035` can arrive as `851344035`. Only customer-packages defends
(`normalizeGvizStringFields`), and there the backend assembly already stringifies, so that defense
is redundant. `customers` reads the same Phone column with no defense at all —
`CustomerListPage.vue:40` calls `.toLowerCase()` on it and `AppointmentForm.vue:45` calls `.trim()`.
Today that only holds because the sheet column is formatted Plain Text.

## The proposal

Normalize once at the read boundary, `sheet.repository.ts:153`, right after `fetchGVizRows` returns
and before mapping to API names. Every module reads through that funnel.

Decide from the db-contract row schema, never from the shape of the value. Schema says string and a
non-string arrives, stringify it; schema says number and a string arrives, parse it. The rule
"type is never sniffed from the value" is already written into `sheet-cell-type.ts:36-38` and must
hold here too. `valueInput` must not be the deciding input — it is documented write intent, not the
stored cell type, and `sheet-contract.ts` says so.

This extends the mechanism that already exists rather than adding a new one. `sheetDate()` /
`sheetDateTime()` already mark a field via `.describe()` and `cellTypeOf()` already reads the marker
back; today that is consumed only when building a query literal, not when reading a result.

What could then be deleted: `normalizeGvizStringFields` and its two field arrays, the frontend
`normalizeSheetDate`, `normalizePriceListDate`, and the appointment store's row normalizers.
`formatSheetDate` stays — display formatting belongs on the frontend either way.

## Known traps, if this is ever picked up

- `tests/server/unit/sheets/service-wiring.dry-test.ts:200` and `:506` assert that orders and
  invoices return `Date(2026,6,21)` / `Date(2026,7,6)`. Those tests lock in the wrong behaviour.
  Fix the tests; do not bend the change to satisfy them.
- `server/modules/invoices/invoice.service.ts:631` filters `dateFrom`/`dateTo` lexicographically
  while the comment at `:637` claims the value is ISO. It is comparing `Date(...)` against ISO
  today. That is a live bug, and it is worth fixing on its own without the whole refactor.
- `String(851344035)` does not restore the leading zero. This work prevents a runtime throw; it does
  not make the phone number correct. That needs the sheet column set to Plain Text, separately.
- Sequence if ever done: normalizer plus tests first, then confirm against the live API that
  `Date(...)` is gone, then remove the frontend compensation one feature at a time, then the invoice
  filter, then correct `docs/conventions/datetime.md`. Separate commits so each layer can be
  reverted alone.

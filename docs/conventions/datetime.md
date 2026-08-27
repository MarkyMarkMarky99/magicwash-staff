# Datetime convention

One format, everywhere, regardless of how a sheet happens to store the value.

## The standard

**`yyyy-MM-dd HH:mm:ss`** — Asia/Bangkok, zero-padded, 24-hour, **no offset and no `T`**.

This is the format written into Google Sheets, and the format API DTOs emit. Date-only columns use
**`yyyy-MM-dd`**.

ISO 8601 (`2026-07-13T18:08:20+07:00`, or anything ending in `Z`) is **not** this project's format
and must not appear in a sheet cell or an API response.

The one exception is the HTTP envelope's `meta.timestamp` (`server/shared/http/response.ts`), which
is UTC ISO. That is transport metadata, not business data, and is out of scope here.

## Why it is not negotiable

`SheetRepository` rejects a caller-supplied audit value that does not match
`/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/` (`server/shared/repositories/sheet.repository.ts`), and
`tests/server/unit/shared/repositories/sheet.repository.audit.dry-test.ts` asserts that
`'2026-03-27T04:37:32+07:00'` is refused.

The reason is recorded in `api/CLAUDE.md`: a timestamp written in any other form either stays text
or parses with day and month transposed. 373 cells had to be repaired once already.

## Write side

`formatBangkokTimestamp` (`server/shared/utils/bangkok-timestamp.ts`) is the only production
producer. `SheetRepository` calls it on append, batchAppend, and update, driven by each sheet's
`audit.onAppend` / `audit.onUpdate` declaration. Do not format an audit timestamp anywhere else and
do not pass one in from a service.

`deleted_at` is never auto-stamped. Soft-delete, where it exists, is an explicit UPDATE.

## Read side

**What comes back is not always what was written.** Every write goes out as `USER_ENTERED`, so
Sheets may coerce the string into a real date/datetime cell, and GViz then returns it as
`Date(2026,7,25,12,0,0)` rather than the original text.

Two traps:

- **`valueInput` in a `SheetContract` does not decide this.** It is an intent declaration and a
  guard, not the value sent on the wire; a column absent from `valueInput` is *not* sent as RAW.
  Never infer a column's physical cell type from the db-contract.
- **GViz reports type per column, not per cell.** A mixed column reads as `string` for every row, so
  a single-row spot check settles nothing.

Therefore: **normalize on read**, back to the standard format, using the shared helpers in
`shared/utils/` (see below). Do this in the module that reads the column. `api/CLAUDE.md`'s "GViz
date strings are returned raw; do not parse or format them in the backend" applies to the generic
reader (`gviz-reader.ts`), which stays dumb — it does not exempt a module from emitting the
standard format in its DTO.

Emitting `Date(...)` from an API response is a DB-shape leak across the API boundary and is not
allowed.

## Where the code lives

Root-level **`shared/`** is the only location both sides can import:

- backend — `api/tsconfig.json` includes `../shared/**/*.ts`; import **relative with an explicit
  `.js` extension** (`../../shared/utils/x.js`). There is no path alias on the backend, and a
  missing `.js` passes typecheck but breaks the Vercel deploy.
- frontend — `@shared/*`, wired in `jsconfig.json` and `vite.config.js`.

`src/shared/` is frontend-only and invisible to the backend. Do not put cross-boundary code there.

## Display formatting

Turning the standard string into something a person reads (`25/08/2026`, `2 Aug`) is the
**frontend's** job, in the component or page that renders it. The API never returns a
display-formatted date.

## Known duplication — not yet resolved

Three implementations of near-identical parsing currently coexist. Consolidating them is a tracked
follow-up, not something to do opportunistically in unrelated work:

| Location | Role |
|---|---|
| `shared/utils/` | the destination — new cross-boundary helpers go here |
| `server/shared/utils/bangkok-timestamp.ts` | write side, called from `SheetRepository` |
| `src/shared/utils/sheet-date.ts` | frontend parse/display |

Moving the write-side helper touches `SheetRepository` and therefore every module, so it is done as
its own job on a quiet tree — never alongside feature work.

# Migration or refactor

## User request

"swap the old `formatThaiDate` helper for the shared `formatDate` util everywhere it's used —
same output, just one function instead of two."

## Pattern

General shape: "move these components to the new folder", "swap the old date helper" — no new
files, no design decision, no new data flow.

`explorer` → `ui-builder` → `frontend-reviewer`

Explorer finds every call site — the usual failure here is missing one. Add `frontend-architect`
when the new structure itself has to be decided rather than being given. No `frontend-architect`
here (nothing is being placed) and no `frontend-integrator` (no data flow changes).

**Contract boundary:** `formatThaiDate`/`formatDate` are presentation-only — they change how a
date is *shown*, never what's *sent*. A call site that renders a date to the screen is a safe
like-for-like swap. A call site that feeds the formatted string into an API request (body, query
param, or anything crossing `@contracts/*`) is not — the backend contract governs that value, not
the display helper, and swapping it there can silently break the request even though the output
"looks the same" in the UI. Explorer must tell these two kinds of call site apart; `ui-builder`
must only touch the display ones and stop on the rest.

## Steps

### 1. Discovery phase — `explorer`

The orchestrator sends `explorer` a brief asking for exactly the facts the next phase will need,
nothing it will have to guess:

> Find every file that imports `formatThaiDate`. For each call site, report the file path, the
> arguments passed, and what the rendered output looks like (locale, format string, edge cases
> like a null date). Also locate the shared `formatDate` util and confirm its signature and
> supported options. For each call site, also state whether the formatted value is only rendered
> to the screen or whether it flows into anything sent to the backend (a request body, a query
> param, a stored value). Do not propose a migration — just the facts a migration needs.

**Checking the result:** `explorer` never touches files, so there is no diff to judge — the
report itself is the deliverable, and the orchestrator reads it before trusting it. Every call
site needs a file path, the arguments actually passed, and its real output — not "likely uses
the default locale" or "probably fine." The `formatDate` signature and its supported options must
be confirmed, not assumed compatible. Every call site's render-only-vs-sent-to-backend
classification must be stated, not assumed — "probably just for display" is not an answer. If any
call site is hedged, a file was skipped, the two functions' option coverage isn't fully compared,
or a call site's contract exposure is unclear, send it back to the same `explorer` session, name
exactly what's unresolved, and ask it to dig deeper on those specific points — never carry an
uncertain fact into the Migration phase.

### 2. Migration phase — `ui-builder`

The orchestrator hands `ui-builder` the call-site list Explorer confirmed, plus the migration
brief itself:

> Replace every `formatThaiDate` call found by Explorer with `formatDate`, matching each call
> site's existing output exactly — same locale, same format, same handling of a null/undefined
> date. Do not change any other behavior on the touched files. Only touch call sites Explorer
> classified as render-only; any call site whose formatted value flows into a request to the
> backend is out of scope — report it instead, do not migrate it. Delete `formatThaiDate` and its
> import only if no call site still needs it; if a contract-facing call site remains, keep the
> helper and report the deletion as blocked on that call site. Report which call sites needed extra
> care (e.g. a format option `formatDate` doesn't expose) rather than silently approximating them.

**Checking the result:** this phase does touch files, so the orchestrator judges from `git status`
and `git diff` — never `ui-builder`'s own summary — against the acceptance criteria below. Every
changed file must trace back to a call site Explorer named or to the deleted helper itself;
nothing reformatted, no output changed, nothing outside the date-formatting change touched, and no
contract-facing call site touched. If a call site was skipped, output drifted, a contract-facing
call site got migrated anyway, or the diff includes an unrelated cleanup, `git checkout --
<path>` the offending files while still uncommitted and send the stage back to the same
`ui-builder` session, naming exactly which call site or file failed. Only once every criterion
holds does the orchestrator commit and move on — two send-backs maximum before it stops and takes
the mismatch to the user.

### 3. Review phase — `frontend-reviewer`

The orchestrator hands `frontend-reviewer` the original request and the committed diff:

> Verify every render-only `formatThaiDate` call site Explorer found now calls `formatDate` with
> identical output, confirm no render-only call site was missed, confirm no contract-facing call
> site was touched, confirm `formatThaiDate` and its file are gone only if that's actually safe,
> and confirm nothing outside the date-formatting change was touched.

**Checking the result:** `frontend-reviewer` returns exactly one of `APPROVED`,
`CHANGES_REQUIRED`, or `BLOCKED`. `APPROVED` closes the workflow. `CHANGES_REQUIRED` findings here
are mechanical-migration defects, so they route straight back to `ui-builder` — never patched by
the orchestrator itself, and never waved through by rereading the diff instead of re-invoking the
reviewer. A contract-facing call site that got migrated anyway is treated the same way — it's
still `ui-builder`'s mistake to fix, not a reason to escalate past the reviewer. `BLOCKED` means
the reviewer couldn't verify something — e.g. it can't confirm a call site's original output —
and is never treated as approval; resolve whatever fact it's missing (usually routing back to
`explorer`) before asking it to review again. Two correction rounds maximum before the unresolved
findings go to the user instead.

## Acceptance criteria applied

- every changed file was named in the brief (the render-only call sites Explorer found, plus the
  deleted helper file if nothing still needs it) — nothing extra
- output is byte-identical to before for every call site — a refactor changes *how*, never *what*
  renders
- the deletion of `formatThaiDate` is itself reviewed, not assumed safe because "it's unused now"
- no contract-facing call site was touched — what crosses `@contracts/*` to the backend is
  governed by the API contract, not by a display refactor, even when the two happen to render the
  same

# New feature from scratch

## Request

"add a create-customer form — a button on the customer list opens it, saves through the existing
backend."

## Chain

`explorer` → `frontend-architect` → `frontend-designer` → `frontend-integrator` → `frontend-reviewer`

No design exists to copy for a customer form — price-list and appointment are different patterns
from each other, and neither has customer fields, copy, or a button for this. Full pipeline,
`frontend-designer` included.

```
 explorer
   │  discover how (or whether) this project already builds forms
   ▼
 frontend-architect
   │  turn those facts into a placement plan — file locations, route, close pattern
   ▼
 frontend-designer
   │  build the fields + the "add" entry point per the plan (this step's design decision)
   │
   ├──▶ frontend-architect   confirm the files landed where the plan said;
   │        (same session)   mismatch → back to frontend-designer, not a new plan
   │
   ▼
 frontend-integrator
   │  wire the built UI to the real backend — store, service, navigation
   ▼
 frontend-reviewer
      verify the whole feature end-to-end; CHANGES_REQUIRED routes back to
      whichever stage above actually owns the finding
```

## 1. Discovery — `explorer`

```
GOAL   survey how this project builds forms; facts only
FIND   - existing form pattern(s) — don't assume count or shape in advance;
         for each one found, note how it's wrapped/shelled (if at all) and
         how it's dismissed/closed, exactly as built, not as one of a
         preset list of options
       - a rule/skill/doc describing form conventions, if any
       - shared form-field components + props
       - the API contract for creating a customer, if one exists: full field
         list, required flags, and whether a create route is actually wired
       - how any existing create flow populates an actor/audit-style field
         (who made the change) — name the field and how it's populated,
         don't assume it's called anything in particular
       - whether the page that lists customers already has an "add" affordance
AVOID  proposing a pattern, deciding structure, judging readiness
```

**Check:** every pattern reported on its own terms, not collapsed into one · every required
schema field listed · the actor/audit-field answer is cited, not guessed · a genuinely missing
backend capability is a blocker to the user, not something to invent around · incomplete or hedged
report
→ back to the same `explorer` session, name what's missing.

## 2. Placement — `frontend-architect`

```
INPUT  Discovery's report, filtered to what placement needs — the form
       pattern(s) found and their structure, the customer contract
       state, and whether the list page already has an entry point
GOAL   turn Discovery's facts into a file and route plan; placement only
DECIDE - new page file location; store/service: extend existing file or new one
       - new route's path and name
       - which of the closing behaviors Discovery actually found this
         form should follow, and why — based on which existing form's
         structural situation this one actually resembles; don't invent
         a pattern Discovery didn't report
AVOID  field layout, copy, button placement — those are design, not placement
```

**Check:** every decision justified against a real template, not asserted · the close-pattern
choice has a stated reason · plan doesn't drift into layout or copy → back to the same
`frontend-architect` session, name the gap.

## 3. Design — `frontend-designer`

```
INPUT  the architect's plan (file locations, route, close pattern +
       the template it was based on) and Discovery's report on the
       schema fields and shared components
GOAL   design and build the form's fields and the list page's "add" entry point
BEFORE - list src/shared/components/ yourself; don't trust Explorer's
         inventory as final
       - look at how the template Architect identified actually lays
         itself out (grouping, spacing, label style) — and, separately,
         how an existing list page adds a "create new" entry point —
         before designing anything
BUILD  - a shared component per schema field (excl. `updatedBy`) wherever
         one fits
       - the project's existing form-shell convention, not a new one
       - component name + matching KeepAlive exclude entry in App.vue
       - button placement, copy, field labels — match this app's
         existing style, depart only where this form's content
         genuinely needs it
NEVER  - create or modify a shared component — build it locally instead
         and report under SHARED GAPS naming why nothing existing fit
       - implement the store action, service call, or navigation —
         leave the call site, report what frontend-integrator needs
```

**Check:** judge from `git diff`, never the summary · every field uses a shared component or a
justified SHARED GAPS exception · nothing created or edited under the shared component directory
· the component's registered name matches the `KeepAlive` exclude string exactly · layout reads as
the same app as the template Architect identified, not a bolted-on style · the new button looks
native next to the existing one it was modeled on · the shell is present but not wired to real
navigation
· no store, service, or routing code in the diff → violations get `git checkout --`, back to the
same `frontend-designer` session, name what's wrong (max 2 send-backs).

Then send the resulting file paths to the same `frontend-architect` session from step 2: does this
match its plan? A mismatch sends `frontend-designer` back to correct it — Architect is confirming
compliance with its own plan, not making a new one. Only if Architect says the plan itself doesn't
fit what got built does this return to `frontend-architect` for a corrected plan first.

## 4. Integration — `frontend-integrator`

```
INPUT  the architect's plan, Discovery's report on the contract schema
       and the actor-field precedent, and frontend-designer's own
       report of exactly what call site it left open
GOAL   wire the form to the real backend
BUILD  - store action + service call using the contract schema Explorer
         confirmed — import the types, don't redeclare them
       - the actor field populated the way the cited sibling flow does it
       - open/close navigation per Architect's chosen pattern
       - loading/success/error states matching the template Architect's
         close-pattern choice was based on
STATE  exactly what you verified end-to-end and what you couldn't — not
       "it compiles, so it works"
NEVER  restyle or rearrange anything frontend-designer built
```

**Check:** diff shows contract types imported, not redeclared · the actor field matches the cited
precedent · navigation matches Architect's chosen pattern · `frontend-integrator`'s own
verification statement is read alongside the diff — an untested claim of success isn't accepted as
fact just because it's stated · violations get `git checkout --`, back to the same
`frontend-integrator` session, name the failure (max 2 send-backs).

## 5. Review — `frontend-reviewer`

```
INPUT  the original request, the architect's plan, and the full diff
       committed across all three prior stages
GOAL   verify the whole feature against the plan and this app's conventions
CHECK  - every field uses a shared component, or a justified exception
       - navigation matches Architect's chosen pattern
       - the actor field matches the cited precedent
       - request/response shapes come from the contract
       - loading/error states match the template Architect's close-pattern
         choice was based on
       - the component name is in App.vue's KeepAlive exclude
       - nothing outside this feature was touched
```

**Decision:** `APPROVED` / `CHANGES_REQUIRED` / `BLOCKED`. Route findings by kind — field, copy,
button, or an unjustified component → `frontend-designer`; navigation, request shape, actor field,
loading/error handling → `frontend-integrator`; a placement problem → `frontend-architect` for a
corrected plan first, then whoever implements it. A missing-design `BLOCKED` routes to
`frontend-designer` — there is no `ui-builder` in this chain. Max 2 correction rounds, then
unresolved findings go to the user.

## Acceptance criteria

- every changed file traces back to the architect's plan
- every field uses a shared component, except a justified SHARED GAPS exception
- open/close navigation matches the pattern Architect chose and the reason for it
- request/response shapes come from the contract schema; the actor field matches the cited
  precedent, never invented
- the component's name is present in `App.vue`'s `KeepAlive` exclude list
- `frontend-integrator`'s own verification statement is trusted only as far as it actually claims

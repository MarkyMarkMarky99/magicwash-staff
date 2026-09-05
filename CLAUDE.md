# AGENTS.md - Vue Feature-Based Frontend

## Tech Stack
- Vue 3 + TypeScript
- Pinia for state management
- Vue Router for routing
- Vite as build tool

## Frontend Structure
- `src/app/` - Application core: root router, global layouts, app-level stores.
- `src/shared/` - Reusable cross-feature code: base components, composables, API client, shared types, utils.
- `src/features/<feature>/` - Isolated business feature containing:
  - `components/` - Feature UI components. Props in, emits out.
  - `pages/` - Route-level pages. Orchestrate store, route params, and feature components.
  - `services/` - API communication for the feature.
  - `stores/` - Feature state management using Pinia.
  - `routes.ts` - Feature route definitions.
- `src/assets/` - Static assets: images, icons, global styles.

Only create subfolders when the feature actually needs them.

## Architecture Rules
- Follow feature-based architecture. Dependency direction: `app` -> `features` -> `shared`; `shared` must never import from `features`, and avoid cross-feature imports — move shared logic to `src/shared/`.
- Layer responsibilities: components (presentational, no API calls) -> pages (orchestrate, no duplicated API logic) -> stores (manage state, call services) -> services (call the API and return typed API DTOs directly).
- The API is the source of truth for business data — it returns frontend-ready `camelCase` DTOs with all business facts (statuses, totals, merged relations) already resolved. The frontend must not re-derive or re-assemble business data the API should already provide.
- API DTOs are already the frontend model. Do not add frontend mappers to transform API data. If the UI needs additional business data or a different data shape, fix the backend contract/mapper instead of transforming it again in the frontend.

## Data Flow

Component -> Page -> Store -> Service -> API

Response flow:

API -> Service -> Store -> Page -> Component

## Backend API
The serverless backend lives in `api/`. **`api/CLAUDE.md` is the single source of truth**
for its structure, layers, and rules — backend details are intentionally not duplicated here.

The frontend depends only on the **API contract**: it consumes `camelCase`, business-complete
DTOs (statuses, totals, merged relations already resolved) and never sees DB shape —
`snake_case`/PascalCase rows stay behind the API boundary.

That contract lives in `contracts/<feature>/<m>-api.schema.ts` (project root, outside both
`src/` and `api/`) and is the **single source of truth** for request/response shapes + enums —
imported by the backend AND the frontend via the `@contracts/*` alias. Use `import type` +
`z.infer<typeof schema>` to pull just the types with no runtime cost, or import the schema value
when you want client-side zod validation. Only camelCase API schemas/enums live there — never DB shape.

## Types & DTO Rules
- API contract schemas come from `@contracts/<feature>/<m>-api.schema.ts` (shared with the
  backend). Stores and services should import the schema and derive DTO types with
  `z.infer<typeof schema>`.
- Do not create frontend-owned DTO/type copies for API responses. Use the contract-derived
  DTO types directly.
- API DTOs are the frontend model. Do not create separate frontend view-model types unless
  the type is purely UI state and is not a transformed copy of API data.
- Never let DB shape reach the frontend: raw DB rows / `snake_case` must not cross the
  API boundary, and DB types must never reach stores, pages, or components.

## Naming Conventions
- Vue components: `PascalCase.vue`
- Logic files: `kebab-case`
- Composables: prefix with `use`

## Import Rules
- Use `@/` path alias for `src/`; `@contracts/*` for the shared API contract.
- Avoid deep relative imports like `../../../../`.
- Use `import type` for TypeScript types and interfaces (and to pull contract types
  without bundling zod at runtime).

## Coding Standards
- Prefer strong TypeScript types.
- Avoid `any`.
- Keep components presentational when possible.
- Keep business logic out of UI components.
- Keep API logic inside services only.
- Do not add frontend field mapping layers for API data.

## Testing

No test runner is installed — tests are plain TypeScript files asserting via `node:assert/strict`.
Run `tests/server/...` with `npx tsx <path>` (backend tests use relative `.js` imports and no
alias). Run `tests/web/...` with `npx tsx --tsconfig jsconfig.json <path>` because web tests
import `src/` code that uses the `@/` alias, which bare `tsx` cannot resolve. They live under
`tests/`, not colocated with the source they cover, split by project:

- `tests/web/unit/<mirrored src/ path>/<name>.dry-test.ts` — frontend unit tests; the subpath
  mirrors the file's path under `src/` (e.g. `src/features/customers/utils/waiting-pickup.filter.ts`
  → `tests/web/unit/features/customers/utils/waiting-pickup.filter.dry-test.ts`). Imports stay
  extensionless (Vite/bundler convention), unlike backend imports.
- `tests/server/...` — backend tests; see the Testing section in `api/CLAUDE.md` for the full
  convention (unit vs. type-only tests, `api/tsconfig.json` scope).

## Gotchas
- Do not inject API clients into components.
- Use API DTOs directly as the frontend data model.
- Do not re-implement business logic in the frontend that the API already resolves
  (e.g. status derivation, totals, merging related records). If the API response
  is missing data the UI needs, fix it in the API (see `api/CLAUDE.md`) — don't patch
  it on the frontend.
- Do not let the frontend know about the database shape — `snake_case` and raw
  DB rows must never cross the API boundary.
- Do not put feature-specific code in `shared/`.
- Do not create all folders upfront if they are unused.
- Do not duplicate API calls in pages when a store/service already exists.

## Working Rules for Claude

Claude is the brain, the assistants below are the hands. Claude does the real work of this role —
understanding the request, analyzing the codebase's constraints, planning the approach, writing the
brief, and acting as the user's technical advisor. Understanding a problem is not a reason to open
the source: exploration goes to an assistant, and that thinking gets turned into a brief dispatched
via the `Agent` tool or a skill, with the result relayed back to the user.

Reading source to answer "how does this work" or "where is X" stays delegated — that is the expensive
habit this rule exists to break, and a summary from an explorer costs a fraction of the files it read.

### When Claude may edit directly

Small, already-decided, single-target changes: one file, a change Claude can state exactly before
opening it — a comment, a rename, a one-line fix, a config key, a file move. Docs and `CLAUDE.md`
are always fair game.

Everything else is delegated. In particular, hand off anything that spans multiple files, needs the
surrounding code read to decide what to write, or would have Claude exploring to find the edit site.
If a "small" edit starts requiring context Claude does not already have, stop and write a brief
instead — that is the signal it was never small.

Verify a direct edit like any other: run the affected test or build, and say what the result was.

### Assistants

- **grok-explorer** — codebase exploration: "where is X defined", "how does Y work", "find every
  usage of Z".
- **grok-investigator** — deep research: root-cause bug investigation, or any question that needs a
  deep understanding of the code before a fix is even attempted. When its subagent spawn is blocked,
  `grok-explorer` takes the same prompt — do not let the gap go silent.

### Writing the brief

The brief is the only lever on the result, since Claude won't be reading the code to double-check.
Put in it: the traps, what must not change, what to report rather than fix, and which tests are
allowed to change versus which must pass untouched. State why a constraint exists — a rule with a
reason survives, a bare rule gets worked around.

Always call out in the brief: `G:\My Drive\Magicwash\Database\GoogleSheets\*.json` — the schema
registry, shared with the Python project at the repo root — must never be written to by a delegated
agent. When registry and code disagree, the code changes. An instruction to "make them match" always
has two solutions, and the wrong one silently rewrites the source of truth.

Two independent tasks can run in parallel in this working tree when their files do not overlap (e.g.
`src/` and `server/`). Give each brief the other's boundaries and its own verification command, so
neither "fixes" the other's half-finished state.

## Frontend Layout and Navigation Rules

See `docs/frontend-layout-nav-refactor.md` for the full rationale.

### Shared components: import only

Import from `src/shared/components/`. Do not create a new shared component and do not modify an existing one — not even to add a prop. A change that makes a shared component fit your page can break every other page using it, and this project has **no frontend type-check** (`npm run build` is esbuild only), so a broken prop contract ships green.

If nothing there fits: build it locally inside your own feature folder and report it under "SHARED GAPS" in your final report, naming what you needed and why the existing component did not fit. A missing shared component is not permission to add one — shared components are created and changed only in a dedicated refactor pass, where every existing call site is checked at once.

**List the directory before you build anything.** Do not rely on a list written in a document; read `src/shared/components/` directly, because any list here would go stale.

Components in `src/shared/` are presentational and must not know the domain exists — generic prop names (`title`, `subtitle`, `leading`, `trailing`, `variant`), no business logic, no store/service/API imports, no feature-conditional branches. A component that legitimately speaks about orders belongs in `src/features/orders/components/` and may name its props after orders. The test: to reuse it in a feature that does not exist yet, would any prop need renaming? If yes, it is not shared.

### Overlays must never own browser history

An overlay component — including the shared shell in `src/shared/layouts/` — must never call `history.pushState`, `history.back()`, `history.forward()`, or listen for `popstate`. If you find yourself adding any of those to make a Back button dismiss an overlay, stop.

An entry created with raw `pushState` is invisible to vue-router. It copies vue-router's `position` field, so popping it makes the router compute `delta = state.position - fromState.position === 0`, treat the pop as a duplicated navigation, and run its recovery path `go(-1)` — an extra Back rather than an undo. The user gets thrown off the page or skips one. Hiding the pop from the router with capture-phase `stopImmediatePropagation`, and repairing surplus traversals with `history.forward()`, were both built and rejected: they turn the shell into a second history controller, and every overlay later migrated onto that shell inherits it.

**An overlay that must be dismissible with the browser or Android Back button is represented as a route.** This project's convention is a **query parameter** — see `useOrderSheetRoute.ts` for the template: it derives open state from the route with `computed` (never mirrored into a local `ref`, because on a `KeepAlive`-cached page a stale mirror makes reopening the same item a silent permanent no-op) and closes with `router.back()` only when this page pushed the entry; on a deep link or a refresh there is no parent entry and `router.back()` would leave the app, so it strips the query with `router.replace` instead. An action that navigates away from an open overlay uses `router.replace`, not close-then-`push`, so the overlay's entry is consumed rather than left behind for Back to resurrect. `useCustomerFilterRoute.ts` and `useInvoiceFilterRoute.ts` follow a related but distinct, replace-only convention for filter state — they always use `router.replace`, never `push`/`back()`, because filter state has no dismiss/undo semantics. Do not treat them as overlay-dismiss templates.

There are **no nested/`children` routes anywhere in this project.** Do not introduce them for this.

An overlay that does not need Back-to-close stays plain local state, and Back simply leaves the page. That is fine and is the default.

### Form pages are never cached

`src/App.vue` wraps the router view in `<KeepAlive>` with an `exclude` list. Form pages are on that list and must stay there. Their fields are component-local refs; if the page is cached, what a user typed for one customer survives into the next one and can be submitted against the wrong record.

`exclude` matches the **component name**, not the file path — renaming one of those files silently removes it from the list and reintroduces the bug with no error anywhere. If you add a new form page, add it to the list.

A page on that list must not use `onActivated`/`onDeactivated`; those hooks never fire for an uncached component. Use `onMounted`.

## Session continuity — beat the context bill

Long sessions get expensive and `/compact` costs more than it saves. The fix is to make a clean
`/clear` lose nothing.

- **`.user/memory/MEMORY.md` is the one handoff note** — a live note of what is in flight, what
  is next, and what is stuck. Not a document, not rules, not a diary. Read it first each session.
  **Rules: `.claude/.rules/memory.md`.** Read that before writing to it.
  The short version: 150 lines max, bullets not prose, every entry tied to a branch that still
  exists, project rules as pointers only, update at every commit.
- **When a commit closes a unit of work, say so and offer to stop.** Update the note first; the
  user clears and reopens with "read `MEMORY.md`".
- Put worker-specific context in that worker's brief, not here.

## Context economy

The main context is the scarce resource; workers are cheap.

- Do not read source files into the main context. Send an explorer and take the summary.
- Ask workers for terse, on-point reports.
- Read logs with `tail -c` or `grep -n`, never whole files.
- Check diffs with `--stat` and targeted greps rather than printing them.
- Write briefs to a file and pipe the file in; do not paste long briefs into the conversation.

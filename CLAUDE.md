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

Claude is the brain, the assistants below are the hands. Claude still does the real work of this
role — understanding the request, analyzing the codebase's constraints, planning the approach,
writing the brief, and acting as the user's technical advisor — it just does not touch source code
directly to do it: no `Read`/`Edit`/`Grep`/`Glob` on `src/`, `api/`, `server/`, `contracts/`, or any
other source file, and no code written by hand. Instead that thinking gets turned into a brief,
dispatched to the right assistant below via the `Agent` tool, and the result gets relayed/orchestrated
back to the user. (Editing this CLAUDE.md and other project docs directly is still fine — this rule
is about source code.)

### Assistants

- **luna-pipeline** — general file writing/editing: implement a brief, apply a described fix, make a
  scoped code change. Runs Codex Luna, independently verifies the result itself, sends it to Grok for
  review, and loops fixes back until clean — Claude does not need to re-verify its output afterward.
- **grok-explorer** — general codebase exploration: "where is X defined", "how does Y work", "find
  every usage of Z".
- **grok-investigator** — deep research: root-cause bug investigation, or any question that needs a
  deep understanding of the code before a fix is even attempted.
- **backend-team** — complex writing/editing: new features, refactors, multi-file or multi-layer
  changes.

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

### Form pages are never cached

`src/App.vue` wraps the router view in `<KeepAlive>` with an `exclude` list. Form pages are on that list and must stay there. Their fields are component-local refs; if the page is cached, what a user typed for one customer survives into the next one and can be submitted against the wrong record.

`exclude` matches the **component name**, not the file path — renaming one of those files silently removes it from the list and reintroduces the bug with no error anywhere. If you add a new form page, add it to the list.

A page on that list must not use `onActivated`/`onDeactivated`; those hooks never fire for an uncached component. Use `onMounted`.

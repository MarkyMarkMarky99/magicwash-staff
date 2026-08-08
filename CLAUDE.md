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

## Delegating code to Codex luna

Codex `gpt-5.6-luna` writes and edits the code in this repo. Claude writes the brief,
orchestrates, and independently verifies — it does not edit files itself.

```bash
codex exec -s workspace-write -m gpt-5.6-luna -c model_reasoning_effort="xhigh" - < <brieffile>
```

Pass the brief on stdin; inlining a long prompt as a quoted argument mangles it.

**`-s workspace-write` only.** Never `--full-auto` or a sandbox bypass. That flag is what
structurally confines writes to this repo, and
`G:\My Drive\Magicwash\Database\GoogleSheets\*.json` — the schema registry, shared with the
Python project at the repo root — must never be written to. When registry and code
disagree, the code changes. Say so in every brief that mentions the registry: an
instruction to "make them match" always has two solutions and the wrong one silently
rewrites the source of truth.

Two independent tasks can run in parallel in this working tree when their files do not
overlap (e.g. `src/` and `server/`). Give each brief the other's boundaries and its own
verification command, so neither "fixes" the other's half-finished state.

### Writing the brief

The brief is the only lever on the result. Put in it: the traps, what must not change,
what to report rather than fix, and which tests are allowed to change versus which must
pass untouched. State why a constraint exists — a rule with a reason survives, a bare
rule gets worked around.

### Verifying

Check the code, not the summary. Luna has reported success on work with real defects: a
test that passed while the regression it guarded was live, and a "passing" test suite that
had quietly broken the documented run command.

For anything that guards a rule, break the rule and confirm the guard fails. Several rules
here are invisible to `tsc` — schema key order, lazy repository construction, JSON column
kinds — so a green typecheck proves nothing about them.

If luna returns a workaround out of proportion to the problem, suspect the brief before
the work. It usually means a constraint was stated that cannot actually hold.

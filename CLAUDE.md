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
  - `types/` - Frontend models and API DTO types.
  - `mappers/` - Transform API DTOs to frontend models and payloads back to API format.
  - `constants/` - Feature-specific static values.
  - `routes.ts` - Feature route definitions.
- `src/assets/` - Static assets: images, icons, global styles.

Only create subfolders when the feature actually needs them.

## Architecture Rules
- Follow feature-based architecture. Dependency direction: `app` -> `features` -> `shared`; `shared` must never import from `features`, and avoid cross-feature imports — move shared logic to `src/shared/`.
- Layer responsibilities: components (presentational, no API calls) -> pages (orchestrate, no duplicated API logic) -> stores (manage state, call services) -> services (call the API, run responses through mappers).
- The API is the source of truth for business data — it returns frontend-ready `camelCase` DTOs with all business facts (statuses, totals, merged relations) already resolved. The frontend must not re-derive or re-assemble business data the API should already provide.
- Frontend mappers only turn API DTOs into view models by adding presentation concerns (labels, tones, display aliases, summary strings) — never merge records, compute business statuses, or convert casing; that is the API's job (see `api/CLAUDE.md`).

## Data Flow

Component -> Page -> Store -> Service -> Mapper -> API

Response flow:

API -> Mapper -> Service -> Store -> Page -> Component

## Backend API
The serverless backend lives in `api/`. **`api/CLAUDE.md` is the single source of truth**
for its structure, layers, and rules — backend details are intentionally not duplicated here.

The frontend depends only on the **API contract**: it consumes `camelCase`, business-complete
DTOs (statuses, totals, merged relations already resolved) and never sees DB shape —
`snake_case`/PascalCase rows stay behind the API boundary.

## Types & DTO Rules
- `*-api.types.ts` — the API response contract the frontend consumes: `camelCase`,
  business-complete (all statuses/totals/relations resolved server-side).
- `*.types.ts` — frontend view models; extend the API type with presentation-only
  additions (labels, tones, display aliases, summaries).
- Never let DB shape reach the frontend: raw DB rows / `snake_case` must not cross the
  API boundary, and DB types must never reach stores, pages, or components.

## Naming Conventions
- Vue components: `PascalCase.vue`
- Logic files: `kebab-case`
- Composables: prefix with `use`

## Import Rules
- Use `@/` path alias.
- Avoid deep relative imports like `../../../../`.
- Use `import type` for TypeScript types and interfaces.

## Coding Standards
- Prefer strong TypeScript types.
- Avoid `any`.
- Keep components presentational when possible.
- Keep business logic out of UI components.
- Keep API logic inside services only.
- Keep field mapping inside mappers only.

## Gotchas
- Do not inject API clients into components.
- Do not use API DTOs directly in UI — always map to a view model first.
- Do not re-implement business logic in the frontend that the API already resolves
  (e.g. status derivation, totals, merging related records). If the API response
  is missing data the UI needs, fix it in the API (see `api/CLAUDE.md`) — don't patch
  it on the frontend.
- Do not let the frontend know about the database shape — `snake_case` and raw
  DB rows must never cross the API boundary.
- Do not put feature-specific code in `shared/`.
- Do not create all folders upfront if they are unused.
- Do not duplicate API calls in pages when a store/service already exists.

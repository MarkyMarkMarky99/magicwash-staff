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
  - `types/` - Frontend-owned TypeScript contracts, including duplicated API response DTOs and UI-only types.
  - `routes.ts` - Feature route definitions.
- `src/assets/` - Static assets: images, icons, global styles.

Only create subfolders when the feature actually needs them.

## Architecture Rules
- Follow feature-based architecture. Dependency direction: `app` -> `features` -> `shared`; `shared` must never import from `features`, and avoid cross-feature imports — move shared logic to `src/shared/`.
- Layer responsibilities: components (presentational, no API calls) -> pages (orchestrate, no duplicated API logic) -> stores (manage state, call services) -> services (call the API).
- The backend response DTO is the source of truth for business data. The API returns frontend-ready `camelCase` DTOs with all business facts (statuses, totals, merged relations) already resolved.
- Frontend response type files must duplicate the backend `*-response.types.ts` contract exactly for the fields the API returns, but must not import from backend files because backend and frontend are separate projects.
- Services return API response DTOs directly. Do not map, alias, reshape, or enrich API data in services, stores, pages, or components.
- Do not create frontend mappers. If a screen needs labels, tones, CSS classes, aliases, or display summaries, compute them as presentation-only values without changing the API data shape.

## Data Flow

Component -> Page -> Store -> Service -> API

Response flow:

API -> Service -> Store -> Page -> Component

## Backend API Structure (`api/modules/<feature>/`)
- `handlers/` - API endpoint layer. Parses the request, calls the service, returns the HTTP response.
- `services/` - Business layer. Validates input, orchestrates repository + mapper, applies business rules (filtering, sorting, pagination, derived facts).
- `repositories/` - Data access layer. Queries the data source and returns raw rows. Contains no business logic.
- `mappers/` - Data transform layer. Converts raw DB rows into response DTOs: merges related records, converts `snake_case` -> `camelCase`, and resolves business-derived fields (e.g. status, balances, payment method).
- `types/` - `<feature>-db.types.ts` mirrors the real data source schema (`snake_case`); `<feature>-response.types.ts` is the frontend-ready contract returned by the API (`camelCase`, business-complete).

Backend data flow:

Repository (DB rows, snake_case) -> Mapper (-> response DTO, camelCase, business-complete) -> Service (filter/sort/paginate/orchestrate) -> Handler -> HTTP response

## Types & DTO Rules
- Use feature `*.types.ts` files for frontend-owned contracts. For API responses, copy the full contract from the matching backend `api/modules/<feature>/types/<feature>-response.types.ts` file into the frontend feature type file.
- Backend `*-db.types.ts` mirror the real data source schema and may use `snake_case`; they never leave the backend.
- Backend `*-response.types.ts` and frontend duplicated response DTO types must stay identical for API response data: `camelCase`, frontend-ready, and business-complete.
- Do not import backend type files into frontend code. Keep the frontend copy in sync manually when the backend response contract changes.
- Do not map API DTOs into separate frontend view models. Use response DTOs directly for business data, and keep presentation-only metadata separate from the API data shape.
- Never expose backend DB types to the frontend, or to stores/pages/components.
- `snake_case` -> `camelCase` conversion happens once, inside the backend mapper.

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
- Services should parse and return typed API responses directly.
- Do not add frontend field mapping layers. Business field mapping belongs in backend mappers only.

## Gotchas
- Do not inject API clients into components.
- API DTOs are frontend-ready and may be used directly by stores/pages/components for business data.
- Do not import from `api/modules/**` inside `src/**`; copy response DTO contracts into frontend feature types instead.
- Do not re-implement business logic in the frontend that the API already resolves
  (e.g. status derivation, totals, merging related records). If the API response
  is missing data the UI needs, fix the backend mapper/service — don't patch it
  on the frontend.
- Do not let the frontend know about the database shape — `snake_case` and raw
  DB rows must never cross the API boundary.
- Do not put feature-specific code in `shared/`.
- Do not create all folders upfront if they are unused.
- Do not duplicate API calls in pages when a store/service already exists.

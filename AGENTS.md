# AGENTS.md - Vue Feature-Based Frontend

## Tech Stack
- Vue 3 + TypeScript
- Pinia for state management
- Vue Router for routing
- Vite as build tool

## Project Structure
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

## Feature Structure

src/features/<feature>/
├─ components/
├─ pages/
├─ services/
│  └─ <feature>.service.ts
├─ stores/
│  └─ <feature>.store.ts
├─ types/
│  ├─ <feature>.types.ts
│  └─ <feature>-api.types.ts
├─ mappers/
│  └─ <feature>.mapper.ts
├─ constants/
└─ routes.ts

Only create subfolders when the feature actually needs them.

## Architecture Rules
- Follow feature-based architecture.
- Dependency direction: `app` -> `features` -> `shared`.
- `shared` must never import from `features`.
- Avoid cross-feature imports. Move shared logic to `src/shared/`.
- Components must not call APIs directly.
- Pages should orchestrate, not contain duplicated API logic.
- Stores manage feature state and call services.
- Services call APIs and use mappers.
- Mappers handle all backend/frontend field conversion.

## Data Flow

Component -> Page -> Store -> Service -> Mapper -> API

Response flow:

API -> Mapper -> Service -> Store -> Page -> Component

## Types & DTO Rules
- Use `*.types.ts` for frontend models.
- Use `*-api.types.ts` for backend API DTOs.
- Frontend models should use `camelCase`.
- Backend DTOs may use `snake_case`.
- Never expose API DTOs to stores, pages, or components.
- Convert DTOs inside `mappers/` only.

Example:

invoice_id     -> id
invoice_no     -> invoiceNo
customer_name  -> customerName
total_amount   -> totalAmount

## Naming Conventions
- Vue components: `PascalCase.vue`
  - `BaseButton.vue`
  - `OrderTable.vue`
- Logic files: `kebab-case`
  - `order.service.ts`
  - `order.store.ts`
  - `order.mapper.ts`
  - `order-api.types.ts`
- Composables: prefix with `use`
  - `usePagination.ts`
  - `useToast.ts`

## Import Rules
- Use `@/` path alias.
- Avoid deep relative imports like `../../../../`.
- Use `import type` for TypeScript types and interfaces.

Example:

import type { Invoice } from '../types/invoice.types'

## Coding Standards
- Prefer strong TypeScript types.
- Avoid `any`.
- Keep components presentational when possible.
- Keep business logic out of UI components.
- Keep API logic inside services only.
- Keep field mapping inside mappers only.

## Gotchas
- Do not inject API clients into components.
- Do not use backend DTOs directly in UI.
- Do not put feature-specific code in `shared/`.
- Do not create all folders upfront if they are unused.
- Do not duplicate API calls in pages when a store/service already exists. 

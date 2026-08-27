---
last_audited: 2026-08-26
audit_sources:
  - src/features/customers
  - src/features/customers/routes.ts
  - src/features/customers/pages/CustomerListPage.vue
  - src/features/customers/services/customer.service.ts
---

# Frontend Feature Structure

Business functionality is organized by feature.

Each feature owns its UI, state, routing, API integration, and feature-specific logic.

## Structure

src/features/<feature>/
├── components/   # Feature-specific UI components
├── pages/        # Route-level pages
├── composables/  # Reusable feature logic
├── stores/       # Pinia feature state and workflows
├── services/     # Backend API communication
├── utils/        # Feature-specific pure helpers
└── routes.ts     # Routes owned by the feature

Create only the parts the feature actually needs.

## Dependency Direction

Page
→ Store / Composable
→ Service
→ API

Page
→ Components

Feature code may depend on `src/shared/`.

Avoid direct dependencies between unrelated features.

## Placement Rule

Keep code inside its owning feature unless it is genuinely reusable across multiple features.

Cross-feature reusable code belongs in `src/shared/`.

Code the backend must execute identically belongs in the repository-root `shared/`
instead — a calculation whose result the UI previews and the backend stores. Two copies
of one rule diverge silently.

`src/shared/` is frontend-only; root `shared/` is the only folder both runtimes import.
---
last_audited: 2026-09-07
audit_sources:
  - src/features/customers
  - src/features/customers/routes.ts
  - src/features/customers/pages/CustomerListPage.vue
  - src/features/customers/services/customer.service.ts
  - src/features/gallery/pages/OrderGalleryPage.vue
  - src/features/gallery/services/laundry-photo.service.ts
---

# Frontend Feature Structure

Business functionality is organized by feature.

- Each feature owns its UI, routing, workflow state, and feature-specific logic.

The gallery writes photo rows through the shared API client; Apps Script is no longer in its create
path. Its image binary still goes to Firebase Storage, only the URL reaches the API, and the photo
list is still read from GViz — moving either is separate work. Reassigning an already saved before
or after photo is a separate feature service operation through the same client; the gallery loads
the current order's destination items only when the reassignment picker opens.

## Structure

src/features/<feature>/
├── components/   # Feature-specific UI components
├── pages/        # Route-level pages
├── composables/  # Reusable feature logic
├── stores/       # Pinia feature state and workflows
├── utils/        # Feature-specific pure helpers
└── routes.ts     # Routes owned by the feature

Create only the parts the feature actually needs.

## Dependency Direction

Page
→ Store / Composable
→ Data

Page
→ Components

- Components receive props and emit user actions to their owning page or feature container.
- Components do not call APIs directly.
- Pages coordinate loading, navigation, and calls to stores or data modules.

- Stores own workflow state, forms, selections, and UI state.
- Features do not construct API requests or call the shared API client directly.
- Feature-specific filtering and derivation of table data stays in the feature.

The API contract is the frontend business-data boundary. New code consumes contract-derived
camelCase DTOs directly; do not add frontend DTO copies or re-derive business facts the API owns,
such as statuses, totals, or merged relations. UI-local form state and boundary payload
normalization remain valid frontend responsibilities. Legacy service-wrapper types may remain until
their owning feature is migrated; do not use them as a template for new code.

Feature code may depend on `src/shared/`.

Avoid direct dependencies between unrelated features.

## Placement Rule

Keep code inside its owning feature unless it is genuinely reusable across multiple features.

Cross-feature reusable code belongs in `src/shared/`.

Code the backend must execute identically belongs in the repository-root `shared/`
instead — a calculation whose result the UI previews and the backend stores. Two copies
of one rule diverge silently.

`src/shared/` is frontend-only; root `shared/` is the only folder both runtimes import.

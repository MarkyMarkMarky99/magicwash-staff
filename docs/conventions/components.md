---
last_audited: 2026-08-26
audit_sources:
  - src/shared/components
  - src/shared/layouts
  - src/features/customers/components
  - src/features/appointments/components
---

# Component Conventions

Components should focus on UI.

## Ownership

src/
├── shared/components/              # Generic cross-feature UI
└── features/<feature>/components/  # Feature-specific UI

### Shared Components

- Generic and reusable across unrelated features.
- Must not contain domain-specific business logic.
- Must not depend on `src/features/`, feature stores, or feature services.
- Must not call APIs directly.

### Feature Components

- May understand the owning feature's domain.
- Keep feature-specific components inside their feature.

## Rules

- Keep components focused on UI and interaction.
- Prefer props for input and emits for actions.
- Keep API calls, shared state, and business workflows outside components.
- Local UI state may remain inside the component.
- Do not move a component to `shared/` merely because it is reused within one feature.
- Move to `shared/` only when genuinely reusable across multiple features.
- Prefer existing shared components as-is; if one does not fit, create a feature-local component rather than changing the shared API casually.
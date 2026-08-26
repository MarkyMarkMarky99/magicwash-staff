---
last_audited: 2026-08-27
audit_sources:
  - shared/utils/invoice-calculator.ts
  - server/shared/http/validate.ts
  - server/shared/services/base-crud.service.ts
---

# Coding Conventions

## Structure

- Keep logic simple and local by default.
- Keep functions focused on one responsibility.
- Use explicit, domain-accurate names.

## Validation

- Validate untrusted input at public boundaries.
- Keep private functions and methods focused on already-validated input.
- Do not duplicate boundary validation in private functions or methods.

## Reuse

- Extract shared logic when it is used in multiple places.
- Extract complex logic when it improves readability.
- Do not add helpers that only rename one obvious expression.
- Do not add abstractions that do not reduce duplication, complexity, or risk.

## Comments

- Code, explicit names, types, interfaces, and tests are the primary documentation.
- Comment only a non-obvious invariant, business rule, unusual implementation, or dangerous constraint.
- Do not narrate code, types, formulas, examples, variable roles, persistence details, or tested behavior.
- Prefer an explicit name, type, small function, or test over explanatory prose.
- Keep comments concise and adjacent to the code they protect.
- Update or remove comments when the related behavior changes.

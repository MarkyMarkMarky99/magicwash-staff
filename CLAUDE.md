# Frontend Documentation Index

Read the canonical document for the area you change. Do not duplicate its rules here.

When a behavior, architecture decision, convention, contract, or verification rule changes, update
its canonical document under `docs/` in the same change. If documentation conflicts with the
implemented behavior, correct the canonical document rather than adding a competing rule here.

## Architecture

- [Project structure, technology, path aliases, and dependency direction](docs/architecture/frontend/project-structure.md)
- [Feature structure, data flow, state/API ownership, and shared-code placement](docs/architecture/frontend/feature-structure.md)

## Conventions

- [Coding and TypeScript](docs/conventions/coding.md)
- [Components](docs/conventions/components.md)
- [Naming](docs/conventions/naming.md)
- [Contracts and the API/DB boundary](docs/conventions/contracts/README.md)
- [API contract schemas](docs/conventions/contracts/api.md)
- [Datetime and cross-runtime code](docs/conventions/datetime.md)

## UI patterns

- [Forms](docs/design/patterns/forms.md)
- [List pages](docs/design/patterns/list-pages.md)
- [Navigation and route-owned overlays](docs/conventions/navigation.md)

## Verification

- [Type checking and tests](docs/conventions/verification.md)

## Backend

The serverless backend lives in `api/` and `server/`.

- [Backend project structure](docs/architecture/backend/project-structure.md)
- [Backend module structure](docs/architecture/backend/module-structure.md)
- [Backend service layer](docs/architecture/backend/service-layer.md)
- [Backend persistence](docs/architecture/backend/persistence.md)
- [Backend operations, contracts, validation, and verification](docs/architecture/backend/operations.md)

## Operational rules

- Session continuity is governed by `.claude/.rules/memory.md`. Before every commit, update
  `.user/memory/MEMORY.md` in accordance with that rule.

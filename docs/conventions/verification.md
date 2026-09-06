---
last_audited: 2026-09-07
audit_sources:
  - package.json
  - tsconfig.web.json
  - api/tsconfig.json
  - tests/e2e/playwright.config.ts
---

# Verification Conventions

## Type checking

Every frontend change must pass:

```sh
npm run typecheck:web
```

It runs `vue-tsc -p tsconfig.web.json --noEmit` and covers TypeScript, JavaScript, and Vue files
under `src/`. `npm run build` runs Vite/esbuild and does not replace type checking.

Backend or shared-contract changes must also pass:

```sh
npm run typecheck:api
```

## Tests

There is no single `npm test` command. Run the relevant test directly.

- Dry tests use `node:assert/strict` and `tsx`.
- Frontend dry tests under `tests/web/` normally run with:

  ```sh
  npx tsx --tsconfig jsconfig.json <path-to-test>
  ```

- Compatibility and shared-runtime dry tests under `tests/frontend/` and `tests/shared/` normally
  run with `npx tsx <path-to-test>`.

- Backend test conventions, including unit, workflow, integration, and type-only tests, are defined
  in `docs/architecture/backend/operations.md`.
- End-to-end tests use Playwright. Start the required local application services first, then run:

  ```sh
  npx playwright test --config=tests/e2e/playwright.config.ts
  ```

Use the command documented by a focused test when it has stricter prerequisites, especially when a
test reaches live backend services.

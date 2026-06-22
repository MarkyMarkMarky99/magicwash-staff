---
description: Rules for AI when writing API contract schema files
paths:
  - "contracts/**/*.schema.ts"
---

# API Contract Schema Rules

- Use `zod` for all schema declarations.
- Do not export `z.infer` types from `*.schema.ts` files.
- Define domain value schemas for API-facing enums.
- Define reusable primitive validation schemas when a field format is reused.
- Define a create request schema for client create payloads.
- Define an update request schema for mutable update payloads.
- Define update schemas with required actor fields when the module tracks update actors.
- Define update schemas so at least one mutable field is required.
- Define a sort field schema when the list endpoint supports sorting.
- Define a list query schema for filters, search, pagination, and sorting.
- Define pagination limits and use shared pagination defaults.
- Define list response schemas for lightweight list DTOs.
- Define detail response schemas for full detail DTOs.
- Define response schemas as API-facing `camelCase` DTO contracts only.
- Do not include DB row schemas or `snake_case` fields in API contract schemas.
- Keep every individual schema exported (the frontend imports them directly).
- Export a single `*ApiSchemas` bundle in the nested standard shape `{ query: { list }, request: { create, update }, response: { list, detail, create, update } }`, typed with `satisfies ModuleApiContract` from `contracts/shared/module-api-contract.ts`.

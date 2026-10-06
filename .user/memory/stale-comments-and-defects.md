# Stale source comments and real defects — open

Two statically supported cache defects, plus unchecked audit rows.

- Runtime reproduction of the cache defects remains pending; existing dry tests do not cover these cases.
- Recheck each stale-comment lead before changing its source comment.

Full context and the audit's other tables: `.user/memory/doc-comment-docs-work.md`.

## Real code defects — 2

| Location | Defect |
|---|---|
| `src/shared/api/persistent-cache.ts` | The parse guard checks object-ness and that `t` is a number, but never validates `parsed.v`. |
| `src/shared/api/persistent-cache.ts`, `response-cache.ts` | Failed `removeItem` leaves the persisted entry available for promotion back into memory without value validation. |

## Unchecked stale-comment rows

Nine rows the audit marked STALE were never re-checked; see `.user/memory/doc-comment-docs-work.md`.

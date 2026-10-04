# Stale source comments and real defects — open

Two code defects the comment-cleanup rounds left untouched, plus unchecked audit rows.

**Every row below is a claim from a read-only audit, not a verified fact.** Open the code and the
cited evidence before acting. The same audit was already wrong twice elsewhere. If a comment does
not say what the row claims, fix the row — do not delete the comment.

Full context and the audit's other tables: `.user/memory/doc-comment-docs-work.md`.

## Real code defects — 2

| Location | Defect |
|---|---|
| `src/shared/api/persistent-cache.ts:77-83` | The parse guard checks object-ness and that `t` is a number. `parsed.v` is never validated, so a shape-mismatched value passes through. |
| `src/shared/api/persistent-cache.ts:175-189` | If `removeItem` throws, the persisted entry survives and `promoteFromStorage` reads it back into memory. The next read does not revalidate. Promotion: `src/shared/api/response-cache.ts:78-99,144-157`. |

## Unchecked stale-comment rows

Nine rows the audit marked STALE were never re-checked; see `.user/memory/doc-comment-docs-work.md`.

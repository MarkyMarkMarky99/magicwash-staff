# User Memory

## Future API Engine Work

- DB request/response schemas in `ModuleDbContract` should eventually be enforced at runtime.
- Current repository flow uses `db.row`, `db.fieldMap`, and `db.primaryKey` at runtime, but does not parse/validate:
  - `db.request.create`
  - `db.request.update`
  - `db.response.read`
  - `db.response.create`
  - `db.response.update`
- Intended future behavior: after `mapper.toDb()` and `transformer.request`, validate the final DB/AppScript request body against the matching `db.request.*` schema before `execute/write`.
- Intended future behavior: after storage returns data and `transformer.response` runs, validate DB response shape against the matching `db.response.*` schema before `mapper.toApi()`.
- This is intentionally out of scope for the current appointment migration.


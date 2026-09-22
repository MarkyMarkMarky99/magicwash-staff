# Items master

- Worktree: `C:/Users/Asus/.codex/worktrees/items-master/webapp-vue`.
- Branch includes the committed picker and form through a fast-forward from `codex/price-list-item-form`.
- Items contracts/backend are committed; root reviewed every changed line and restored PriceList GET/PATCH coverage.
- API/Web typechecks, ten targeted dry-test files, diff whitespace checks, and local Vercel build pass.
- Nullable PATCH fields clear their stored cells; transport regression test passes.
- PriceList POST is disabled; existing GET/PATCH and live PriceList sheet remain intact.
- Items uses the existing Items tab in the PriceList spreadsheet.
- Frontend integration: Order reads Items; Invoice retains PriceList; new form creates without price and optionally uploads a photo.
- Web typecheck, cross-feature check, targeted tests, build, and mocked mobile browser flow pass; no live writes or deployment performed.
- Root reviewed every frontend diff line; category validation now reacts to fresh Items data and has browser regression coverage.
- Frontend-review completed all five streams; load retry, cache invalidation and duplicate live-region findings are fixed and tested.
- User authorized push, Preview deployment, and creating/editing one real TEST item; verification is pending.
- No Items edit UI exists; live edit verification uses PATCH from a browser context.
- Read-then-append item-code allocation has no cross-instance uniqueness guarantee.
- Resume at `server/modules/items/items.module.ts` and `tests/server/unit/modules/items/`.

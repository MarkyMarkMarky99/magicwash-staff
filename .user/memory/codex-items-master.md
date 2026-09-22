# Items master

- Worktree: `C:/Users/Asus/.codex/worktrees/items-master/webapp-vue`.
- Branch includes the committed picker and form through a fast-forward from `codex/price-list-item-form`.
- Items contracts/backend are uncommitted; root reviewed every changed line and restored PriceList GET/PATCH coverage.
- API/Web typechecks, ten targeted dry-test files, diff whitespace checks, and local Vercel build pass.
- Nullable PATCH fields clear their stored cells; transport regression test passes.
- PriceList POST is disabled; existing GET/PATCH and live PriceList sheet remain intact.
- Items uses the existing Items tab in the PriceList spreadsheet.
- Frontend form remains UI-only; no live data writes or deployment were performed.
- Read-then-append item-code allocation has no cross-instance uniqueness guarantee.
- Resume at `server/modules/items/items.module.ts` and `tests/server/unit/modules/items/`.

# Items master

- Worktree: `C:/Users/Asus/.codex/worktrees/items-master/webapp-vue`.
- Branch includes the committed picker and form through a fast-forward from `codex/price-list-item-form`.
- Items contracts/backend are committed; root reviewed every changed line and restored PriceList GET/PATCH coverage.
- API/Web typechecks, ten targeted dry-test files, diff whitespace checks, and local Vercel build pass.
- Nullable PATCH fields clear their stored cells; transport regression test passes.
- PriceList POST is disabled; existing GET/PATCH and live PriceList sheet remain intact.
- Items uses the existing Items tab in the PriceList spreadsheet.
- Frontend integration: Order reads Items; Invoice retains PriceList; new form creates without price and optionally uploads a photo.
- Web typecheck, cross-feature check, targeted tests, build, and mocked mobile browser flow pass.
- Root reviewed every frontend diff line; category validation now reacts to fresh Items data and has browser regression coverage.
- Frontend-review completed all five streams; load retry, cache invalidation and duplicate live-region findings are fixed and tested.
- Live Preview tested: https://magicwash-staff-pj12g834a-magicwashth-8243s-projects.vercel.app (application commit b94b71a).
- Created TEST item ITM-0099 / 2e6b91d2 through the real form; PATCH changed variant/displayNameEn and set active=false; GET read-back passed.
- Test item name: ZZ TEST Items 1790072460209; intentionally retained inactive in Items; PriceList rows unchanged.
- No Items edit UI exists; live edit verification uses PATCH from a browser context.
- Read-then-append item-code allocation has no cross-instance uniqueness guarantee.
- Resume at `server/modules/items/items.module.ts` and `tests/server/unit/modules/items/`.

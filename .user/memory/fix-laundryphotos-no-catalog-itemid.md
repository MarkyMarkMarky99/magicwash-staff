# fix/laundryphotos-no-catalog-itemid

- Gallery BEF upload no longer sends `itemId`; photo reassign writes only `orderitem_id` + `updated_by`.
- Gates passed: typecheck api/web, vite build, laundry-photo dry tests.
- Not browser-tested; owner said commit only, do not deploy yet.
- AfterPhoto (AFT) still writes catalog ids into `AfterPhoto.item_id`; not in scope.
- After deploy: fix target rule of `scripts/one-off/clear-catalog-itemid-laundryphotos.ts`, dry-run, owner approves `--write`.

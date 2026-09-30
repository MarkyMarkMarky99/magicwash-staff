# feat/package-service-type

- Live `Packages` sheet already migrated 2026-09-30: IRONING→IRON, SILVER/GOLD/PLATINUM/PERSONAL→WSIR, WASHING→WASH.
- New package `WASHING` (100 credits, 990 THB) replaced the old `ZZTEST01` test row.
- Package cards still show the raw code (e.g. `WSIR`), not the Thai label; undecided.
- `customer-package.service.dry-test.ts` fails on `main` too (fetch-URL regex); not caused by this branch.
- Package form picker not yet checked in a real browser.

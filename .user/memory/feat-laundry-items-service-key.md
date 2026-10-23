# feat/laundry-items-service-key

- Webapp half of `C:\MagicwashAI\docs\plans\classify-laundry-items.md`: header `x-service-key` = env `AI_SERVICE_KEY` lets PATCH /api/laundry-items/:id set `itemId` only, actor `AI`.
- Gates passed: typecheck:api, staff-auth-gateway + laundry-items dry tests.
- Before merge: set `AI_SERVICE_KEY` in Vercel Production/Preview and the same value as `WEBAPP_SERVICE_KEY` in MagicwashAI `.env`.
- MagicwashAI half (classify-laundry-items task) on its own branch in that repo.

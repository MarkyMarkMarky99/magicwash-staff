# feat/staff-google-auth

- Status: frontend (login page, router guard, `authFetch`, logout) and backend (gateway `jose` check, `Staff` sheet allow-list, `GET /api/auth/me`) built; typecheck and new dry-tests pass.
- Vercel env `FIREBASE_PROJECT_ID` and `STAFF_SPREADSHEET_ID` added by user (Production + Preview) on 2026-09-27.
- Next: real-account login test (listed and unlisted email), then merge to `main`.
- Blocker for Preview login: Preview URLs are not in Firebase Authorized domains (`auth/unauthorized-domain`); add the preview host or test locally.
- `orders` module stays unauthenticated for the external portal.
- Out of scope by user decision: removing `?by=`, server-side actor from token, Firebase Storage rules.
- AppSheet deep links with `?by=` now land on the login page first.
- Codex reported 5 server dry-tests failing (invoice workflows x2, sheet metadata x2, order-item contract export) as pre-existing; not verified against `main`.

# ccr-403098c8-ftoikm — staff login fails on every device

- Symptom: Google sign-in works, then `/api/auth/me` fails (non-403) → "ตรวจสอบสิทธิ์ไม่สำเร็จ".
- Change: login Staff reader reads `A:ZZ` (was `A:I`), so a StaffId column past I no longer 500s everyone.
- Change: the error now ends with the HTTP status, or `(network)`, to show which layer failed.
- Not confirmed: prod logs were not reachable from the session.
- Owner checks: Vercel logs for `/api/auth/me`; env `GOOGLE_SERVICE_ACCOUNT_KEY`, `STAFF_SPREADSHEET_ID`, `FIREBASE_PROJECT_ID`.
- Owner checks: Staff sheet still named `Staff`, shared with the service account, headers Email/Name/Role/Active/StaffId.

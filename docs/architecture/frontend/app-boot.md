---
last_audited: 2026-09-11
audit_sources:
  - src/main.js
  - src/App.vue
  - src/router/index.js
  - src/firebase.js
  - src/features/gallery/routes.ts
  - src/features/appointments/stores/appointment.store.ts
  - src/shared/api/persistent-cache.ts
---

# Application Boot

What may run before the first route renders.

## Budget

- Eager JS at boot: **277 KB across 8 chunks** (measured 2026-09-11, `npx vite build`). The byte
  count is unchanged from the 7-chunk measurement of 2026-09-10; Firebase merely split out of the
  entry chunk once a second lazy route started importing it.
- Treat that as a ceiling, not a target. A change that raises it needs a reason in the PR.
- Verify: `npx vite build`, then read the `assets/*.js` set in `dist/index.html`.

## Page components

- Every page component is a dynamic import. No exceptions.
- A statically imported page is bundled into the entry chunk and every user pays for it.
- Current violation: `src/features/gallery/routes.ts:1-6` imports `OrderGalleryPage.vue` statically.
  That one line pulls the Firebase SDK into the entry chunk for staff who never open the gallery.

## Third-party SDKs

- Do not initialise an SDK at module scope unless every route needs it.
- `src/firebase.js:4-14` calls `initializeApp()` and `getStorage()` on import. The issue report form
  reaches it too, but lazily; the gallery's static import above is the only reason it runs at boot,
  so fixing that import fixes this too.

## Network at boot

A request may fire at boot only if it meets all three:

1. Every route uses the data.
2. The query is bounded — a `perPage` cap alone is not a bound.
3. The caller has an in-flight guard, not just a `loaded` flag.

- Current boot requests: `src/App.vue:8-9` fires two appointment reads on mount.
- `?appointmentDate=<today>&perPage=100` is bounded.
- `?status=PENDING&perPage=100` is **not** date-bounded and silently truncates past 100 rows.
  `appointment-api.schema.ts:88-102` already accepts `dateFrom` / `dateTo`.
- `appointment.store.ts:73` checks `pendingLoaded` only, so a second call can start mid-flight.

## Module-scope side effects

- Keep them cheap and safe to run twice.
- `src/shared/api/persistent-cache.ts:37-43` runs `purgeOtherVersions()` on import, reading
  `localStorage` synchronously. Anything heavier belongs behind a call, not an import.

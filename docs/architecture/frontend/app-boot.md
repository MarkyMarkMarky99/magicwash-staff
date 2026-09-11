---
last_audited: 2026-09-10
audit_sources:
  - src/main.js
  - src/App.vue
  - src/router/index.js
  - src/firebase.js
  - src/features/gallery/routes.ts
  - src/features/appointments/stores/appointment.store.ts
  - src/shared/api/persistent-cache.ts
---

> **DRAFT — not reviewed.** Written by an agent session on 2026-09-11 and merged in `d9e34bc`
> without the repository owner reading it. At least one statement in it has already been found
> wrong. Verify anything here against the source before relying on it, and do not cite this
> document as the authority for deleting a source comment until it has been reviewed.

# Application Boot

What may run before the first route renders.

## Budget

- Eager JS at boot: **277 KB across 7 chunks** (measured 2026-09-10, `npx vite build`).
- Treat that as a ceiling, not a target. A change that raises it needs a reason in the PR.
- Verify: `npx vite build`, then read the `assets/*.js` set in `dist/index.html`.

## Page components

- Every page component is a dynamic import. No exceptions.
- A statically imported page is bundled into the entry chunk and every user pays for it.
- Current violation: `src/features/gallery/routes.ts:1-6` imports `OrderGalleryPage.vue` statically.
  That one line pulls the Firebase SDK into the entry chunk for staff who never open the gallery.

## Third-party SDKs

- Do not initialise an SDK at module scope unless every route needs it.
- `src/firebase.js:4-14` calls `initializeApp()` and `getStorage()` on import. It is reached only
  through the gallery page above; fixing the import fixes this too.

## Network at boot

A request may fire at boot only if it meets all three:

1. Every route uses the data.
2. The query is bounded — a `perPage` cap alone is not a bound.
3. The caller has an in-flight guard, not just a `loaded` flag.

- Current boot requests: `src/App.vue:8-9` fires two appointment reads on mount.
- `?appointmentDate=<today>&perPage=100` is bounded.
- `?status=PENDING&perPage=100` is **not** date-bounded and silently truncates past 100 rows.
  `appointment-api.schema.ts:88-102` has no date-range field: adding `dateFrom` / `dateTo` to
  the query schema is part of the fix, not something already available.
- `appointment.store.ts:73` checks `pendingLoaded` only, so a second call can start mid-flight.

## Module-scope side effects

- Keep them cheap and safe to run twice.
- `src/shared/api/persistent-cache.ts:37-43` runs `purgeOtherVersions()` on import, reading
  `localStorage` synchronously. Anything heavier belongs behind a call, not an import.

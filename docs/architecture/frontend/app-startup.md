# App startup and preloaded data

What the app does from the moment the page opens until a staff member can work, and which data it
loads once and keeps for every page. Owner of this behavior: `src/main.js`, `src/App.vue`,
`src/router/index.js` and the stores under `src/data/`.

## Order of events

1. `src/main.js` creates the app with Pinia and the router and mounts `App.vue`.
2. `App.vue` sets up, before mounting:
   - the staff-card gun listener, active only on the shared device account
     ([shared-device flow](../../features/staff/shared-device.md));
   - the any-page garment gun listener, active for every signed-in account on routes without
     `meta.public` or `meta.ownsWorkScan` ([scan code prefixes](../../plans/scan-code-prefix.md)).
3. The router guard runs for the first route. Public routes, login and staff registration open
   at once. Every other route waits for `authStore.ready()`, then opens when the session is signed
   in, or redirects to login with the requested path in `redirect`.
4. `authStore.ready()` starts the Firebase sign-in listener once. For a signed-in Firebase user it
   calls `GET /api/auth/me`. The status becomes `signedIn` (or `pending` / `unregistered` on a 403)
   and the ready promise resolves.
5. `App.vue` `onMounted`, after `router.isReady()` and only on non-public routes:
   - starts loading the document-scanner model in the background (`preloadDocumentScanner`);
   - waits for the first `signedIn` status, then starts the preloads below once.
6. The garment overlay, an App-level overlay, mounts only after App has mounted and only while a
   garment is open. The scan passes its registration lookup row as `initialGarment`, avoiding a
   second garment lookup in the view. A refreshed overlay deep link has no supplied row and loads
   it itself. During App's first render `#overlay-root` is not in the document yet.

## Preloaded data

Started once, on the first signed-in status, in parallel and without waiting for each other. Pages
read these stores instead of fetching their own copy.

| store | endpoint | used for | loads again when |
|---|---|---|---|
| appointments (`appointment.store`) | `/api/appointments`: all appointments in one request, capped at 1,000 rows | the schedule, pending list and pending badge in the nav | an explicit refresh; writes upsert their returned row locally |
| customers (`customer.store`) | `/api/customers` (all customers) | customer names and indexes on every page | whenever `/api/customers` is invalidated: Customer list pull-to-refresh, a customer write, the nav refresh control |
| staff (`staff.store`) | `/api/staff` (all staff) | StaffId → name everywhere | Staff list pull-to-refresh, a page when not loaded yet, Retry; writes upsert locally |
| price list (`price-list.store`) | `/api/price-list` | prices in order and invoice forms | a price-list write, or a forced reload |

The Items catalog (`/api/items`) and wash programs (`/api/wash-programs`) are not preloaded. Pages
that need them (order intake, garment detail) load them on first use, and their stores keep the
result for later pages. Garment detail checks that Items is empty before loading; wash programs
reuse their store's loaded guard. These reads run in the background and do not delay the garment view.

## Store reuse rules

- **Customers** and **price list**: `load()` returns at once when already loaded, and a call made
  while a load is running waits for that load. A page may call it freely.
- **Staff**: `load()` always re-reads. A page that only needs names checks `staff.loaded` first.
  Staff list entry and activation also check `staff.loaded` and reload only scores when loaded;
  its pull-to-refresh reloads both staff and scores.
  Two calls during one in-flight request still send one request, because the API client shares
  in-flight requests to the same URL.
- **Appointments**: one shared list for every date. Once loaded, date changes and ordinary loads
  reuse it; concurrent calls wait for the same load. `refreshDate()` and `loadPending(true)` force
  a reload. The schedule derives non-PENDING rows for the selected date, sorted by time slot.
  The pending list and badge include only PENDING rows dated today or later, sorted by date.
  Write responses upsert into the shared list because sheet reads may lag.

## Browser cache under the stores

`src/shared/config/cache.ts` sets the cache policy for every `GET /api/*` (design in
`docs/plans/cache-gateway.md`):

- Cached responses are served first, then refreshed in the background when not fresh.
- Fresh for 1 hour: customers, price list, laundry photos, after photos, order reports. 24 hours:
  machines. Everything else: always refreshed.
- Kept in `localStorage` across reloads: customers, price list, machines.
- Never cached: job tickets, auth, staff, work transactions, order snapshots, attendance.
- Writes call `invalidate()` on the endpoints they change. The nav sidebar refresh control clears
  the cache for changes made on another device or in the sheet.

## Adding to startup

- Preload only data most pages need and that stays small. Feature data loads on the page that
  needs it and is kept in its store.
- A new preload goes in the same `signedIn` watcher in `App.vue` and gets a row in the table
  above.
- An overlay placed in `App.vue` follows step 6.

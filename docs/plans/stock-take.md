# Stock-take (ตรวจนับงานค้าง)

Status: draft, revised after codex-advisor review rounds 1–7. Owner decisions so far: build a
stock-take mode; it gives no KPI score to anyone; it must prove each open order's garments are all
accounted for.

## Problem

Staff did not scan work as it happened, so JobTickets no longer match where garments physically
are. Normal department scanning cannot repair this: one scan moves one ticket one status inside one
department, an earlier unfinished step blocks it, and every completion writes an EARN row to the
scanner.

## Outcome

One shop-wide count session. Staff scan every garment tag where it physically sits. Every open
order ends either fully accounted for, or with a named list of garments still unaccounted. Ticket
corrections are applied forward-only in one admin step. No WorkTransactions row is written.

## Data (registry JSON first, then sheets)

- `StockTakes`: `id`, `status` (`OPEN` / `CLOSED` / `APPLIED` / `CANCELLED`), `opened_at`,
  `opened_by`, `closed_at`, `closed_by`, `applied_at`, `applied_by`, `notes`.
- `StockTakeEntries` (one tab for observations, resolutions and the apply plan): `id`,
  `stock_take_id`, `kind` (`SCAN` / `RESOLUTION` / `PLAN`), `order_id`, `laundry_item_id`, `bag_id`,
  `department`, `status` (`Pending` / `In Progress` / `Packed`), `plan_state` (`PLANNED` /
  `APPLIED` / `SKIPPED` / `SUPERSEDED`, `PLAN` rows only), `resolution` (`RETURNED` /
  `OFF_SITE` / `LOST` / `KEEP_LOOKING` / `LINK_CONFIRMED` / `TASK_PICK`), `reason` (required for `RETURNED` / `OFF_SITE`: who / where /
  when), `job_ticket_id`, `baseline` and `patch` (JSON, `PLAN` rows only: the ticket's state at preview
  and the fixed values to write, timestamps included), `created_at`, `created_by`.

## Expected set (keyed by order + tag)

- Every open order: status not `COMPLETED` or `CANCELLED` (includes `PENDING`, because intake links
  garments before tickets exist). An open order with no tagged `OrderGarments` or `LaundryPhotos`
  link and no `ITEM` ticket is outside garment tracking and is left out of the report.
- Garments of an order: the union of live `OrderGarments` links and `LaundryPhotos` links for that
  order, each matched to a live `LaundryItems` row. A `LaundryPhotos` tag with no `LaundryItems`
  row is a legacy garment: it is expected as is, with its order photo and no garment type. On an order that has both sources, a tag found
  in only one of them is a membership gap (Order Detail can add a photo-only link). The admin clears
  a gap within the count by recording `LINK_CONFIRMED` for that order + tag.
- A tracked order with zero garments, an `OrderGarments`-only link with no live `LaundryItems` row,
  a tag with two `LaundryItems` rows, or any unresolved
  membership gap goes to review and blocks the order from reading as accounted for.
  `LINK_CONFIRMED` only resolves the gap; the garment still needs a scan or a `RETURNED` /
  `OFF_SITE` resolution (a partial intake can leave a `PENDING` header
  with no garment rows).
- Live `ITEM` tickets whose tag is missing from that list are reported as membership gaps. When the
  admin confirms such a tag (`LINK_CONFIRMED`), it joins the order's expected set.
- A tag claimed by two open orders is a conflict: its scan satisfies neither claim and the garment
  is not previewed until the admin records `LINK_CONFIRMED` for the order that really owns it.
- No garment is excluded because of a Logistics or bag status. Bagged, out-for-delivery and
  delivered-looking garments stay expected until found or resolved; their Logistics state is shown
  as a hint.

## Freeze

A session is active while `OPEN` or `CLOSED`; only one active session may exist (opening a second
is rejected). While one is active, one server-side flag rejects every other writer of tickets, bags
and garment membership: `/advance`, `/start-order`, `/complete-order`, reopen, ticket `PATCH`,
packaging confirm, `POST /bag-items`, bag/WEIGHT image writes, `POST /laundry-photos`, work-order
status changes, intake/order-garment edits. Physical moves, dispatch and direct Sheet edits are
paused by procedure.

## Count phase (staff)

- Admin opens a session.
- Staff pick a zone = department + `รอทำ` / `กำลังทำ`, or `แพ็คแล้ว`, then scan garment tags.
- In `แพ็คแล้ว`, staff scan the bag QR first, then each garment inside it; those scans carry
  `bag_id`. The bag scan alone never counts its garments. A bag with no readable QR: garments are
  scanned without `bag_id`; they count as found, and go on the packing exception list for bag
  verification (Packaging unchanged).
- Each scan writes a `SCAN` entry. Retry/dedup key = session + tag + zone (+ `bag_id` in `แพ็คแล้ว`), so distinct observations
  of one tag are kept (not the department page's ticket-id dedup).
- Scans never write JobTickets.
- Each scan is acknowledged at once on the scanning device; the admin checklist (found / expected
  per order) refreshes on demand, no live sync.

## Close + review (admin)

- **Per order:** found / returned / off-site / expected, shown separately. Accounted for = no review
  flag and every expected tag is found or resolved `RETURNED` / `OFF_SITE` with a reason.
- **Missing:** tag, garment type, registration photo, last ticket state, Logistics hint. Admin
  resolves `RETURNED` / `OFF_SITE` (e.g. dry-cleaning vendor) / `LOST` / `KEEP_LOOKING`;
  `LOST` and `KEEP_LOOKING` stay unaccounted.
- **Conflicts:** tag scanned in two zones or in two bags; zone not on the garment's route; a department with more
  than one live task for the garment (admin picks the task: a `TASK_PICK` resolution with
  `order_id`, tag and `job_ticket_id`; the latest one wins).
- **Unexpected:** a tag no open order claims: only on a closed order, registered with no order, or
  unknown everywhere.
- **Backward cases:** the zone is earlier than what tickets already record (a later step
  `In Progress` / `Completed`, or the target already `Completed`). Not applied; listed for the
  owner.
- **Blocked:** a `Cancelled` predecessor or a missing route step. Not applied; listed.
- **Packing/dispatch exceptions:** a `Packed` garment without a verified bag link (no or several
  `BagItems` rows for this order, scanned in a different bag than recorded, missing bag image, or
  no live `LOG-BAG` ticket, or one that is `Cancelled`). A stale or mismatched `BagItems` link
  blocks repacking (the packing screen rejects a tag already in a confirmed bag), so the owner must
  correct that link before staff can repack the garment; a bag found in the
  shop whose Logistics ticket is already `In Progress` / `Completed`. Listed for the owner.
- **Preview:** one `PLAN` row for every live ticket of each planned garment's route, unchanged steps
  included (`patch` empty), so preflight can see added, removed or changed blockers.

## Apply (forward-only)

Each garment's route (its live `ITEM` tickets ordered by `step_no`) is planned and applied as one
unit. Only forward moves are allowed: a ticket may go `Pending` → `In Progress` / `Completed` or
`In Progress` → `Completed`; equal state is a no-op. Any other change (reset, touching a
`Cancelled` or `Completed` ticket) sends the whole garment to review.

- zone (D, S): the target task in D is set to S; every earlier step is set `Completed`; later steps
  untouched.
- zone `แพ็คแล้ว`: steps before Packaging are set `Completed`. Packaging is set `Completed` only
  when the tag has exactly one `BagItems` row for this order, its `bag_id` equals the bag the
  garment was scanned in, that bag's `OrderImages` row exists, and the bag's `LOG-BAG` ticket is
  live and `Pending`; otherwise it stays and the garment is on the packing
  exception list (so it stays selectable for a real bag). `ORDER` tickets (`PCK-WEIGHT-KG`,
  `LOG-BAG`) are never touched.
- Existing `started_at`, `completed_at`, `scanned_by` and notes are preserved. Newly stamped times
  (and `updated_at`) are fixed at preview time and stored in `patch`; `updated_by` = admin; `notes` gets `stock-take <id>` appended. No staff is
  credited for historical work.
- Writes use `JobTickets.updateMany` directly, never the transition / packaging / work-order
  services, so no EARN or VOID can be written.
- Before writing, re-read every ticket of each planned garment and compare the ticket-id set and
  each ticket's state with `baseline`; an added or removed ticket also counts as a difference.
  A garment is already done (safe retry) only when every route ticket equals its baseline with its
  patch applied (an unchanged step must still equal its baseline). Every nonempty patch carries a
  fixed `updated_at`, so the repository does not stamp its own value. Any other difference marks the whole garment `SKIPPED`; it is listed.
- Preview and apply run only while the session is `CLOSED`. Re-preview builds a plan for every
  garment that has no `APPLIED` rows: its earlier `PLANNED` / `SKIPPED` rows become `SUPERSEDED` and
  new `PLANNED` rows are appended. The current plan of a garment = its `PLANNED` rows.
- Write the remaining patches; read back; mark rows `APPLIED`. The session stays `CLOSED`; the admin
  re-previews skipped garments or presses Finish, which requires no `PLANNED` rows and sets the
  session `APPLIED` (garments still `SKIPPED` go to the owner list). Zero remaining patches is a valid apply (skip the write call). If a `plan_state`
  save fails after a successful write, re-running apply finds those garments done and only saves
  their state.
- Resolutions change no tickets in v1. Owner handoff: a fully `RETURNED` order may be closed by
  setting the order `COMPLETED` (existing path, writes no EARN) only after confirming the whole order
  went back. That path also completes open `LOG-BAG` tickets, so customer tracking shows Delivered
  with the current time, and its ticket cleanup can fail silently: check the order's tickets
  afterwards. A partially returned order or a packing/dispatch exception is handled case by case.
- Cancel is allowed only while no `PLAN` row of the session is `APPLIED`; after any ticket write the
  session ends only through Finish.
- `APPLIED` or `CANCELLED` lifts the freeze.

## Implementation rules

- Use the latest appended `LINK_CONFIRMED` for duplicate ownership and the latest appended
  `TASK_PICK` per order and tag. The other claimant remains under review. A physical observation
  takes precedence over returned and off-site dispositions. A registered tag with no open claim
  is reported as unexpected.
- Use the same case-sensitive eight-character tag format as garment registration. A packed
  observation with no bag ID remains evidence that the garment is present. If the same zone has a
  readable bag observation too, use that bag for verification. Two different readable bags still
  conflict.
- Use the linked order line's service route when available, preferring live OrderGarments links
  over photo links, as ticket provisioning does. Fall back to the order service for links without
  a line. Conflicting service routes in the selected source, missing steps, or invalid step data
  block planning. For a packed scan, leave other Packaging tasks unchanged. Live OrderGarments
  links and ITEM tickets with blank tags are unresolvable membership gaps.
- Membership and scan conflicts block the order from being marked accounted for. Ticket workflow
  and packing exceptions remain visible even when all garments are physically accounted for.
  Unconfirmed membership gaps are excluded from preview. A resolution recorded after preview
  supersedes pending plans for that tag so Apply cannot use an outdated decision. Ownership of an
  applied tag remains fixed for this session.
- Baseline also records route position, task and department, notes, scanner, and update audit
  values to avoid overwriting corrections to unchanged steps or ticket notes. The preview admin
  supplies the patch's `updated_by` value. Retry reads session state, plan rows, and tickets through
  the authenticated Sheets API. When a pending plan shows that its patch took effect, retry Apply
  before replacing it. Cancel checks earlier plans as well so it cannot discard a session with
  evidence of a ticket write.
- Opening and guarded writes serialize per backend instance. Sheets has no cross-instance
  transaction for the active-session check and a subsequent write. Run the count with one admin
  operator and wait for normal writes already submitted to settle before opening. If multiple
  active sessions appear, normal writers stay frozen and stock-take actions reject the ambiguous
  session state.
- Reports use current inventory plus the requested session's persisted scans, resolutions, and plan
  states. After Finish or Cancel, later order changes can affect a report refreshed for that session.

## Deferred

- Bag-scan shortcut (needs the owner to accept a bag manifest as evidence).
- Backward corrections (reopen + VOID) — owner reviews case by case.
- Repeating the count weekly as a drift check.

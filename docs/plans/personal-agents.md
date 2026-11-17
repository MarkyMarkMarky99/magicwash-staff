# Personal assistant agents — v1 (pilot) plan

Spans two repositories: **AI** = `C:\MagicwashAI`, **W** = `C:\MagicwashGemini\webapp-vue`.
Builds on the team-agent runtime (`docs/plans/department-agents.md`). Small shop: keep it simple.
Reviewed twice by Codex Sol (2026-11-18); its findings are folded in.

## Owner decisions (2026-11-18)

- One personal assistant per employee: its own chat, workspace, notes, and follow-ups.
- Admin can open any employee's assistant chat, read its full history, and type instructions into it.
  No notice about this is shown to staff.
- Admin assigns work to an employee through that employee's assistant; the assistant follows up with
  the employee on the manager's behalf.
- Department agents (washing, ironing, appointments) can hand work to an employee's assistant,
  **only when an admin asks for it**. Staff cannot assign work to anyone.
- Pilot with two people first: the owner and one employee.

## Principles

- The **server**, not the model, owns assignments, delivery, follow-up timing, reports, and
  authority. Agents only call small server operations; nothing relies on prompt wording to prevent
  loops, leaks, or unauthorized assignments.
- Personal assistants **read and remind only**. Ticket writes stay with the department agents.
- "Done" means **the employee reported the assignment done**. It never closes tickets or gives score.

## AI (MagicwashAI)

### Instances

- Public agent id stays `personal`; the server resolves it plus the authorized target to an internal
  instance key `personal:<StaffId>` **before** dispatch. Internal keys never appear in public schemas.
- The runtime map, listener registration and worker start can add an instance after startup
  (`getOrCreatePersonal(staffId)`), and every existing instance is restored on startup so due
  follow-ups run before anyone reopens a chat.
- Files: `logs/personal/<StaffId>/` (history, turns, reminders, thread) and
  `work/personal/<StaffId>/notes/`. One shared template `work/personal/AGENTS.md` and shared
  `work/personal/scripts/` (read-only); no per-employee copies of the toolset.
- One idempotent `ensurePersonalWorkspace(staffId)` creates the notes folder and sets it writable for
  the Codex UID; it runs on creation **and** on restore, because `docker-entrypoint.sh` resets the
  whole work volume on every start.
- Known limit, accepted for the pilot: all Codex children share one Unix identity, so a workspace
  folder is not a security boundary. Notes must hold nothing private.

### Access

- One resolver used by **every** personal endpoint (message, history, reminders, notes, images):
  `staff` → always their own instance from the token; `admin` → own instance by default, or an
  explicit `staffId` target. Any other target is `FORBIDDEN`. `device` accounts cannot chat.
- Admin messages keep the admin as speaker. Each queued turn stores the speaker's StaffId and role
  from the token; the prompt shows the role (`admin` / `staff` / `system`) so the model never infers
  authority from wording.

### Listener capability (personal and department agents)

- Each executing turn gets a short-lived listener token, bound server-side to instance, turn id,
  speaker (StaffId + role) and the operations allowed for that turn. It is revoked when the turn ends.
  A listener call is authorized only by that token, never by a route parameter.
- `assign` is allowed only when the turn's speaker role is `admin`; `createdBy` and
  `requestedByAdmin` come from the token, not from the agent's request.
- `assignment-done` / `assignment-note` are allowed only on assignments whose assignee is the calling
  personal instance.

### Reads

- The personal Codex process receives **no** webapp key. Reads go through listener operations that
  the server performs with its own `WEBAPP_SERVICE_KEY`, filtered to the instance's StaffId:
  - `my-tickets`: tickets this employee started and has not completed (W adds an optional
    `startedBy` filter to `GET /api/job-tickets`);
  - `my-score`: this employee's WorkTransactions for a period (server fetches the period, filters by
    StaffId);
  - `my-assignments`: the employee's assignments from the register.
- No appointments read: appointments have no employee assignee.

### Assignments

- One server-owned store `logs/personal/assignments.json` (same fsync + temp-file write as other
  state), serialized updates. Record: `id`, `version`, `idempotencyKey`, `assigneeStaffId`,
  `createdBy` `{ kind: admin|agent, staffId?, agentId?, name }`, `requestedByAdmin` (StaffId),
  `detail`, `dueAt` (ISO with `+07:00`; Bangkok text only for display), `status`
  `open|done|cancelled`, `reportTo` (exact chat key), `nextFollowUpAt`, `log[]` of
  `{ at, by, change }`.
- Create — `assign` from:
  - an employee's personal chat during an admin turn → `reportTo` = that admin's own personal chat;
  - a department agent during an admin turn → `reportTo` = that department chat.
  The assignee is a StaffId; the agent resolves a name to one active StaffId and asks when ambiguous.
- Creation is idempotent: **one assignment per admin turn**, `idempotencyKey` = the persisted turn id.
  A recovered turn calling `assign` again gets the existing record back, even if it rephrases the
  detail or deadline. A second `assign` in the same turn is refused; the agent tells the admin to
  send the next assignment as a new message.
- Each transition bumps `version` and writes the assignment change **and** its pending deliveries in
  one state update (outbox). A delivery has a stable id `<assignmentId>:<version>:<destination>`;
  delivering twice is a no-op. Pending deliveries replay after restart.
- Deliveries:
  - created → one turn in the assignee's chat (`source.kind: assignment`, history `event.kind:
    system`), waking the assistant to tell the employee;
  - due → one turn in the assignee's chat at `dueAt`;
  - done / cancelled / overdue → a system event appended to `reportTo` **without waking** that agent.
- Delivery outcome: a report (no wake) is done once its history event is appended — the event id is
  the delivery id, so a replay finds it and just marks it done. A wake delivery is done only when its
  turn **succeeded**; a failed turn retries after 15 minutes, up to 3 times (counts persisted), then
  is marked failed and shown on the admin list.
- Stale work: before running and again before publishing a follow-up turn, the server rechecks each
  assignment's status/version, drops ones that are done or cancelled, and skips an empty batch.
- Overdue is reported to `reportTo` once. Only admin cancels an assignment. Staff cannot cancel or
  reassign.

### Schedule and load

- One daily batch at 08:00 Bangkok: only employees with open assignments get one turn that both
  summarizes and follows up. No other routine runs. After a restart, a missed batch runs once.
- Reuse the global runner queue (`MAX_CONCURRENT`, default 3). Measure pilot turn count and duration
  before tuning.

### Admin assignment API

- `GET /agents/personal/assignments` and `POST /agents/personal/assignments/:id/cancel` on
  MagicwashAI, called by W with the admin's Firebase token; admin role checked at AI. No new
  service credential.

### Backup

- Once a day the server copies `assignments.json` to a host-mounted folder, keeping 14 days.
  Restore = stop the container, copy a backup back, start.

## W (webapp-vue)

- Contracts: add `personal` to the agent enum; personal endpoints take an optional `staffId` target
  (admin only). Action schemas add `assign|assignment-done|assignment-cancelled|assignment-overdue`.
  History event kinds stay `staff|agent|action|system`.
- Job tickets: optional `startedBy` filter on `GET /api/job-tickets`.
- Service-key allowlist (`api-gateway.ts`): add `GET /api/work-transactions` only.
- Catalog: one "My assistant" entry for every signed-in employee (not `device`).
- Admin: an "Open assistant" action on the existing staff list/profile opening
  `/agents/personal/:staffId`; a small assignments list (status, due, assignee, failed deliveries,
  cancel) calling the MagicwashAI admin API.
- Store and page keyed by viewer + target staff; last-seen key includes both, so an admin reading
  does not mark it read for the employee. Dispose state on identity change.
- History: add a backward `before` cursor (AI + W) so admin can scroll the full history
  (today: latest 200).
- Unread polling: only the viewer's own assistant chat.

## Out of scope (v1)

- Department column on the Staff sheet; clock-in data; assignments in a Google Sheet.
- Personal assistants writing tickets or appointments.
- Agent-to-agent conversation beyond server-delivered assignments and reports.

## Build order and executors

1. AI: instances, access resolver, per-turn listener tokens, scoped reads (Sol). W: `startedBy`
   filter, contracts, history cursor, store keying, routes (Sol); catalog and "Open assistant"
   (Sonnet). Pilot chat only, no assignments.
2. AI: assignment store, outbox, delivery/retry, daily batch, `assign` in personal + department
   agents, admin API, backup (Sol).
3. W: admin assignments list (Sonnet). Live test with the owner + one employee, test customer KLX only.

# Appointments agent (น้องนัดหมาย) — v1 plan

Spans two repositories: **AI** = `C:\MagicwashAI`, **W** = `C:\MagicwashGemini\webapp-vue`.
Reviewed twice by codex-advisor (2026-11-16). Goal for v1: works for a small shop in a testing phase.
No approval workflow, no Redis/scheduler framework, no extra roles.

## Owner decisions

- Agent creates, reschedules and cancels appointments itself through W `/api/appointments`, acting as
  the AI staff member (Staff sheet row `StaffId = AI`, role `staff`, active).
- Create freely. Reschedule/cancel only when a person asked or after asking the team — rule lives in
  the instruction only. Cancel = PATCH `status: CANCELLED`; nothing is deleted.
- Access: role `admin` only (shop manager uses `admin`).
- One shop-wide conversation: every admin sees the same history; history is kept forever, stored by
  AI in its own file, separate from Codex session files and from the 30-day `logs/history` prune.
- Continuity: resume one shared Codex thread forever; rely on Codex auto-compact.
- Model `gpt-6.1-sol`, reasoning `medium`. Instruction is a framework, not micromanagement.
- No request/response time limit: a turn is accepted immediately and its reply lands in history.
- Agent can wake itself: a fixed daily run and agent-set reminders, both visible to and cancellable by staff.
- Recurring customers are kept in the agent's own notes; the daily run creates missing appointments.
- Appointment dates follow the web form's limits, enforced server-side for the AI actor.
- After a container restart, unfinished work resumes automatically.

## AI (MagicwashAI)

### Agent and workspace

- Register `appointments` in `src/tasks/chat/agents/index.js` with `proposalSchema: null`.
- `work/appointments/AGENTS.md` — the framework: role, team-facing Thai tone, tools, appointment
  statuses/types, date limits, reschedule/cancel rule, recurring-notes format, "never report a write
  as done without a successful tool result; on an unknown outcome check before retrying".
  (`instruction.md` is ignored when `AGENTS.md` exists — do not duplicate.)
- `work/appointments/.agents/skills/appointments/SKILL.md` — how to use the scripts.
- `work/appointments/scripts/` — small node scripts:
  - read via W API: find customer, list appointments for a date (per-date + paginated; loop for ranges),
    get appointment.
  - write via W API: create (flat customer fields `customerId, customerName, customerCode, phone,
    address, location`), reschedule (PATCH date/slot + `status: PENDING`), cancel (PATCH `CANCELLED`).
  - `remind` (create/list) — calls the local listener, not a file.
  - every write script reports attempt + result (including unknown outcome) to the local listener.
- `work/appointments/notes/` — agent-writable memory, indexed by `notes/MEMORY.md` (≤ 60 lines, read
  every turn); one topic per note, ≤ 20 lines; no diaries or appointment-id lists. Recurring customers use one fixed format:
  customer ID, weekdays, time slot, type, exceptions.
- `docker-entrypoint.sh` copies `.agents/` and `scripts/` too, and makes `notes/` writable by the
  Codex child (uid 1002) after its ownership reset.
- Per-agent env option: only the appointments child receives the W service key and the local
  listener URL (`src/codex-process.js` allowlist stays closed for other agents).
- Per-agent model/effort/sandbox: set the sandbox through supported config so it applies to new AND
  resumed turns (`codex exec resume` takes no `-s` in CLI 0.160.0). Verify tool execution on a resume.

### Shared thread and turn queue

- Server selects the shop thread; client `sessionId` is ignored for this agent. Persist the thread id
  as soon as Codex announces it.
- Appointments-only FIFO shared by staff messages, the daily run and reminders. One turn reaches the
  runner at a time; wait for runner capacity instead of failing BUSY; release only after the child
  process has actually closed. Other agents stay synchronous.
- Codex execution cap only to kill a hung process (about 10 minutes).
- Staff messages are prefixed with the speaker's name (keep the name from `src/auth.js`).
  Automatic turns use a visible system identity and enter the queue internally (they do not pass the
  admin check).

### Persistence (service-owned files on the persistent volume, outside the prune)

- `history` — append-only JSONL; every event has a stable id: staff message, agent reply, action line
  (create/reschedule/cancel/remind/reminder cancelled), system notes.
- `turns` journal — each turn `queued → running → done`. The staff message is appended to history and
  the turn to the journal **before** replying 202.
- `thread` — the shared thread id.
- `reminders` — absolute timestamps, status, created-at, note.
- `daily` — last completed Bangkok date.

### Restart recovery (automatic)

- On startup: re-queue `queued` turns in order; re-queue `running` turns with a prefix telling the
  agent the turn was interrupted and to check appointment state before any write; write a visible
  history line for each.
- Overdue reminders and a missed daily run are queued once on startup.

### Local listener

- Second Node HTTP listener bound to container `127.0.0.1`, unpublished port. Accepts: action reports
  and reminder create/list. Node validates, enforces caps, persists, appends history.
- Reminder caps (code): ≤ 10 pending, ≥ 30 minutes apart, ≤ 14 days ahead.

### Scheduler

- One Node timer, checks at startup and every minute, all times computed in `Asia/Bangkok`
  (the container sets no timezone).
- Daily run at 08:00 when today is not done: review today/tomorrow, pending confirmations, recurring
  customers; create missing recurring appointments for the next 7 days, checking existing ones
  **including cancelled** so intentional cancellations are not recreated; summarize for the team.
- Due reminders: queue a turn carrying the note. No duplicate enqueue while one is waiting.

### Endpoints (admin-only, Firebase)

- `POST /tasks/chat` for `appointments` → 202 accepted with the turn id.
- History read (since an event id), pending reminders list, reminder cancel, notes read-only
  (files inside `notes/` only).

### Gateway HTTP interface (shared by AI and W; JSON/multipart, existing error envelope)

- `POST /tasks/chat` `{ input: { agentId: 'appointments', message } }` → 202
  `{ ok: true, result: { accepted: true, turnId, eventId } }` (wrap in the existing success envelope).
  Also accepts `multipart/form-data`: a `request` JSON field containing the same input plus
  `attachments: [{ file: '<upload-field>', role: 'reference' }]`, and matching uploaded file fields.
  Up to 3 JPEG/PNG images, each at most 5 MiB; message may be empty when images are attached.
  Images are copied to persistent `logs/appointments/images/` before 202 and replayed with the turn after recovery.
- `GET /agents/appointments/history?after=<eventId>&limit=<n≤500>` →
  `{ events: Event[], busy: boolean }`, oldest first; without `after` returns the latest `limit`.
  `Event = { id, at, kind: 'staff'|'agent'|'action'|'system', speaker: { staffId, name } | null,
  text, images?: { id, name, type }[], action?: { type: 'create'|'reschedule'|'cancel'|'remind'|'reminder-cancelled',
  appointmentId?, outcome: 'ok'|'failed'|'unknown' } }`. `at` = `yyyy-MM-dd HH:mm:ss` Asia/Bangkok.
- `GET /agents/appointments/reminders` → `{ reminders: [{ id, dueAt, note, createdAt, status }] }`.
- `POST /agents/appointments/reminders/:id/cancel` → `{ reminder }`.
- `GET /agents/appointments/notes` → `{ files: [{ name, content, updatedAt }] }`.
- `GET /agents/appointments/images/:id` streams the persisted image as `image/jpeg` or `image/png`;
  validates the opaque image id and rejects path traversal. Errors use the existing JSON error envelope.
- Visible history text is concise Thai prose, with Bangkok local dates/times; no JSON, UUIDs or ISO timestamps.
  Daily/reminder events show short Thai labels while Codex receives the full internal prompt.
  Identifiers and attachment metadata remain in structured fields.
- All six require a Firebase admin. W calls them only through typed functions in
  `shared/ai-gateway/tasks/appointments-agent.ts`.

## W backend

- Service key: allow appointments `GET/POST/PATCH` and customers `GET`; scope the existing laundry
  body filter to the laundry route only (`server/shared/http/api-gateway.ts`).
- Service-key actor resolves from the Staff row via `findStaffById('AI')`; reject the request if the
  row is missing or inactive.
- AI date policy at an appointment-specific request boundary using `req.staff` (generic CRUD passes
  no actor to the service). Applies only when the actor is AI:
  - create: today … today+13, not Tuesday, no slot that has already started today;
  - date-changing PATCH: tomorrow … today+14, not Tuesday (shop closed);
  - cancel / other PATCH: no date check.

## W frontend

- `contracts/ai-gateway/chat-api.schema.ts`: add `appointments`; accepted-response contract.
- Agent catalog/types/store initialization; agent visible to admin only (list and direct route).
- Chat page for this agent: load shared history with speaker names; poll on focus, after send, and
  every ~15 s while open; no auto-retry; no "End chat"/clear/session reset; no "not saved" notice.
- Panel: pending reminders (time, note, created-at) with cancel; notes read-only.
- Unread badge on the Agents menu: per-device last-seen event id in browser storage; polling runs
  outside the chat page.

## Verification

- AI unit tests: queue order/serialization, journal recovery, reminder caps, Bangkok daily trigger.
- W: typecheck api + web, vite build; date policy tests for the AI actor.
- Live: deploy W first, then rebuild the AI container; exercise create/reschedule/cancel on test
  customer `cbcc555a` (KLX) only; a resumed turn that writes; a reminder firing; a restart mid-turn.

## Out of scope for v1

LINE/push notifications, AI reading work orders, approval cards, configurable schedules.

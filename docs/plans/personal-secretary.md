# Personal secretary — plan

Spans two repositories: **AI** = `C:\MagicwashAI`, **W** = `C:\MagicwashGemini\webapp-vue`.
Replaces the earlier router/delegation idea (`agent-delegation.md`, removed). Reviewed twice by
Codex Sol (session `01a20c6d-4e7d-71e1-a724-a49707940147`); this revision is not re-reviewed yet.

## Owner decisions (2026-11-24)

- One secretary per employee. A **new, separate system**: its own Docker container, Codex home,
  work folders, skills and scripts. Existing agents (appointments, washing, ironing, personal) and
  their workflow are not touched.
- The secretary hands most work to **Codex subagents** (`washing`, `ironing`, `appointments`) to keep
  its own context small. `AGENTS.md` says when to call a subagent and when to answer directly.
- Subagents **may write on the secretary's behalf** (e.g. reschedule an appointment). The secretary
  checks every write against fresh data before telling the employee it is done.
- Writes go only through **ready-made operations** (fixed scripts in the skills, backed by named
  operations on the server). The AI never builds a free-form API request.
- Hiding a skill or subagent is routing only. **The Vercel backend is the permission check.**
- **No new sheet columns.** Each secretary is its own Staff row with its own StaffId; every write it
  or its subagents make is recorded under that StaffId in the existing columns.
- Initial trial: one secretary for the owner (admin), writes allowed. Admin-managed enable/disable now supports active human admin and staff owners.

## Identity

| Who acted | recorded as | shown as |
|---|---|---|
| Employee in the app | `<StaffId>` | employee name |
| Employee's secretary (or its subagent) | `AI-<owner StaffId>` | e.g. "เลขาของสมชาย" |
| Team agent / automation (unchanged) | `AI` | AI |

- Secretary Staff row: `StaffId = AI-<owner StaffId>`, `Name`, `Role = assistant`, `Active`,
  `Email` = unique non-login placeholder. Owner is derived from the StaffId; no extra column.
- Registry change (owner approves): add `assistant` to `Staff.Role` in
  `G:\My Drive\Magicwash\Database\GoogleSheets\Staff.json`; the W contract follows, but the staff
  update contract and role picker do not offer `assistant`.

## Container (AI)

- New compose service `magicwash-secretary` in the same compose project, its own port on
  127.0.0.1, own volumes: `/codex-home`, `/app/work` (per-owner folders, notes), `/app/logs`.
- Same image pattern as today: service process runs as `app`, Codex children as `agent`.
- Secrets in the service process only: `SECRETARY_PROXY_KEY` (new, for Vercel) and the Firebase /
  gateway settings it needs. **No `WEBAPP_SERVICE_KEY` anywhere in this container**, and no Codex
  child env carries any Webapp key.
- Codex children see only their own instance folder, the secretary skills and role files (read-only,
  shipped in the image), and their per-turn listener URL.
- The tunnel / webapp relay routes the secretary agent id to this container.
- Code layout: new entry point and modules (e.g. `src/secretary/`), reusing existing generic pieces
  (Codex runner, session store, chat journal, push) by import, without changing their behaviour for
  the existing service.

## Named operations (AI listener → W)

The listener exposes `POST <capability url>/ops/<name>` with a fixed JSON body per operation. Each
operation validates its body, builds the exact Vercel request itself (fixed method, path and payload
keys), adds `SECRETARY_PROXY_KEY` and `x-assistant-id` from the instance config, and returns the W
status and envelope. Anything else → 404.

| Operation | Body | Vercel call |
|---|---|---|
| Reads: `work`, `order`, `garment`, `find-customer`, `get-appointment`, `list-appointments`, `open-orders`, `staff-names` | ids / dates only | fixed GETs |
| `close` | `orderId`, `department` | job-tickets complete-order |
| `reopen` | `orderId`, `department`, `reason`, `ticketIds[]` | job-tickets reopen |
| `create-appointment` | the fields the current create script sends | appointments POST |
| `reschedule` | `appointmentId`, `date`, `timeSlot` | appointments PATCH with only date + slot |
| `cancel` | `appointmentId` | appointments PATCH with only status `CANCELLED` |
| `complete-appointment` | `appointmentId` | appointments PATCH with only status `COMPLETED` (W cascades to the linked order) |
| `complete-order` | `customerId`, `orderId` | work-orders PATCH status `COMPLETED` |
| `remind` | `dueAt`, `note` | local reminders |

- **Write gate.** Turn provenance is persisted (direct owner message vs reminder / system / recovery).
  At capability issuance `mayWrite` = direct message from the exact owner StaffId, not a recovered
  turn. Write operations and reminder creation are rejected when `mayWrite` is false. Subagents
  spawned in the turn use the same capability.
- **Write log.** The listener records every write operation it forwards in the turn journal: name,
  body, targets, W status, outcome (`ok` / `failed` / `unknown` on timeout). Op `writes` returns the
  current turn's log.
- Skill scripts are thin wrappers that call these operations and print the JSON result.

## Secretary permission matrix (W)

A request with `SECRETARY_PROXY_KEY` + `x-assistant-id` is accepted only for an active
`AI-<StaffId>` row with `Role = assistant` whose owner is an active human; owner role and
Departments are read fresh per request. The legacy service key + `x-assistant-id` is rejected. The
audit actor is the secretary StaffId; KPI subjects stay human (a reopen VOID still credits the
original EARN subject).

| Request | Rule |
|---|---|
| Job tickets `complete-order`, `reopen` | owner admin, or staff with that department in Departments |
| Appointment create, reschedule (date + slot only), cancel (status only) | owner admin |
| Appointment complete (status only; cascade to its existing linked order) | owner admin or staff |
| Work-order PATCH status `COMPLETED` only | owner admin or staff |
| The fixed GETs above | allowed |
| Anything else, or any extra payload key | forbidden |

- The secretary gets its own branch in `api-gateway.ts` and the affected routes/services; literal
  `AI` branches stay exactly as they are. Booking rules (date/slot) for secretary requests: same as
  the literal `AI` branch.
- W returns partial results honestly (e.g. appointment updated but order cascade failed); the
  secretary reports from the write log plus fresh reads, not from the top-level object alone.

## Staff readers (W)

- Login, registration, card lookup, device operator: never resolve an `assistant` row.
- Employee rosters and eligibility (staff list, attendance list/targets/day-off checks, KPI boards,
  ticket provisioning, AI assignment recipients): exclude `assistant`.
- Actor names: a name-only lookup that includes assistant rows (inactive too), so history shows the
  secretary's name, not `AI-...`.

## Skills and subagents (secretary container)

- Own skills, shipped in the image (read-only): `secretary/.agents/skills/{washing,ironing,appointments}`
  published to `/codex-home/.agents/skills`. Content adapted from the department skills, but every
  command is a secretary script calling a named operation.
- Each run passes `-c skills.config=[...]` disabling skills the owner may not use (admin = all;
  staff = appointments + own Departments), for fresh and resumed runs.
- Subagent role files shipped in the image at an absolute path, each with `description` and
  `developer_instructions` (use skill `<name>`, do only the task given, return what it changed with
  ids). Each run declares only the allowed roles with `-c agents.<name>.config_file=...`; nothing in
  shared config or auto-discovered `.codex/agents/`.
- Subagents are spawned without the parent's history (`fork_turns = none`); the secretary passes
  the task and the ids explicitly. Spawn backend / tools on the trial model to be confirmed in the
  container.

## AGENTS.md (secretary)

- Staged into each per-owner folder `work/secretary/<owner StaffId>/` (like personal instances).
- Call a subagent for any department lookup or change and any multi-step work; answer directly for
  chat, reminders, and results it already has.
- Confirm the order / appointment and the change with the employee before a write.
- After subagents finish: call `writes`, re-read every target (appointment, its linked order, the
  affected tickets), and report only what those reads show, including partial or unknown outcomes.

## Chat wiring

- Per-owner instance; access = the exact owner for sending, reminders, read markers and image
  upload; admin may view read-only. Push to the owner only.
- W: add the secretary agent id to the chat contract and agent list; relay resolves the per-owner
  instance (like `personal`).
- Department team-chat assignments and local `/staff` / `/assign` tools are not part of the
  secretary (v1).

## Tests

Named-operation allowlist and exact payloads; legacy key + `x-assistant-id` rejected; header never
from the request; write gate per turn source incl. queued and running recovery; write log incl.
timeout; W permission matrix per request and department; staff reader exclusions and name lookup;
skills/roles declared per run (fresh and resumed); existing service unchanged.

## Later

- Self-service secretary creation for staff.
- Decide whether department team agents are retired or moved to named operations.

## Webapp secretary administration (2026-11-24)

Implemented in W without new API functions or sheet columns: Firebase admin-only
`GET` / `PATCH /api/staff/secretary/:staffId`, strict `{ active }` writes, and separate assistant
rows as specified above. Missing rows are appended on enable with `เลขาของ <owner name>` and
`secretary+<staffId>@example.invalid`; disable preserves the row. Re-enable updates only Active.
Invalid owners, duplicate IDs and non-assistant ID collisions fail before writing. The Staff
registry has no audit columns. See [registration](../features/staff/registration.md#secretary-administration)
for the full lifecycle and the Sheets concurrent-append limitation.

Reply language (`th`, `my`, `en`) and read-only `codexReady` remain in MagicwashAI:
`GET /secretary/settings?staffId=<ownerId>` (admin any owner, staff self),
`POST` with `{ language }` (admin only). Both return `{ staffId, language, codexReady }`.
W supplies validated gateway service functions and a settings store using the secretary base URL
and Firebase token. No profile UI is part of this implementation. The admin/staff agent-list entry
and background unread polling require the viewer's own active assistant in the existing directory.
See [profile integration](../features/staff/profile.md#secretary-data-integration) for UI call signatures.

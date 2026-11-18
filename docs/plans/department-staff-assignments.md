# Department agents assign work to their staff — plan

Spans two repositories: **AI** = `C:\MagicwashAI`, **W** = `C:\MagicwashGemini\webapp-vue`.
Builds on `docs/plans/personal-agents.md` (assignment register, outbox, follow-ups — all reused).
Reviewed by Codex Sol (2026-11-18); its findings are folded in.

## Owner decisions (2026-11-18)

- Department agents (washing, ironing) may create assignments **on their own**, e.g. to follow up
  slow or stuck work, not only when an admin asks.
- They reach the right people through a new per-employee **Departments** field on the Staff sheet.
- These are real assignments: delivered to the employee's assistant, followed up until done.

## Staff departments (W + sheet)

- New Staff sheet column `Departments` after `StartDate` (column J): comma-separated JobTicket
  departments (the existing JobTicket department enum). Empty = none.
- Registry JSON `G:\My Drive\Magicwash\Database\GoogleSheets\Staff.json` gains `Departments`; its
  stale `x-access` line ("served publicly") is corrected — `/api/staff` requires staff auth.
- Rollout-safe mapping (Staff module, `server/modules/staff/`): `Departments` is an **optional**
  header — reads default to `[]` when the column is missing; a write that sets departments while the
  column is missing is rejected with a clear error. So the code deploys first, then the column is
  added, with no window where Staff list/register/update break.
- API: `departments: Department[]`. Write: strict enum, deduplicated, `[]` clears, serialized as
  `Washing, Ironing`. Read: split, trim, drop unknown values, deduplicate.
- Staff edit form: multi-select of departments (admin only, like role). Staff profile shows them.
- New service-key route `GET /api/staff/directory` (AI service key only, also allowed for signed-in
  staff): `{ staffId, name, role, active, departments }` per row — no email, phone or address.

## AI (MagicwashAI)

### Staff directory
- Server reads `/api/staff/directory` with the service key and caches it 10 minutes. Inactive and
  `device` rows are excluded.
- `staff.mjs` returns names, departments, and whether an assistant exists. Assigning by name works
  without an admin first opening the chat; a missing assistant is created automatically with the
  directory name.

### Who may assign
- **Through a department agent (any turn, any speaker):** only active employees whose
  `departments` include that agent's department; department quotas apply. Admin turns get no wider
  authority here.
- **Through a personal assistant:** admin turns only, any active employee, no quota (unchanged).
- Agent-created assignments record `createdBy = { kind: 'agent', agentId, staffId?: admin if an
  admin was speaking }`, `reportTo` = the department chat.

### Order reference and duplicates
- Assignments gain optional `orderId`; **required** when created through a department agent.
- Registry rule, enforced inside the creating mutation: at most one open assignment per
  (creating agent, orderId). A second create for that order returns the open one (`existing: true`).
- Idempotency key for department-agent creates = `<turnId>:<assigneeStaffId>:<orderId>`, so one
  summary turn can create several assignments (different people or orders) and a replay of the same
  call returns the same record. Personal-assistant creates keep one-per-admin-turn.

### Limits
- Per (department agent, employee): at most 3 open assignments, and at most 3 created per Bangkok
  day. Over the limit → refused with a clear message (the agent mentions it in its chat instead).

### Department view of its assignments
- Listener op `GET agent-assignments` (department agents only): open assignments this agent created,
  with orderId, assignee, due, created time.

### Closing
- Listener op `POST assignment-close { id, reason }`: only the creating department agent, only open
  assignments. Sets `status: 'done'` (no new status), logs `{ by: agent, change: 'closed: reason' }`,
  emits action `assignment-closed` in the department chat and a report event to `reportTo`; follow-ups
  stop. Repeating the close of an already-closed-by-this-agent assignment returns it unchanged.
- Agent workflow (AGENTS.md): list `agent-assignments`, read each order with `order.mjs`. Close only
  when the read succeeded, returned this department's tickets for that order, and every one of them is
  `Completed`. An empty result or Cancelled tickets → do not close; mention it in the department chat
  for an admin. Never infer completion from absence in the work summary.
- Legacy assignments without `orderId` (created before this change) stay on the employee-reporting
  path: `agent-assignments` lists them separately as "no order", and they are never auto-closed.
- Reports stay event-only (never wake the receiving agent), so no agent-to-agent loop.

### Work summary
- `work.mjs` passes `startedBy` (and its staff name from the directory) through to the summary, so
  the agent can choose the assignee without extra lookups.

### Agent instructions (washing/ironing AGENTS.md)
- At 08:00/18:00: for work slow by the notes criteria, assign a follow-up to the employee who started
  it if they are in the department, otherwise to a department member; one assignment per order;
  include the order id and garment tags in `detail`; respect the limits.
- Before the summary, close own assignments whose orders are done (workflow above).

## W changes besides Staff
- History action enums (both `shared/ai-gateway/tasks/team-agent.ts` and AI) add
  `assignment-closed`.
- Assignment schema adds optional `orderId`; Assignments page shows the order and, for agent-created
  work, the agent name (น้องซักผ้า/น้องรีดผ้า) as creator.

## Rollout order
1. W deploy (optional Departments mapping, directory route, schemas, form).
2. Add the `Departments` column to the Staff sheet; owner fills departments.
3. AI deploy (directory, rules, ops, AGENTS.md); rebuild Docker.

## Out of scope
- Departments for the appointments agent; auto-closing without the agent; shift rosters.

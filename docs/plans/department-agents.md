# Department agents (Washing, Ironing) — v1 plan

Spans two repositories: **AI** = `C:\MagicwashAI`, **W** = `C:\MagicwashGemini\webapp-vue`.
Template: the appointments agent (`docs/plans/appointments-agent.md`). Keep it simple: small shop, testing phase.

## Owner decisions (2026-11-17)

- Two agents first: `washing` (น้องซักผ้า) and `ironing` (น้องรีดผ้า). Other departments later.
- Scope: the JobTicket department boards only (`Washing`, `Ironing`). The wash/dryer machine queue
  (`/wash-queue`) is out of scope.
- Jobs: answer work-status questions, daily summary, warn about stuck or slow work, recommend what to
  do next. The agent recommends; staff still scan the real garments.
- Writes, own department only:
  - close an order's open tickets when staff say the work is done — **no score** (same as admin Complete);
  - reopen Completed tickets for rework → `Pending`, and **void the original score**; whoever
    redoes the work earns again on completion.
- Who can chat: every employee signed in with their own account (`admin`, `staff`). Shared `device`
  accounts cannot chat in v1 — the AI gateway cannot see the scanned operator.
- "Slow" threshold: the agent keeps its own criteria in its notes, starting at "open past one
  business day"; the team adjusts it in chat.
- Next-work order: oldest received order first; orders with a delivery appointment soon move up.
- Model `gpt-6.1-sol`, reasoning `medium`, same as appointments.

## AI (MagicwashAI)

### Shared team-agent runtime

- Turn the appointments service (shared thread, FIFO turn queue, history, turns journal, reminders,
  daily run, local listener, restart recovery, notes, images) into a small factory with three fixed
  configurations — not a configurable framework. Each agent has its own files under `logs/<agentId>/`
  and its own thread.
- Appointments moves onto it with no behavior change (same URLs, paths, `daily.json`, runner options,
  resumed thread) — a pure move first, then add the two new agents.
- Per-agent config: allowed roles (appointments `admin`; washing/ironing `admin | staff`, applied to message acceptance and every agent HTTP endpoint), daily run slots,
  action types, Thai labels, env allowlist (W service key + listener URL).
- Action types per agent: appointments keeps `create|reschedule|cancel|remind|reminder-cancelled`;
  departments add `close|reopen`. Listener validation and W's history schema accept them.
- Daily state per slot (`08:00`, `18:00`): record the last completed date per slot; appointments keeps
  its single-slot file format. Recovery queues each missed slot once.
- `docker-entrypoint.sh` makes every agent's `notes/` writable (today only appointments).
- HTTP: `/agents/:agentId/*` for the team agents; `/agents/appointments/*` keeps working.

### Agent workspaces

- `work/washing/` and `work/ironing/`: `AGENTS.md`, `scripts/`, `notes/` (same notes rules as
  appointments: `notes/MEMORY.md` index ≤ 60 lines, one topic per note ≤ 20 lines).
- AGENTS.md: role, Thai tone, department statuses (`Pending`, `In Progress`, `Completed`,
  `Cancelled`), earlier-step gate, next-work order rule, slow-work criteria kept in notes,
  confirm the order and garments before any write, a reopen always needs a reason,
  never report a write as done without a successful tool result.
- Scripts (read): department work list (`GET /api/job-tickets/department-work`), tickets of one order
  or garment (paginated `GET /api/job-tickets?orderId=…` / `?laundryItemId=…`), work orders for the
  received date (`GET /api/work-orders`), appointments for a date range (delivery priority).
- Scripts (write): close order's open tickets in this department; reopen tickets with a reason.
  Every write reports attempt + result to the local listener, like appointments.
- Job-ticket write responses are unwrapped `{ kind: 'completed' | 'write_failed', certainty, … }`,
  not the `{ success, data.appointmentId }` envelope: the department scripts use their own response
  adapter (ok = `completed` with the affected ticket ids; `write_failed` maps certainty to
  failed/unknown).
- Daily runs at 08:00 and 18:00 Bangkok: open work, slow work, recommended order for the shift.

## W backend

- Service-key allowlist adds GETs: `/api/job-tickets/department-work`, `/api/job-tickets` (list),
  `/api/work-orders`; POSTs: `/api/job-tickets/complete-order`, `/api/job-tickets/reopen`.
- `complete-order`: the AI actor may call it for `Washing` and `Ironing` only (today admin-only);
  unchanged skip-gate, no-score behavior.
- New `POST /api/job-tickets/reopen` `{ orderId, department, ticketIds, reason }` — admin or AI actor:
  - only `Completed` tickets of that order and department;
  - rejected if a non-deleted ticket of the same order and garment tag with a higher `step_no` is
    `In Progress` or `Completed` (mirror of the existing earlier-step gate);
  - ticket → `Pending`; resets `started_at`, `started_by`, `completed_at`, `scanned_by`; `updated_by` =
    actor; appends a short `reopen <Bangkok time> <actor>: <reason>` line to the ticket `notes`, so the
    reason survives even without a score;
  - score: for each `EARN` of the ticket not yet reversed, append one `VOID` row with negated minutes,
    `created_by` = actor, `notes` = `earn:<EARN id> reopen: <reason>`. A ticket closed without score
    gets no VOID. A ticket with an unlinked legacy VOID is rejected for manual review (no guessing).
  - order: VOID rows first, then the ticket update.
  - retry reconciles current state: a requested ticket already `Pending` whose last `notes` entry is a
    reopen counts as already reopened (no second ticket write); its unreversed EARNs are still voided.
    So a retry after an unknown outcome or a rejected ticket write finishes without double VOIDs.
  - response: same unwrapped `completed` / `write_failed` shape as advance, listing per ticket
    `reopened`, `already_reopened`, `blocked`, or `skipped`, plus VOIDs written; a `write_failed`
    also lists VOIDs that did commit.
- WorkTransactions reader: a VOID whose `notes` names `earn:<id>` is attributed to that EARN's staff;
  older VOIDs keep today's first-earner fallback. Totals/rankings already sum signed minutes and count
  VOID as −1 job. Test A earns → reopen → B earns → reopen debits A once and B once.

## W frontend

- Generalize the appointments agent data service, store, last-seen key and `AppointmentsChatPage`
  into one team-agent set parameterized by agent id (history, polling, images, reminders and notes
  panel).
- Agents list shows washing/ironing to `admin` and `staff`; appointments stays admin-only.
- Unread badge per agent.
- Speaker name: the signed-in employee. Washing/ironing agents are hidden from `device` accounts and
  the AI gateway rejects them (owner decision; operator forwarding is out of scope).

## Verification

- AI unit tests: runtime keyed by agent id, appointments regression, per-agent role check.
- W: typecheck api + web, vite build; reopen tests (later-step gate, field reset, VOID per unreversed
  EARN, partial-write retry, repeated rework cycles), AI department limit on complete-order.
- Live: deploy W first, then rebuild AI; test close/reopen on a test order of customer `cbcc555a`
  (KLX) only; confirm appointments still works after the move.

## Out of scope for v1

Wash/dryer machine queue, DryCleaning/Packaging/Logistics agents, LINE/push notifications,
agent starting or completing tickets with score.

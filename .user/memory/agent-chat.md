# Agent chat — pending items

Canonical doc: `docs/features/agents/agent-chat.md`.

- Owner to decide: switch app-wide UI text (nav: รายการราคา, แจ้งปัญหา, พนักงาน) to English like agents/price-list.
- Prod chats need MagicwashAI running on this PC; if it stops, register/price chats show the error bubble.
- NEXT session: build น้องติดตาม (order-tracking) — handoff `.user/memory/order-tracking-agent-handoff.md`; prod shows its fake reply until then.
- Local test: MagicwashAI `ALLOWED_ORIGINS` must include `http://localhost:3000` for `vercel dev`.
- น้องนัดหมาย (`appointments`) live 2026-11-16; schedule page has a Pickup/Delivery filter; plan `docs/plans/appointments-agent.md`.
- น้องซักผ้า/น้องรีดผ้า live 2026-11-17 (live-tested close/reopen/gate on KLX 6dc8190f); next: own avatars, review greetings; plan `docs/plans/department-agents.md`.
- Unread badges per chat + draggable floating AI bubble live 2026-11-18; real finger drag not yet checked on a phone.
- Personal assistants live 2026-11-18 (plan `docs/plans/personal-agents.md`); staff scores need W prod deploy; not yet seen live: open-card Cancel, Overdue pill.
- Staff profile uses shared report components (src/shared/components/reports) + open assignments, live 2026-11-18; staff-viewer case not browser-tested.
- Department agents assign work to their own staff: live 2026-11-18 (`docs/plans/department-staff-assignments.md`); owner must set each employee's Departments.
- น้องนัดหมาย closes orders (and all leftover tickets) once staff confirm delivery; asks at 20:00; staff can open its chat; not yet tried in a real chat.

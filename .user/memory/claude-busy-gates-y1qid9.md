# Branch `claude/busy-gates-y1qid9`

- Plan: `docs/plans/staff-attendance.md`. Sheet `Attendance` exists in the Staff spreadsheet; registry JSON written.
- Built: backend (5 endpoints, rules, dry-tests) and staff booking page `/attendance` (design: `.user/day-off-design/variant-a.html`).
- Live-tested via `vercel dev`: book, reload, locked week, server 409, admin soft-delete all OK.
- Pending: admin UI (create LEAVE/ABSENT, edit, cancel, book for another staff) — backend endpoints exist.
- Open: day-off page close button returns to `/`, not the staff profile — owner not decided.
- Not deployed; not merged.

# feat/work-ledger

## Status

- Staff KPI ledger built end to end; owner-tested on localhost 2026-10-04 (approval stamped 2/6/1, completion wrote EARN 2 by b8624701); not pushed.
- Workbook `MagicwashWork`, env `WORK_SPREADSHEET_ID` (Vercel all envs + `.env.local`); registry JSONs in G Drive.
- WorkRates: one `EASY` row per department; owner fills minutes in the sheet.
- Order approval stamps `JobTickets.work_minutes` from the department's active EASY rate (blank if missing/unreadable).
- Completing tickets appends one EARN row per ticket (minutes = `work_minutes`, created_by = StaffId) in one batch; old tickets without `work_minutes` earn nothing silently.
- A failed EARN write returns `scoreFailed` and the department page shows "Score not saved … Tell an admin"; no backfill.

## Next

- Merge to `main` after the started_at fix.
- Accepted risk: two simultaneous completions of one ticket can write two EARNs; fix with a VOID row.
- Before KPI drives pay: server must take the actor from the token, not the client body.
- Future: supervisor-created tickets with custom `work_minutes`; KPI report screen.

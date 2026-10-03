# feat/work-ledger

## Status

- Staff KPI ledger: `WorkTransactions` (append-only) and `WorkRates` (read-only) registered under `server/sheets/`; no caller yet.
- Workbook `MagicwashWork`, env `WORK_SPREADSHEET_ID` (Vercel all envs + `.env.local`); registry JSONs in G Drive.
- WorkRates seeded one `EASY` row per department; owner fills minutes in the sheet.
- Order approval stamps `JobTickets.work_minutes` from the department's active EASY rate (blank if missing/unreadable); old tickets stay blank by owner decision.

## Next

- Write `EARN` rows in `job-ticket-advance.service.ts` on In Progress → Completed, minutes from `work_minutes`; advance response gains `scoreFailed`, page shows an auto-dismissing warning; no backfill.
- Accepted risk: two simultaneous completions of one ticket can write two EARNs; fix with a VOID row.
- Before KPI drives pay: server must take the actor from the token, not the client body.
- Future: supervisor-created tickets with custom `work_minutes`.

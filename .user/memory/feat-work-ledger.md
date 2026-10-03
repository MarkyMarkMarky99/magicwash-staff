# feat/work-ledger

## Status

- Staff KPI ledger: `WorkTransactions` (append-only) and `WorkRates` (read-only) registered under `server/sheets/`; no caller yet.
- Workbook `MagicwashWork`, env `WORK_SPREADSHEET_ID` (Vercel all envs + `.env.local`); registry JSONs in G Drive.
- WorkRates seeded one `EASY` row per department; owner set every rate to 1 minute for now.

## Next

- Write `EARN` rows in `server/modules/job-tickets/job-ticket-advance.service.ts` when a ticket moves In Progress → Completed; owner must approve touching that module first.
- Open: EARN append fails after ticket update (Claude suggests log + backfill); department with no active EASY rate (Claude suggests skip + log).
- Accepted risk: two simultaneous completions of one ticket can write two EARNs; fix with a VOID row.
- Before KPI drives pay: server must take the actor from the token, not the client body.

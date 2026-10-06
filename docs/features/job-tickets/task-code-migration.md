# WorkRates and JobTickets task-code migration

Status (2026-10-07): live WorkRates and JobTickets headers and values are migrated, the schema registry
is updated, and live column parity passes. Deployment and the controlled test-order check remain.

## Physical columns

WorkRates has ten columns after the change:

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| task_code | department | name_th | minutes | active | notes | created_at | created_by | updated_at | updated_by |

Rename A from `id` to `task_code` and remove the old C `level`. The primary key is `task_code`.
JobTickets replaces E `service_type` with `task_code`; all other columns stay in place.
Keep every existing JobTickets `id`, `work_minutes`, status, actor, and timestamp unchanged.
Keep every WorkTransactions row and `job_ticket_id` unchanged.
Order and order-item service types still select the route.

## Initial routing and migration mapping

The user confirmed this round keeps one task per department. The following codes are used by the local
routes; they must be present in the migrated rates if those operations should earn minutes.

| Department | Task code | Existing rate source |
|---|---|---|
| Tagging | TAG-PHOTO | active EASY rate for Tagging |
| Washing | WSH-STANDARD | active EASY rate for Washing |
| DryCleaning | DRC-STANDARD | active EASY rate for DryCleaning |
| Ironing | IRN-STANDARD | active EASY rate for Ironing |
| Packaging | PCK-STANDARD | active EASY rate for Packaging |
| Logistics | LOG-STANDARD | existing EASY rate, if needed; no route creates it |

Preserve the selected row's minutes, Thai name, active flag, notes, and audit metadata. Do not invent a
rate or activate an inactive row. Resolve multiple candidate EASY rows explicitly before migration.
Back up MEDIUM and HARD rows; decide their mapping or archival disposition before removing them from the
live rate catalog. They cannot share a task code with the retained rate, including when inactive.

Existing department tickets represent the original combined operation. Backfill E using the department
mapping only for tickets confirmed to follow that workflow. Review manually created or unknown records
separately; never infer folding, packing, or washing variants from their old service code.
Do not rename the header and leave values such as WSIR or WASH in E: API reads physical cell values and
would expose them as task codes. Clear unresolved cells to blank only after recording their old values
in the migration backup and review list; blank cells return null and retain the existing ticket score.

## Coordinated rollout

1. Prepare and review backups, rate mapping, ticket mapping, unresolved records, and before-change
   counts and score totals. Include WorkTransactions as the comparison baseline.
2. Coordinate the shared schema registry update with its owner. The registry is read-only to this
   implementation; do not rewrite it to match code. Audit other projects and API consumers before
   replacing the old columns and response field.
3. Pause every writer that can approve orders, create tickets, start tickets, or complete tickets.
   Keep writes paused throughout the schema/build switch; approvals alone are not the entire write path.
4. Apply the approved physical column changes and backfills. Verify task-code uniqueness and preserve
   ticket IDs, minute snapshots, ledger references, and unrelated columns.
5. Run live column parity from the candidate code before deploying:

   ```sh
   node --env-file=.env.local --import=tsx/esm tests/server/integration/sheet-column-parity.ts
   ```

   Pending: this requires live access and environment configuration. Parity validates column shape,
   not mappings, row counts, or historical score totals.
6. Deploy the matching backend and frontend and refresh old clients. Restart instances to clear the
   cached rate index. Smoke-read the API and verify preserved history; use a controlled test order to
   verify new IDs, task rates, Tagging scoring, and reapproval without duplicate tickets or EARN rows.
7. Reconcile counts, stored minutes, and ledger references, then resume normal writes.

Before new writes occur, rollback can restore the backup sheets and matching previous build together.
After new writes occur, capture and reconcile new tickets and transactions before rollback; blindly
restoring old snapshots would discard them.

## Runtime behaviour

New ticket IDs are `XXX-<orderId>-<laundryItemId>-<taskCode>`, retaining the department prefix for score
reporting. Old deterministic IDs are unchanged and reserve the original default task on reapproval,
including if their task cell is blank. A different task in that department is not suppressed. Tickets
with noncanonical old IDs require a confirmed task backfill before reapproval.

Active rates require a readable code, known department, and finite non-negative minutes. A code
appearing on more than one row is excluded entirely, even if another occurrence is inactive or its
minutes are invalid. Missing, invalid, mismatched, or duplicated rates leave new ticket minutes blank
and earn no score. Approval still succeeds. Successful rate reads are cached for the server-instance
lifetime; failed reads retry later. Existing ticket minutes are never recomputed.

The department page displays the task code; name_th remains catalog metadata and is not added to the
API in this round. Multiple eligible tickets for one scan are rejected with an instruction to select
cards from the list. The direct scan API can select taskCode explicitly. Queue restoration continues
using ticket IDs. Blocker responses still identify departments.

## Deferred work

Separate Packaging tasks, washing variants, task-specific blocker messages, and ORDER/per-kilogram
weighing require further business rules. They are not enabled by this structural change.

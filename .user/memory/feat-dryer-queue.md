# feat/dryer-queue

## Status
- Washer + dryer share the WashQueue workflow; booking requires `machineId` from the read-only `Machines` sheet.
- Backend (Codex sol) and frontend (Sonnet) built; gates green; not merged, not deployed.
- Do not deploy backend alone: POST now requires `machineId`, the old frontend would 422 on booking.

## Decided
- Machines ids `WSH10-01` style (TYPE+CAPACITY-SEQ); 6 rows live; registry JSON in G Drive updated.
- One row per machine size for now; each machine id is its own FIFO queue.
- Same operator (`WashOperator`) for washer and dryer; dryer jobs booked manually after unload.
- UI: plain rounded-square Washer/Dryer switch at the bottom (`?mode=dryer`); Photo button in the top section header; English-only labels; row line 2 = machine label; no basket counters.

## Next
- Implement timer card frame variant C1: `.playwright/prototypes/wash-queue-in-machine-card-frame.html`.
- Dryer copy ("First in, first washed", "Dry X kg") still undecided.
- Photo button sits tight to the right edge of the section header; owner not yet asked to fix.
- Phone-test the whole flow before merge.

# feature/wash-queue

## Status

- WashQueue feature is built and committed on this branch. It is not pushed and not deployed.
- The page uses direction A rows with swipe actions and GenericTabs filters (owner-picked prototype: `.playwright/prototypes/wash-queue-swipe-tabs.html`).
- Feature doc: `docs/features/wash-queue/wash-queue.md`. Registry: `G:\My Drive\Magicwash\Database\GoogleSheets\WashQueue.json`.
- Sheet tab `WashQueue` (21 columns, A–U) lives in the JobTickets spreadsheet and is already live.
- Shared changes on this branch:
  - `WeightPrompt.vue` moved from orders to `src/shared/components/` and restyled (owner-picked 6.5 sticker field).
  - `ConfirmOverlay` gained opt-in `header-action` and `footer` slots.
  - `parseWeightKg` added to `shared/utils/item-quantity.ts`.

## Next

- Push to Preview and phone-test the full flow: book (weigh + on-scale photo) → Load → Unload (weigh + photo) → Pick up → Cancel.
- Phone-check the swipe rows: the right panel is Load/Unload/Pick up and the left is Cancel. The lime panel sits above an always-rendered left panel (z-10 workaround).
- Phone-check that Order Detail's WEIGHT flow still works with the restyled `WeightPrompt`.
- Set Staff `Position` = `WashOperator` for the machine operator.
- Deploy order: ship the contract before staff use it. The tab already has 21 columns, so the old contract cannot read it.

## Open decisions

- Should the success notices after actions stay? Sonnet added them unasked.
- Tapping the backdrop of the booking confirm discards the photo and note. Keep or block?
- OrderBagRow likely loses its card radius mid-swipe, the same way WashQueueRow did (unchecked).
- Make close X buttons consistent: hand-rolled X buttons should use the shared `CloseButton`. This is a separate task, not started.

## Deferred (owner)

- KPI: a WashQueue completion should write a WorkTransactions EARN row later. `work_minutes` is reserved, and the report derives the department from the id prefix.
- `machine_id` is reserved for a future `WashMachines` sheet (capacity_kg lives there).
- Cancel and Load/Unload permissions are enforced in the frontend only, by owner decision.

# Plan — Shared UI consolidation

Status: **not started.** Written 2026-10-25 from a read-only audit of `src/` (look-alike UI and
shared components with drifting settings), partly confirmed by measuring the running app.

This is the "dedicated shared component refactor" that `docs/conventions/components.md` requires
before `src/shared/components/` may change. It runs on its own branch (`refactor/shared-ui`), cut
from `feat/order-intake-page` at `bbd010a6` (owner 2026-10-25) because Round 1–3 targets exist only
there; it is never mixed with feature work. Sonnet implements each round; Claude decides, reviews and
verifies.

## Why

The same pieces of the app's sticker/paper look are re-implemented by hand in many features. The
copies have started to drift (sizes, radii, letter-spacing), and every new page copies one of them
again. Consolidating them makes the look consistent and makes new pages cheaper.

## Rules for every round

1. **Two kinds of round, never mixed.** An *extract* round only moves identical code into one shared
   component: same markup, same CSS, same pixels (the rule in `migration-preserves-behavior`). A
   *unify* round changes how something looks, so the owner picks the target look first.
2. One pattern per round, one commit per round, each round shippable on its own.
3. A new shared component gets a short entry in `docs/conventions/components.md` (what it is, props,
   slots) in the same commit; the feature docs that described the local copy point to it.
4. Gates every round: `npm run typecheck:web`, `npm run build` (template compile), `npm run
   check:cross-feature-imports`, the dry-tests of touched features.
5. Visual proof every round: before/after screenshots of every page the round touches, at 390px,
   taken in the owner's Chrome by a Sonnet subagent (hash URLs, `localhost:3000/#/…`). An extract
   round passes only when before and after are identical.

## Rounds

Ordered by confidence first (copies confirmed identical), then by number of copies.

### Round 1 — Extract: form page header (`FormPageHeader`) — done

Three hand-built copies of the dark-green form header with the "Customer" box and its lime tab,
measured identical in the browser (23px/800 title, 72.5×22.8 tab, same rotation):
`OrderIntakeHeader.vue`, `CorporateOrderHeader.vue`, `LaundryItemRegisterHeader.vue` (`.hdr`, `.cust`,
`.cust__tab`, loading skeleton). New `src/shared/components/FormPageHeader.vue` with slots for the
title, eyebrow and customer box content; the three become thin wrappers or are deleted.

### Round 2 — Extract: section header (`SectionHeader`) — done

`LaundryItemSectionHeader.vue` and `OrderFormSectionHeader.vue` are byte-identical. Promote one to
`src/shared/components/SectionHeader.vue` and replace both. Same round: the copies with the same
metrics — `PackagingBagSheet` `.bag-sec`, `OrderIntakeRowSheet` `.row-sec`, `wash-program.css` `.sec` —
only if their screenshots match; otherwise they move to Round 7.

### Round 3 — Extract: paper card (`PaperCard`) — done

The `.paper` + `.paper__tab` trio is the same CSS in `CorporateCountSheet.vue`,
`OrderIntakeItemsPaper.vue`, `LaundryItemRegisterPaper.vue` (measured identical: radius 11/15/12/14,
4px hard shadow, -3° tab). New `src/shared/components/PaperCard.vue` (tab label prop, `tone`
primary/warning, default slot). `AgentCardFrame` (agents feature) is the same idea with a tone;
fold it in if its screenshots match, otherwise Round 7.

### Round 4 — Extract: inline notice (`InlineNotice`) — done

About 40 hand-rolled `bg-success|warning|error|info-container` blocks with three different tone maps
(`ScanResultCard`, `WashQueueNotice`, `OrderBagsView`). First take only the groups that are already
identical (e.g. the warning save notice on Intake, Corporate and Register; the error alert on the
two invoice payment pages; the two appointment pages). New `src/shared/components/InlineNotice.vue`
(`tone`, `role`, optional icon). The remaining variants go to Round 7.

### Round 5 — Extract: dead and duplicated bits

- Remove `ImageContentCard.vue` (no call sites) after a final grep.
- The `.done` "photo taken" restyle of the 47px StickerFab is copied in `WashQueueBookDialog` and
  `PackagingBagSheet`: move it into `WeightField`'s action usage or a `StickerFab` prop (`done`).
- The corner status bubble on a 56px thumb is duplicated in `WashQueueRow` and `OrderBagRow`:
  extract `ThumbStatusBubble`.

### Round 6 — Settle the shared-component changes made on `feat/order-intake-page`

That branch added `backAction` to `AppHeader.vue` and `closeButton` to `PickerOverlay.vue` outside a
dedicated refactor (for the garment detail overlay). Review them here: keep them with docs entries,
or replace them with a cleaner API, and convert `AppHeader`'s runtime `defineProps` to the typed form
the rest of shared uses.

### Round 7 — Unify (owner picks the look per item)

Each item is a separate decision with screenshots of every variant side by side:

1. **StickerFab sizes.** Today 72, 48, 47 and 46px for the same lime square role, plus icon sizes 20,
   26 and 36px set three different ways. Proposal: two sizes as a prop (`md` 72px page action,
   `sm` 46px inline/header action), no `!h-…` overrides.
2. **BaseBadge for status.** The same card-status role is `sm` uppercase on some cards and `lg`
   sentence case on others. Proposal: one rule for card status; add a `stamp` variant for the tilted
   stamp style (garment detail "Washing now") instead of hand-rolled pills (~10 copies).
3. **Sheet headers and close buttons.** `DetailOverlay` sheets use four title treatments and several
   hand-placed close buttons. Proposal: one sheet header (title, optional subtitle, close) in
   `DetailOverlay`.
4. **Photo tiles.** Tile radius ranges 0/3/10/12/18px; chips and badges are positioned outside
   `SquareImageCard`. Proposal: one radius, corner-badge and chip slots on `SquareImageCard`.
5. **Metadata grid, timeline, tag sticker.** Two to four copies each with different metrics
   (`WashQueueDetailSheet` vs garment detail grid; wash-program steps vs garment timeline vs agents
   tracking card; WashQueue tag label vs garment detail TAG sticker). Decide whether each is one
   component.
6. **Loading/empty/error page states.** Several hand-rolled full-page states and list skeletons beside
   `ListContainer`'s built-in ones.

## Not in scope

- Any behaviour, data or route change.
- Desktop layouts.
- Restyling anything the owner has not picked in Round 7.

## Estimate

| round | effort |
|---|---|
| 1 Form page header | ½ day |
| 2 Section header | ½ day |
| 3 Paper card | ½ day |
| 4 Inline notice (identical groups) | ½ day |
| 5 Dead and duplicated bits | ½ day |
| 6 Settle `AppHeader` / `PickerOverlay` additions | 1–2 h |
| 7 Unify | ½ day per item after the owner's pick |

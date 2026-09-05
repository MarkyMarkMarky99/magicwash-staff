# Plan — BaseOverlay escapes the app column at desktop widths

Branch: `feat/customer-detail-tabs` (2 commits in: `3a2784b`, `ad962b0`). Tree is clean.
Scope: **one file, two class strings, plus one regression assertion.** Nothing else.

---

## 1. The bug

The app renders inside a centred mobile column — `src/App.vue:13`, `mx-auto ... sm:max-w-[390px]`.

`BaseOverlay` teleports a native `<dialog class="fixed inset-0 ... w-full max-w-none">` to `body` and
calls `showModal()`. `fixed inset-0` is relative to the **viewport**, not that column, and the panel
inside it is `w-full`. So at a 1280px desktop width an open overlay spans the whole screen while the
rest of the app stays in the 390px column.

Evidence: `.../scratchpad/shots/09-order-sheet-1280.png` (order detail sheet, full-bleed at 1280px).

Pre-existing — not introduced by the customer-detail-tabs work.

---

## 2. Scope — smaller than it looks. Read this before touching anything.

There are four overlay shells in `src/shared/layouts/`. Only one is broken:

| Shell | Call sites | Verdict |
|---|---|---|
| `BaseOverlay.vue` | 4 | **Broken. This is the only file to change.** |
| `BaseFullOverlay.vue` | 1 (only `FormOverlay` consumes it) | Leave alone |
| `FormOverlay.vue` | 12 | **Already correct** — `FormOverlay.vue:271-273` pins its panel to `width: min(390px, 100%)` |
| `BaseSlideOverlay.vue` | **0** | Dead code. Leave alone; see §6 |

The 12 `FormOverlay` call sites — every form in the app, including buy-package and package-usage —
already render at the right width. Do not "fix" them.

The four `BaseOverlay` call sites, none of which pass any width class:

- `src/features/customers/components/OrderDetailSheet.vue:67` — `variant="sheet"` (the only sheet)
- `src/features/customer-packages/components/CustomerPicker.vue:46` — `variant="full"`
- `src/features/invoices/components/InvoicePriceListPicker.vue:97-101` — `variant="full"`
- `src/features/orders/components/OrderImageWeightPrompt.vue:47` — default `full`

---

## 3. The fix — constrain the panel, not the dialog

**Do not touch the `<dialog>` element.** Leave it `fixed inset-0 ... w-full max-w-none`. The backdrop
should keep covering the whole screen — that is correct modal behaviour, and it is what
`FormOverlay` already does. `max-w-none` sits on the dialog, not on the panel we are constraining,
so it does not need removing.

The dialog already carries `items-end justify-center`, so a narrowed panel centres itself and lines
up with the app's `mx-auto` column.

In `src/shared/layouts/BaseOverlay.vue`, in the panel's `:class` binding (around line 300), add
`sm:max-w-[390px]` to **both** variant strings:

- sheet: `... flex max-h-[84vh] w-full flex-col ...` → `... flex max-h-[84vh] w-full sm:max-w-[390px] flex-col ...`
- full: `... flex h-full w-full flex-col ...` → `... flex h-full w-full sm:max-w-[390px] flex-col ...`

Use the `sm:` prefix, not a bare `max-w-[390px]`. It must mirror `App.vue:13` exactly: below 640px
the app column is unconstrained, and the overlay must be unconstrained there too, or every phone
gets a letterboxed overlay. This is the single most likely way to get this change wrong.

Keep `w-full` — it is the base that `sm:max-w-*` caps.

That is the entire change. Two class strings in one file.

---

## 4. What must not change

- **Do not** alter the `<dialog>` classes, the backdrop, `showModal`/`close`, the focus handling, the
  scroll lock, the sheet drag-to-dismiss, or any transition.
- **Do not** edit `BaseFullOverlay.vue`, `BaseSlideOverlay.vue`, or `FormOverlay.vue`. `FormOverlay`
  already applies its own 390px panel; a second constraint from a shared shell would double-apply.
- **Do not** change any of the four call sites. The fix belongs in the shell so all four get it.
- **Do not** touch `src/App.vue` or the column definition.
- **Never** write to `G:\My Drive\Magicwash\Database\GoogleSheets\*.json`.
- Do not commit.

This is a shared component in `src/shared/`, normally off-limits. It is in scope here only because
this is the dedicated pass for it, and §2 lists every call site so all of them can be checked at
once. That list is the reason the change is allowed — do not widen it.

---

## 5. Verification

There is no frontend type-check, so `npm run build` proves only that nothing failed to resolve. Say
so rather than calling it a pass.

```bash
npm run build
```

Then prove it in the browser. The Playwright suite already exists and already has a 1280x800 desktop
project (`tests/e2e/playwright.config.ts:24-27`).

Add one regression assertion to `tests/e2e/customer-detail-tabs.spec.ts`: at the 1280x800 viewport,
open the order detail sheet on the customer detail page and assert the **panel's** bounding box
width is ~390px and that it is horizontally centred — not the dialog's, which stays full width by
design. The existing sheet test around `:168-174` shows how the sheet is opened.

Run the suite and report the actual result:

```bash
npx playwright test --config tests/e2e/playwright.config.ts
```

The dev server must serve both the frontend and `/api` — `npx vercel dev --listen 3102`, per the
earlier run. `vercel dev` leaks child node processes and eventually OOMs the API function; if pages
hang on "Loading customer...", kill the process tree and restart before concluding anything failed.

Capture two screenshots into
`C:\Users\Asus\AppData\Local\Temp\claude\C--MagicwashGemini-webapp-vue\c36b7929-cfac-42a3-b205-62379c67c6fe\scratchpad\shots\`
named `fix-order-sheet-1280.png` and `fix-order-sheet-390.png`, then **open both and confirm by eye**:
at 1280 the sheet sits inside the app column, and at 390 it is still full width with nothing
letterboxed. Also check `CustomerPicker` at 1280 (it is the `variant="full"` case and exercises the
other class string).

---

## 6. Report, do not fix

Two things found while surveying, both out of scope for this change:

- `BaseSlideOverlay.vue` has **zero call sites** — a full duplicate of the sheet variant, dead.
- `BaseOverlay.vue:1-27` carries a **private copy** of the page-scroll lock instead of importing
  `src/shared/layouts/use-page-scroll-lock.ts`, which `BaseFullOverlay` and `BaseSlideOverlay` both
  use. Two independent lock counters can disagree if overlays ever nest.

Note them in the report. Do not act on either.

Final report: **DONE** (files changed), **VERIFIED** (build result, suite result, what the two
screenshots actually looked like), **DID NOT DO**. Terse, no narrative.

# Plan — Garment photos on the garment detail page

Status: **design agreed with the owner 2026-10-25; not built.** Builds on the garment detail page
(`docs/features/laundry-items/laundry-item-detail-page.md`) on branch `feat/order-intake-page`.

## Why

A photo is a property of the garment. Staff add defect, before and after photos on the garment
detail page, not in an order form. Each photo either belongs to one order or is shared garment
history (for example the customer had it shortened or re-sewn), which every order should see.

## Decisions

Owner (2026-10-25):

1. The order a photo belongs to comes from where the page was opened, never from a server guess.
   The server does not pick "the current order": staff may add photos to an older or undelivered
   order.
2. `#/garments/:tagId?order=<orderId>` filters the page to that order: its history shows only that
   order. Without `order`, the page shows every order as today, each row expanding to its tracking.
3. A photo added with `order` in the URL is saved with that `order_id`. A photo added without it is
   saved with `order_id` empty: shared garment history.
4. Shared garment history is shown in both modes; with `order` it sits in its own section above the
   order's history.
5. No new photo type now. Photos use the existing `BEFORE`, `AFTER` and `DEFECT` types with an
   optional note. The design must allow adding a type (for example `ALTERATION`) later by a
   registry change only.
6. Garment detail opened from the Intake page is view only: the order does not exist yet, so it has
   no add or edit actions. Staff save the intake first, then open the garment from order detail.

Claude (minor):

7. `order` is a query, not a path segment, so the existing route and links keep working.
8. When `orderId` is sent, the server checks that the garment is linked to that order through a
   non-deleted OrderGarments row (1 GViz read) and rejects it otherwise (400). Without `orderId`, no
   order check.
9. Photos upload to Firebase when captured (shared upload composable); the row is written once on
   confirm, one `LaundryItemPhotos` append per photo set.

## Page

- Header action "Add photo" opens a sheet: type (`Defect`, `Before`, `After`), camera, optional
  note, Save. The sheet title states where the photo goes: "Order <received date>" with `order`, or
  "Garment history (all orders)" without.
- With `order`: the page reads the order's OrderGarments link; if the garment is not in that order
  it shows "This garment is not in this order" and no add action.
- The type list comes from the API contract enum, so a new type shows up without page changes.
- The Intake overlay (`intake=item:<tag>`) passes a view-only flag; the add action is hidden.

## Backend

- `POST /api/laundry-item-photos` (existing CRUD create) gains the order check of decision 8 and
  accepts `photoType` `BEFORE | AFTER | DEFECT` only (`REGISTRATION` stays register-only).
- Calls per add: 0–1 GViz read (OrderGarments, only with `orderId`), 1 Sheets API write.

## Entry points

- Order detail and department pages that list a garment link to it with `?order=<orderId>`.
  Which screens get the link is decided when they are built; none links today.
- The Intake row sheet keeps opening the garment as a view-only overlay.

## Later (designed, not in this round)

- **Defect photos at intake.** Garment detail in Intake mode gets the add action, but photos are
  held in the Intake draft instead of written. Intake Save writes them to LaundryItemPhotos with the
  new `order_id` in one extra batch append. Discard deletes their files with the draft.
- **New photo type.** Add the value to the registry and the API enum; the page lists it.

## Out of scope

- Editing or deleting existing photos.
- Moving a photo between an order and shared history.

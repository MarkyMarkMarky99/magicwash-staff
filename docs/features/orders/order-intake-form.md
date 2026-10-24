---
last_audited: 2026-10-24
audit_sources:
  - src/features/orders/pages/OrderIntakePage.vue
  - src/features/orders/routes.ts
  - src/features/orders/utils/order-intake-draft.ts
  - src/features/orders/composables/useOrderIntakeOverlayRoute.ts
---

# Order intake form

## Purpose

Staff use this page to take in a customer's laundry at the counter. They describe the order (name, note, service type, dates) and photograph what arrived: garments with their tags, the customer's document, the weight of a bag, and valuables found with the laundry. The page has no item entry. The order's items are meant to come from AI sorting after the order is saved; that wiring does not exist yet (see Save).

## Route

The page lives at `/orders/new/intake/:customerId`, route name `order-create-intake`, with the order list as its parent. The shared `orderIntakeCreateRoute` builder in `src/shared/navigation/form-routes.ts` builds the location. The component name is `OrderIntakePage`; it is on the `KeepAlive` exclude list in `src/App.vue` because its state is component-local, and it uses `onMounted` only.

The customer comes from the route parameter and is found in the preloaded customer store, which the page starts loading on mount. Staff open the page from the customer detail Order History create menu, which shows an "Intake Order" item after "New Order" for every customer.

## Layout

A plain full-screen page with the corporate order form's shell: green header, body overlapping the header by 16px with rounded top corners, and a footer bar with Discard and Save order.

- Header: label "New laundry intake", title "New order", the shared close button on dark, and the customer card. The card shows the customer name and sub line, a dashed divider, the order name, the note on one line with ellipsis, and a bottom line "Received <date> · <service type>". The service type is a pill like the corporate turnaround chip, but shows the service label and no turnaround. The due calendar tile sits inside the card on the right. A small edit icon marks the card as tappable. The tile turns to a warning when due is before received.
- Items section: the shared section header "Items" with the subtitle "No items yet". Its action area holds the photo preview stack and the camera button. Below it is the empty Items paper (head Item and Qty, an empty state, a total of 0 pcs) and an information strip saying that after saving, AI sorts the garments into order items for staff to check. There is no add-item control.

## Order details sheet

Tapping the customer card opens a bottom sheet. It holds the customer (read only, with a lock), order name, note, the service type as a two by two grid, and received and due dates. Defaults are today as received, received plus two days as due (Bangkok civil dates, the corporate form's helper), service type `WSIR`, and empty name and note. A "Due before received" warning chip shows only when due is earlier than received. Cancel discards the edits; Done applies them. The service types are `WSIR` Wash & Iron, `IRON` Iron only, `DRCL` Dry clean and `WASH` Wash & Fold.

## Capture

The camera button opens a menu under it listing four categories, each with its current photo count. A tap outside or Escape closes the menu.

- Garments: opens the garment registration camera without an order item. A tag is accepted only if it passes `validGarmentTag` and is not already used by a garment in this draft. A valid tag plus a photo adds the garment to the draft. Nothing is sent to the server at capture time. Tags registered on other orders cannot be checked before the order exists.
- Document: opens the document scanner.
- Weight: asks for the weight with the shared weight prompt, then opens the shared camera for one photo, which closes after the capture.
- Customer assets: opens the shared camera; it stays open for several photos. Photos are stored as `BELONGING` order images.

The camera, scanner and weight prompt are route-owned overlays held in the `intake` query value (`garments`, `document`, `weight`, `belonging`, `photos`, `view:<id>`), so browser Back closes them without leaving the page. A refresh drops the query because photos live only in page state.

Photo files and their object-URL previews stay in the draft. A preview URL is released when its photo is removed and when the page is left.

## Preview stack and photos sheet

Beside the camera button, up to three overlapping thumbnails show the newest photos, with a badge for the total count. Tapping it opens the photos sheet: all four categories as stacked sections, each with a sticky header (icon, name, count), three-column square tiles, and garment tiles labelled with their tag. An empty category reads "No photos yet". Tapping a tile opens the shared photo viewer with a Remove action; removing returns to the sheet.

## Save

The new backend flow does not exist yet, so Save uses existing APIs only:

1. Creates the order with `useOrderStore().create` and `workOrderCreateSchema`: customer, received and due dates, service type, quantity equal to the number of garments (null with none), order name and note (null when empty), `createdBy` from `currentActor()`, and no items. The order stays `PENDING`.
2. For each garment, uploads its file and creates the LaundryPhotos row exactly as the order detail garment registration does: no order item, and the tag as `itemId`.
3. Uploads documents, weights and customer assets through `useOrderImageStore().captureImage` with the created order id, the image type, and the weight for `WEIGHT`.

A failure after the order exists does not undo it. The footer shows a notice with the order id and an "Open order" link, and Save stays disabled. Save is disabled while saving and after success. Full success replaces the route with the order detail. Discard and the header close control leave the page like the other forms.

Later work will move the order to `RECEIVED`, copy the garment photos, and let AI classify them into order items. None of that happens in this page yet.

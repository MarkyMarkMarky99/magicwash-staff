---
last_audited: 2026-10-24
audit_sources:
  - src/features/orders/pages/OrderIntakePage.vue
  - src/features/orders/routes.ts
  - src/features/orders/utils/order-intake-draft.ts
  - src/features/orders/utils/order-intake-items.ts
  - src/features/orders/utils/order-intake-scan.ts
  - src/features/orders/composables/useOrderIntakeOverlayRoute.ts
  - src/features/orders/composables/useOrderIntakeScan.ts
  - src/features/orders/components/OrderIntakeRowSheet.vue
  - src/features/orders/components/OrderIntakeScanBanner.vue
---

# Order intake form

## Purpose

Staff use this page to take in a customer's laundry at the counter. They describe the order (name, note, service type, dates) and add each garment by scanning its tag. Every garment was registered once beforehand on the Register Garments page, so the page needs no photo per garment. The Items paper shows the order's items live, grouped by the garments' registered types. Staff can also capture the customer's document and valuables found with the laundry. Bags are weighed on the Packaging page, not here. The plan behind the page is `docs/plans/order-intake-flow.md`.

## Route

The page lives at `/orders/new/intake/:customerId`, route name `order-create-intake`, with the order list as its parent. The shared `orderIntakeCreateRoute` builder in `src/shared/navigation/form-routes.ts` builds the location. The component name is `OrderIntakePage`; it is on the `KeepAlive` exclude list in `src/App.vue` because its state is component-local, and it uses `onMounted` only.

The customer comes from the route parameter and is found in the preloaded customer store, which the page starts loading on mount. The page also starts loading the price-list Items catalog on mount. Staff open the page from the customer detail Order History create menu, which shows an "Intake Order" item after "New Order" for every customer.

## Layout

A plain full-screen page with the corporate order form's shell: green header, body overlapping the header by 16px with rounded top corners, and a footer bar with Discard and Save order.

- Header: label "New laundry intake", title "New order", the shared close button on dark, and the customer card. The card shows the customer name and sub line, a dashed divider, the order name, the note on one line with ellipsis, and a bottom line "Received <date> · <service type>". The service type is a pill like the corporate turnaround chip, but shows the service label and no turnaround. The due calendar tile sits inside the card on the right. A small edit icon marks the card as tappable. The tile turns to a warning when due is before received.
- Items section: the shared section header "Items" whose subtitle counts the garments ("No garments yet", "1 garment", "5 garments"). Its action area holds the photo preview stack and the camera button. Below it is the Items paper, with no information strip.

## Items paper

The paper has one row per item type, laid out like a WashQueue row without the separate card: the garment count with "pcs" in a left block behind a vertical rule, then the item name, a warning label "Choose a type" on Uncategorized, and the Thai name when it differs, then the price-list item's image on the right (an icon when it has none). Rows are separated by dashed lines, as on the corporate count sheet. The total row is a short strip: "Total" on the left, the count with "pcs" on the right. Rows are sorted by name. Names come from the price-list Items catalog that the item picker also uses: the English display name, or the Thai one when the English name is blank.

Garments that have no registered type, or whose type is not in the catalog, gather in one Uncategorized row. It is always last, is styled as a warning with the warning colour tokens, and is shown only while it holds garments. The total at the bottom counts all garments. With no garments the paper shows an empty state asking staff to scan a garment tag. The grouping is a pure function in `order-intake-items.ts`, unit tested.

## Adding garments by scanning

A garment is added by its tag alone; nothing is photographed and nothing is sent at scan time except a lookup.

There are two ways to scan:

- The hardware scanner gun is the main way. The page listens for the gun through the shared scanner gun input with staff cards skipped, and the listener is enabled only while no overlay or sheet is open: the camera, scanners, photos sheet, row sheet, picker and the order details sheet all disable it.
- The Garments entry in the camera menu opens the shared QR scanner overlay in the phone camera. It reads only tags, adds them, and stays open for more scans. A line at the bottom shows how many garments are in the order, followed by the scan banner without its action buttons.

Both inputs use the shared scan code reader, accepting `MWG-<tagId>` (case-insensitive prefix)
and legacy bare garment IDs without changing the case of the ID. Intake owns scans on this route;
the app-level garment detail scan is disabled.

Each scanned code goes through the same steps:

1. A code that is not a garment tag is refused with "Not a garment tag".
2. A tag already in this draft is not added again; the banner shows a warning "Already in this order".
3. Otherwise the page looks the tag up among the customer's registered garments, which it loads once when it opens (one LaundryItems list request filtered by customer). A tag not found there (another customer's, unregistered, or registered after the page opened) is looked up on the server. A scan made while the list is still loading waits for it. If the list fails to load, every tag is looked up on the server. A repeat scan of the same tag is ignored while its lookup is pending.

The lookup has these outcomes:

- The garment belongs to this order's customer: it is added with its registered type and registration photo. A garment with no type goes to Uncategorized.
- The garment belongs to another customer: refused with "<tag> belongs to another customer".
- The tag is not registered: refused with "<tag> is not registered. Register it on Register Garments first."
- Any other error: refused with "Could not check <tag>. Try again."

A success plays the shared success feedback; a warning or a refusal plays the failure feedback.

## Scan banner

Every scan shows a large scan card (`OrderIntakeScanCard`) in the middle of the page: a see-through dark glass card, about 22rem wide, with the garment photo filling its top as a square and the details below. It does not block the page or the scanner gun; it is hidden while any sheet, camera or picker is open. The footer's own notice is for the Save message only. The latest scan replaces the previous card and restarts a short pop-in (none under reduced motion). A close button sits at its top right. It has three tones:

- Success: the garment was added. The garment's registration photo is shown in full, with nothing drawn over it except the close button inset from its corner. Below it are the tag with a lime check badge at the right end of its line, and the garment's item type (or "Uncategorized" in the warning colour, with the Choose type action). A garment with no photo, or whose photo fails to load, shows a placeholder garment icon instead.
- Warning: the tag is already in the draft. Same card as success, with a warning badge in the same place and the pill "Already in this order".
- Error: nothing was added (not a garment tag, another customer's, not registered, or lookup failed). A red tile with a cross replaces the photo, the tag is shown (or "Scan" when the code was not a tag), and a red pill carries the message.

There is no timer. The banner stays until the next scan, until it is dismissed, or, for success and warning, until its garment is removed from the draft. The phone scanner overlay shows the same result as a compact banner (`OrderIntakeScanBanner`) in its bottom area, without an action.

There are no defect photos in this round. The only action is:

- Choose type, which appears only for an Uncategorized garment. It opens the item picker for that garment; choosing a type or closing the picker returns to the page. A garment that already has a type has no type action on the scan card; its registered type can be changed from the row sheet's garment detail overlay.

The banner follows the draft, so after a type is chosen it shows the new type and the Choose type action goes away.

## Row sheet

Tapping a row of the Items paper opens a bottom sheet in the style of the Packing bag sheet, without selection. Its header has the lime bar, the row's item name (or Uncategorized) and the garment count, and a close button. Below is a three-column grid of the garments' registration photos, with no caption (the row already names the type).

Tapping a garment photo opens the shared garment detail view in a full-screen route-owned overlay, keeping the Intake draft in page state. Each tile is a button labelled "Open <tag>". Back returns to the row sheet. Changing type there persists the garment's type and also updates its draft item id so the Items paper regroups. If the original row becomes empty, the returning sheet shows the garment's new row. See [Garment detail](../laundry-items/laundry-item-detail-page.md). The page has no per-garment remove: a wrong garment is cleared with Discard. Choosing a type for an Uncategorized garment is also available from the scan card.

## Order details sheet

Tapping the customer card opens a bottom sheet. It holds the customer (read only, with a lock), order name, note, the service type as a two by two grid, and received and due dates. Defaults are today as received, received plus two days as due (Bangkok civil dates, the corporate form's helper), service type `WSIR`, and empty name and note. A "Due before received" warning chip shows only when due is earlier than received. Cancel discards the edits; Done applies them. The service types are `WSIR` Wash & Iron, `IRON` Iron only, `DRCL` Dry clean and `WASH` Wash & Fold.

## Capture

The camera button opens a menu under it listing three categories, each with its current count. A tap outside or Escape closes the menu.

- Garments: opens the tag scanner described above. Its count is the number of garments in the draft.
- Document: opens the document scanner.
- Customer assets: opens the shared camera; it stays open for several photos. Photos are stored as `BELONGING` order images.

All overlays, including the row sheet, the item picker and the garment detail, are route-owned and held in the `intake` query value, so browser Back closes them without leaving the page. The values are `garments`, `document`, `belonging`, `photos`, `view:<photo id>`, `row:<item id or uncategorized>`, `pick:<tag>` and `item:<tag>`. Opening garment detail from a row pushes an entry, so Back returns to the row sheet. Other Intake overlay transitions replace the query value. The garment's album, viewer and type picker own a separate `garmentDetail` query. A refresh preserves an `item:<tag>` deep link and can reload its garment; other Intake overlays are cleared. The draft is lost on every refresh because everything lives in page state.

Photo files and their object-URL previews stay in the draft. Capture starts a Firebase upload through the shared `useGarmentPhotoUploads` immediately. Removing a photo deletes its uploaded file; Discard and leaving an unsaved page call `discardAll`, including cleanup after an in-flight upload finishes. Preview URLs are released on remove and page disposal. Files referenced by a 201 response are kept.

## Preview stack and photos sheet

Beside the camera button, up to three overlapping thumbnails show the newest photos, with a badge for the total count. Tapping it opens the photos sheet: the categories Document and Customer assets as stacked sections, each with a sticky header (icon, name, count) and three-column square tiles. An empty category reads "No photos yet". Uploading tiles show a centred `progress_activity` spinner on a translucent dark overlay, in both the sheet and preview stack. Failed tiles show an `error` icon; tapping one retries its upload. Done tiles open the shared photo viewer with a Remove action; removing returns to the sheet.

## Save

Save calls `POST /api/order-intakes` through `src/data/order-intakes/order-intake.service.ts`. The contract-derived body contains customer, dates, service type, nullable name/note, item rows with their tags, and DOCUMENT/BELONGING images with their uploaded URLs. The body builder is unit tested. Save is disabled with no garment, an Uncategorized garment, any uploading or failed photo, a save in flight, or a previous 201 response. During the request its label is "Saving…" and navigation away is blocked.

A 201 with APPROVED and no failures clears the draft while keeping uploaded files, then replaces the route with `order-detail`. Other 201 responses stay on the page with Save disabled and the footer notice "Order <orderId> saved as <status>. Not saved: <failed joined by comma>. Open the order to finish." The Not saved sentence is omitted when there are no failures. Errors keep the draft and show the server message, including unregistered, conflicting, or type-mismatched tags. Discard and the header close control leave the page like the other forms.

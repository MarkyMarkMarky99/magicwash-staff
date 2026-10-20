---
last_audited: 2026-10-14
audit_sources:
  - src/features/orders/pages/CorporateOrderPage.vue
  - src/features/orders/routes.ts
  - src/features/orders/utils/corporate-order-items.ts
  - src/features/orders/utils/corporate-order-draft.ts
  - src/features/orders/composables/useSlipOverlayRoute.ts
---

# Corporate order form

## Purpose

Staff use this page to take in a corporate customer's laundry round. The customer sends a paper count slip with the laundry; staff count what actually arrived, item by item, against the customer's own item list. The page produces a count sheet, not a priced order: nothing on it is a price, a service choice or an order name.

## Route

The page lives at `/orders/new/corporate/:customerId`, route name `order-create-corporate`, with the order list as its parent. The component name is `CorporateOrderPage`; it is on the `KeepAlive` exclude list in `src/App.vue` because its fields are component-local, and it uses `onMounted` only.

The customer comes from the route parameter. The page finds the customer in the preloaded customer store and starts loading customers if the store is empty. A customer that is not in the store shows a "Customer not found" message in the header card. No other page links to this route yet; the owner decides where it is launched from. A shared route-location builder exists in `src/shared/navigation/form-routes.ts` for that launch point.

## Fields

The page is a plain full-screen page with its own green header, not a `FormOverlay`, because it needs a customer card and two footer buttons.

- Header: "New order" with the customer card. The close control leaves the page the same way as the Discard button.
- Customer card: the customer name, a sub line with the customer index and customer type, and a "Received <date> · <turnaround>" line at the bottom. A calendar tile on the right of the card shows the due date (a "Due" band, the day number, weekday and month). Tapping the received line or the tile opens a native date picker. Received defaults to today and due defaults to two days later, both as Bangkok civil dates. The turnaround chip and the tile turn to a warning when due is before received or a date is missing. There is no separate order details section, no note, no order name, no piece count and no service picker.
- Count sheet: a table with an item column and a counted column. Each row shows the item's image (or a glyph), its English name and its Thai name, and a counter with minus and plus buttons and a field to type the number. An empty counter means not counted; zero is a real count. The minus button is off until a count above zero exists. A total row at the bottom sums the counts. The section subtitle reads "Slip order" with how many lines have been counted out of all lines.
- Added items: a button below the rows opens a small form for an item that is not on the customer's list. Staff type a name and a count. The line is shown with an "Added" tag and can be removed again.
- Footer: only Discard and Save order. There are no totals or stats in the footer.

## Item list source

The rows come from the price list. A row belongs to the customer's list when its price group equals the customer's price group and the row is active. The rows are read from the existing price list store, filtered on the page; the store's interface is unchanged. An item code that appears on several rows, for example once per service type, is shown once.

When the customer has no price group, or no active row matches the group, the count sheet shows a "This customer has no corporate item list yet" message. Staff can still add items by hand in that case.

## Slip photos

The Scan button sits at the right of the count sheet header and floats there, so it does not make the header row taller. It opens the app's document scanner. Each accepted scan becomes a page of the slip. Pages appear as a small stack of thumbnails to the left of the Scan button, with the page count on the top thumbnail.

Tapping the stack opens the shared photo viewer, which shows one page at a time with a page counter and a thumbnail strip. Its footer shows "Page n of N" with Retake and Remove. Retake opens the scanner for that page and returns to the viewer afterwards; Remove deletes the page and moves to a neighbouring page, or closes the viewer when it was the last one.

The scanner and the viewer are route-owned overlays held in one `slip` query value, so browser Back closes them and does not leave the page. A refresh drops the value because the photos live only in page state. Photos are optional, are uploaded after order creation, and their local preview URLs are released when the page is left.

## Service type

Corporate orders use WASH. This is an owner decision from 2026-10-14. The page keeps it as a constant in its draft and does not show it.

## Save

Save order uses the normal new-order flow's `workOrderCreateSchema`, `useOrderStore().create` and `currentActor()`. With no count above zero it makes no API call and shows "Count at least one item before saving" in the footer. While saving, both footer buttons are disabled and Save reads "Saving…"; repeated submissions are ignored.

The payload uses the draft customer id, received date, due date and WASH service type, with quantity equal to the sum of positive counts. Order name, note and order description are null. Each positive-count line becomes one nested item with its count as quantity, English display name (Thai fallback, or the typed name for added lines) as description, and null price and special instructions. Its item id is the Items sheet row id matching its item code, preferring the first active match and otherwise using the first match. Added lines and lines with no matching Items row use null. PriceList rows still supply the count sheet display list but do not supply order-item ids. Zero and untouched lines are omitted.

The page starts loading the existing Items store on mount. Save awaits the store's own load promise before mapping ids; if loading fails, it keeps the draft and shows the error without creating an order.

After creation, each slip photo uploads in page order through `useOrderImageStore().captureImage`, using the created order id, DOCUMENT type, the original File and null quantity. Upload failures are read from the store's `uploadError` after each upload; they do not undo the order or stop later uploads.

Full success replaces the route with `order-detail` and the created order id, exactly as the normal new-order page does. The existing detail notice is specific to approval/ticket creation, so item-row or photo failures instead keep this page open with a footer notice containing the saved order id and an Open order link. Save remains disabled after creation to prevent duplicate orders. A create failure keeps the draft and shows the error in the footer, allowing retry.

Discard and the header close control leave the page like the other forms: back to the in-app origin, or to the order list on a fresh deep link. Discard is disabled during saving.

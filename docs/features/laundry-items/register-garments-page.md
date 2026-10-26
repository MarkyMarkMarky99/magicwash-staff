---
last_audited: 2026-10-24
audit_sources:
  - src/features/laundry-items/pages/LaundryItemRegisterPage.vue
  - src/features/laundry-items/routes.ts
  - src/features/laundry-items/composables/useLaundryItemRegisterGarments.ts
  - src/shared/composables/useGarmentPhotoUploads.ts
  - src/data/laundry-items/laundry-item.service.ts
---

# Register Garments page

Camera tag input uses the shared scan code reader: `MWG-<tagId>` and legacy bare IDs both work.
Prefixes match case-insensitively; saved tags contain only the case-sensitive eight-character ID.

## Purpose

Staff register a customer's garments (tag plus photo) into LaundryItems before any order exists. The page is a reduced copy of the [order intake form](../orders/order-intake-form.md): garments only, no order details. Plan: `docs/plans/laundry-item-registration.md`.

## Route

`/customers/:customerId/garments/register`, route name `laundry-item-register`, component `LaundryItemRegisterPage`, parent the customer detail page. The shared `laundryItemRegisterRoute` builder in `src/shared/navigation/form-routes.ts` builds the location. The page is on the `KeepAlive` exclude list in `src/App.vue`.

Staff open it from the customer detail Order History create menu: "Register Garments" is the last item.

## Layout

The intake page shell: green header, body overlapping the header by 16px with rounded top corners, and a footer with Discard and Save.

- Header: label "Customer garments", title "Register garments", the shared close button on dark, and a customer card with the name and the sub line (customer index and type). Nothing else.
- Items section: header "Items" with the subtitle "<n> garments" or "No garments yet". Its action area holds only the camera button; one tap opens the garment camera directly (no menu).
- Items paper (head Garment and Status): one row per captured garment, newest last. A row has a 48px thumbnail (opens the shared photo viewer with a Remove action), the tag in monospace, a remove icon button, and the upload state on the right: "Uploading…" with a spinner, "Uploaded", or "Failed" with a "Retry" button. The footer line reads "Total <n> pcs". The empty state reads "Scan a tag, then photograph the garment".

The camera and the photo viewer are route-owned overlays held in the `register` query value (`camera`, `view:<id>`), so Back closes them. A refresh drops the query because photos live only in page state.

## Capture and tag check

The camera is the shared `GarmentRegistrationCamera` in unassigned mode. Before a scanned tag is accepted:

- A tag already in this draft is rejected with "Tag already in this list".
- `getLaundryItem(tag)` (`GET /api/laundry-items/:tag`) looks the tag up. A 404 means not registered and the tag is accepted. A soft-deleted row (`deletedAt` set) counts as not registered.
- A live row for the same customer is rejected with "Already registered to this customer"; for another customer with "Tag belongs to another customer".
- Any other error is rejected with "Could not check the tag. Try again".

Every rejection plays the failure feedback and resets the camera. A tag plus a photo adds the garment to the draft and starts its upload at once.

## Uploads and delete

`useGarmentPhotoUploads` uploads each photo with `uploadLaundryPhoto` as soon as the garment is added and tracks `uploading`, `done` or `failed` per garment; Retry re-runs a failed upload. Removing a row removes it from the draft and deletes the Firebase file (when the upload is still running, the file is deleted when it finishes). Discard, the header close and leaving the page without saving delete every uploaded file. Delete failures are logged and ignored. Object-URL previews are released with the draft.

## Save

Save is disabled with no garments, while any upload is `uploading` or `failed`, and during the request (label "Saving…"). It validates `{ customerId, garments: [{ tag, imageUrl, itemId: null }] }` with `laundryItemRegisterRequestSchema` and calls `POST /api/laundry-items/register` through the data service. The service parses the response with `laundryItemRegisterResponseSchema` and invalidates `/api/laundry-items` caches.

Success shows "<n> registered", adding ", <m> already registered" and ", <f> photo rows failed" when their counts are nonzero. The draft is marked kept so its files are retained, including on remove, Discard, or leaving after a partial success. With no failed photo rows the page closes to the customer detail; otherwise it stays open for a retry. Retries skip existing garments and repair missing registration photo rows.

A 409 `TAG_CONFLICT` shows "Tag belongs to another customer: <tags>". Other errors show their message. Errors leave the draft open and re-enable Save. Discard and removal are ignored during saving, and route navigation is blocked until the response arrives, so files being registered cannot be deleted.

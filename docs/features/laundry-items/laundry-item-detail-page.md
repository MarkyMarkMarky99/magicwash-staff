# Garment detail

`/garments/:tagId` opens a registered garment with the normal app header and Back. The same
`LaundryItemDetailView` is used in a full-screen overlay on Order Intake, keeping its unsaved draft
in place. The layout follows `.user/item-detail-design/zone-5.html` using the app's theme tokens.
The standalone page is excluded from KeepAlive so an inactive copy cannot react to the Intake
view's photo or picker query, and returning to it reloads its garment.

`/garments/:tagId?order=<orderId>` opens the garment for one order. The page passes `order` to the
view as `orderId`; a blank value counts as absent. `LaundryItemDetailView` also takes `readonly`:
the Intake overlay sets it, which hides the Add photo action because the order does not exist yet.
Changing the garment type stays available there.

The registration photo fills a large rounded square with the WashQueue-style TAG sticker. The title
uses the Items catalog's English display name, falling back to its stored Thai name; the Thai name
also appears underneath. A missing type reads "Uncategorized" in the warning colour. The borderless
pencil opens the existing item picker. A selection patches the garment with `itemId` and the standard
`currentActor()` actor. The title changes after success; errors remain visible and can be retried by
selecting again. In Intake, success also updates that garment's draft item id and regroups the paper.

The two-column metadata card shows Customer, Registered, Wash program, Last seen, and a full-width
Note. Missing values use "–". Dates show `d MMM yyyy HH:mm` in Bangkok. Last seen is the latest start
or completion timestamp among this garment's live tickets across every order.

Order history joins live order-garment links to the customer's orders, newest received date first.
Rows show the received date and English service label, without order ids. Only the newest unfinished
order has a lime place stamp: the In Progress department plus "now", otherwise the first Pending
department plus "next". Completed, cancelled and delivered orders have no stamp. One accordion row
opens at a time. An empty history reads "Not in any order yet".

With `order`, the history section is titled "This order" and lists only that order's row. If the
garment has no live order-garment link to that order, an InlineNotice reads "This garment is not in
this order" in place of the list, and the Add photo action is hidden. A linked order that the
customer's orders do not include reads "Order not found".

Photos with an empty order id, other than Registration, are shared garment history. When any exist,
a "Garment history" card sits above the order history in both modes: a three-column grid, newest
first, each tile labelled with its capitalised type, opening the shared PhotoViewer.

Each expanded panel starts with that order's defect thumbnails, then the garment's tickets sorted by
step number. Completed dots are dark green, In Progress dots are lime with a ring, and future dots
are hollow. Started and completed events display their own timestamp and staff member; Pending
steps read "Not started yet". Cancelled tickets are labelled as cancelled. Deleted records are ignored.

The header, right of the title, copies the corporate count sheet's photo controls
(`LaundryItemPhotoControls`). On the left sits a stack of up to three tilted paper thumbnails of the
photos the album shows for the current mode, newest on top, with a badge holding the photo count; it is
hidden when there are no photos. Photos captured in the current visit appear in it at once, above the
saved ones. Tapping it opens the album. On the right a lime `StickerFab` (`size="sm"`, label "Add",
aria-label "Add photo", glyph `add_a_photo`) opens the type menu; it is hidden when adding is not
allowed (`readonly`, or `order` with the garment not in that order), and the stack stays. While a photo
uploads or saves it shows the saving state ("Saving").

The album is a route-owned `DetailOverlay` titled "Photos · N" (`garmentDetail=album`). Registration,
Defects, Before and After sections appear only when nonempty, with a three-column square grid.
The registration image is included even when it has no separate photo row, without adding it again
when its URL already appears in Registration. Other tiles carry their order's received-date chip,
or "–" if the order date is unavailable. All thumbnails open the shared PhotoViewer. With `order`
the album holds only Registration, shared history and that order's photos; without it, every photo.

Add opens `LaundryItemPhotoTypeMenu`, a dropdown anchored under the button with the look and behavior of
the Intake capture menu (tap outside or Escape closes). A line above the items reads "Saves to: This
order" with `order`, otherwise "Saves to: Garment history". The items come from the contract enum minus
`REGISTRATION` (Defect, Before, After today; a new value appears by itself), each with an icon
(`report`, `photo_camera_back`, `photo_camera_front`, otherwise `photo_camera`) and a hint ("Damage or
stain", "As received", "After cleaning", none for other types).

Picking a type opens the camera directly, route-owned as `garmentDetail=camera:<TYPE>` (for example
`camera:DEFECT`), so Back closes it. `CameraOverlay` has no title. Each Add takes exactly one photo:
the first capture closes the camera at once, as the Intake document capture does. The capture starts a
Firebase upload through `useGarmentPhotoUploads` and shows at the front of the header stack with the
shared `UploadStateOverlay` (spinner while uploading, error glyph when failed). The state lives in
`useLaundryItemPhotoCapture`. Each photo is independent: another Add can be opened while earlier photos
upload or save.

When the upload is done the photo is saved with one create call (`POST /api/laundry-item-photos`:
`photoType` the chosen type, `orderId` from the URL or null, no note), then the page's photos reload and
the local capture is dropped without deleting its file. Failures show an `InlineNotice` under the header
with a Retry button and a dismiss control, per photo:
- Upload failed: warning "Photo did not upload." Retry re-runs the upload and then saves. Dismiss drops it.
- Save failed: error with the server message. Retry resends the same request. The uploaded file is kept
  while a retry is possible and deleted only on Dismiss.

Leaving the page with unsaved photos deletes their files, except photos whose save is in flight. The server rejects an `orderId` the garment is not linked to (400 "Garment is not in this
order") and any `REGISTRATION` photo. Notes are not part of this flow.

The album, type picker, camera and viewer use the `garmentDetail` query (`album`, `type`,
`camera:<TYPE>`, `photo:<id>`); `order` is never removed by closing them.
Opening pushes a history entry; swiping photos replaces it. Close uses Back only for entries opened
by this view; a refreshed deep link removes its query with replace. Intake uses `intake=item:<tag>`
for the outer overlay and pushes it over the row sheet. Back restores the row sheet; if changing type
emptied the old row, it shows the changed garment's new row. Refreshing an Intake garment deep link
can reload the garment, but cannot restore the page-only draft.

The loading composable starts the garment, links, photos, tickets and catalog reads in parallel.
Customer orders start as soon as the garment's customer is known. Ticket reads go through the
JobTickets store. A loading message precedes the view, and load failures or missing/deleted garments
show an error with Retry. The link, photo and garment ticket requests use the brief's 1,000-row limit;
customer orders use the existing customer-order service.

Pure derivations are covered by `tests/web/unit/features/laundry-items/utils/laundry-item-detail.dry-test.ts`.

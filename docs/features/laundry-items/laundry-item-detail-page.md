# Garment detail

`/garments/:tagId` opens a registered garment with the normal app header and Back. The same
`LaundryItemDetailView` is used in a full-screen overlay on Order Intake, keeping its unsaved draft
in place. The layout follows `.user/item-detail-design/zone-5.html` using the app's theme tokens.
The standalone page is excluded from KeepAlive so an inactive copy cannot react to the Intake
view's photo or picker query, and returning to it reloads its garment.

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

Each expanded panel starts with that order's defect thumbnails, then the garment's tickets sorted by
step number. Completed dots are dark green, In Progress dots are lime with a ring, and future dots
are hollow. Started and completed events display their own timestamp and staff member; Pending
steps read "Not started yet". Cancelled tickets are labelled as cancelled. Deleted records are ignored.

The lime photo sticker opens a route-owned `DetailOverlay` titled "Photos · N". Registration,
Defects, Before and After sections appear only when nonempty, with a three-column square grid.
The registration image is included even when it has no separate photo row, without adding it again
when its URL already appears in Registration. Other tiles carry their order's received-date chip,
or "–" if the order date is unavailable. All thumbnails open the shared PhotoViewer.

The album, type picker and viewer use the `garmentDetail` query (`album`, `type`, `photo:<id>`).
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

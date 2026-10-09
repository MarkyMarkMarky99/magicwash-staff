# Packaging workflow

Packaging staff put each order's garments into bags (packages) so the order is ready for delivery.

## Flow

1. Staff open an order from the Packaging department page. This opens the same order scan page that
   the Logistics department uses: an order summary card on top and the order's bag list below.
2. An order that has no bag yet shows an empty bag list.
3. Below the bag list sits a dashed **Add bag** card. Tapping it adds a new bag to the list.
   Creating a bag needs no garment count and no weight. The card disappears once every garment of
   the order is assigned to a bag (confirmed or new), and returns if a garment is unassigned again.
4. Garments are assigned to a bag later. Staff tap a bag in the list to open a bottom sheet for that
   bag.
5. In the bottom sheet, staff add garments to the bag by tapping a garment's image or by scanning
   its tag. This is the same pick-by-image-or-scan mechanism the garment department pages
   (Washing, Ironing) use; Packaging reuses it rather than building a second one.
6. Creating bags and assigning garments stay on the device. No request reaches the backend until
   staff press **Confirm**.
7. On this page, the Logistics page's Scan button is replaced by a **Confirm** button.
8. Confirm sends one request for the whole order. It creates every new bag (one OrderImages row per
   bag, which needs a bag photo), its BagItems rows, and its Logistics ticket.
9. After the Logistics tickets are created successfully, the tags for all of the order's new bags
   print together. Staff stick each tag on its bag.

10. Each bag row shows its photo at the right edge, as on the Logistics page. A bag without a photo
    shows a dashed frame there; staff tap the frame to photograph the bag. The photo is the packed
    bag, matching the WEIGHT rule that a bag photo is taken after packing.

## Agreements

- BagItems is written by the Packaging department only.
- Confirm is enabled only when there is at least one new bag and every new bag has its photo.
- A new bag with no garments blocks Confirm. The page warns staff to delete that bag, because each
  bag prints a tag and an empty bag would print an extra one. Staff can delete a new bag before
  Confirm.
- Partial packing is allowed: staff can confirm bags before every garment of the order is bagged,
  because a customer may collect some garments early or the shop may deliver the rest later. Staff
  return to the same order later to pack the remaining garments in new bags.
- A confirmed bag is locked: its tag is printed, so garments cannot be added to it, removed from
  it, or moved to another bag. BagItems stays append-only. Garments already in a confirmed bag are
  not offered for selection again.
- Confirm also completes the Packaging ITEM ticket of every garment put into a bag, so the staff
  member earns the Packaging score for those garments.
- A garment whose earlier department work is not finished is shown in the bag bottom sheet but
  cannot be selected or scanned in. It shows which department it is still waiting on.
- Unconfirmed bags (with their photos and selected garments) are kept on the device. If staff
  leave the page before Confirm, the bags are still there when they return, because a bag photo is
  hard to retake once the bag is closed.
- One Confirm = one request per order; bag creation, garment assignment, and tag printing are
  committed together, never one bag or one garment at a time.
- A bag is identified by its OrderImages row (`orderImageId`).
- The Packaging order page reuses the Logistics order scan page layout. The bag bottom sheet reuses
  the shared-layout bottom sheet, restyled to match this page.
- The bag-tag print request gains an item-count field (number of garments in the bag). Weighed
  folded bags will also send it later, once they are linked to BagItems.
- `weightKg` in the bag-tag print request becomes optional (null when the bag was not weighed).
- `weighedAt` is renamed to `packedAt` (when the bag was packed), because not every bag is weighed.
  For a weighed bag, `packedAt` is the weigh time.
- Every bag tag references its bag's BagItems: the tag's QR/barcode carries the bag's
  `orderImageId`, which is the bag key in BagItems.
- webapp-vue only sends the data; how the count appears on the tag is decided in the printer
  project (C:\MagicwashInvoice), and both sides change the request contract together.
- Create-bag is separate work from the WEIGHT photo. The existing WEIGHT save flow is not changed
  by this feature; how the two relate is decided later.

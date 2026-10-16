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
   its tag with the camera or a barcode gun. This is the same pick-by-image-or-scan mechanism the
   garment department pages (Washing, Ironing) use; Packaging reuses it rather than building a
   second one. Garments are labelled by item name, never by tag code.
6. Creating bags and assigning garments stay on the device. No request reaches the backend until
   staff press **Confirm**.
7. On this page, the Logistics page's Scan button is replaced by a **Confirm** button.
8. Confirm sends one request for the whole order. It creates every new bag (one OrderImages `WEIGHT` row
   per bag, which needs a bag photo and the weight of the bag in kg), its BagItems rows, and its
   Logistics ticket.
9. After the Logistics tickets are created successfully, the tags for all of the order's new bags
   print together. Staff stick each tag on its bag.

10. Each bag row shows its photo at the right edge, as on the Logistics page. A bag without a photo
    shows a dashed frame there; staff tap the frame to photograph the bag. The photo is the packed
    bag, matching the WEIGHT rule that a bag photo is taken after packing.
11. The bag bottom sheet opens with a photo section above the garment grid, the same passive
    `PhotoCapturePanel` the wash-queue booking sheet uses: a 200 px dashed "No photo yet" frame
    (hint "Weigh the bag, then tap Photo.") that shows the photo of the bag once taken. Below it sits
    the shared `WeightField` with a Photo/Retake sticker in its action slot, as in the wash-queue
    booking sheet. The sticker is disabled until the weight is valid (the WEIGHT rule: greater than 0,
    at most 200 kg, one decimal place) and is the only photo action; it opens the camera
    (`?photo=<bagId>`, pushed on top of `?bag=`), so closing the camera returns to the open sheet. A
    new bag can be retaken any number of times; a failed upload keeps the previous photo. Confirmed
    bags are not shown in the sheet and cannot be retaken.
12. A new bag row shows its weight after the status (for example "Ready to confirm · 2.5 kg") and
    says "Add bag weight" until it is valid. The photo frame of the row is a button only once the
    weight is valid. Confirmed bags show no weight on the row.

## Agreements

- BagItems is written by the Packaging department only.
- Confirm is enabled only when there is at least one new bag and every new bag has garments, its photo,
  and a valid weight. The typed weight is kept with the bag in the device draft; a draft saved before
  weights existed restores with an empty weight.
- A new bag with no garments blocks Confirm. Its row says “Empty · delete or add garments”, because
  each bag prints a tag and an empty bag would print an extra one. Staff can delete a new bag before
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
- A bag photo is uploaded to storage as soon as it is taken. The device keeps only the photo URL
  with the unconfirmed bag, and Confirm sends those URLs in the order request. No sheet row is
  written before Confirm. A photo of a bag deleted before Confirm is left in storage.
- Confirm is safe to retry. Every row and ticket uses a deterministic id, so a retry after a
  partial failure skips what already exists and writes only what is missing. Tags print only after
  every write succeeds. Nothing is rolled back.
- The Packaging order page reuses the Logistics order scan page layout. The bag bottom sheet reuses
  the shared-layout bottom sheet, restyled to match this page.
- The bag-tag print request gains an item-count field (number of garments in the bag). Packaging bags
  send it together with the weight of the bag; weighed folded bags will also send it later, once they
  are linked to BagItems.
- `weightKg` in the bag-tag print request is optional (null when the bag was not weighed).
- `weighedAt` is renamed to `packedAt` (when the bag was packed), because not every bag is weighed.
  For a weighed bag, `packedAt` is the weigh time.
- Every bag tag references its bag's BagItems: the tag's QR/barcode carries the bag's
  `orderImageId`, which is the bag key in BagItems.
- webapp-vue only sends the data; how the count appears on the tag is decided in the printer
  project (C:\MagicwashInvoice), and both sides change the request contract together.
- A packaging bag is recorded exactly like the order-detail weight photo: an OrderImages `WEIGHT` row
  with the photo in `image_path` and the bag kg in `quantity`, plus the same weight-photo ticket and
  score, LOG-BAG ticket and tag print, each once per bag (see [Confirm contract](./confirm.md)). The
  order-detail save flow itself is unchanged. `BAG` rows written by earlier confirmations stay in the
  sheet and are still shown as bags.

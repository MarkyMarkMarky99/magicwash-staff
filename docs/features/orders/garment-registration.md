# Garment registration

The order detail item menu opens the before-photo registration overlay with
`?orderAction=register-garment&registerItem=<orderItemId>`. The order ID comes from
`/orders/:orderId`. The item row itself still opens that item's before-photo gallery.
The overlay follows the order detail query navigation: opening pushes a history entry,
Back closes it, and a refreshed deep link closes by replacing the overlay query.

The registration camera owns one rear-camera stream. The shared scanner engine reads full
frames for QR Code and Code 128 whenever the tag is missing, regardless of the selected mode.
It uses native BarcodeDetector when QR Code is supported, otherwise the lazily loaded
barcode-detector ponyfill with a self-hosted ZXing-C++ WASM asset. The shutter
draws a live video frame to canvas and encodes a JPEG in either mode; another press
replaces the unsaved photo. The capture flashes and flies into a bottom-left thumbnail,
which shows the last capture after auto-save until the next photo. The thumbnail has no
navigation action. Staff can complete the tag and photo in either order. The
scan/photo toggle is centred in the top header. It starts in photo mode and returns
there after each saved garment. A photo without a tag switches to scan mode; a tag
without a photo switches to photo mode. Scan mode shows a square of lime corner
brackets with a thin centre line.
The centred tag box above the shutter is an editable text input. Enter or the keyboard
Done key submits its value through the same acceptance path as a scan, and clearing it
allows another tag to be scanned. A scan fills the input. Tags are eight-character base62
codes using `0-9`, `A-Z`, and `a-z`, generated with the shared ID helper and validated by
the tag-print contract. The screen has no album picker. After-photos remain in the gallery.

The page starts loading all LaundryPhotos tag IDs alongside the other order data, before
the registration overlay opens. The camera stays usable while that request runs. A tag
scanned or entered early remains in the tag box with a small spinner; the page checks it
against the loaded `itemId` values and tags registered or uploading in this session as
soon as loading finishes. A failed load leaves the tag in place with a retry control.
The first tag page shares the gallery's cached order-photo request. Fresh cache updates
merge new tag IDs into the current set and check a pending tag again; later pages use
their own requests. Tag loading does not clear the photo response cache.
Auto-save waits until duplicate checking succeeds.
A duplicate rejects the tag and discards any unsaved photo. The page saves automatically
as soon as a valid, nonduplicate tag and one photo are present. The scanned or typed tag
becomes `LaundryPhotos.itemId`;
the order row's `OrderItem.itemId` is never used as that payload field.
Invalid-format and duplicate-tag warnings disappear three seconds after their latest occurrence.

Saving reserves the tag and resets the current garment immediately. In the background, the camera
JPEG uploads to Firebase Storage's `images` folder, then the existing LaundryPhotos create
API receives `orderId`, `orderItemId`, `itemId`, `createdBy`, and `imageUrl`. The actor is
resolved with `currentActor` from the optional `by` query, matching the gallery upload.
The registered count increases only after the create request succeeds. A failure releases
the tag for retry and shows a dismissible error naming it. The close button remains disabled
while any upload is pending; the header shows the pending count.

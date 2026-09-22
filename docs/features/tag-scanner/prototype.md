# Tag scanner prototype

The Preview prototype route is `/#/tag-scanner`.

It opens the rear camera and continuously reads the two formats used for tag evaluation:

- QR Code
- Code 128

The page keeps a session list, ignores a repeated value until the list is cleared, and gives sound
and vibration feedback when the browser allows it. It displays the raw code only. Linking a scanned
tag to an order remains a separate workflow. The operational tagging flow persists the physical
tag as `LaundryPhotos.item_id` when staff photograph the garment; job-ticket scanning uses that
stored value as `laundryItemId`.

Camera access requires HTTPS or localhost and user permission. The Vercel Preview deployment uses
HTTPS.

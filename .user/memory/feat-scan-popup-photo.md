# feat/scan-popup-photo

- Status: popup + scan-to-top owner-tested on `vercel dev` 2026-10-17; packaging bag changes committed but NOT tested in a browser yet.
- Design source: `.user/prototypes/scan-confirm-prototype.html` (popup) and `check-mark-variants.html` (variant E chosen).
- Popup shows photo, customer name, customer index; never order id or tag (unreadable to staff).
- Scan-to-top: gun reads only; tap never reorders; resets on clear/deselect/tab/send.
- Packaging bag page: banners removed, gun scan in open bag sheet (shared useScanNotice/ScanNotice), item names via LaundryPhotos + work-order store join (+2 requests per order).
- Not done: camera overlay keeps old text card; photo not dimmed for "Not in this tab"/multi-task as the prototype did.
- Next: owner tests Packaging bag sheet with a gun on vercel dev, then merge to main and check on prod.

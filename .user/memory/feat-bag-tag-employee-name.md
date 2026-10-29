# feat/bag-tag-employee-name

- Backend only: bag-tag print request now carries `employeeName` (resolved from `createdBy` via StaffService) and caps `itemCount` at 999.
- `BagTagPrintService.print(image, { itemCount })` is ready; the order-images hook still passes no count.
- Open: owner and Claude to design how Order Detail sends a garment count with the WEIGHT photo (frontend + order-images API).
- Deploy order: print server must run C:\MagicwashInvoice `8e41fa4`+ before this ships, or employeeName is unknown to it.
- Not done: real print test of the new Block A tag with a live employee name.
- Layout prototypes: `.user/bag-tag-layout/` (v8 approved; real renders in `real-render/`).

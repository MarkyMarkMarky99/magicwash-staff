# feat/bag-tag-employee-name

- Bag-tag print request carries `employeeName` (cached staff list via `findStaffById`) and an optional `itemCount`.
- Order Detail weight prompt has an optional Count field; the count is printed only, never saved to OrderImages.
- Not done: browser check of the weight prompt Count field (login blocked the local check).
- Not done: real print test of the Block A tag with weight + count + employee name.
- Deploy order: print server must run C:\MagicwashInvoice `8e41fa4`+ before this ships.
- Layout prototypes: `.user/bag-tag-layout/` (v8 approved; real renders in `real-render/`).

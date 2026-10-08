# Bag item — API contract

The staff-authenticated `bag-items` module uses the append-only `BagItems` sheet in
`ORDERS_SPREADSHEET_ID`, the same workbook as `OrderImages`.

`bagId` references an `OrderImages.id` for a WEIGHT or PACK bag. `orderId` references
`OrderForm.id` and must equal that bag's order. `laundryItemId` is the garment tag shared
by `LaundryPhotos.item_id` and `JobTickets.laundry_item_id`; garment identity is the
order and garment tag pair. The API accepts these references without cross-sheet lookup.
Moving garments between bags is outside this contract.

## GET /api/bag-items

At least one trimmed nonempty `bagId` or `orderId` is required; missing both returns 422.
When both are supplied, both equality filters apply. `keyword` defaults to an empty string
and searches bag item, bag, order, and garment ids. `page` defaults to 1; `perPage` defaults
to 500 and is capped at 500. `sortBy` is `createdAt`; `sortOrder` defaults to `asc`
and also accepts `desc`.

The 200 response uses the shared paginated envelope. Each row contains six strings:
`bagItemId`, `bagId`, `orderId`, `laundryItemId`, `createdAt`, and `createdBy`.

## POST /api/bag-items

The request contains `bagId`, `orderId`, `laundryItemId`, and `createdBy`, all trimmed
nonempty strings. Unknown fields, including client-owned ids or timestamps, return 422.
The server generates `bagItemId` with `generateShortId()` and repository append audit
stamps `createdAt` as `yyyy-MM-dd HH:mm:ss` in Asia/Bangkok. `createdBy` is the packer's StaffId.

The 201 response uses the shared success envelope with the same six fields. If the
bag and garment tag pair already exists, it returns that original row without writing,
preserving the original order, actor, id, and timestamp. The check does not make concurrent
requests atomic; Sheets has no unique-pair constraint.

There is no item route, PATCH, or DELETE. Unsupported collection methods return 405.

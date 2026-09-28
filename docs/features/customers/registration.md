# Customer registration

Staff register a new customer from `/customers/new`. The server assigns the customer ID and a free three-letter label. Staff never choose the label.

## Rules

- `CustomerID` is a new `generateShortId()` value, created before any write.
- `CustomerIndex` is a random free `CustomerLabel` from `CustomerIDMapping`.
- Phones compare by digits only: `081-234-5678` equals `0812345678`. A phone already used by a live customer blocks the create.
- Create and update phone values on the wire are exactly 10 digits with no separators. The create form shows 3-3-4 dashes for display only.
- The shared API error schema permits only standard codes, so a duplicate phone uses HTTP 409 with `CONFLICT` as the envelope code and `duplicate_phone` as the message and `details.code`. The form recognizes that specific message and shows the error beside the phone field.
- `Timestamp` and `RegisteredDate` use the project standard: `yyyy-MM-dd HH:mm:ss` and `yyyy-MM-dd`, Asia/Bangkok.
- No LINE notification. No Apps Script.

## Flow

`POST /api/customers` runs a dedicated registration service instead of the generic CRUD create.

1. Generate the new `CustomerID`.
2. Read Customers. If a live row has the same phone digits, return the duplicate-phone 409 described above.
3. Read CustomerIDMapping through its repository, filter rows with a blank `CustomerID` in memory, and pick one at random. The shared GViz query builder cannot express the blank filter.
4. Reserve it: update that mapping row's `CustomerID` to the new ID.
5. Append the Customers row with the new ID and the reserved label.
6. If step 5 fails and `classifySheetWriteFailure` reports `rejected`, update the mapping row's `CustomerID` to `''` to release the label, then return the error. If it reports `unknown`, keep the label assigned and return the error: the customer row may have landed.
7. Return the created customer, including `customerIndex`.

Random choice from ~17,000 free labels makes two concurrent registrations picking the same label unlikely. The reservation does not fully prevent it: two requests can still pick and write the same row. Accepted risk.

## Sheet capabilities

- Customers: `append: true`, `update: false`, `delete: false`.
- CustomerIDMapping: `update: true` only.

## Frontend

- `CustomerCreatePage.vue` posts the form; submit stays disabled while the payload fails `customerCreateSchema` or a save is in flight.
- The form has no registration date field; the server sets `RegisteredDate` to today (Bangkok).
- The form has no location field until a map picker exists; the API still accepts `location`.
- On 409 `duplicate_phone`, show the error on the phone field.
- On success, add the customer to the customer store and open the customer's detail page.

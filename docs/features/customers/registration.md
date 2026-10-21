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

## Price group contract

Customers column U is `PriceGroup`, after column T `DeletedAt`, and maps to API `priceGroup`.
List, detail, create, and update responses include it as a nullable string. Create
payloads accept an optional nullable string with unrestricted text; PATCH does not accept `priceGroup`.
Registration defaults an omitted or null value to null and preserves an empty string; DEFAULT pricing
behavior is deferred.

## Sheet capabilities

- Customers: `append: true`, `update: true`, `delete: false`.
- CustomerIDMapping: `update: true` only.

## Frontend

- `CustomerFormPage.vue` serves create and edit using `CustomerForm.vue`; create posts the form; submit stays disabled while the payload fails `customerCreateSchema` or a save is in flight.
- Agent customer drafts can open create with a one-use in-memory prefill from `src/shared/navigation/customer-create-prefill.ts`. On mount, create mode takes and clears it, then fills only matching empty fields; edit mode does not consume it. `CustomerFormPage` is excluded from KeepAlive. No customer data is put in URLs or history state, and a reload loses the prefill. All eight hand-off fields exist in form state, including WhatsApp; customer type stays hidden in create mode and the existing create payload still omits it. Staff review and save with the form's own validation and save button.
- The form has no registration date field; the server sets `RegisteredDate` to today (Bangkok).
- The form has no location field until a map picker exists; the API still accepts `location`.
- On 409 `duplicate_phone`, show the error on the phone field.
- On success, add the customer to the customer store and open the customer's detail page.

## Admin editing

Only staff whose resolved role is `admin` may PATCH `/api/customers/:id`. Other roles receive
403 before any sheet access. GET and POST keep their existing behavior.

The editable fields are `customerName`, `phone`, `address`, `facebook`, `lineId`, `whatsapp`,
`email`, and `customerType`. Customer type is edit-only in the form, with `Member`, `Regular`, and
`Corporate` options. A null type starts blank; selecting a type includes it only when changed.
Create still omits `customerType` from its form payload. PATCH reuses each field's create validation,
makes each optional, and requires at least one supplied editable field. Phone cannot be null.
Unknown fields, including IDs, metadata, location, source, and price group, are rejected.
The server replaces `updatedBy` with the signed-in StaffId and fills `UpdatedAt`; only supplied
fields and these audit columns are written. Editing uses the generated CRUD update handler with
a customers-module phone check. When PATCH supplies `phone`, the server compares digits against
other live customers, excluding the same `CustomerID`. A duplicate returns the same 409
`duplicate_phone` error as registration before any write; the edit form shows it beside the phone
field. Keeping the customer's own phone is allowed. PATCH without `phone` skips this check.

The customer detail card shows Edit only to admins. It pushes `/customers/:customerId/edit`,
which opens the same routed FormOverlay as create and prefills the eight inputs from the loaded
customer. Non-admin deep links redirect to `/` after auth readiness. Save stays disabled while
loading, saving, invalid, or unchanged; edit submits only changed fields. The existing input bindings
and phone display formatting are preserved. Close uses route history when available; the fallback
for edit is that customer's detail page, while create keeps the customer list fallback. After a
successful edit, go back when a history back entry exists; otherwise replace the edit route with
that customer's detail page. This avoids adding a second detail entry. Successful create keeps
replacing the form route with the new customer's detail page.

`createCustomer` and `updateCustomer` invalidate the `/api/customers` response cache after success.
The customer store's invalidation listener reloads the list, and the saved response is immediately
added to the store. The saved response also refreshes the cached customer detail record.

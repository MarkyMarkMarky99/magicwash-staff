# Invoices read API — example payloads

Companion to `invoice-view-api.schema.ts`. Plain example data, not code —
nothing here is imported by the app. Numbers are self-consistent
(subtotal → adjustmentTotal → grandTotal → paidAmount → balanceDue all add up)
so you can sanity-check the shape without cross-referencing the schema.

## What `.nullable()` actually controls here

Marking a field `.nullable()` in the schema is a **type-level note for
TypeScript only** — it does NOT gate whether the object is returned. This
codebase never runs `schema.parse()` on data read from a sheet (confirmed:
no `.parse` call anywhere in `gsheet.repository.ts`, and
`BaseCrudService.project()` just copies `Object.keys(schema.shape)` off the
raw row, whatever those values happen to be). So:

- An incomplete/dirty row never blocks the whole response. If one column is
  genuinely empty, only THAT field comes back empty/`undefined` — every
  other field in the same object is unaffected.
- A field left WITHOUT `.nullable()` (e.g. `issuedDate`) is a claim "this
  column is always populated for a real InvoicesView row," taken from what
  `InvoiceView.json`'s own `required` list declares — not a runtime
  guarantee this schema enforces. If the live sheet ever has a row missing
  that value, the API would silently hand the frontend `undefined` where
  TypeScript promises `string`, with no error anywhere.
- Fields ARE marked `.nullable()` when the live JSON Schema itself types the
  column as `["string", "null"]` (e.g. `billingPeriodStart/End`) — that's a
  real, expected empty state, not dirty data.

If you'd rather every field defend against dirty data by being nullable
regardless of what the live schema declares, say so — that's a one-line
change per field, just a different default posture than "trust the declared
schema."

---

## 1. List query — `GET /api/invoices?...`

```
GET /api/invoices?keyword=&customerId=CUS-88291&status=PARTIALLY_PAID&dateFrom=2026-07-01&dateTo=2026-07-31&page=1&perPage=20&sortBy=issuedDate&sortOrder=desc
```

Every param is optional except `page`/`perPage`/`sortBy`/`sortOrder`, which
default (`page=1`, `perPage=20`, `sortBy=issuedDate`, `sortOrder=desc`) if
omitted.

## 2. List response — body of the same request

```json
{
  "success": true,
  "data": [
    {
      "invoiceNumber": "INV-2026-0034",
      "status": "PARTIALLY_PAID",
      "billingType": "ORDER",
      "billingPeriodStart": null,
      "billingPeriodEnd": null,
      "issuedDate": "2026-07-15",
      "dueDate": "2026-07-29",
      "customerId": "CUS-88291",
      "customer": {
        "customerCode": "CUS-88291",
        "customerName": "บริษัท ตัวอย่าง จำกัด",
        "phone": "081-234-5678",
        "address": "99 ถนนสุขุมวิท กรุงเทพมหานคร 10110"
      },
      "subtotal": 1240,
      "adjustmentTotal": 50,
      "adjustments": [
        { "label": "ค่าขนส่ง", "calculation": "FIXED", "value": 50 }
      ],
      "grandTotal": 1290,
      "paidAmount": 500,
      "balanceDue": 790
    },
    {
      "invoiceNumber": "INV-2026-0033",
      "status": "PAID",
      "billingType": "ORDER",
      "billingPeriodStart": null,
      "billingPeriodEnd": null,
      "issuedDate": "2026-07-10",
      "dueDate": "2026-07-24",
      "customerId": "CUS-88291",
      "customer": {
        "customerCode": "CUS-88291",
        "customerName": "บริษัท ตัวอย่าง จำกัด",
        "phone": "081-234-5678",
        "address": "99 ถนนสุขุมวิท กรุงเทพมหานคร 10110"
      },
      "subtotal": 700,
      "adjustmentTotal": 0,
      "adjustments": [],
      "grandTotal": 700,
      "paidAmount": 700,
      "balanceDue": 0
    }
  ],
  "meta": {
    "timestamp": "2026-08-01T09:00:00.000Z",
    "pagination": { "page": 1, "perPage": 20 }
  }
}
```

Note: no `total`/`totalPages` in `meta.pagination` — this codebase's list
envelope is page-only (no full count), same as every other module on the new
`BaseCrudService` path (appointments, customers).

## 3. Detail query — `GET /api/invoices/:invoiceNumber`

```
GET /api/invoices/INV-2026-0034
```

## 4. Detail response — body of the same request

```json
{
  "success": true,
  "data": {
    "invoiceNumber": "INV-2026-0034",
    "status": "PARTIALLY_PAID",
    "issuedDate": "2026-07-15",
    "dueDate": "2026-07-29",
    "customerId": "CUS-88291",
    "customer": {
      "customerCode": "CUS-88291",
      "customerName": "บริษัท ตัวอย่าง จำกัด",
      "phone": "081-234-5678",
      "address": "99 ถนนสุขุมวิท กรุงเทพมหานคร 10110"
    },
    "grandTotal": 1290,
    "paidAmount": 500,
    "balanceDue": 790,
    "billingType": "ORDER",
    "billingPeriodStart": null,
    "billingPeriodEnd": null,
    "subtotal": 1240,
    "adjustmentTotal": 50,
    "adjustments": [
      { "label": "ค่าขนส่ง", "calculation": "FIXED", "value": 50 }
    ],
    "items": [
      {
        "description": "ผ้าปูที่นอน",
        "unit": "ผืน",
        "quantity": 20,
        "unitPrice": 35,
        "subtotal": 700,
        "adjustments": [],
        "netTotal": 700
      },
      {
        "description": "ผ้าห่ม",
        "unit": "ผืน",
        "quantity": 5,
        "unitPrice": 120,
        "subtotal": 600,
        "adjustments": [
          { "label": "ส่วนลดผ้าห่ม", "calculation": "PERCENT", "value": -10 }
        ],
        "netTotal": 540
      }
    ],
    "payments": [
      {
        "paymentId": "PAY-2026-0050",
        "amount": 500,
        "method": "QR_PROMPTPAY",
        "status": "VERIFIED",
        "paidAt": "2026-07-20T10:30:00+07:00",
        "reference": "BANK-REF-050",
        "proofUrl": "https://example.com/payment-proof.jpg",
        "notes": null
      }
    ]
  },
  "meta": { "timestamp": "2026-08-01T09:05:00.000Z" }
}
```

⚠️ The `payments[]` shape here is inferred, not observed: `InvoiceView.json`'s
only example has an empty payments array, so the fields come from `Payment.json`
translated to camelCase. Treat it as unconfirmed until a real populated row is
seen. Everything else on this page is grounded in `InvoiceView.json` /
`Payment.json`.

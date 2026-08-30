# Order list screen — spec

**Route:** `/orders` · **Page:** `OrderListPage.vue` · **Row:** `OrderRow.vue`
**Status:** spec — the shipped screen does not match this yet. See "Gaps".
**Written:** 2026-08-31

## Scope

This document specifies the **staff-facing order list row** (`OrderRow.vue`) only.

Do not confuse it with `src/features/customers/components/OrderCard.vue`, a separate card
in the customers feature with a different layout (received date as the title, an avatar
icon). That component is **not** covered here.

## What a row shows

| Position | Field | Format |
|---|---|---|
| Title | `orderNumber`, falling back to `orderId` | bold, truncated |
| Badge, top right | `status` | **Thai label** — never the raw enum |
| Subtitle | `customerName`, falling back to `customerId` when the name is blank | plain text |
| Bottom left | `receivedDate` → `dueDate` | `DD Mon YYYY`, joined by `→`, `—` when absent |
| Bottom right | `serviceType` | small chip, `—` when null |
| **New** | `quantity` | `N ชิ้น` — hidden when null |
| **New** | `invoiceNumber` | badge indicating the order has been invoiced — hidden when null |

**Not shown:** `note`. It stays in the list DTO for other consumers, but it is free text
and too long for a row.

`customerName` is a non-nullable `z.string()` that the backend fills with `''` when the
customer cannot be resolved, so the fallback must be a truthy/trim check, never `??`.

## Status labels

| API value | Label |
|---|---|
| `PENDING` | รอดำเนินการ |
| `RECEIVED` | รับผ้าแล้ว |
| `COMPLETED` | เสร็จแล้ว |
| anything else | show the raw value — do not guess |

Required by `docs/design/patterns/list-pages.md:38` — "staff-facing status labels … never
raw API enum values".

**Open point — the map is duplicated.** These three labels currently live in the tab
definitions at `OrderListPage.vue:19-21`, while
`src/features/customers/components/OrderCard.vue:43` maintains a separate
`STATUS_PRESENTATION` map doing the same job. Decide whether to unify them or accept the
duplication before implementing.

## Controls

- **Search** — one keyword across `orderId`, `orderNumber`, `customerId`, `invoiceNumber`.
  See `search-fields.md`.
- **Status tabs** — ทั้งหมด / รอดำเนินการ / รับผ้าแล้ว / เสร็จแล้ว.
- **Sort** — fixed: `receivedDate` descending. Not user-configurable.
- **Absent** — no date-range filter (the query layer has no range support) and no page
  controls.

All control state lives in the query string. Changing the keyword or the tab resets
`page` to 1.

## Screen states

| State | Shows |
|---|---|
| Loading | five skeleton rows |
| Error | the API message, falling back to "Unable to load work orders" |
| Empty | "ไม่พบออเดอร์ที่ตรงกับเงื่อนไข" |

## Gaps — the shipped screen differs from this spec

1. The status badge renders the raw enum (`PENDING`), violating the list-pages rule.
2. `quantity` and `invoiceNumber` are fetched but not rendered.
3. Search does nothing — `searchFields: []`. See `search-fields.md`.
4. The footer prints "หน้า N" with no controls. **Undecided** — see
   `list-response-fields.md`.

## Unconfirmed

Three presentation choices in this document were proposed, not specified by the product
owner, and should be confirmed before implementation:

- `quantity` rendered as `N ชิ้น` (wording).
- `invoiceNumber` shown as an "invoiced" badge rather than the literal invoice number.
- `note` omitted from the row.

# Order create screen — spec

**Route:** `/orders/new` · **Page:** `OrderCreatePage.vue` · **Component name:** `OrderCreatePage`
**Status:** spec — the shipped screen mostly matches. See "Gaps".
**Written:** 2026-08-31

Supersedes `forms/create-order.md`, which is a pre-implementation plan (banner
`PLANNING — not implemented`, commit `9e6d5e8`) and names a `POST /api/orders`
endpoint that is not what shipped.

## Caching

`OrderCreatePage` is on the `<KeepAlive>` exclude list in `src/App.vue:18` and must stay
there. Its fields are component-local refs; if the page were cached, what a user typed for
one customer would survive into the next and could be submitted against the wrong record.
The exclude list matches the **component name**, so the `defineOptions({ name: 'OrderCreatePage' })`
declaration must not be renamed. The page uses `onMounted`, never `onActivated`.

## Fields

| Label | Binds to | Type | Required |
|---|---|---|---|
| ลูกค้า | `customerId` | searchable picker, options from `GET /api/customers` | yes |
| วันที่รับผ้า | `receivedDate` | date | yes |
| กำหนดส่ง | `dueDate` | date | yes |
| บริการ | `serviceType` | option grid — WSIR / IRON / DRCL / WASH | yes |
| จำนวน | `quantity` | number | no |
| ชื่อออเดอร์ | `orderName` | text | no |
| รายละเอียดออเดอร์ | `orderDescription` | textarea | no |
| หมายเหตุ | `note` | textarea | no |

Blank optional text fields are trimmed and submitted as `null`; blank numbers as `null`.

**Removed:** ไม้แขวน (`hangers`) and ถุง (`bags`) are currently on the form and must be
taken off it. See `list-response-fields.md` — they are dead fields being retired from the
API contract, read and write.

## Payload

Governed by `workOrderCreateSchema` in `contracts/work-orders/work-order-api.schema.ts`,
parsed on submit before the request goes out.

Two schema fields are not collected from the user:

- `items` — always `[]`. Items are added afterwards from the detail screen.
- `createdBy` — hardcoded `'admin'`. **This is wrong** and is tracked under Gaps.

## Submit flow

`orderStore.create` → `createWorkOrder` → `POST /api/work-orders`.

- Success → `router.replace` to `order-detail`. `replace`, not `push`, so Back does not
  return to a submitted form.
- Error → inline `formError` on the page. No toast.
- Cancel/close → currently `router.push` to the list, which stacks a history entry.
  It should be `router.replace`.

## Gaps

1. `hangers` and `bags` inputs still present; must be removed with the contract change.
2. `createdBy: 'admin'` is hardcoded. There is no signed-in user concept feeding this, so
   every order is attributed to a fake account. Needs a real decision before it becomes
   audit data people trust.
3. No cross-field validation: `receivedDate` may be later than `dueDate` and the form
   accepts it.
4. `quantity` is coerced with `Number()` but the schema expects an integer; a decimal
   entry fails at parse time rather than being caught in the field.
5. Close uses `push` where `replace` is correct.
6. `OrderCustomerPicker.vue` in this feature is dead code — the page uses the shared
   `FormPicker` instead. Delete it or use it, but not both.

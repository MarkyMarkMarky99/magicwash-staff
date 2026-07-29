# Prompt — build a clickable prototype of the Create Invoice page

Paste this to the agent that will build it.

---

Build a **clickable prototype** of the staff "create invoice" page in
`C:\MagicwashGemini\webapp-vue`. The point is to see the flow working before the real system is
wired up, so the person reviewing it can tell whether it matches how the shop actually works.

**This is a prototype, not production code.** Mock everything. Make no network calls, write
nothing to any sheet, and touch none of the existing invoice feature files. Everything you add
must be deletable in one step when the real page is built.

## Where it goes — ONE standalone HTML file

**Deliver exactly one file: `docs/prototypes/invoice-create.html`.** Nothing else. It opens by
double-clicking it in a browser — no build step, no dev server, no install.

- **Do not wire it into the app.** No route, no entry in the router, no Vue SFC, no import from
  `src/`, no change to any existing file anywhere in the repo. This is a throwaway mockup for
  judging the flow, and it must be deletable by deleting one file.
- Everything lives inside that file: markup, styles, behaviour, and the mock data.
- Plain HTML with vanilla JavaScript in a `<script>` tag is fine and preferred. If a framework
  genuinely helps, a single CDN `<script>` tag is acceptable — but no bundler, no `npm install`,
  no build.
- Styling: write plain CSS in a `<style>` block, or use a Tailwind CDN tag. Do not try to import
  the app's `src/style.css`.

## Look and feel

Mobile-first, the way the staff app is. **It must look like it belongs to this app** — the flow is
being judged in context, and a mockup in generic styling teaches nothing about how the real page
will feel.

Read `src/style.css`'s `@theme` block and reproduce the real design system inside the HTML file:
the actual Material 3 colour tokens, the real font families and their `font-headline` /
`font-body` / `font-label` roles, the real radii and spacing rhythm. Copy the values across
literally as CSS custom properties in the `<style>` block — do not approximate a palette from
memory. Icons are Material Symbols. Then open `src/features/invoices/pages/InvoiceListPage.vue`
and a form under `src/components/forms/` and match their density, heading style, button shapes,
and how cards and sections are separated.

The file still carries its own copy of everything; it never imports from `src/`.

All copy in **Thai**, in the plain tone a shop employee would expect. Currency renders as
`฿1,234.56`.

## The flow to demonstrate

A staff member is issuing an invoice to a customer. **Two screens.**

### Screen 1 — pick who and what

Nothing else. This screen only answers "which customer, which order".

1. **Customer** — a searchable list of 5–6 mock customers.
2. **Order** — once a customer is picked, their orders appear. Picking one moves straight on to
   screen 2. No confirm button if the choice alone is unambiguous.

### Screen 2 — the invoice, already filled in

Arriving here, the work is mostly done. The page opens with everything already populated from the
choices made on screen 1 — the staff member is reviewing and pricing, not typing from scratch.

3. **Already filled, shown as settled facts rather than empty inputs:**
   - **Customer** — the snapshot that will be frozen onto the invoice: code, name, phone, address.
   - **Invoice number** — auto-generated. Show it plainly. (In the real system staff will type it;
     for the prototype, generate something plausible so the reviewer can see the finished shape.
     Keep it editable, and show an inline "already used" warning for one hardcoded number, say
     `INV-2026-0001`, so the duplicate check is visible — it warns, it never blocks.)
   - **Dates** — issued date defaults to today, due date to a sensible offset. **Both must stay
     editable**; back-dating is allowed and staff do use it.
   - **Line items** — every item on the chosen order is already loaded, with description and
     quantity filled and **unit price empty**. Pricing those lines is the main thing the staff
     member actually does on this screen.
4. **No billing type.** Only ORDER invoices exist for now. Do not show a billing-type choice, and
   do not show billing-period dates — the server fills that in. Nothing about it appears in the UI.
5. **Line items** — the heart of it. The order's lines are already there; on top of that the staff
   member can:
   - **Delete** any line they do not want to bill.
   - **Add a blank line** and type everything, for anything not on the order.
   Both kinds live in the *same* editable list.
   Each row needs only: description, unit (free text, e.g. ผืน / กก. / ครั้ง), quantity, unit
   price, a per-line adjustments editor, a live line total, and a remove button. **No service type
   on the line** — this first version keeps lines minimal. Rows must be clearly numbered, because
   their order is meaningful.

   **Rows must be compact.** Do not stack every field vertically — a full-width block per field
   makes a five-line invoice unreadable and unusable on a phone. Group the short numeric fields
   onto one row (unit, quantity, unit price belong side by side), keep description on its own
   line since it is the long one, and let the line total sit to the right of the numbers rather
   than on a line of its own. Per-line adjustments should be collapsed by default and expand only
   when a line actually has one. Aim for a line item that reads at a glance and takes a few rows
   of height, not a screenful.
6. **Invoice-level adjustments** — the same adjustment editor, applied to the whole invoice.
7. **Totals** — live, always visible: each line's own total, the sum of lines, then the effect of
   invoice-level adjustments, then the final amount.
8. **Issue the invoice** — a single button. On click, fake a 2-second wait, then show one of the
   result states below.

## The arithmetic — get this exactly right, it is the point of the prototype

An adjustment is `{ label, calculation: 'FIXED' | 'PERCENT', value }`. `value` is signed: negative
deducts. Zero is not allowed — drop empty rows rather than treating them as zero.

**Line level — adjustments apply to ONE UNIT, in array order, then multiply:**

```
unit = unitPrice
for adj of line.adjustments:
  unit += adj.calculation === 'FIXED' ? adj.value : unit * adj.value / 100
lineSubtotal = quantity * unitPrice
lineTotal    = quantity * unit
```

- `unitPrice 50`, `quantity 10`, one `FIXED -10` → line total **400**, not 490. The discount lands
  on every unit.
- `unitPrice 100`, `quantity 4`, `[FIXED -12, PERCENT -10]` → `100-12=88`, then `88-8.8=79.2`, so
  **316.8**. Percent compounds on the already-adjusted unit.

**Invoice level — adjustments apply ONCE to the running total:**

```
total = sum(line.lineTotal)
for adj of invoice.adjustments:
  total += adj.calculation === 'FIXED' ? adj.value : total * adj.value / 100
```

A `FIXED -10` here removes 10 baht from the whole invoice, however many units it contains.

Order matters at both levels — never sort or reorder an adjustments array.

## Result states — show all three, switchable

The real endpoint answers with one of four outcomes. Give the prototype a way to force each one (a
small dev-only selector is fine — it does not have to be pretty):

- **Created.** Show the invoice number, the line count, and the final total.
- **Validation failed.** Field-level messages, nothing was saved, the staff member fixes and
  resubmits.
- **Items saved but the invoice failed.** The worst case and the one most likely to be designed
  badly: the line items are already in the system but the invoice itself is not. The screen must
  say so plainly and **must not offer a retry button** — pressing it again would duplicate the
  lines. It should tell the staff member to contact whoever administers the sheets, quoting the
  invoice number.

## Show the payload

Add a collapsible panel at the bottom that renders the JSON the page *would* POST, live as the form
is filled. This is how the reviewer checks that the contract matches what they expect. The shape:

```json
{
  "invoiceNumber": "INV-2026-0042",
  "sourceOrderId": "ORD-2026-0117",
  "issuedDate": "2026-07-29",
  "dueDate": "2026-08-05",
  "customer": {
    "customerCode": "CUS-001",
    "customerName": "โรงแรมสยาม",
    "phone": "021234567",
    "address": "123 ถ.พระราม 1 กรุงเทพฯ"
  },
  "adjustments": [
    { "label": "ส่วนลดลูกค้าประจำ", "calculation": "PERCENT", "value": -5 }
  ],
  "items": [
    {
      "description": "ผ้าปูที่นอน",
      "unit": "ผืน",
      "quantity": 20,
      "unitPrice": 35,
      "adjustments": []
    },
    {
      "description": "ค่าจัดส่ง",
      "unit": "ครั้ง",
      "quantity": 1,
      "unitPrice": 150,
      "adjustments": []
    }
  ]
}
```

Note what is **absent** and must stay absent: no `billingType` and no billing-period dates, no
totals, no line ids, no line numbers, no status, no `createdBy`, no `customerId` (it is derived
from `customer.customerCode`), no `sku`. The server owns all of those.

`sourceOrderId` sits at **invoice level**, once — one invoice bills exactly one order, so the
server copies it onto every item row. Lines themselves carry no `sourceOrderId`, no `sourceItemId`
and no `serviceType` in this first version, whether they came from the order or were typed by
hand. The two shapes are deliberately identical.

## Mock data to invent

5–6 customers with Thai names and addresses; each with 1–3 orders; each order with 2–5 items
carrying description, service type and quantity but **no price**. Make it look like a laundry
business — hotels, spas, clinics, individuals — so the reviewer can judge the flow against real work.

## Done when

Opening `docs/prototypes/invoice-create.html` directly in a browser — no server, no build — lets a
person pick a customer and an order on the first screen, land on a second screen that is already
filled in, price the lines, watch the totals update as they type, see the payload build up, and
trigger each of the three result states.

Both screens live in the one HTML file — swap what is rendered, do not open a second file.

Confirm in your report that you created **exactly one file** and changed nothing else in the repo,
and say what about the flow felt wrong to build — that feedback is worth as much as the prototype.

/**
 * Invoice write contract — exactly what we POST to Google Sheets
 *
 * Type-only spec. Nothing imports it at runtime; it exists so the payload is
 * agreed before any code is written.
 *
 * Three writes, three sheets, through the SheetLib gateway at
 * APPSCRIPT_GATEWAY_URL:
 *   Invoice      → tab "Invoices",     PK invoice_number       (APPEND)
 *   InvoiceItem  → tab "InvoiceItems", PK invoice_item_id, FK invoice_number (APPEND)
 *   OrderForm    → sheet "OrderForm",  PK id                   (UPDATE, one column)
 *
 * Authoritative schemas (read them, do not trust this file where they differ):
 *   G:\My Drive\Magicwash\Database\GoogleSheets\Invoice.json
 *   G:\My Drive\Magicwash\Database\GoogleSheets\InvoiceItem.json
 *   G:\My Drive\Magicwash\Database\GoogleSheets\OrderForm.json
 * Ignore Invoices.json / InvoiceItems.json one directory up — stale, different targets.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * 0. What SheetLib does to our payload — verified by reading its source
 * ────────────────────────────────────────────────────────────────────────────
 *
 * These four behaviours decide the payload shape. All confirmed in
 * appscript/SheetLib/{SheetService,SchemaUtils}.js, not assumed:
 *
 * 1. Nested values are serialized for us:
 *      `if (typeof value === 'object') return JSON.stringify(value)`
 *    → We send `customer` as a real object and `adjustments` as a real array.
 *      Do NOT pre-stringify them; that would double-encode.
 *
 * 2. `null` and `undefined` become an empty cell (`""`), not the text "null".
 *    → Omitting an optional column and sending null are equivalent on the wire.
 *
 * 3. `created_at` is auto-stamped when absent:
 *      `doc.created_at = doc.created_at || _now()`
 *    → We may omit it. `created_by` is NOT stamped and must be sent.
 *
 * 5. Because of 2 and 3, the rule for this payload is: **send only the columns
 *    we actually own, and omit every optional one.** Sending `null` and
 *    omitting the key produce the same empty cell, but omission says plainly
 *    that the system owns the value, and it stops a future default from being
 *    silently overwritten by our null.
 *
 * 4. APPEND accepts an array for batch, and validates EVERY document before
 *    writing ANY of them — one invalid row aborts the whole batch with
 *    `Validation failed at data[i]: ...` and nothing is written.
 *    → All line items go in ONE request, not a loop. This removes the
 *      partially-written-items failure mode entirely.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * 1. The gateway envelope
 * ──────────────────────────────────────────────────────────────────────────── */

export interface GatewayAppendRequest<TRow> {
  resource: 'sheet';
  action: 'APPEND';
  target: 'Invoice' | 'InvoiceItem';
  /** One row, or many for a batch append. */
  data: TRow | TRow[];
}

export interface GatewayAppendOk {
  resource: 'sheet';
  status: 'ok';
  target: string;
  updated_range: string;
  /** Present only when `data` was an array. */
  appended_rows?: number;
}

export interface GatewayError {
  status: 'error';
  message: string;
}

/**
 * ⚠ Every gateway response is HTTP 200, including errors. Dispatch on
 * `status`, never on the HTTP code. POST with `Content-Type: text/plain`
 * (Apps Script rejects the JSON preflight) and follow redirects.
 */
export type GatewayAppendResponse = GatewayAppendOk | GatewayError;

/* ────────────────────────────────────────────────────────────────────────────
 * 2. POST #1 — the line items (sent FIRST, as one batch)
 * ──────────────────────────────────────────────────────────────────────────── */

export interface InvoiceItemRow {
  /** FK → Invoice.invoice_number. Same value on every row of the batch. */
  invoice_number: string;
  /** PK. Unique and immutable. Generation scheme is ours to choose — see §6. */
  invoice_item_id: string;
  /** Display order within the invoice. 1-based, contiguous, caller-assigned. */
  item_no: number;

  /** Set when the line came from an order; null when typed by hand. */
  source_order_id: string | null;
  source_item_id: string | null;

  /* sku is omitted entirely — no source for it yet, and not on the form. */
  /** Free text. No enum — do not constrain it to a fixed list. */
  service_type: string | null;
  /** Customer-facing text, snapshot. Required. */
  description: string;

  /** > 0, fractional allowed (kilograms). Zero is rejected. */
  quantity: number;
  /** Free text label such as piece or kg. No enum. */
  unit: string | null;
  /** Price of ONE unit before any item adjustment. */
  unit_price: number;

  /** quantity × unit_price, before adjustments. We compute it. */
  subtotal: number;
  /** Applied PER UNIT, in array order. See §4. */
  adjustments: Adjustment[];
  /** Final line total after adjustments per unit × quantity. We compute it. */
  net_total: number;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 3. POST #2 — the invoice header (sent SECOND, one row)
 * ──────────────────────────────────────────────────────────────────────────── */

export interface InvoiceRow {
  /** PK. Typed by staff, stored verbatim, never reformatted. */
  invoice_number: string;

  /**
   * Lifecycle only. We always write 'ISSUED'.
   * ⛔ PAID / UNPAID / PARTIALLY_PAID / OVERDUE are computed in InvoicesView
   *    and are rejected by this enum.
   */
  status: 'DRAFT' | 'ISSUED' | 'CANCELLED' | 'VOID';

  /**
   * The sheet's enum is 'ORDER' | 'CYCLE', but we only ever write 'ORDER'.
   * CYCLE billing does not exist in this app yet.
   */
  billing_type: 'ORDER';
  /*
   * billing_period_start and billing_period_end are omitted entirely. They are
   * required and non-null only for CYCLE invoices, which we never write.
   */

  /** ISO 8601 calendar dates. */
  issued_date: string;
  due_date: string;

  /** Must equal customer.customer_code exactly — a denormalisation that exists
   *  because GViz cannot filter inside the JSON snapshot below. */
  customer_id: string;
  customer: CustomerSnapshot;

  /** Invoice-level. Applied ONCE to the running invoice total. See §4. */
  adjustments: Adjustment[];

  /** Not stamped for us — we must send it. Currently the literal 'staff'. */
  created_by: string;

  /*
   * Omitted from the payload entirely — see §0.5. Not sent as null:
   *   created_at   SheetLib stamps it
   *   updated_at / updated_by   a new invoice has never been edited
   *   deleted_at / deleted_by   a new invoice has never been deleted
   */
}

/**
 * Frozen at issue time so later profile edits never alter an issued invoice.
 * Never re-resolved when rendering.
 */
export interface CustomerSnapshot {
  customer_code: string;
  customer_name: string;
  phone?: string;
  address?: string;
  /*
   * tax_id, branch_code, contact_name and email are omitted entirely for now —
   * there is no source for them and they are not on the form. When they do
   * arrive: tax_id is exactly 13 digits, branch_code exactly 5 (00000 = head
   * office), and branch_code may not be sent without tax_id.
   */
}

export interface Adjustment {
  label: string;
  calculation: 'FIXED' | 'PERCENT';
  /** Signed. Negative deducts. **Zero is rejected** — drop empty rows instead. */
  value: number;
  /** Each requires the other; send both or neither. */
  ref_source?: string;
  ref_code?: string;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 3b. POST #3 — mark the source order as invoiced (sent THIRD, after Invoice)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Closes the gap where nothing in the system can tell whether an order
 * already has an invoice. Same gateway, same workbook-agnostic envelope
 * shape as §1, but UPDATE instead of APPEND, and a target sheet — OrderForm
 * — that neither Invoice nor InvoiceItem live in.
 *
 *   { resource: 'sheet', action: 'UPDATE', target: 'OrderForm',
 *     key_value: <OrderForm.id>, data: { invoice_id, updated_by } }
 *   → { status: 'ok', ... } | { status: 'error', message }
 *
 * `key_value` is OrderForm.id — the SAME value already carried through
 * invoice creation as CreateInvoiceRequest.sourceOrderId (OrdersView, what
 * staff actually browse, is itself built from OrderForm rows, so the id is
 * identical throughout that chain).
 *
 * ⚠ The column is `invoice_id`, NOT `invoice_number`. OrderForm.json has
 *   `additionalProperties: false` and no `invoice_number` property — only a
 *   nullable `invoice_id` string. The VALUE written there is still our
 *   Invoice.invoice_number string; only the column name differs.
 *
 * `updated_at` is auto-stamped by SheetLib's update() when omitted — same
 * auto-stamp behaviour as `created_at` on APPEND (verified in
 * appscript/SheetLib/SheetService.js). `updated_by` is NOT auto-stamped and
 * must always be sent explicitly (SheetLib's own doc comment on update():
 * "data.updated_by must be set by caller").
 *
 * export interface OrderFormInvoiceLinkUpdateRequest {
 *   resource: 'sheet';
 *   action: 'UPDATE';
 *   target: 'OrderForm';
 *   key_value: string;          // OrderForm.id == sourceOrderId
 *   data: {
 *     invoice_id: string;       // Invoice.invoice_number's value
 *     updated_by: string;       // NOT auto-stamped; always send it
 *   };
 * }
 *
 * Failure reporting: attempted only after the Invoice header row (POST #2)
 * has already succeeded, so by the time this write is attempted the invoice
 * itself is fully and correctly recorded. A failure or an unconfirmed result
 * here is reported as its own distinct outcome (`order_link_failed`, see
 * `invoice-api.contract.ts` §5) and must NEVER be offered a retry by the
 * caller — retrying would create a second Invoice for money that's already
 * correctly billed. This is a stricter rule than POST #2's failure, which
 * also can't be blindly retried but at least names a concrete recovery path
 * (delete/ignore the orphaned items); here the correct recovery is an admin
 * setting OrderForm.invoice_id by hand, never resubmitting the form.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * 4. The arithmetic — the part most likely to be implemented wrong
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The two adjustment arrays share a shape and a name but not their maths.
 *
 * ITEM LEVEL — applied to ONE UNIT, in array order, then multiplied:
 *
 *   unit = unit_price
 *   for adj of adjustments:
 *     unit += adj.calculation === 'FIXED' ? adj.value : unit * adj.value / 100
 *   subtotal  = quantity * unit_price
 *   net_total = quantity * unit
 *
 *   Worked: unit_price 50, quantity 10, adjustment FIXED -10
 *     unit      = 50 - 10 = 40
 *     subtotal  = 500
 *     net_total = 400          ← NOT 490. The discount lands ten times.
 *
 *   Worked: unit_price 100, quantity 4, adjustments [FIXED -12, PERCENT -10]
 *     unit      = 100 - 12 = 88 → 88 - 8.8 = 79.2
 *     subtotal  = 400
 *     net_total = 316.8        ← percent compounds on the already-adjusted unit
 *
 * INVOICE LEVEL — applied ONCE to the running invoice total:
 *
 *   total = sum(item.net_total)
 *   for adj of adjustments:
 *     total += adj.calculation === 'FIXED' ? adj.value : total * adj.value / 100
 *
 *   A FIXED -10 here removes 10 baht from the whole invoice, regardless of
 *   how many items or units it contains.
 *
 * ⚠ Order matters at both levels: PERCENT compounds on the current running
 *   value, so reordering the array changes the answer. Preserve array order
 *   from the form through to the sheet.
 *
 * ⚠ The invoice row stores NO total. subtotal and net_total exist only on item
 *   rows; invoice totals, balances and payment status are computed downstream
 *   when InvoicesView is built. Do not invent a total column.
 *
 * The server computes subtotal and net_total and is authoritative. Anything the
 * browser sends for them is a preview and must be recomputed, never trusted.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * 5. Write sequence
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   1. POST InvoiceItem       — the whole batch in one request
 *   2. POST Invoice           — the header row
 *   3. UPDATE OrderForm       — mark the source order invoiced (§3b)
 *   4. POST InvoiceView sync  — refresh the materialized invoice view
 *
 * Items first, deliberately. There is no transaction across the sheets, so
 * any of the first three writes can land without the next. The view sync is
 * always attempted last, after the source invoice and order link are complete:
 *
 *   items ok, invoice fails        → orphan item rows nothing references.
 *     Invisible in every invoice list. Recoverable: fix and retry, or delete
 *     by hand.
 *   invoice ok, items fail         → an ISSUED invoice with no lines, visible
 *     to staff and billable. Strictly worse. This ordering makes it
 *     impossible.
 *   items + invoice ok, order-link fails/unconfirmed → the invoice itself is
 *     already fully and correctly recorded; only the OrderForm.invoice_id
 *     linkage is missing. Reported as its own outcome (§3b) and never
 *     retried — retrying would create a second, fully duplicate invoice.
 *   source writes ok, view sync fails → the invoice is complete but
 *     InvoicesView is stale. Reported as its own outcome and never retried.
 *
 * Because APPEND validates the entire batch before writing any of it, a bad
 * line cannot leave a half-written item set — the whole request is rejected and
 * nothing is written.
 *
 * Failure reporting: an item-batch failure means nothing was written; say so
 * plainly and let staff fix and resubmit. An invoice-row failure after a
 * successful item batch must be reported as its own distinct outcome, naming
 * the invoice number, because rows exist that a human has to clean up. An
 * order-link failure after a successful invoice write is a THIRD distinct
 * outcome for the same reason, with a stricter rule: never offer a retry at
 * all (see §3b). A view-sync failure is a FOURTH distinct outcome: the source
 * invoice is complete, but the materialized view is stale. Never collapse any
 * of these into one generic error.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * 6. Open decisions — settle these before implementing
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. `invoice_item_id` generation. It must be unique and immutable, and the
 *    schema says nothing about its format. A deterministic
 *    `${invoice_number}-${item_no}` is readable and makes a retry idempotent in
 *    practice, but collides if the same invoice number is ever reused. A random
 *    id never collides but makes rows harder to trace by eye. Not yet decided.
 *
 * 2. Duplicate invoice numbers. `invoice_number` is the PK but the gateway has
 *    no uniqueness check — a typo silently creates a second row. The only
 *    available guard is a read of InvoicesView in the portal spreadsheet before
 *    writing, which lags behind recent writes, so it is a warning and never a
 *    hard block.
 *
 * 3. `created_by` is the literal 'staff' until this app has real staff
 *    identity. Keep it in one named constant so it is a one-line change later.
 */

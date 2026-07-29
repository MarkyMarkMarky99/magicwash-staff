/**
 * Invoice API contract — browser ⇄ our own backend
 *
 * Type-only spec, agreed before implementation. camelCase throughout; the
 * snake_case sheet shape never crosses this boundary. For what the backend
 * then sends onward to Apps Script, see `invoice-write.contract.ts`.
 *
 * ⚠ SCOPE: **create only.** There is no edit path. Staff may not alter an
 *   invoice once issued. A future privileged role may be allowed to change a
 *   narrow set of fields — `status` above all — and that will be its own
 *   endpoint and its own contract, not a widened version of this one. Nothing
 *   here should be named or shaped as though it will grow into an update.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * 1. POST /api/invoices — request
 * ──────────────────────────────────────────────────────────────────────────── */

export interface CreateInvoiceRequest {
  /** Typed by staff. Stored verbatim, never reformatted. */
  invoiceNumber: string;

  /*
   * No billingType. Only ORDER invoices exist for now, so the server writes
   * billing_type: 'ORDER' and omits the two billing-period columns. The staff
   * member is never asked, and the choice is not shown anywhere in the UI.
   *
   * CYCLE billing is a later feature. When it arrives it brings back
   * billingType plus a required billingPeriodStart/End pair — adding a field
   * to this request, not reshaping it.
   */

  /**
   * The order this invoice bills, chosen on the first screen. Invoice-level,
   * not per line: one ORDER invoice covers exactly one order, so repeating it
   * on every line would be the same value copied n times with n chances to
   * disagree. The server fans it out onto each item row's source_order_id.
   */
  sourceOrderId: string;

  /** Staff-chosen, defaulting to today in the UI. Back-dating is allowed. */
  issuedDate: string;
  dueDate: string;

  customer: CustomerSnapshotInput;

  /** Invoice-level. Applied once to the running invoice total. */
  adjustments: AdjustmentInput[];

  /** At least one. Array order is the line order — see §3. */
  items: InvoiceLineInput[];
}

export interface CustomerSnapshotInput {
  /** The customer's id. Becomes both customer_id and customer.customer_code. */
  customerCode: string;
  customerName: string;
  phone?: string;
  address?: string;
}

export interface InvoiceLineInput {
  /*
   * Deliberately minimal in this first version. A line carries no
   * sourceOrderId (it lives on the invoice), no sourceItemId, and no
   * serviceType — the server writes null for the latter two.
   *
   * The cost of leaving them out: a line cannot be traced back to the
   * individual order item it came from, only to the order. That is accepted
   * for now; adding them later is additive.
   */
  description: string;
  /** Free text label — piece, kg, and so on. Typed by staff. */
  unit?: string;

  /** Greater than zero. Fractions are legal (kilograms). */
  quantity: number;
  /** Price of one unit before any adjustment. Typed by staff on every line, */
  /** including imported ones — order items carry no price. */
  unitPrice: number;

  /** Item-level. Applied per unit, in order, then multiplied by quantity. */
  adjustments: AdjustmentInput[];
}

export interface AdjustmentInput {
  label: string;
  calculation: 'FIXED' | 'PERCENT';
  /** Signed; negative deducts. Zero is invalid — the UI drops empty rows. */
  value: number;
  /** Each requires the other. */
  refSource?: string;
  refCode?: string;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 2. What the client deliberately does NOT send
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Every one of these is owned by the server or by Apps Script. Accepting them
 * from a browser would mean either trusting a forgeable value or carrying a
 * field we then ignore — and a field that is accepted but ignored is a bug
 * waiting to be filed.
 *
 *   subtotal, netTotal   the server computes them and is authoritative
 *   invoiceItemId        the server mints it (8-char UUID segment)
 *   itemNo               derived from array position; the order IS the data
 *   billingType          always ORDER for now; not a client's choice
 *   billingPeriodStart,
 *   billingPeriodEnd     only meaningful for CYCLE, which does not exist yet
 *   status               always ISSUED on create; not a client's choice
 *   createdBy            server constant while this app has no staff identity
 *   createdAt            Apps Script stamps it
 *   customerId           duplicate of customer.customerCode; server derives it,
 *                        so the two can never disagree
 *   sku                  no source for it yet; not on the form
 *   item.sourceOrderId   sent once at invoice level; the server copies it onto
 *                        every item row
 *   item.sourceItemId,
 *   item.serviceType     omitted in this first version; the server writes null
 *   taxId, branchCode,
 *   contactName, email   no source yet; omitted, not sent as null
 *   updatedAt/By,
 *   deletedAt/By         a new invoice has never been edited or deleted
 */

/* ────────────────────────────────────────────────────────────────────────────
 * 3. Ordering
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Two orderings are load-bearing and must survive from the form to the sheet:
 *
 *   items[]        → item_no, assigned 1..n from array position
 *   adjustments[]  → applied in array order at both levels. PERCENT compounds
 *                    on the current running value, so reordering changes the
 *                    total. Never sort, dedupe, or normalise these arrays.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * 4. POST /api/invoices — success response
 * ──────────────────────────────────────────────────────────────────────────── */

export interface CreateInvoiceSuccess {
  kind: 'created';
  invoiceNumber: string;
  itemCount: number;
  /** Sum of every line's net total, as the server computed it. */
  itemsTotal: number;
  /** After invoice-level adjustments. What the customer owes. */
  invoiceTotal: number;
}

/**
 * The totals come back because the sheet stores none — the invoice row has no
 * total, tax or balance column, and InvoicesView only catches up later. Without
 * them the confirmation screen would have to recompute what was just written
 * and hope the two agree.
 *
 * The client still computes a live preview while the form is being filled. To
 * keep one implementation of the arithmetic rather than two that drift apart,
 * the calculator lives in `contracts/` and both sides import it. There is no
 * client-supplied total in the request to cross-check, because there is nothing
 * to cross-check against.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * 5. POST /api/invoices — failure responses
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Four outcomes, and they must stay four. The difference between them is
 * whether anything was written, which decides whether resubmitting is safe.
 */

export interface CreateInvoiceValidationError {
  kind: 'validation_error';
  issues: { path: string; message: string }[];
  /** Nothing was written. Fix the form and submit again. */
}

export interface CreateInvoiceItemsFailed {
  kind: 'items_write_failed';
  message: string;
  /**
   * Nothing was written — Apps Script validates the whole batch before writing
   * any of it, so a rejected batch leaves the sheet untouched. Safe to retry.
   */
}

export interface CreateInvoiceHeaderFailed {
  kind: 'invoice_write_failed';
  invoiceNumber: string;
  itemCount: number;
  /**
   * ⚠ The line items ARE in the sheet; only the invoice row failed. Resubmitting
   * writes a second set of items. The UI must say so and must not offer a plain
   * retry — this needs a person to reconcile.
   */
}

export interface CreateInvoiceOrderLinkFailed {
  kind: 'order_link_failed';
  invoiceNumber: string;
  sourceOrderId: string;
  /**
   * ⚠ The invoice IS fully and correctly recorded at this point — both the
   * InvoiceItem batch and the Invoice header row were written successfully.
   * Only the OrderForm-side linkage (its `invoice_id` column) failed or came
   * back unconfirmed. The UI must NEVER offer a retry here: resubmitting
   * would write a SECOND invoice for money that is already correctly
   * billed. An admin must look up `sourceOrderId` and set `invoice_id` on
   * that OrderForm row by hand.
   */
}

export type CreateInvoiceResponse =
  | CreateInvoiceSuccess
  | CreateInvoiceValidationError
  | CreateInvoiceItemsFailed
  | CreateInvoiceHeaderFailed
  | CreateInvoiceOrderLinkFailed;

/* ────────────────────────────────────────────────────────────────────────────
 * 6. GET — the duplicate-number check
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `invoiceNumber` is the sheet's primary key, but the gateway enforces no
 * uniqueness: a typo silently appends a second row. The only guard available is
 * a read of InvoicesView, which lives in the portal spreadsheet — the same
 * workbook as OrdersView, and readable, unlike the workbook we write to.
 *
 * The client checks while the field is being typed (debounced), so the warning
 * appears before submit rather than after. Because the view lags behind recent
 * writes, this is advisory: it warns, it never blocks, and a failed lookup must
 * never prevent an invoice from being issued.
 */

export interface InvoiceNumberCheckResult {
  invoiceNumber: string;
  exists: boolean;
}

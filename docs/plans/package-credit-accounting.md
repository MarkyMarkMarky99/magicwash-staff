# Package credits as a monthly subscription

Status: Plan. Owner decisions recorded 2026-09-30; reviewed by gpt-6-sol (accountant + engineer roles). Nothing implemented yet.
Repo: C:/MagicwashGemini/webapp-vue. Registry (schema source of truth, owner edits only):
G:/My Drive/Magicwash/Database/GoogleSheets/*.json

## How the business actually works (owner, 2026-09-30)

- A package is a MONTHLY plan, like a phone plan: fee per month, a credit allowance per month.
- Unused credits carry over into next month's package IF the customer renews; otherwise they lapse.
- Usage beyond the allowance is allowed (no blocking) and billed at 25 THB per credit.
- Some customers pay the fee at the start of the month, some (old customers) pay later together with overage.
- Late payment / suspension is handled by staff by hand. No automation: no auto-renew, no auto-expire, no auto-suspend.
- Not VAT-registered. Items with no credit rate (e.g. suit) are always paid at the normal price.
- PERSONAL = normal price + 10 THB/unit (only matters for items paid in cash; credits cover the item fully).

## Accounting (deliberately simple)

- Invoice issued at month end (postpaid, service already given): Dr Accounts receivable / Cr Monthly service revenue
  (+ Cr Overage revenue, + Cr Service revenue for cash-priced items).
- Invoice issued at month start (prepaid): Dr Accounts receivable / Cr Deferred service revenue; when the month of
  service is complete: Dr Deferred service revenue / Cr Monthly service revenue. One time-based adjustment per invoice,
  split by service days only if the month crosses a closing date. No per-credit valuation.
- Mixed prepaid invoice (the usual prepaid case): October invoice = October fee 1,190 + September overage 100 +
  September suit 180 → Dr AR 1,470 / Cr Deferred service revenue 1,190 / Cr Overage revenue 100 / Cr Service revenue 180.
  Only the NEW month's fee line is deferred; lines for the previous month's service are revenue at once.
- Payment (either case): Dr Cash / Cr Accounts receivable.
- Credits are a usage COUNTER, not money. No value per credit, no unearned-revenue ledger, no breakage entries,
  no PACKAGE_CREDIT payment method, no per-line package adjustments.
- Carry-over credits: at each financial closing date, check the total carried-over credits. If immaterial, no entry
  (write the policy and keep the check as evidence). If material, the bookkeeper estimates one lump-sum deferral at the
  closing date and releases it when used or lapsed. No per-credit ledger in baht.

## Data model (mostly existing)

- Credit rates: PriceList rows with price_group = 'CREDIT', `price` = credits per unit, `unit` unchanged.
  No CREDIT row = cannot use credits. credit_eligible left unused.
- CustomerPackages: one row per customer per month (start_date = 1st of month or purchase date, expiry = +1 month),
  invoice_id -> that month's CYCLE invoice.
- PackageTransactions (credit counter), per package-month:
  - PURCHASE +allowance when the month's package is created.
  - USAGE −credits per order, reference_source "Orders", reference_id = order id (one USAGE per order; a second
    USAGE for the same order is refused).
  - TRANSFER on renewal: −N on the old month, +N on the new month, same reference id, for leftover credits.
  - ADJUSTMENT +N closing a negative balance once the overage invoice is issued successfully (reference = invoice
    number); refused if an ADJUSTMENT already references overage for that package-month (no double 25 THB billing).
  - Correcting a wrong USAGE: an ADJUSTMENT that references the original USAGE id; never a second USAGE for the order.
  - EXPIRE −N recorded by staff when a customer does not renew (optional, for a clean balance).
- Overage: negative balance at month end = overage credits (may be fractional, e.g. 0.5); billed as ONE invoice line
  with quantity = 1 and unit_price = overage credits × 25, description "ใช้เกิน 0.5 เครดิต × 25 = 12.50 บาท".
  (Invoice quantities may be fractional only for unit kg — shared/utils/item-quantity.ts:11.)
- Order item -> credit rate: OrderItemForms.item_id -> Items.id -> Items.item_code -> PriceList(item_code,
  service_type, price_group 'CREDIT', active, effective dates). Legacy rows without item_id are excluded.

## Billing cycle rule (no double monthly fee)

- Postpaid customer: one CYCLE invoice at month end = that month's fee + that month's overage + that month's cash items.
- Prepaid customer: the invoice at the start of month M = fee for M + overage and cash items of month M−1.
  If the customer does not renew, staff still issue a closing CYCLE invoice for month M−1's overage and cash items only.
- CustomerPackages.invoice_id points to the invoice carrying that package-month's FEE. The overage ADJUSTMENT of a
  package-month references the invoice that actually BILLED the overage, which for prepaid customers is next month's.

## Month close order (staff-driven, per package-month)

1. Compute usage: allowance + carried in − used = balance (negative = overage).
2. Put the overage line (overage credits × 25) on the invoice per the billing cycle rule (month-end invoice for postpaid,
   next month's start invoice or a closing invoice for prepaid) and confirm it saved.
3. ADJUSTMENT +overage referencing the invoice number (closes the negative balance).
4. If the customer renews: create next month's package; TRANSFER only a POSITIVE balance (−N old / +N new, one shared
   reference). A negative balance is never transferred. If only one TRANSFER side is written, show it as pending work
   for staff before the new month is used.
5. If not renewed: optional EXPIRE −balance by staff. The app already shows EXPIRED status after expiry_date
   (customer-package-assembly.ts:79); "no automation" means no automatic ledger writes.

## Monthly invoice content

- Line: package fee for the month (if billed in advance, it is on the invoice issued at start of month).
- Line: overage of the previous (or current, if billed at end) month = credits over allowance × 25.
- Lines: items with no credit rate (e.g. suit), at normal price (PERSONAL +10 applies here). Owner chose to bill these on
  the monthly CYCLE invoice, not per-order invoices. Each such line carries source_order_id + source_item_id at LINE
  level. The server (not the caller) checks that the order item exists, belongs to that order, and that the order belongs
  to the invoice's customer; and refuses the line if the order item is already on any non-VOID/non-CANCELLED invoice,
  ORDER or CYCLE. (Today OrderForm.invoice_id is linked only for invoices with a header sourceOrderId,
  invoice.service.ts:541, so the guard must read InvoiceItems.source_item_id, not OrderForm.) Today every line is written with
  source_item_id = null (invoice.service.ts:455-465) and the create request has no per-line source key, so this needs a
  contract + service change.
- Attachment/detail: credits used / allowance / carried in / carried out.
- Staff choose per customer whether to issue at the start (prepaid) or at the end (postpaid). Both use CYCLE.

## Phases

1. PriceList CREDIT rows: add create route (server/modules/price-list/price-list.module.ts:93 has none),
   "ราคาเครดิต" tab (main view hides CREDIT rows), labels เครดิต not บาท, price_group selector on create;
   import historical rates keyed by Items.item_code, owner reviews. (Deleting dead order-price-list-items.ts is
   housekeeping, any time.)
2. Credit usage per order: compute credits from order items via CREDIT rows, staff confirm, write one USAGE per
   order; show balance, allow negative (overage).
3. Monthly bill helper: pre-fill a CYCLE invoice with fee / overage / non-credit items and the usage summary;
   add per-line source keys + one-invoice-per-order-item guard; month close steps 1–3.
4. Renewal helper (staff button): create next month's package + TRANSFER positive leftover; pending-work view for
   half-written TRANSFER or package creation (purchase writes PURCHASE before the package row,
   customer-package-purchase.service.ts:66).

## Things from today's code that still matter

- USAGE today is entered by hand on customer detail with no balance or duplicate check
  (server/modules/customer-packages/package-transaction.service.ts:51) — add the one-USAGE-per-order guard.
- Invoice lines are written with source_item_id/service_type = null (server/modules/invoices/invoice.service.ts:464):
  fine for the fee/overage lines; only needed if non-credit items should link back to order items.
- REFUND must be positive today (credits returned). A cash refund is out of scope (staff handle it).

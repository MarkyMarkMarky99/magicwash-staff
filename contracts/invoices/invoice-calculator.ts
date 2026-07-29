/**
 * Invoice adjustment arithmetic — the ONE implementation, imported by both the
 * server (authoritative, in `server/modules/invoices/invoice.service.ts`) and
 * the client (a live preview while the create form is filled). There is no
 * `expectedTotal` in the create request to cross-check against the server's
 * numbers, precisely so there is only ever one implementation of this math —
 * writing it twice (once per side) is exactly the drift risk this file exists
 * to remove.
 *
 * ⚠ Deliberate exception to the general `contracts/` rule in `api/CLAUDE.md`
 * ("never in contracts/: ... business services"): this is pure, side-effect
 * free arithmetic with no I/O and no schema — not a service — and both FE and
 * BE need the literal same function, not two hand-synced copies. Zod schemas
 * still live in `invoice-api.schema.ts`; this file has no dependency on Zod or
 * on either side's framework.
 *
 * The two adjustment arrays in the invoice feature share a shape and a name
 * but NOT their maths — mixing up which "running value" an adjustment
 * compounds on is the single most likely implementation mistake here.
 *
 * ITEM level — applied to ONE UNIT, in array order, then multiplied:
 *
 *   unit = unitPrice
 *   for adj of adjustments:
 *     unit += adj.calculation === 'FIXED' ? adj.value : unit * adj.value / 100
 *   subtotal = quantity * unitPrice
 *   netTotal = quantity * unit
 *
 *   Worked: unitPrice 50, quantity 10, adjustment FIXED -10
 *     unit     = 50 - 10 = 40
 *     subtotal = 500
 *     netTotal = 400          ← NOT 490. The discount lands ten times, once
 *                                per unit, before the multiply.
 *
 *   Worked: unitPrice 100, quantity 4, adjustments [FIXED -12, PERCENT -10]
 *     unit     = 100 - 12 = 88 → 88 - 8.8 = 79.2
 *     subtotal = 400
 *     netTotal = 316.8        ← PERCENT compounds on the already-discounted
 *                                per-unit value (88), not on 100 and not on
 *                                the line subtotal.
 *
 * INVOICE level — applied ONCE to the running invoice total (a DIFFERENT
 * running value than the per-unit one above — never conflate the two):
 *
 *   total = sum(item.netTotal)
 *   for adj of adjustments:
 *     total += adj.calculation === 'FIXED' ? adj.value : total * adj.value / 100
 *
 *   A FIXED -10 here removes 10 baht from the whole invoice once, regardless
 *   of how many items or units it contains.
 *
 * ⚠ Order matters at both levels: PERCENT compounds on the CURRENT running
 *   value, so reordering an adjustments array changes the answer. Preserve
 *   array order end to end — never sort, dedupe, or normalize it.
 *
 * ⚠ There is no invoice-level total column on the Invoice sheet row at all —
 *   `computeInvoiceTotal` below exists only for a client preview and for the
 *   `invoiceTotal` field the create response returns; it is never written to
 *   a sheet.
 *
 * ── Where this rounds, and why ──────────────────────────────────────────────
 *
 * Binary floating point cannot represent most two-decimal money values
 * exactly (0.1, 8.8, ... are all repeating binary fractions), and every
 * FIXED add or PERCENT multiply in the adjustment loops is another chance for
 * that representation error to show up in the result. Two rounding
 * strategies are both wrong:
 *
 *   - Rounding ONLY at the very end (e.g. only on the final invoice total)
 *     lets an already-drifted per-unit value get multiplied by quantity —
 *     for a large quantity, a tiny per-unit float error is scaled up into a
 *     visibly wrong line total, and that wrong `net_total` is what gets
 *     written to the sheet.
 *   - Rounding after EVERY intermediate step (after each FIXED/PERCENT
 *     adjustment individually) is also wrong: it feeds an already-rounded,
 *     slightly-off per-unit value into the NEXT adjustment, so a PERCENT
 *     step compounds on a number a human didn't intend it to compound on.
 *     `unitPrice 100, [FIXED -12, PERCENT -10]` must compound the -10% on
 *     exactly 88, not on round(88.000000000001) if that were the case, and
 *     definitely not on a value that was rounded and then had a *different*
 *     adjustment's error baked in.
 *
 * The rule this file follows: round a value at the moment it becomes a
 * monetary amount that will be either persisted or fed into a *different*
 * kind of operation (summed across a different scope, or scaled by a factor
 * it hasn't already been scaled by) — never mid-reduction over the same
 * adjustment array.
 *
 *   1. Item level: adjustments reduce over the per-unit running value with
 *      NO rounding between steps (PERCENT must compound on the exact prior
 *      step's value, not a rounded one). Round the result ONCE, after the
 *      full reduce, because that per-unit amount is about to be scaled by
 *      quantity — an unrounded float error would otherwise be multiplied up.
 *   2. `subtotal` (quantity × raw unitPrice) and `netTotal` (quantity ×
 *      rounded adjusted unit) are each rounded once, right after their
 *      multiply — these are the values that get written to the sheet as
 *      `subtotal` / `net_total`, so they must land on an exact cent.
 *   3. Invoice level: line `netTotal`s are already rounded money, but
 *      summing several 2-decimal floats can itself reintroduce binary drift
 *      (e.g. 400 + 316.8 + 150 in IEEE 754), so the sum is rounded once
 *      before invoice-level adjustments run.
 *   4. Invoice-level adjustments reduce with a round after EACH step. Unlike
 *      the per-unit case, there is no further "scale by a factor" step
 *      downstream — each intermediate running total already IS a monetary
 *      amount (a partial invoice total), so rounding it immediately is the
 *      correct, not premature, thing to do; it keeps a PERCENT adjustment
 *      compounding on a clean cent value instead of amplifying whatever
 *      binary noise the previous FIXED/PERCENT step left behind.
 */

export type InvoiceAdjustmentCalculation = 'FIXED' | 'PERCENT'

/** The minimal shape the calculator needs from an adjustment — structurally
 *  compatible with both `InvoiceAdjustmentInput` (camelCase, FE↔BE contract)
 *  and any local form state, without importing Zod or either contract file. */
export interface CalculatorAdjustment {
  calculation: InvoiceAdjustmentCalculation
  value: number
}

export interface InvoiceLineCalculationInput {
  quantity: number
  unitPrice: number
  /** Array order is significant — see the module header. */
  adjustments: readonly CalculatorAdjustment[]
}

export interface InvoiceLineCalculationResult {
  /** quantity × unitPrice, before adjustments. */
  subtotal: number
  /** Final line total after every adjustment, applied per unit, × quantity. */
  netTotal: number
}

/** One adjustment step against a running numeric value — FIXED adds the
 *  signed value once; PERCENT adds `value`% of the CURRENT running value
 *  (compounding). Shared by both levels below; the only difference between
 *  the two levels is what "running value" they start from and how many times
 *  the result is used afterward. */
function applyAdjustmentStep(running: number, adjustment: CalculatorAdjustment): number {
  return adjustment.calculation === 'FIXED'
    ? running + adjustment.value
    : running + (running * adjustment.value) / 100
}

/** Rounds a number to 2 decimal places the way money needs, not the way
 *  `Math.round(x * 100) / 100` does. That bare form misbehaves on inputs
 *  like `1.005`, which IEEE 754 actually stores as
 *  `1.00499999999999989...` — multiplying by 100 first gives `100.49999...`,
 *  which rounds DOWN to `1.00` instead of the `1.01` a human expects.
 *
 *  The fix: shift the decimal point using the number's *string* form (via
 *  exponential notation) rather than a floating-point multiply. `Number`
 *  parses `"1.005e2"` as the nearest double to the literal decimal 100.5
 *  (i.e. it round-trips through the correctly-rounded string the runtime
 *  already knows how to produce for `1.005`), so `Math.round` sees 100.5,
 *  not 100.49999999999999. Shifting back the same way avoids reintroducing
 *  a division's rounding error. */
function roundMoney(value: number): number {
  const shifted = Number(`${value}e2`)
  const rounded = Math.round(shifted)
  return Number(`${rounded}e-2`)
}

/** Computes one line's `subtotal`/`netTotal`. Item-level adjustments apply
 *  per unit, in array order, to a running per-unit value that starts at
 *  `unitPrice`; only after every adjustment does the result get × quantity. */
export function computeInvoiceLine(
  input: InvoiceLineCalculationInput,
): InvoiceLineCalculationResult {
  // No rounding between steps: PERCENT must compound on the exact prior
  // step's value (see module header point 1).
  const rawAdjustedUnit = input.adjustments.reduce(applyAdjustmentStep, input.unitPrice)
  // Round once, now, because this per-unit amount is about to be scaled by
  // quantity — leaving it unrounded would let a tiny float error multiply up.
  const adjustedUnit = roundMoney(rawAdjustedUnit)

  return {
    subtotal: roundMoney(input.quantity * input.unitPrice),
    netTotal: roundMoney(input.quantity * adjustedUnit),
  }
}

/** Computes the invoice-level running total: every line's `netTotal` summed,
 *  then invoice-level adjustments applied ONCE, in array order, to that sum —
 *  never per unit, never per line. Preview/response only; never written to a
 *  sheet (the Invoice row carries no total column). */
export function computeInvoiceTotal(
  lineNetTotals: readonly number[],
  adjustments: readonly CalculatorAdjustment[],
): number {
  // Each netTotal is already rounded money, but summing several 2-decimal
  // floats can itself reintroduce binary drift (e.g. 400 + 316.8 + 150), so
  // round the sum once before invoice-level adjustments run.
  const linesTotal = roundMoney(lineNetTotals.reduce((sum, netTotal) => sum + netTotal, 0))

  // Round after EACH invoice-level step, unlike the per-unit reduce above:
  // there is no later "scale by a factor" step downstream of this one, so
  // every intermediate running value already IS a monetary amount (a partial
  // invoice total) — rounding it immediately keeps the next PERCENT step
  // compounding on a clean cent value instead of the previous step's noise.
  return adjustments.reduce((running, adjustment) => roundMoney(applyAdjustmentStep(running, adjustment)), linesTotal)
}

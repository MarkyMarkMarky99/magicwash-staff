/** Shared by the create-form preview and the server's authoritative recomputation. */

export type InvoiceAdjustmentCalculation = 'FIXED' | 'PERCENT'

/** Keeps the calculator independent of contract schemas and form-state types. */
export interface CalculatorAdjustment {
  calculation: InvoiceAdjustmentCalculation
  value: number
}

export interface InvoiceLineCalculationInput {
  quantity: number
  unitPrice: number
  /** Order is load-bearing — PERCENT compounds on the running value; never sort or dedupe. */
  adjustments: readonly CalculatorAdjustment[]
}

export interface InvoiceLineCalculationResult {
  subtotal: number
  netTotal: number
}

function applyAdjustmentStep(running: number, adjustment: CalculatorAdjustment): number {
  return adjustment.calculation === 'FIXED'
    ? running + adjustment.value
    : running + (running * adjustment.value) / 100
}

/** Uses exponential-string shifting to avoid floating-point errors from `value * 100`. */
export function roundMoney(value: number): number {
  const shifted = Number(`${value}e2`)
  const rounded = Math.round(shifted)
  return Number(`${rounded}e-2`)
}

/** Line adjustments apply per unit in array order before quantity is applied. */
export function computeInvoiceLine(
  input: InvoiceLineCalculationInput,
): InvoiceLineCalculationResult {
  const rawAdjustedUnit = input.adjustments.reduce(applyAdjustmentStep, input.unitPrice)
  // Round after the per-unit reduction, before quantity scales it.
  const adjustedUnit = roundMoney(rawAdjustedUnit)

  return {
    subtotal: roundMoney(input.quantity * input.unitPrice),
    netTotal: roundMoney(input.quantity * adjustedUnit),
  }
}

/** Invoice adjustments apply once to the rounded line-total sum, in array order. */
export function computeInvoiceTotal(
  lineNetTotals: readonly number[],
  adjustments: readonly CalculatorAdjustment[],
): number {
  const linesTotal = roundMoney(lineNetTotals.reduce((sum, netTotal) => sum + netTotal, 0))

  // Invoice-level adjustment steps round independently.
  return adjustments.reduce((running, adjustment) => roundMoney(applyAdjustmentStep(running, adjustment)), linesTotal)
}

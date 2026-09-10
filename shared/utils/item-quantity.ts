export const MAX_ORDER_IMAGE_WEIGHT_KG = 200

export function isWeightUnit(unit: string | null | undefined): boolean {
  return unit?.trim().toLowerCase() === 'kg'
}

export function itemQuantityStep(unit: string | null | undefined): '0.1' | '1' {
  return isWeightUnit(unit) ? '0.1' : '1'
}

export function isValidItemQuantity(
  rawQuantity: string | number,
  unit: string | null | undefined,
): boolean {
  const normalizedQuantity = typeof rawQuantity === 'string' ? rawQuantity.trim() : rawQuantity
  if (normalizedQuantity === '') return false

  const quantity = Number(normalizedQuantity)
  if (!Number.isFinite(quantity) || quantity <= 0) return false
  if (!isWeightUnit(unit)) return Number.isInteger(quantity)
  if (
    typeof normalizedQuantity === 'string'
    && !/^(?:\d+(?:\.\d)?|\.\d)$/.test(normalizedQuantity)
  ) return false

  const tenths = quantity * 10
  return Number.isInteger(tenths) && tenths > 0
}

export function isValidOrderImageWeight(quantity: string | number): boolean {
  return Number(quantity) <= MAX_ORDER_IMAGE_WEIGHT_KG && isValidItemQuantity(quantity, 'kg')
}

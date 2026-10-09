interface WeightedBasket {
  weightBeforeKg: number | null
  weightAfterKg: number | null
}

export function formatKg(value: number): string {
  return `${value.toFixed(1)} kg`
}

// "12.5 kg" before washing; "12.5 → 11.8 kg" once the washed weight is known.
export function formatWeights(row: WeightedBasket): string {
  const before = row.weightBeforeKg
  const after = row.weightAfterKg
  if (before !== null && after !== null) return `${before.toFixed(1)} → ${formatKg(after)}`
  if (before !== null) return formatKg(before)
  if (after !== null) return `After ${formatKg(after)}`
  return ''
}

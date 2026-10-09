export function formatKg(value: number): string {
  return `${value.toFixed(1)} kg`
}

// Weight-column figure: one decimal at most, no trailing ".0" (14 kg, 12.5 kg).
export function formatKgFigure(value: number): string {
  return String(Number(value.toFixed(1)))
}

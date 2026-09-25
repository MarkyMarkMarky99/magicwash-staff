export function orderQuantityMismatch(
  quantity: number | null,
  items: ReadonlyArray<{ quantity: number | null }>,
): boolean {
  return quantity === null || items.length === 0 || quantity !== items.reduce((sum, item) => sum + (item.quantity ?? 0), 0)
}

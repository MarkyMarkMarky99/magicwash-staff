const bahtFormatter = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatOrderPrice(price: number): string {
  return bahtFormatter.format(price)
}

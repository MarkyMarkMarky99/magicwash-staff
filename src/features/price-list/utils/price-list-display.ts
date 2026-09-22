const categoryOrder = ['CLOTHING', 'BEDDING', 'HOUSEHOLD', 'OTHERS']

export function comparePriceListCategories(a: string, b: string): number {
  const aOrder = categoryOrder.indexOf(a.toUpperCase())
  const bOrder = categoryOrder.indexOf(b.toUpperCase())
  return (aOrder < 0 ? categoryOrder.length : aOrder)
    - (bOrder < 0 ? categoryOrder.length : bOrder) || a.localeCompare(b, 'th-TH')
}

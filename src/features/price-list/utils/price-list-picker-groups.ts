export type ItemTypeGroup<T> = {
  key: string
  category: string
  subcategory: string
  itemType: string
  items: T[]
}

export function groupItemTypes<T extends { category: string; subcategory: string; itemType: string }>(
  items: readonly T[],
): ItemTypeGroup<T>[] {
  const groups = new Map<string, ItemTypeGroup<T>>()
  for (const item of items) {
    // The same itemType can describe different products in separate subcategories.
    const key = JSON.stringify([item.category, item.subcategory, item.itemType])
    const existing = groups.get(key)
    if (existing) existing.items.push(item)
    else groups.set(key, {
      key, category: item.category, subcategory: item.subcategory,
      itemType: item.itemType, items: [item],
    })
  }
  return [...groups.values()].sort((a, b) =>
    a.category.localeCompare(b.category, 'th-TH')
    || a.itemType.localeCompare(b.itemType, 'th-TH'),
  )
}

export function groupVariants<T extends { variant: string | null }>(items: readonly T[]) {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = item.variant ?? ''
    const existing = groups.get(key)
    if (existing) existing.push(item)
    else groups.set(key, [item])
  }
  return [...groups].map(([key, groupedItems]) => ({
    key, items: groupedItems, name: key || 'General',
  }))
}

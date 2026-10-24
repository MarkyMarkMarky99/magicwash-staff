import type { OrderIntakeGarment } from '@/features/orders/utils/order-intake-draft'

export const UNCATEGORIZED_ROW_KEY = 'uncategorized'
export const UNCATEGORIZED_ROW_NAME = 'Uncategorized'

export interface OrderIntakeCatalogItem {
  id: string
  displayNameTh: string
  displayNameEn: string | null
  imageUrl?: string | null
}

export interface OrderIntakeRow {
  key: string
  itemId: string | null
  name: string
  nameTh: string | null
  imageUrl: string | null
  uncategorized: boolean
  garments: OrderIntakeGarment[]
}

export interface OrderIntakeRows {
  rows: OrderIntakeRow[]
  total: number
}

export function orderIntakeItemName(item: OrderIntakeCatalogItem): string {
  return item.displayNameEn?.trim() || item.displayNameTh
}

export function groupOrderIntakeGarments(
  garments: readonly OrderIntakeGarment[],
  catalog: readonly OrderIntakeCatalogItem[],
): OrderIntakeRows {
  const items = new Map(catalog.map((item) => [item.id, item]))
  const typed = new Map<string, OrderIntakeRow>()
  const uncategorized: OrderIntakeGarment[] = []
  for (const garment of garments) {
    const item = garment.itemId === null ? undefined : items.get(garment.itemId)
    if (garment.itemId === null || item === undefined) {
      uncategorized.push(garment)
      continue
    }
    const row = typed.get(garment.itemId)
    if (row) row.garments.push(garment)
    else {
      const name = orderIntakeItemName(item)
      const nameTh = item.displayNameTh.trim() && item.displayNameTh.trim() !== name ? item.displayNameTh.trim() : null
      typed.set(garment.itemId, { key: garment.itemId, itemId: garment.itemId, name, nameTh, imageUrl: item.imageUrl ?? null, uncategorized: false, garments: [garment] })
    }
  }
  const rows = [...typed.values()].sort((a, b) => a.name.localeCompare(b.name, 'th-TH') || a.key.localeCompare(b.key))
  if (uncategorized.length > 0) {
    rows.push({ key: UNCATEGORIZED_ROW_KEY, itemId: null, name: UNCATEGORIZED_ROW_NAME, nameTh: null, imageUrl: null, uncategorized: true, garments: uncategorized })
  }
  return { rows, total: garments.length }
}

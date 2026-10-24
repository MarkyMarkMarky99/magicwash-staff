import type { OrderIntakeGarment } from '@/features/orders/utils/order-intake-draft'

export const UNCATEGORIZED_ROW_KEY = 'uncategorized'
export const UNCATEGORIZED_ROW_NAME = 'Uncategorized'

export interface OrderIntakeCatalogItem {
  id: string
  displayNameTh: string
  displayNameEn: string | null
}

export interface OrderIntakeRow {
  key: string
  itemId: string | null
  name: string
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
  const names = new Map(catalog.map((item) => [item.id, orderIntakeItemName(item)]))
  const typed = new Map<string, OrderIntakeRow>()
  const uncategorized: OrderIntakeGarment[] = []
  for (const garment of garments) {
    const name = garment.itemId === null ? undefined : names.get(garment.itemId)
    if (garment.itemId === null || name === undefined) {
      uncategorized.push(garment)
      continue
    }
    const row = typed.get(garment.itemId)
    if (row) row.garments.push(garment)
    else typed.set(garment.itemId, { key: garment.itemId, itemId: garment.itemId, name, uncategorized: false, garments: [garment] })
  }
  const rows = [...typed.values()].sort((a, b) => a.name.localeCompare(b.name, 'th-TH') || a.key.localeCompare(b.key))
  if (uncategorized.length > 0) {
    rows.push({ key: UNCATEGORIZED_ROW_KEY, itemId: null, name: UNCATEGORIZED_ROW_NAME, uncategorized: true, garments: uncategorized })
  }
  return { rows, total: garments.length }
}

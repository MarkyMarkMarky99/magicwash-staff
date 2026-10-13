import type { PriceListDto } from '@/data/price-list/price-list.service'

export interface CorporateOrderItem {
  itemCode: string
  nameEn: string | null
  nameTh: string
  imageUrl: string | null
}

export function corporateOrderItems(
  priceGroup: string | null | undefined,
  rows: readonly PriceListDto[],
): CorporateOrderItem[] {
  const group = priceGroup?.trim()
  if (!group) return []

  const byCode = new Map<string, CorporateOrderItem>()
  for (const row of rows) {
    if (!row.active || row.priceGroup !== group) continue
    const existing = byCode.get(row.itemCode)
    if (existing) {
      existing.nameEn ??= row.displayNameEn
      existing.imageUrl ??= row.imageUrl
      continue
    }
    byCode.set(row.itemCode, {
      itemCode: row.itemCode,
      nameEn: row.displayNameEn,
      nameTh: row.displayNameTh,
      imageUrl: row.imageUrl,
    })
  }
  return [...byCode.values()]
}

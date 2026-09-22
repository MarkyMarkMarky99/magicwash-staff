import type { PriceListDto } from '@/data/price-list/price-list.service'

export function filterOrderPriceListItems(
  items: PriceListDto[],
): PriceListDto[] {
  const byCode = new Map<string, PriceListDto>()
  for (const item of items) {
    const existing = byCode.get(item.itemCode)
    if (!existing || (!existing.active && item.active)
      || (existing.active === item.active && existing.priceGroup !== 'DEFAULT' && item.priceGroup === 'DEFAULT')) {
      byCode.set(item.itemCode, item)
    }
  }
  return [...byCode.values()]
}

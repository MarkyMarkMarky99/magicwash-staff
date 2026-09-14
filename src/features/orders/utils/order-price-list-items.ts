import type { PriceListDto } from '@/data/price-list/price-list.service'

export function filterOrderPriceListItems(
  items: PriceListDto[],
  serviceType: PriceListDto['serviceType'] | null,
): PriceListDto[] {
  if (serviceType === null) return []
  return items.filter((item) =>
    item.active === true
    && item.priceGroup === 'DEFAULT'
    && item.serviceType === serviceType,
  )
}

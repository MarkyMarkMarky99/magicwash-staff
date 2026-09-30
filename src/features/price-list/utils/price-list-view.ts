import type { PriceListDto } from '@/data/price-list/price-list.service'

export function rowsForPriceListView(rows: PriceListDto[], view: 'PRICE' | 'CREDIT'): PriceListDto[] {
  return rows.filter((row) => row.active && (view === 'CREDIT' ? row.priceGroup === 'CREDIT' : row.priceGroup !== 'CREDIT'))
}

export function priceListValueLabel(row: Pick<PriceListDto, 'price' | 'priceGroup' | 'unit'>): string {
  const value = new Intl.NumberFormat('th-TH').format(row.price)
  return row.priceGroup === 'CREDIT' ? `${value} เครดิต / ${row.unit ?? '—'}` : `฿${value}`
}

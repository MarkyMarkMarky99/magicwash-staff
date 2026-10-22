import type { PriceListDto } from '@/data/price-list/price-list.service'

type ServiceType = PriceListDto['serviceType']

export const priceListServices: readonly { key: ServiceType; label: string; icon: string }[] = [
  { key: 'WSIR', label: 'Wash Iron', icon: 'local_laundry_service' },
  { key: 'WASH', label: 'Wash', icon: 'water_drop' },
  { key: 'DRCL', label: 'Dry Clean', icon: 'dry_cleaning' },
  { key: 'IRON', label: 'Iron', icon: 'iron' },
]

const unitLabels: Record<string, string> = { piece: '(pc)', set: '(set)', pair: '(pr)' }

export interface PriceListTableRow {
  key: string
  nameTh: string
  secondLine: string
  variant: string | null
  prices: Partial<Record<ServiceType, PriceListDto>>
}

export interface PriceListTableCard {
  key: string
  subcategory: string
  services: ServiceType[]
  rows: PriceListTableRow[]
}

export function isServiceType(value: string | null): value is ServiceType {
  return priceListServices.some((service) => service.key === value)
}

export function serviceLabel(serviceType: ServiceType): string {
  return priceListServices.find((service) => service.key === serviceType)?.label ?? serviceType
}

export function retailPriceRows(items: PriceListDto[]): PriceListDto[] {
  return items.filter((item) => item.active && item.priceGroup === 'DEFAULT')
}

function secondLine(item: PriceListDto): string {
  const unit = item.unit ? (unitLabels[item.unit] ?? `(${item.unit})`) : null
  return [item.displayNameEn, unit].filter(Boolean).join(' · ')
}

export function buildPriceListCards(rows: PriceListDto[], serviceType: ServiceType | null): PriceListTableCard[] {
  const cards = new Map<string, PriceListTableCard>()
  for (const item of rows) {
    if (serviceType && item.serviceType !== serviceType) continue
    const cardKey = `${item.category}|${item.subcategory}`
    let card = cards.get(cardKey)
    if (!card) {
      card = { key: cardKey, subcategory: item.subcategory, services: [], rows: [] }
      cards.set(cardKey, card)
    }
    const variant = item.variant?.trim() || null
    let row = card.rows.find((entry) => entry.nameTh === item.displayNameTh
      && entry.variant === variant
      && entry.prices[item.serviceType] === undefined)
    if (!row) {
      row = { key: item.id, nameTh: item.displayNameTh, secondLine: secondLine(item), variant, prices: {} }
      card.rows.push(row)
    }
    row.prices[item.serviceType] = item
  }
  const ordered = [...cards.values()]
  for (const card of ordered) {
    card.services = priceListServices
      .map((service) => service.key)
      .filter((key) => card.rows.some((row) => row.prices[key] !== undefined))
  }
  return ordered
}

export function countPriceListRows(cards: PriceListTableCard[]): number {
  return cards.reduce((total, card) => total + card.rows.length, 0)
}

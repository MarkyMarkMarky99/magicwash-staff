import type { InvoicePriceListItemDto } from '../services/invoice-price-list.service'
import { formatSheetDate } from '@/shared/utils/sheet-date'
import { createEmptyLineItemRow, type LineItemFormRow } from '../types/invoice-create.types'

export const PRICE_LIST_RENDER_CAP = 2000

export const PRICE_LIST_SERVICES = [
  { key: 'washDryIronPrice', label: 'ซัก อบ รีด', icon: 'local_laundry_service' },
  { key: 'ironOnlyPrice', label: 'รีดอย่างเดียว', icon: 'iron' },
  { key: 'dryCleanPrice', label: 'ดรายคลีน', icon: 'dry_cleaning' },
] as const

export type PriceListServiceKey = (typeof PRICE_LIST_SERVICES)[number]['key']

export interface PriceListServiceOption {
  key: PriceListServiceKey
  label: string
  icon: string
  price: number
}

export interface PriceListCategoryGroup {
  category: string
  items: InvoicePriceListItemDto[]
}

/**
 * `0` is a valid price. Never use truthiness (`if (price)`, `price || fallback`)
 * — a free item would silently vanish.
 */
export function hasServicePrice(price: number | null | undefined): price is number {
  return price !== null && price !== undefined
}

export function availableServices(item: InvoicePriceListItemDto): PriceListServiceOption[] {
  const options: PriceListServiceOption[] = []
  for (const service of PRICE_LIST_SERVICES) {
    const price = item[service.key]
    if (hasServicePrice(price)) {
      options.push({ key: service.key, label: service.label, icon: service.icon, price })
    }
  }
  return options
}

export function serviceLabel(serviceKey: PriceListServiceKey): string {
  const match = PRICE_LIST_SERVICES.find((service) => service.key === serviceKey)
  return match?.label ?? serviceKey
}

/**
 * Icons are hinted from the category *string*, not a hardcoded catalog of
 * known category names — whatever categories the API returns get an icon.
 */
const CATEGORY_ICON_HINTS: ReadonlyArray<{ pattern: RegExp; icon: string }> = [
  { pattern: /bed|pillow|duvet|sheet|blanket|linen|quilt/i, icon: 'bed' },
  { pattern: /suit|formal|gown|tuxedo|jacket|blazer/i, icon: 'dry_cleaning' },
  { pattern: /curtain|household|rug|carpet|drape|home/i, icon: 'curtains' },
  { pattern: /bag|leather|luggage|handbag|wallet/i, icon: 'work' },
  { pattern: /apparel|shirt|cloth|wear|pant|skirt|dress|polo|garment/i, icon: 'checkroom' },
]

export function iconForCategory(category: string): string {
  const haystack = category.trim()
  for (const hint of CATEGORY_ICON_HINTS) {
    if (hint.pattern.test(haystack)) return hint.icon
  }
  return 'local_laundry_service'
}

export function uniqueCategories(items: readonly InvoicePriceListItemDto[]): string[] {
  const seen = new Set<string>()
  const categories: string[] = []
  for (const item of items) {
    if (seen.has(item.category)) continue
    seen.add(item.category)
    categories.push(item.category)
  }
  return categories
}

export function filterPriceListItems(
  items: readonly InvoicePriceListItemDto[],
  options: { query: string; category: string | null },
): InvoicePriceListItemDto[] {
  const query = options.query.trim().toLocaleLowerCase('th-TH')
  return items.filter((item) => {
    if (options.category !== null && item.category !== options.category) return false
    if (!query) return true
    return matchesPriceListSearch(item, query)
  })
}

export function matchesPriceListSearch(item: InvoicePriceListItemDto, normalizedQuery: string): boolean {
  const fields = [
    item.itemCode,
    item.displayNameTh,
    item.category,
    item.subcategory,
    item.itemType,
    item.variant,
  ]
  return fields.some((value) => (value ?? '').toLocaleLowerCase('th-TH').includes(normalizedQuery))
}

export function groupPriceListByCategory(
  items: readonly InvoicePriceListItemDto[],
): PriceListCategoryGroup[] {
  const groups = new Map<string, InvoicePriceListItemDto[]>()
  for (const item of items) {
    const current = groups.get(item.category)
    if (current) {
      current.push(item)
    } else {
      groups.set(item.category, [item])
    }
  }
  return Array.from(groups, ([category, groupItems]) => ({ category, items: groupItems }))
}

export function capGroupedItems(
  groups: readonly PriceListCategoryGroup[],
  cap: number = PRICE_LIST_RENDER_CAP,
): { groups: PriceListCategoryGroup[]; truncated: boolean; renderedCount: number } {
  let remaining = cap
  const capped: PriceListCategoryGroup[] = []

  for (const group of groups) {
    if (remaining <= 0) break
    const slice = group.items.slice(0, remaining)
    remaining -= slice.length
    capped.push({ category: group.category, items: slice })
  }

  const renderedCount = cap - remaining
  const total = groups.reduce((sum, group) => sum + group.items.length, 0)
  return { groups: capped, truncated: total > cap, renderedCount }
}

export function formatEffectiveRange(from: string, to: string | null): string {
  return `มีผล: ${formatSheetDate(from)} – ${formatSheetDate(to)}`
}

export function formatBaht(price: number): string {
  return `฿${new Intl.NumberFormat('th-TH').format(price)}`
}

export function toLineItemFormRow(
  item: InvoicePriceListItemDto,
  serviceKey: PriceListServiceKey,
): LineItemFormRow | null {
  const price = item[serviceKey]
  if (!hasServicePrice(price)) return null

  const line = createEmptyLineItemRow()
  line.description = `${item.displayNameTh} (${serviceLabel(serviceKey)})`
  line.unit = 'piece'
  line.unitOption = 'piece'
  line.quantity = '1'
  line.unitPrice = String(price)
  line.adjustments = []
  return line
}

/**
 * True only for the still-untouched blank row *we* seeded because the order
 * had zero items. Provenance is the `syntheticPlaceholder` marker — field
 * values alone cannot distinguish that row from an order-seeded line whose
 * description/quantity were null.
 */
export function isUnusedPlaceholderLine(row: LineItemFormRow): boolean {
  return (
    row.syntheticPlaceholder === true
    && row.description.trim() === ''
    && row.unitPrice.trim() === ''
    && row.quantity === '1'
    && row.adjustments.length === 0
  )
}

/**
 * Always-safe append. An empty `existing` array is a first-class case — never
 * index `existing[existing.length - 1]` without handling length 0.
 *
 * The only replace case is a single still-unused synthetic placeholder.
 * Order-seeded rows are never marked, so a blank-looking real line is appended
 * to, not overwritten.
 */
export function appendPickedLine(
  existing: readonly LineItemFormRow[],
  picked: LineItemFormRow,
): LineItemFormRow[] {
  if (existing.length === 0) return [picked]
  if (existing.length === 1 && isUnusedPlaceholderLine(existing[0]!)) return [picked]
  return [...existing, picked]
}

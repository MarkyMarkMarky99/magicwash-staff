import type { ReadSlipResult } from '@shared/ai-gateway/tasks/read-slip'
import { getSheetDateCalendar } from '@/shared/utils/sheet-date'
import { addedLine, type CorporateOrderLine } from './corporate-order-draft'

export function slipPrefill(current: readonly CorporateOrderLine[], result: ReadSlipResult) {
  const items = new Map(result.items.map((item) => [item.itemCode, item]))
  const lines = current.filter((line) => !line.added).map((line) => ({
    ...line, counted: items.get(line.itemCode ?? '')?.count ?? null,
  }))
  const listedCodes = new Set(lines.map((line) => line.itemCode))
  const keys = new Set(lines.map((line) => line.key))
  let sequence = 0
  const extras = [
    ...result.items.filter((item) => !listedCodes.has(item.itemCode)).map((item) => ({
      name: item.nameEn ?? item.nameTh, count: item.count, itemCode: item.itemCode,
    })),
    ...result.unlisted.map((item) => ({ ...item, itemCode: null })),
  ]
  const flaggedKeys = new Set<string>()
  const flaggedCodes = new Set(result.warnings.map((warning) => warning.field.startsWith('items.') ? warning.field.slice(6) : null))
  for (const line of lines) {
    if (line.itemCode && flaggedCodes.has(line.itemCode)) flaggedKeys.add(line.key)
  }
  for (const item of extras) {
    let key: string
    do { key = `added-ai-${++sequence}` } while (keys.has(key))
    keys.add(key)
    lines.push(addedLine(key, item.name, item.count))
    if (item.itemCode && flaggedCodes.has(item.itemCode)) flaggedKeys.add(key)
  }
  const date = result.header.collectionDate.date
  return {
    lines,
    receivedDate: date && getSheetDateCalendar(date) ? date : null,
    flaggedKeys: [...flaggedKeys],
    warnings: result.warnings,
  }
}

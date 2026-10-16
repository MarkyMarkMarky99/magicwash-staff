export const FALLBACK_ITEM_NAME = 'Item'

export type ItemNameLink = { itemId: string; orderItemId: string }
export type ItemNameOrderItem = { orderItemId: string; description: string | null }

// A garment tag is saved in a photo's `itemId` at registration; the photo's `orderItemId` names the
// order item whose description is the display name. Photos whose `itemId` is not a tag (the
// reassignment path writes a catalog id there) never match a garment, and links to unknown order
// items or items without a description are skipped.
export function buildItemNames(links: readonly ItemNameLink[], orderItems: readonly ItemNameOrderItem[]): Map<string, string> {
  const descriptions = new Map<string, string>()
  for (const item of orderItems) {
    const description = item.description?.trim()
    if (description) descriptions.set(item.orderItemId, description)
  }
  const names = new Map<string, string>()
  for (const link of links) {
    const description = descriptions.get(link.orderItemId)
    if (description && !names.has(link.itemId)) names.set(link.itemId, description)
  }
  return names
}

export function itemNameFor(names: ReadonlyMap<string, string>, tagId: string): string {
  return names.get(tagId) ?? FALLBACK_ITEM_NAME
}

import { validGarmentTag } from '@/shared/utils/garment-registration'
import type { OrderIntakeGarment } from '@/features/orders/utils/order-intake-draft'

export interface OrderIntakeScanLookup {
  customerId: string
  itemId: string | null
  imageUrl: string | null
}

export type OrderIntakeScanBanner =
  | { tone: 'success' | 'warning', tag: string, message: string | null }
  | { tone: 'error', tag: string | null, message: string }

export type OrderIntakeScanResult =
  | { kind: 'added', garment: OrderIntakeGarment, banner: OrderIntakeScanBanner }
  | { kind: 'refused', banner: OrderIntakeScanBanner }

export interface OrderIntakeScanContext {
  customerId: string
  hasTag: (tag: string) => boolean
  lookup: (tag: string) => Promise<OrderIntakeScanLookup | null>
}

export function checkScannedTag(code: string, hasTag: (tag: string) => boolean): { tag: string } | { banner: OrderIntakeScanBanner } {
  const tag = validGarmentTag(code)
  if (!tag) return { banner: { tone: 'error', tag: null, message: 'Not a garment tag' } }
  if (hasTag(tag)) return { banner: { tone: 'warning', tag, message: 'Already in this order' } }
  return { tag }
}

function refused(tag: string, message: string): OrderIntakeScanResult {
  return { kind: 'refused', banner: { tone: 'error', tag, message } }
}

export async function resolveScannedTag(tag: string, context: OrderIntakeScanContext): Promise<OrderIntakeScanResult> {
  let found: OrderIntakeScanLookup | null
  try {
    found = await context.lookup(tag)
  } catch {
    return refused(tag, `Could not check ${tag}. Try again.`)
  }
  if (found === null) return refused(tag, `${tag} is not registered. Register it on Register Garments first.`)
  if (found.customerId !== context.customerId) return refused(tag, `${tag} belongs to another customer`)
  return {
    kind: 'added',
    garment: { tag, itemId: found.itemId, imageUrl: found.imageUrl, note: null, defectPhotos: [] },
    banner: { tone: 'success', tag, message: null },
  }
}

/**
 * Look a tag up in the customer's garments loaded when the page opened; only a tag not found there
 * (another customer's, unregistered, or registered after the page opened) goes to the server.
 * A failed preload sends every tag to the server.
 */
export function preloadedLookup(
  preload: Promise<readonly (OrderIntakeScanLookup & { id: string })[]>,
  fallback: (tag: string) => Promise<OrderIntakeScanLookup | null>,
): (tag: string) => Promise<OrderIntakeScanLookup | null> {
  const known = preload.then(
    (garments) => new Map(garments.map((garment) => [garment.id, garment])),
    () => new Map<string, OrderIntakeScanLookup>(),
  )
  return async (tag) => (await known).get(tag) ?? fallback(tag)
}

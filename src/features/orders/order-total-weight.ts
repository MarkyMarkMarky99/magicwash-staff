import type { OrderImageDto } from '@/data/order-images/order-image.service'

export function orderTotalWeightKg(images: readonly Pick<OrderImageDto, 'imageType' | 'quantity'>[]): number | null {
  let total = 0
  let hasWeight = false
  for (const image of images) {
    if (image.imageType !== 'WEIGHT' || image.quantity === null) continue
    total += image.quantity
    hasWeight = true
  }
  return hasWeight ? Math.round(total * 10) / 10 : null
}

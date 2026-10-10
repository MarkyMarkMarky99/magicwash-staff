import type { z } from 'zod'
import type { washOptionsSchema } from '@contracts/wash-queue/wash-queue-api.schema'
import type { WashProductDto } from '@/data/wash-products/wash-products.service'

export type WashOptions = z.infer<typeof washOptionsSchema>

export function defaultWashOptions(products: readonly WashProductDto[]): WashOptions {
  const detergent = products.filter((product) => product.status === 'ACTIVE' && product.type === 'DETERGENT')
    .sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || a.id.localeCompare(b.id))[0]
  return {
    preRinse: false, soakMinutes: null, extraWash: false, temperature: 'cold',
    bleach: null, detergent: detergent?.id ?? null, softener: null, rinses: 2,
  }
}

export function washOptionLabels(options: WashOptions, nameOf: (id: string) => string): string[] {
  const labels: string[] = []
  if (options.preRinse) labels.push('Pre-rinse')
  if (options.soakMinutes !== null) labels.push(`Soak ${options.soakMinutes} min`)
  if (options.extraWash) labels.push('Extra wash')
  if (options.temperature !== 'cold') labels.push(`${options.temperature}°C`)
  for (const id of [options.bleach, options.detergent, options.softener]) {
    if (id !== null) labels.push(nameOf(id))
  }
  labels.push(`Rinse ${options.rinses}`)
  return labels
}

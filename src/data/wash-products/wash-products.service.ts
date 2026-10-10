import type { z } from 'zod'
import type { washProductRowSchema } from '@contracts/wash-products/wash-products-api.schema'
import { apiGet } from '@/shared/api/api-client'

export type WashProductDto = z.infer<typeof washProductRowSchema>

let requestSequence = 0
export function listWashProducts(): Promise<WashProductDto[]> {
  return apiGet<WashProductDto[]>(`/api/wash-products?request=${++requestSequence}`)
}

import {
  laundryTagPrintRequestSchema,
  laundryTagPrintResponseSchema,
  type LaundryTagPrintRequest,
  type LaundryTagPrintResponse,
} from '@contracts/laundry-tag-prints/laundry-tag-print.schema'
import type { WorkOrderDetailDto } from '@/data/work-orders/work-order.service'
import { apiPost } from '@/shared/api/api-client'
import { generateId } from '@shared/utils/id'

const ENDPOINT = '/api/laundry-tag-prints'
const TAG_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export function createLaundryTagPrintRequest(
  order: WorkOrderDetailDto,
  customerIndex: string,
  requestedCount?: number,
): LaundryTagPrintRequest {
  const totalCount = requestedCount ?? order.quantity
  if (typeof totalCount !== 'number' || !Number.isInteger(totalCount) || totalCount < 1 || totalCount > 999) {
    throw new Error('จำนวนแท็กต้องเป็นเลขจำนวนเต็มตั้งแต่ 1 ถึง 999')
  }

  const usedIds = new Set<string>()
  const tags = Array.from({ length: totalCount }, (_, index) => {
    let tagId: string
    do {
      tagId = generateId({ length: 8, alphabet: TAG_ALPHABET })
    } while (usedIds.has(tagId))
    usedIds.add(tagId)
    return { sequence: index + 1, tagId }
  })

  return laundryTagPrintRequestSchema.parse({ customerIndex, totalCount, tags })
}

export async function printLaundryTags(
  request: LaundryTagPrintRequest,
): Promise<LaundryTagPrintResponse> {
  return apiPost<LaundryTagPrintResponse>(ENDPOINT, {
    data: request,
    requestSchema: laundryTagPrintRequestSchema,
  })
}

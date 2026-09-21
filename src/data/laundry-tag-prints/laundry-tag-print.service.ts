import {
  laundryTagPrintRequestSchema,
  laundryTagPrintResponseSchema,
  type LaundryTagPrintRequest,
  type LaundryTagPrintResponse,
} from '@contracts/laundry-tag-prints/laundry-tag-print.schema'
import type { WorkOrderDetailDto } from '@/data/work-orders/work-order.service'
import { apiPost } from '@/shared/api/api-client'

const ENDPOINT = '/api/laundry-tag-prints'

export function createLaundryTagPrintRequest(
  order: WorkOrderDetailDto,
  customerIndex: string,
  requestedCount?: number,
): LaundryTagPrintRequest {
  const quantities = order.items.map((item) => item.quantity)
  if (quantities.length === 0 || quantities.some((quantity) =>
    !Number.isInteger(quantity) || quantity === null || quantity < 1
  )) {
    throw new Error('รายการชิ้นยังไม่มีจำนวนที่ใช้พิมพ์แท็กได้')
  }

  const itemCount = quantities.reduce<number>((sum, quantity) => sum + quantity!, 0)
  const totalCount = requestedCount ?? itemCount
  if (!Number.isInteger(totalCount) || totalCount < 1 || totalCount > 999) {
    throw new Error('จำนวนแท็กต้องเป็นเลขจำนวนเต็มตั้งแต่ 1 ถึง 999')
  }

  const usedIds = new Set<string>()
  const tags = Array.from({ length: totalCount }, (_, index) => {
    let tagId: string
    do {
      const value = crypto.getRandomValues(new Uint32Array(1))[0]!
      tagId = (value % 100_000_000).toString().padStart(8, '0')
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

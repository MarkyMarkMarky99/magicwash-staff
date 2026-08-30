import type { z } from 'zod'
import {
  workOrderCreateResponseSchema,
  workOrderCreateSchema,
  workOrderDetailResponseSchema,
  workOrderListQuerySchema,
  workOrderListResponseSchema,
} from '@contracts/work-orders/work-order-api.schema'
import { apiGet, apiGetList, apiPost, type ListResult } from '@/shared/api/api-client'

const WORK_ORDERS_ENDPOINT = '/api/work-orders'

export type WorkOrderListDto = z.infer<typeof workOrderListResponseSchema>
export type WorkOrderDetailDto = z.infer<typeof workOrderDetailResponseSchema>
export type WorkOrderCreatePayload = z.infer<typeof workOrderCreateSchema>
export type WorkOrderCreateDto = z.infer<typeof workOrderCreateResponseSchema>
export type WorkOrderListQuery = z.infer<typeof workOrderListQuerySchema>

export function listWorkOrders(query: Partial<WorkOrderListQuery> = {}): Promise<ListResult<WorkOrderListDto>> {
  return apiGetList<WorkOrderListDto>(WORK_ORDERS_ENDPOINT, { query, querySchema: workOrderListQuerySchema })
}

export function getWorkOrder(orderId: string): Promise<WorkOrderDetailDto> {
  return apiGet<WorkOrderDetailDto>(`${WORK_ORDERS_ENDPOINT}/${encodeURIComponent(orderId)}`)
}

export function createWorkOrder(payload: WorkOrderCreatePayload): Promise<WorkOrderCreateDto> {
  return apiPost<WorkOrderCreateDto>(WORK_ORDERS_ENDPOINT, { data: payload, requestSchema: workOrderCreateSchema })
}

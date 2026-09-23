import type { z } from 'zod'
import {
  workOrderCreateResponseSchema,
  workOrderCreateSchema,
  workOrderDetailResponseSchema,
  workOrderListQuerySchema,
  workOrderListResponseSchema,
  workOrderUpdateResponseSchema,
  workOrderUpdateSchema,
} from '@contracts/work-orders/work-order-api.schema'
import { apiGet, apiGetList, apiPatch, apiPost, type ListResult } from '@/shared/api/api-client'
import { invalidate } from '@/shared/api/response-cache'
import { currentActor } from '@/shared/config/actor'

const WORK_ORDERS_ENDPOINT = '/api/work-orders'

export type WorkOrderListDto = z.infer<typeof workOrderListResponseSchema>
export type WorkOrderDetailDto = z.infer<typeof workOrderDetailResponseSchema>
export type WorkOrderCreatePayload = z.infer<typeof workOrderCreateSchema>
export type WorkOrderCreateDto = z.infer<typeof workOrderCreateResponseSchema>
export type WorkOrderListQuery = z.infer<typeof workOrderListQuerySchema>
export type WorkOrderUpdatePayload = Omit<z.input<typeof workOrderUpdateSchema>, 'updatedBy'>
export type WorkOrderUpdateDto = z.infer<typeof workOrderUpdateResponseSchema>

export function listWorkOrders(
  query: Partial<WorkOrderListQuery> = {},
  onFresh?: (result: ListResult<WorkOrderListDto>) => void,
): Promise<ListResult<WorkOrderListDto>> {
  return apiGetList<WorkOrderListDto>(WORK_ORDERS_ENDPOINT, { query, querySchema: workOrderListQuerySchema, onFresh })
}

export function getWorkOrder(orderId: string): Promise<WorkOrderDetailDto> {
  return apiGet<WorkOrderDetailDto>(`${WORK_ORDERS_ENDPOINT}/${encodeURIComponent(orderId)}`)
}

export async function updateWorkOrder(orderId: string, payload: WorkOrderUpdatePayload): Promise<WorkOrderUpdateDto> {
  const result = await apiPatch<WorkOrderUpdateDto>(
    `${WORK_ORDERS_ENDPOINT}/${encodeURIComponent(orderId)}`,
    { data: { ...payload, updatedBy: currentActor() }, requestSchema: workOrderUpdateSchema },
  )
  invalidate('/api/work-orders')
  return result
}

export async function createWorkOrder(payload: WorkOrderCreatePayload): Promise<WorkOrderCreateDto> {
  const result = await apiPost<WorkOrderCreateDto>(WORK_ORDERS_ENDPOINT, { data: payload, requestSchema: workOrderCreateSchema })
  invalidate('/api/work-orders')
  return result
}

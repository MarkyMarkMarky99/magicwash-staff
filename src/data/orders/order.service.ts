import { listWorkOrders, type WorkOrderListDto } from '@/data/work-orders/work-order.service'

export type OrderListDto = WorkOrderListDto

export async function listOrdersByCustomer(
  customerId: string,
  onFresh?: (items: OrderListDto[]) => void,
): Promise<OrderListDto[]> {
  const { items } = await listWorkOrders({ customerId }, (result) => onFresh?.(result.items))
  return items
}

import type { OrderSnapshotDto } from '@/data/order-snapshots/order-snapshot.service'
import { containsKeyword, matchesCustomerKeyword, type CustomerSearchFields } from '@shared/utils/customer-search'

interface OrderListFilters {
  keyword: string
  dateField: 'receivedDate' | 'dueDate' | 'createdAt'
  date: string
}

export function filterOrderList(
  orders: OrderSnapshotDto[],
  { keyword, dateField, date }: OrderListFilters,
  customersById: Map<string, CustomerSearchFields>,
): OrderSnapshotDto[] {
  if (keyword.trim() !== '') {
    return orders.filter((order) => {
      const customer = customersById.get(order.customerId)
      return (customer !== undefined && matchesCustomerKeyword(customer, keyword))
        || containsKeyword(order.orderNumber, keyword)
        || containsKeyword(order.invoiceNumber, keyword)
    })
  }
  return orders.filter((order) => order[dateField]?.slice(0, 10) === date)
}

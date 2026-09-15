import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useCustomerOrdersStore } from '@/data/orders/order.store'
import { useCustomerAppointmentsStore } from '@/data/appointments/customer-appointments.store'
import { useCustomerOrderHistoryStore } from '@/features/customers/stores/customer-order-history.store'
import { invalidate } from '@/shared/api/response-cache'

interface PendingRequest {
  url: URL
  resolve: (response: Response) => void
}

const pending: PendingRequest[] = []
const originalFetch = globalThis.fetch
globalThis.fetch = ((input: string | URL | Request) => new Promise<Response>((resolve) => {
  pending.push({ url: new URL(String(input), 'http://localhost'), resolve })
})) as typeof fetch

function response(data: unknown): Response {
  return new Response(JSON.stringify({
    data,
    meta: { pagination: { page: 1, perPage: 500 } },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function resolveCustomer(customerId: string): void {
  pending.find((request) => request.url.pathname === `/api/customers/${customerId}`)!
    .resolve(response({ customerId, customerName: customerId }))
  pending.find((request) => request.url.pathname === '/api/work-orders'
    && request.url.searchParams.get('customerId') === customerId)!
    .resolve(response([{ orderId: `${customerId}-order`, customerId }]))
  pending.find((request) => request.url.pathname === '/api/appointments'
    && request.url.searchParams.get('customerId') === customerId)!
    .resolve(response([{
      appointmentId: `${customerId}-appointment`,
      customerId,
      appointmentType: 'PICKUP',
      appointmentDate: '2026-09-14',
      timeSlot: '10:00-12:00',
      status: 'PENDING',
    }]))
}

try {
  invalidate()
  setActivePinia(createPinia())
  const store = useCustomerOrderHistoryStore()
  const oldLoad = store.load('old-customer')
  const currentLoad = store.load('current-customer')

  resolveCustomer('current-customer')
  await currentLoad
  resolveCustomer('old-customer')
  await oldLoad

  assert.equal(store.customer?.customerId, 'current-customer')
  assert.equal(store.orders[0]?.orderId, 'current-customer-order')
  assert.equal(store.appointments[0]?.appointmentId, 'current-customer-appointment')
  assert.equal(store.customerLoading, false)
  assert.equal(store.ordersLoading, false)
  assert.equal(store.appointmentsLoading, false)

  store.$dispose()
  useCustomerOrdersStore().$dispose()
  useCustomerAppointmentsStore().$dispose()
} finally {
  globalThis.fetch = originalFetch
}

console.log('customer-order-history-race.dry-test: OK')

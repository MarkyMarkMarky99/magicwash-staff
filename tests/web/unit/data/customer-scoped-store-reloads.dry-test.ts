import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useCustomerAppointmentsStore } from '@/data/appointments/customer-appointments.store'
import { useCustomerPackagesByCustomerStore } from '@/data/customer-packages/customer-packages-by-customer.store'
import { useCustomerInvoicesStore } from '@/data/invoices/customer-invoices.store'
import { useCustomerOrdersStore } from '@/data/orders/order.store'
import { invalidate } from '@/shared/api/response-cache'

interface CustomerScopedStore {
  load(customerId: string, force?: boolean): Promise<void>
  $dispose(): void
}

const response = (rows: unknown[]) => new Response(JSON.stringify({
  data: rows,
  meta: { pagination: { page: 1, perPage: 20 } },
}), { status: 200, headers: { 'Content-Type': 'application/json' } })

async function assertSameCustomerRowsStayVisible(
  endpoint: string,
  store: CustomerScopedStore,
  rows: unknown[],
  readRows: () => unknown[],
): Promise<void> {
  const originalFetch = globalThis.fetch
  let requestCount = 0
  let resolveReload: ((value: Response) => void) | undefined

  globalThis.fetch = (async () => {
    requestCount += 1
    if (requestCount === 1) return response(rows)
    return new Promise<Response>((resolve) => { resolveReload = resolve })
  }) as typeof fetch

  try {
    invalidate(endpoint)
    await store.load('customer-1')
    assert.deepEqual(readRows(), rows)

    invalidate(endpoint)
    const reload = store.load('customer-1', true)
    assert.deepEqual(
      readRows(),
      rows,
      `${endpoint} must retain same-customer rows during a forced reload`,
    )
    resolveReload?.(response([]))
    await reload
  } finally {
    store.$dispose()
    globalThis.fetch = originalFetch
  }
}

setActivePinia(createPinia())
const appointments = useCustomerAppointmentsStore()
await assertSameCustomerRowsStayVisible(
  '/api/appointments',
  appointments,
  [{ appointmentId: 'appointment-1' }],
  () => appointments.items,
)

setActivePinia(createPinia())
const packages = useCustomerPackagesByCustomerStore()
await assertSameCustomerRowsStayVisible(
  '/api/customer-packages',
  packages,
  [{ customerPackageId: 'package-1' }],
  () => packages.items,
)

setActivePinia(createPinia())
const invoices = useCustomerInvoicesStore()
await assertSameCustomerRowsStayVisible(
  '/api/invoices',
  invoices,
  [{ invoiceId: 'invoice-1' }],
  () => invoices.invoices,
)

setActivePinia(createPinia())
const orders = useCustomerOrdersStore()
await assertSameCustomerRowsStayVisible(
  '/api/work-orders',
  orders,
  [{ orderId: 'order-1' }],
  () => orders.items,
)

console.log('customer-scoped-store-reloads.dry-test: OK')

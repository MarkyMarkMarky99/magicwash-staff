import assert from 'node:assert/strict'
import {
  APPOINTMENT_CREATE_ROUTE_NAME,
  CUSTOMER_PACKAGE_CREATE_ROUTE_NAME,
  INVOICE_CREATE_ROUTE_NAME,
  ORDER_CREATE_ROUTE_NAME,
  PRICE_LIST_ITEM_CREATE_ROUTE_NAME,
  appointmentCreateRoute,
  customerPackageCreateRoute,
  invoiceCreateRoute,
  orderCreateRoute,
  priceListItemCreateRoute,
} from '../../../../../src/shared/navigation/form-routes'

assert.deepEqual(appointmentCreateRoute({ customerId: 'C-1' }), {
  name: APPOINTMENT_CREATE_ROUTE_NAME,
  query: { customerId: 'C-1' },
})
assert.deepEqual(appointmentCreateRoute({ customerId: 'C-1', orderId: 'O-2' }), {
  name: APPOINTMENT_CREATE_ROUTE_NAME,
  query: { customerId: 'C-1', orderId: 'O-2' },
})
assert.deepEqual(orderCreateRoute(), { name: ORDER_CREATE_ROUTE_NAME, query: {} })
assert.deepEqual(orderCreateRoute({ customerId: 'C-1' }), {
  name: ORDER_CREATE_ROUTE_NAME,
  query: { customerId: 'C-1' },
})
assert.deepEqual(customerPackageCreateRoute(), {
  name: CUSTOMER_PACKAGE_CREATE_ROUTE_NAME,
  query: {},
})
assert.deepEqual(customerPackageCreateRoute({ customerId: 'C-1' }), {
  name: CUSTOMER_PACKAGE_CREATE_ROUTE_NAME,
  query: { customerId: 'C-1' },
})
assert.deepEqual(invoiceCreateRoute({ customerId: 'C-1', orderId: 'O-2' }), {
  name: INVOICE_CREATE_ROUTE_NAME,
  query: { customerId: 'C-1', orderId: 'O-2' },
})
assert.deepEqual(priceListItemCreateRoute(), {
  name: PRICE_LIST_ITEM_CREATE_ROUTE_NAME,
  query: {},
})
assert.deepEqual(priceListItemCreateRoute({ orderId: 'O-2' }), {
  name: PRICE_LIST_ITEM_CREATE_ROUTE_NAME,
  query: { orderId: 'O-2' },
})
assert.deepEqual(priceListItemCreateRoute({ orderId: 'O-2', category: 'CLOTHING', subcategory: 'Tops' }), {
  name: PRICE_LIST_ITEM_CREATE_ROUTE_NAME,
  query: { orderId: 'O-2', category: 'CLOTHING', subcategory: 'Tops' },
})

console.log('10 form-route builder dry tests passed')

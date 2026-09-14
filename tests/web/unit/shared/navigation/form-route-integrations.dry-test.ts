import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function source(path: string): string {
  return readFileSync(new URL(`../../../../../src/${path}`, import.meta.url), 'utf8')
}

const appointment = source('features/appointments/pages/CreateAppointmentPage.vue')
assert.match(appointment, /getCustomerById\(customerId\)/)
assert.match(appointment, /listOrdersByCustomer\(customerId\)/)
assert.match(appointment, /order\.customerId\.trim\(\) !== loadedCustomer\.customerId\.trim\(\)/)
assert.match(appointment, /useCloseRoute\(fallback\)/)
assert.match(appointment, /window\.history\.state\?\.back[\s\S]*returnAfterSave/)

const order = source('features/orders/pages/OrderCreatePage.vue')
assert.match(order, /singleQueryValue\(route\.query\.customerId\)/)
assert.match(order, /getCustomerById\(sourceCustomerId\)/)
assert.match(order, /form\.customerId = lockedCustomer\.value\.customerId/)
assert.match(order, /disabled: Boolean\(sourceCustomerId\)/)
assert.match(order, /router\.replace\(\{ name: 'order-detail'/)

const invoice = source('features/invoices/pages/InvoiceCreatePage.vue')
assert.match(invoice, /loadInvoiceCreateContext\(customerId, orderId\)/)
assert.doesNotMatch(invoice, /selected-customer\.store|useSelectedCustomerStore/)
assert.match(invoice, /useCloseRoute\(contextFallback\)/)
assert.match(invoice, /v-else-if="result"/)

const customerDetail = source('features/customers/pages/CustomerDetailPage.vue')
assert.match(customerDetail, /router\.push\(appointmentCreateRoute\(/)
assert.match(customerDetail, /router\.push\(orderCreateRoute\(/)
assert.match(customerDetail, /router\.push\(invoiceCreateRoute\(/)
assert.doesNotMatch(customerDetail, /CustomerPackageCreatePage|useCustomerPackageBuyRoute|buyPackage/)
assert.doesNotMatch(customerDetail, /selected-customer\.store|delivery-booking-intent\.store/)

console.log('form route integration dry tests passed')

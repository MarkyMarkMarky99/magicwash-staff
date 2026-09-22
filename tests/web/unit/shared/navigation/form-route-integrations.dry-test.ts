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

const orderDetail = source('features/orders/pages/OrderDetailPage.vue')
assert.match(orderDetail, /router\.push\(priceListItemCreateRoute\(\{ orderId: orderId\.value, category, subcategory \}\)\)/)
assert.match(orderDetail, /@create="openPriceListItemCreate"/)

const priceListItemForm = source('features/price-list/pages/PriceListItemCreatePage.vue')
const itemCreateFlow = source('features/price-list/composables/use-item-create-form.ts')
assert.match(priceListItemForm, /useItemCreateForm\(\)/)
assert.match(itemCreateFlow, /category: routeText\(route\.query\.category\)/)
assert.match(itemCreateFlow, /subcategory: routeText\(route\.query\.subcategory\)/)
assert.match(itemCreateFlow, /orderId = routeText\(route\.query\.orderId\)/)
assert.doesNotMatch(priceListItemForm, /v-model="item\.(?:category|subcategory)"/)
assert.match(priceListItemForm, /v-model="item\.displayNameTh"/)
assert.match(priceListItemForm, /v-model="item\.displayNameEn"/)
assert.match(priceListItemForm, /type="file"/)

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

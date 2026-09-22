import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function source(path: string): string {
  return readFileSync(new URL(`../../../../../src/${path}`, import.meta.url), 'utf8')
}

const pages = [
  ['features/appointments/pages/RescheduleAppointmentPage.vue', 'appointment-schedule'],
  ['features/customers/pages/CustomerCreatePage.vue', 'customer-list'],
  ['features/packages/pages/PackageFormPage.vue', 'package-list'],
  ['features/price-list/pages/PriceListFormPage.vue', 'price-list'],
  ['features/issue-reports/pages/IssueReportFormPage.vue', 'issue-reports'],
] as const

for (const [path, fallback] of pages) {
  const page = source(path)
  assert.match(page, new RegExp(`useCloseRoute\\(\\{ name: '${fallback}' \\}\\)`), `${path} must use its list fallback`)
  assert.match(page, /@close="close"/, `${path} must wire close to useCloseRoute`)
}

assert.match(source(pages[0][0]), /rescheduleAppointment[\s\S]*router\.back\(\)/)
assert.match(source(pages[2][0]), /packageStore\.(?:update|create)[\s\S]*router\.push\('\/packages'\)/)
assert.match(source(pages[3][0]), /priceListStore\.(?:update|create)[\s\S]*router\.push\('\/price-list'\)/)
assert.match(source(pages[4][0]), /issueReportStore\.create[\s\S]*router\.replace\(\{ name: 'issue-reports' \}\)/)
const itemCreatePage = source('features/price-list/pages/PriceListItemCreatePage.vue')
const itemCreateFlow = source('features/price-list/composables/use-item-create-form.ts')
assert.match(itemCreateFlow, /orderId = routeText\(route\.query\.orderId\)/)
assert.match(itemCreateFlow, /name: 'order-detail', params: \{ orderId \}, query: \{ orderAction: 'item' \}/)
assert.match(itemCreateFlow, /: \{ name: 'price-list' \}/)
assert.match(itemCreateFlow, /useCloseRoute\(destination\)/)
assert.match(itemCreateFlow, /router\.replace\(destination\)/)
assert.match(itemCreatePage, /@close="close"/)

console.log('6 form-page close route dry tests passed')

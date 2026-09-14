import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const createPage = readFileSync(
  new URL('../../../../../../src/features/customer-packages/pages/CustomerPackageCreatePage.vue', import.meta.url),
  'utf8',
)
const app = readFileSync(new URL('../../../../../../src/App.vue', import.meta.url), 'utf8')

assert.match(createPage, /defineOptions\(\{ name: 'CustomerPackageCreatePage' \}\)/)
assert.match(createPage, /import FormOverlay from ['"]@\/shared\/layouts\/FormOverlay\.vue['"]/)
assert.match(createPage, /useCloseRoute\(fallback\)/)
assert.match(createPage, /queryString\(route\.query\.customerId\)/)
assert.match(createPage, /getCustomerById\(sourceCustomerId\)/)
assert.match(createPage, /name: 'customer-detail'[\s\S]*tab: 'packages'/)
assert.match(createPage, /name: 'customer-package-list'/)
assert.doesNotMatch(createPage, /defineProps|defineEmits/)
assert.doesNotMatch(createPage, /emit\(['"](?:close|created)['"]\)/)
assert.match(createPage, /window\.history\.state\?\.back[\s\S]*router\.back\(\)[\s\S]*router\.replace\(fallback\)/)
assert.match(createPage, /result\.value\.kind === 'created'\) returnAfterSave\(\)/)
assert.match(createPage, /packageResult\?\.kind === 'created'\) returnAfterSave\(\)/)
assert.match(createPage, /createCustomerPackage\(createPayload\(\)\)/)
assert.doesNotMatch(createPage, /<form\b/i)
assert.match(createPage, /:close-on-backdrop="false"/)
assert.match(createPage, /@close="closeForm"/)
assert.match(createPage, /@submit="submitForm"/)
assert.match(createPage, /\bonMounted\b/)
assert.doesNotMatch(createPage, /\bon(?:Activated|Deactivated)\b/)
assert.match(app, /exclude[^>]*CustomerPackageCreatePage|CustomerPackageCreatePage[^>]*exclude/)

console.log('customer-package create page dry test passed')

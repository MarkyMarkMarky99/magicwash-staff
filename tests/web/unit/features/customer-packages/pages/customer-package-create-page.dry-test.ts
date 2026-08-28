import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const createPage = readFileSync(
  new URL('../../../../../../src/features/customer-packages/pages/CustomerPackageCreatePage.vue', import.meta.url),
  'utf8',
)
const app = readFileSync(new URL('../../../../../../src/App.vue', import.meta.url), 'utf8')
const componentName = 'CustomerPackageCreatePage'

assert.match(createPage, /import FormOverlay from ['"]@\/shared\/layouts\/FormOverlay\.vue['"]/, 'create page must import FormOverlay')
assert.match(createPage, /<FormOverlay\b/, 'create page must use FormOverlay')
assert.doesNotMatch(createPage, /\bAppLayout\b/, 'create page must not reference AppLayout')
assert.match(createPage, /function createPayload\(\)/, 'create page must define createPayload')
assert.match(createPage, new RegExp(`defineOptions\\(\\{ name: '${componentName}' \\}\\)`), 'create page must keep its stable component name')
assert.match(app, new RegExp(`:exclude="\\[[^\\]]*'${componentName}'[^\\]]*\\]"`), 'App KeepAlive must exclude the exact component name')

assert.doesNotMatch(createPage, /<form\b/i, 'FormOverlay must remain the only form boundary')
assert.match(createPage, /<FormOverlay[\s\S]*?:close-on-backdrop="false"/, 'FormOverlay must prevent backdrop dismissal')
assert.match(createPage, /@close="returnToList"/, 'FormOverlay close must use the page return handler')
assert.match(createPage, /@submit="submitForm"/, 'FormOverlay submit must use the page submit handler')

assert.match(createPage, /<FormLabel input-id="customer-package-code">แพ็กเกจ \*<\/FormLabel>[\s\S]*?<select id="customer-package-code"/, 'package must remain a labeled native select')
assert.match(createPage, /<FormOptionGrid v-model="serviceDay" label="Service day" :options="serviceDayOptions"/, 'service day must use FormOptionGrid')
assert.match(createPage, /<FormOptionGrid v-model="timeSlot" label="Time slot" :options="timeSlotOptions"/, 'time slot must use FormOptionGrid')
assert.match(createPage, /\{ value: '', label: 'Service day \(optional\)' \}/, 'service day must retain an explicit empty option')
assert.match(createPage, /\{ value: '', label: 'Time slot \(optional\)' \}/, 'time slot must retain an explicit empty option')
assert.match(createPage, /<CustomerPicker v-model="customerId" :customers="customers" :loading="customersLoading" :error="customersError" \/>/, 'CustomerPicker wiring must remain unchanged')

assert.match(createPage, /createCustomerPackage\(createPayload\(\)\)/, 'submission must invoke createPayload')
assert.doesNotMatch(createPage, /createCustomerPackage\(\{/, 'submission must not inline the request payload')
assert.match(
  createPage,
  /function createPayload\(\) \{\s+return \{\s+customerId: customerId\.value\.trim\(\),\s+packageCode: packageCode\.value\.trim\(\),\s+invoiceId: invoiceId\.value\.trim\(\) \|\| null,\s+startDate: startDate\.value \|\| null,\s+expiryDate: expiryDate\.value \|\| null,\s+serviceDay: serviceDay\.value \|\| null,\s+timeSlot: timeSlot\.value \|\| null,\s+notes: notes\.value\.trim\(\) \|\| null,\s+createdBy: createdBy\.value\.trim\(\),\s+\}/,
  'createPayload must retain the ordered request keys and normalization expressions',
)

assert.match(createPage, /onMounted\(\(\) =>/, 'create page must load with onMounted')
assert.doesNotMatch(createPage, /\bon(?:Activated|Deactivated)\b/, 'uncached create page must not use activated hooks')
assert.doesNotMatch(createPage, /\bhistory\.(?:pushState|replaceState|back|forward|go)\b/, 'create page must not use history APIs')
assert.match(createPage, /route\.meta\.parent/, 'return navigation must retain the route parent meta')
assert.match(createPage, /router\.push\(\{ name: parent \}\)/, 'return navigation must route to the parent')

console.log('customer-package create page dry test passed')

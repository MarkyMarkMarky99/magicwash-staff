import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function source(path: string): string {
  return readFileSync(new URL(`../../../../../../src/${path}`, import.meta.url), 'utf8')
}

const form = source('features/packages/pages/PackageFormPage.vue')
assert.match(form, /defineOptions\(\{ name: 'PackageFormPage' \}\)/)
assert.match(form, /\bonMounted\b/)
assert.doesNotMatch(form, /\bon(?:Activated|Deactivated)\b/)
assert.match(form, /packageStore\.create/)
assert.match(form, /packageStore\.update/)

const list = source('features/packages/pages/PackageListPage.vue')
assert.match(list, /packageStore\.load/)
assert.match(list, /setTimeout[\s\S]{0,100}250/)
assert.match(list, /deletedAt/)

const customerPackageCreate = source('features/customer-packages/pages/CustomerPackageCreatePage.vue')
assert.doesNotMatch(customerPackageCreate, /<FormInput id="customer-package-code"/)
assert.match(customerPackageCreate, /<select id="customer-package-code"/)
assert.match(customerPackageCreate, /usePackageStore/)
assert.match(customerPackageCreate, /CustomerPicker/)

const app = source('App.vue')
assert.match(app, /'PackageFormPage'/)

console.log('package page dry tests passed')

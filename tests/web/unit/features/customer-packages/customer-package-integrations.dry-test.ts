import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CUSTOMER_PACKAGES } from '@/features/customer-packages/preview/customer-packages.fixture'

function readSource(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

const sidebar = readSource('../../../../../src/shared/components/NavSidebar.vue')
assert.match(sidebar, /navigate\('\/customer-packages'\)/, 'sidebar must link to customer packages')
assert.match(sidebar, /route\.path\.startsWith\('\/customer-packages'\)/, 'sidebar must keep customer packages active for feature routes')

const header = readSource('../../../../../src/shared/components/AppHeader.vue')
assert.match(header, /Boolean\(route\.meta\.parent\)/, 'header back navigation must be driven by route metadata')
assert.doesNotMatch(header, /customer-package-detail|customer-packages-preview/, 'header must not know customer-package route names')

const filterBar = readSource('../../../../../src/features/customer-packages/components/CustomerPackageFilterBar.vue')
assert.match(filterBar, /customerPackageStatusSchema\.options/, 'filter statuses must come from the API contract schema')
assert.doesNotMatch(filterBar, /\['ACTIVE', 'INACTIVE', 'EXPIRED', 'CANCELLED'\]/, 'filter statuses must not duplicate contract enum values')

const router = readSource('../../../../../src/router/index.js')
assert.match(router, /if \(import\.meta\.env\.DEV\)[\s\S]*customer-packages\/preview/, 'preview route must only register in development')
assert.match(router, /component:\s*\(\)\s*=>\s*import\('@\/features\/customer-packages\/preview\/CustomerPackagesPreviewPage\.vue'\)/, 'preview route must be lazy loaded')
assert.doesNotMatch(router, /customerPackagePreviewRoutes/, 'router must not import the obsolete preview route module')

const fixture = readSource('../../../../../src/features/customer-packages/preview/customer-packages.fixture.ts')
assert.match(fixture, /customerPackageDetailResponseSchema\.parse\(/, 'preview fixture must validate the API-shaped DTO')
assert.doesNotMatch(fixture, /customer_name|remaining_credit|credit_change|created_at/, 'preview fixture must not use database-shaped fields')
assert.equal(CUSTOMER_PACKAGES[0].customerPackageId, 'CP-20260801-0001', 'validated preview fixture must expose API DTO fields')

const variant = readSource('../../../../../src/features/customer-packages/preview/variant-c/VariantC.vue')
assert.match(variant, /sourcePackage\.totalCredit/, 'preview must display the API total')
assert.doesNotMatch(variant, /\.reduce\(/, 'preview must not re-derive package totals')
assert.doesNotMatch(variant, /customerPackage\s*:/, 'preview must not build a frontend view model')

console.log('customer-package integration dry tests passed')

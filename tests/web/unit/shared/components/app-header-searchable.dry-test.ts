import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { appointmentRoutes } from '../../../../../src/features/appointments/routes'
import { customerRoutes } from '../../../../../src/features/customers/routes'
import { customerPackageRoutes } from '../../../../../src/features/customer-packages/routes'
import { invoiceRoutes } from '../../../../../src/features/invoices/routes'
import { issueReportRoutes } from '../../../../../src/features/issue-reports/routes'
import { packageRoutes } from '../../../../../src/features/packages/routes'
import { priceListRoutes } from '../../../../../src/features/price-list/routes'

const searchablePaths = new Set(['/customers', '/invoices', '/price-list'])
const routes = [
  ...appointmentRoutes,
  ...customerRoutes,
  ...invoiceRoutes,
  ...customerPackageRoutes,
  ...priceListRoutes,
  ...packageRoutes,
  ...issueReportRoutes,
]

for (const path of searchablePaths) {
  const route = routes.find((item) => item.path === path)
  assert.equal(route?.meta?.searchable, true, `${path} must declare meta.searchable === true`)
}

for (const route of routes) {
  if (!searchablePaths.has(route.path)) {
    assert.equal(route.meta?.searchable, undefined, `${route.path} must not declare meta.searchable`)
  }
}

const galleryRoutesSource = readFileSync(
  new URL('../../../../../src/features/gallery/routes.ts', import.meta.url),
  'utf8',
)
assert.doesNotMatch(galleryRoutesSource, /\bsearchable\s*:/)

const routerSource = readFileSync(new URL('../../../../../src/router/index.js', import.meta.url), 'utf8')
assert.doesNotMatch(routerSource, /\bsearchable\s*:/)

const headerSource = readFileSync(
  new URL('../../../../../src/shared/components/AppHeader.vue', import.meta.url),
  'utf8',
)

const forbiddenRouteListIdentifier = ['SEARCHABLE', 'ROUTES'].join('_')
assert.ok(!headerSource.includes(forbiddenRouteListIdentifier))
for (const path of searchablePaths) {
  assert.doesNotMatch(headerSource, new RegExp(`['\"]${path}['\"]`))
}

console.log('app-header searchable route dry tests passed')

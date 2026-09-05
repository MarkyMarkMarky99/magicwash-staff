import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { appointmentRoutes } from '../../../../../src/features/appointments/routes'
import { customerRoutes } from '../../../../../src/features/customers/routes'
import { customerPackageRoutes } from '../../../../../src/features/customer-packages/routes'
import { invoiceRoutes } from '../../../../../src/features/invoices/routes'
import { issueReportRoutes } from '../../../../../src/features/issue-reports/routes'
import { orderRoutes } from '../../../../../src/features/orders/routes'
import { packageRoutes } from '../../../../../src/features/packages/routes'
import { priceListRoutes } from '../../../../../src/features/price-list/routes'

// Search used to be a global affordance: a magnifier painted in AppHeader that only worked on
// routes flagged `meta.searchable`, toggling one module-level ref shared by every page. It now
// belongs to each list's own ListContainer, so neither the flag nor the header button may return
// -- a second, page-level search control would fight the per-list one for the same keyword.
const routes = [
  ...appointmentRoutes,
  ...customerRoutes,
  ...invoiceRoutes,
  ...customerPackageRoutes,
  ...priceListRoutes,
  ...packageRoutes,
  ...orderRoutes,
  ...issueReportRoutes,
]

for (const route of routes) {
  assert.equal(
    (route.meta as Record<string, unknown> | undefined)?.searchable,
    undefined,
    `${route.path} must not declare meta.searchable`,
  )
}

for (const path of ['features/gallery/routes.ts', 'router/index.js'] as const) {
  const src = readFileSync(new URL(`../../../../../src/${path}`, import.meta.url), 'utf8')
  assert.doesNotMatch(src, /\bsearchable\s*:/, `${path} must not declare meta.searchable`)
}

const headerSource = readFileSync(
  new URL('../../../../../src/shared/components/AppHeader.vue', import.meta.url),
  'utf8',
)
assert.doesNotMatch(headerSource, /useHeaderSearch/, 'AppHeader must not own search state')
assert.doesNotMatch(headerSource, />search</, 'AppHeader must not render a search button')
assert.doesNotMatch(headerSource, /\bsearchable\b/)

const forbiddenRouteListIdentifier = ['SEARCHABLE', 'ROUTES'].join('_')
assert.ok(!headerSource.includes(forbiddenRouteListIdentifier))

// The composable that held the global flag is gone; nothing may import it back.
const layoutSource = readFileSync(
  new URL('../../../../../src/shared/layouts/ListPageLayout.vue', import.meta.url),
  'utf8',
)
assert.doesNotMatch(layoutSource, /useHeaderSearch|searchValue|<input/, 'ListPageLayout must not render search')

// Every list that offers search does it through ListContainer.
const container = readFileSync(
  new URL('../../../../../src/shared/components/ListContainer.vue', import.meta.url),
  'utf8',
)
assert.match(container, /searchable:\s*\{\s*type:\s*Boolean,\s*default:\s*false\s*\}/, 'search must stay opt-in')
assert.match(container, /name="search-actions"/, 'the search row must host the filter trigger')

console.log('app-header searchable route dry tests passed')

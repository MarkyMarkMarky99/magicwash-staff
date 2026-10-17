import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url))

function source(path: string): string {
  return readFileSync(resolve(repoRoot, 'src', path), 'utf8')
}

const listPages = [
  'features/customers/pages/CustomerListPage.vue',
  'features/invoices/pages/InvoiceListPage.vue',
  'features/price-list/pages/PriceListPage.vue',
  'features/customer-packages/pages/CustomerPackageListPage.vue',
  'features/packages/pages/PackageListPage.vue',
  'features/issue-reports/pages/IssueReportListPage.vue',
]

for (const path of listPages) {
  const page = source(path)
  assert.match(page, /import\s+ListPageLayout\s+from\s+['"]@\/shared\/layouts\/ListPageLayout\.vue['"]/, `${path} must import ListPageLayout`)
  assert.doesNotMatch(page, /from\s+['"]@\/shared\/layouts\/AppLayout\.vue['"]/, `${path} must not import AppLayout directly`)
  assert.doesNotMatch(page, /overflow-y-auto/, `${path} must not own the scroll region`)
}

assert.doesNotMatch(source('shared/layouts/ListPageLayout.vue'), /from\s+['"][^'"]*features\//, 'ListPageLayout must not import from features')

// Search is a ListContainer prop now, not a route flag and not a layout prop.
for (const path of listPages) {
  const page = source(path)
  assert.doesNotMatch(page, /<ListPageLayout[^>]*search/s, `${path} must not pass search props to the layout`)
}

for (const [path, routeName] of [
  ['features/customer-packages/routes.ts', 'customer-package-list'],
  ['features/packages/routes.ts', 'package-list'],
] as const) {
  assert.doesNotMatch(source(path), /searchable/, `${routeName} must not declare meta.searchable`)
}

const refreshPages = [
  'features/customers/pages/CustomerListPage.vue',
  'features/invoices/pages/InvoiceListPage.vue',
  'features/issue-reports/pages/IssueReportListPage.vue',
  'features/price-list/pages/PriceListPage.vue',
  'features/customer-packages/pages/CustomerPackageListPage.vue',
  'features/staff/pages/StaffListPage.vue',
  'features/orders/pages/OrderListPage.vue',
  'features/appointments/pages/PendingAppointmentsPage.vue',
  'features/appointments/pages/AppointmentSchedulePage.vue',
  'features/wash-queue/pages/WashQueuePage.vue',
  'features/job-tickets/pages/DepartmentWorkPage.vue',
]

for (const path of refreshPages) {
  assert.match(source(path), /<ListContainer\b[^>]*:refresh="/s, `${path} must wire list refresh`)
}

function filesIn(directory: string): string[] {
  return readdirSync(resolve(repoRoot, 'src', directory), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`
    return entry.isDirectory() ? filesIn(path) : [path]
  })
}

const excluded = [
  'features/packages/pages/PackageListPage.vue',
  'features/orders/pages/OrderDetailPage.vue',
  'features/invoices/components/InvoiceLineItemsEditor.vue',
  ...filesIn('features/customers/components'),
  ...filesIn('features/customer-packages/preview'),
]
for (const path of excluded) {
  assert.doesNotMatch(source(path), /:refresh\s*=/, `${path} must not wire list refresh`)
}

const listContainer = source('shared/components/ListContainer.vue')
assert.match(listContainer, /import PullToRefresh from ['"]@\/shared\/components\/PullToRefresh\.vue['"]/)
assert.match(listContainer, /inline: true/)
const wrapper = listContainer.indexOf('<component :is=')
assert.ok(wrapper > listContainer.indexOf('<h2'), 'the list heading must precede the refresh wrapper')
assert.ok(wrapper > listContainer.indexOf('<slot name="search-actions"'), 'the search row must precede the refresh wrapper')

const pullToRefresh = source('shared/components/PullToRefresh.vue')
assert.match(pullToRefresh, /<div\s+v-if="inline"[^>]*ref="body"/s)
assert.match(pullToRefresh, /<ScrollRegion\s+v-else\b/s, 'non-inline mode must keep ScrollRegion')
assert.equal((pullToRefresh.match(/usePullToRefresh\(/g) ?? []).length, 1)

const sourceFiles = filesIn('.').map((path) => path.replace(/^\.\//, ''))
const composableConsumers = sourceFiles.filter((path) =>
  /\.(?:vue|ts|js)$/.test(path) && /import\s[^;]*?from\s*['"][^'"]*\/use-pull-to-refresh['"]/.test(source(path)),
)
assert.deepEqual(composableConsumers, ['shared/components/PullToRefresh.vue'])
assert.ok(!sourceFiles.some((path) => /(?:^|\/)use-scroll-pull-to-refresh(?:\.|$)/.test(path)))

console.log('list-page layout dry tests passed')

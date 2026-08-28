import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

for (const [path, routeName] of [
  ['features/customer-packages/routes.ts', 'customer-package-list'],
  ['features/packages/routes.ts', 'package-list'],
] as const) {
  assert.match(source(path), new RegExp(`name: '${routeName}'[\\s\\S]{0,200}meta: \\{ searchable: true \\}`), `${routeName} route must be searchable`)
}

console.log('list-page layout dry tests passed')

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../../../../../src/features/issue-reports/routes.ts', import.meta.url),
  'utf8',
)

assert.match(source, /export\s+const\s+issueReportRoutes\b/, 'routes must export issueReportRoutes')
assert.match(source, /path\s*:\s*['"]\/issue-reports['"]/, 'list route is required')
const createPosition = source.search(/path\s*:\s*['"]\/issue-reports\/new['"]/)
const detailPosition = source.search(/path\s*:\s*['"]\/issue-reports\/:id['"]/)
assert.notEqual(createPosition, -1, 'create route is required')
assert.notEqual(detailPosition, -1, 'detail route is required')
assert.ok(createPosition < detailPosition, 'create route must precede the ID route')
assert.match(source, /name\s*:\s*['"]issue-reports['"]/, 'list route name is required')
assert.match(source, /name\s*:\s*['"]issue-report-create['"]/, 'create route name is required')
assert.match(source, /name\s*:\s*['"]issue-report-detail['"]/, 'detail route name is required')
assert.match(source, /IssueReportListPage\.vue/, 'list page must be lazy loaded')
assert.match(source, /IssueReportFormPage\.vue/, 'form page must be lazy loaded')
assert.match(source, /IssueReportDetailPage\.vue/, 'detail page must be lazy loaded')
assert.match(source, /meta\s*:\s*\{[^}]*parent\s*:\s*['"]issue-reports['"]/, 'child routes need parent metadata')
assert.match(source, /props\s*:\s*true/, 'detail route must pass ID as a prop')
assert.doesNotMatch(source, /\bchildren\s*:/, 'issue-report routes must not use children')

console.log('issue-report route dry tests passed')

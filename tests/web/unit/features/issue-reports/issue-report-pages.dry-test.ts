import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function readPage(name: string) {
  return readFileSync(
    new URL(`../../../../../src/features/issue-reports/pages/${name}`, import.meta.url),
    'utf8',
  )
}

const list = readPage('IssueReportListPage.vue')
assert.match(list, /defineOptions\(\{\s*name\s*:\s*['"]IssueReportListPage['"]\s*\}\)/)
assert.match(list, /ref\(\s*['"]ALL['"]\s*\)/, 'list must initially select all statuses')
assert.match(list, /activeKey\.value\s*===\s*['"]ALL['"]\s*\?\s*items\s*:\s*items\.filter\(/, 'list must filter by the selected status')
assert.match(list, /store\.load\(\)/, 'list must load reports when mounted')
assert.match(list, /name\s*:\s*['"]issue-report-create['"]/, 'new-report navigation must use the create route')
assert.match(list, /name\s*:\s*['"]issue-report-detail['"]/, 'card navigation must use the detail route')

const form = readPage('IssueReportFormPage.vue')
assert.match(form, /defineOptions\(\{\s*name\s*:\s*['"]IssueReportFormPage['"]\s*\}\)/)
assert.match(form, /screenshotUrl\s*:\s*['"]['"]/, 'form needs screenshot-link state')
assert.match(form, /screenshotUrl\s*:\s*[^?]+\?\s*[^:]+\s*:\s*null/, 'blank screenshot links must become null')
assert.match(form, /router\.replace\(\{\s*name\s*:\s*['"]issue-reports['"]\s*\}\)/, 'successful creation must replace the form route')
assert.match(form, /persist\(\)/, 'successful creation must persist the actor')
assert.match(form, /title\.trim\(\)/, 'title must be required client-side')
assert.match(form, /description\.trim\(\)/, 'description must be required client-side')
assert.match(form, /actor\.value\.trim\(\)/, 'actor must be required client-side')

const detail = readPage('IssueReportDetailPage.vue')
assert.match(detail, /defineOptions\(\{\s*name\s*:\s*['"]IssueReportDetailPage['"]\s*\}\)/)
assert.match(detail, /watch\(\s*\(\)\s*=>\s*props\.id\s*,\s*\(\)\s*=>\s*void\s+loadDetail\(\)\s*,\s*\{\s*immediate\s*:\s*true\s*\}\s*\)/, 'cached detail pages must reload when the ID changes')
assert.match(detail, /store\.items\.find\(\s*\(\w+\)\s*=>\s*\w+\.issueReportId\s*===\s*props\.id\s*\)/, 'detail should reuse a matching store item')
assert.match(detail, /getIssueReport\(props\.id\)/, 'cold deep links must fetch a report by ID')
assert.match(detail, /status\s*===\s*404/, '404 must be distinguished from generic loading errors')
assert.match(detail, /actionError\.value\s*=/, 'status-change errors must have separate action state')
assert.match(detail, /report\.value\s*=\s*await\s+store\.update\(/, 'a successful status change must refresh displayed report data')
assert.match(detail, /persist\(\)/, 'successful status changes must persist the actor')

console.log('issue-report page dry tests passed')

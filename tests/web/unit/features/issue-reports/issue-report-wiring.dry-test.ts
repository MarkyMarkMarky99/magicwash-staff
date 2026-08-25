import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function readSource(path: string) {
  return readFileSync(new URL(`../../../../../src/${path}`, import.meta.url), 'utf8')
}

const service = readSource('features/issue-reports/services/issue-report.service.ts')
assert.match(service, /const\s+ISSUE_REPORTS_ENDPOINT\s*=\s*['"]\/api\/issue-reports['"]/, 'service endpoint is required')
assert.match(service, /export\s+(?:async\s+)?function\s+listIssueReports\b/, 'list service is required')
assert.match(service, /apiGetList\(/, 'list service must use apiGetList')
assert.match(service, /\.items\b/, 'list service must return API list items')
assert.match(service, /export\s+(?:async\s+)?function\s+getIssueReport\b/, 'get service is required')
assert.match(service, /export\s+(?:async\s+)?function\s+createIssueReport\b/, 'create service is required')
assert.match(service, /export\s+(?:async\s+)?function\s+updateIssueReport\b/, 'update service is required')
assert.match(service, /apiPost\(/, 'create service must use apiPost')
assert.match(service, /apiPatch\(/, 'update service must use apiPatch')

const store = readSource('features/issue-reports/stores/issue-report.store.ts')
assert.match(store, /defineStore\(\s*['"]issue-reports['"]/, 'store ID is required')
assert.match(store, /listIssueReports\(\{\s*perPage\s*:\s*500\s*\}\)/, 'load must request the complete report list')
assert.match(store, /loaded\.value\s*=\s*false/, 'reload must clear the loaded guard')
assert.match(store, /items\.value\.unshift\(/, 'create must add the returned report at the top')
assert.match(store, /issueReportId\s*===\s*id/, 'update must replace reports by issueReportId')

const badge = readSource('features/issue-reports/components/IssueReportStatusBadge.vue')
assert.match(badge, /defineProps\s*<\s*\{\s*status\s*:\s*string\s*\}\s*>\s*\(\s*\)/, 'badge status prop must accept legacy strings')
assert.match(badge, /\?\?/, 'unknown statuses need a fallback display style')

const app = readSource('App.vue')
assert.match(app, /['"]IssueReportFormPage['"]/, 'form page must be excluded from KeepAlive')

const router = readSource('router/index.js')
assert.match(router, /issueReportRoutes/, 'router must register issue-report routes')
assert.match(router, /\.\.\.issueReportRoutes/, 'router must spread issue-report routes')

const sidebar = readSource('shared/components/NavSidebar.vue')
assert.match(sidebar, /route\.path\.startsWith\(\s*['"]\/issue-reports['"]\s*\)/, 'nav item must become active for issue-report routes')
assert.match(sidebar, /bug_report/, 'nav item must use the issue-report icon')
assert.match(sidebar, /แจ้งปัญหา/, 'nav item must show the issue-report label')

console.log('issue-report wiring dry tests passed')

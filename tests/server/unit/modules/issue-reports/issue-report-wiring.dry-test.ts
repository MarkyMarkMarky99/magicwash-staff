import assert from 'node:assert/strict'
import { BaseCrudService } from '../../../../../server/shared/services/base-crud.service.js'
import { issueReportsDbContract, issueReportsRowSchema } from '../../../../../server/sheets/IssueReports/IssueReports.db-contract.js'
import { getIssueReportsRepository } from '../../../../../server/sheets/IssueReports/IssueReports.repository.js'
import { deriveGVizColumns } from '../../../../../server/shared/repositories/utils/gviz-query.builder.js'

assert.deepEqual(Object.keys(issueReportsRowSchema.shape), [
  'IssueReportID', 'Title', 'Description', 'Status', 'ScreenshotUrl', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy',
])
assert.deepEqual(deriveGVizColumns(issueReportsDbContract.row), {
  IssueReportID: 'A', Title: 'B', Description: 'C', Status: 'D', ScreenshotUrl: 'E', CreatedAt: 'F', CreatedBy: 'G', UpdatedAt: 'H', UpdatedBy: 'I',
})
assert.equal(issueReportsDbContract.primaryKey, 'IssueReportID')
assert.equal(issueReportsDbContract.sheetName, 'IssueReports')
assert.equal(issueReportsDbContract.spreadsheetId, 'ISSUE_REPORTS_SPREADSHEET_ID')
assert.deepEqual(issueReportsDbContract.audit, { onAppend: ['CreatedAt'], onUpdate: ['UpdatedAt'] })
assert.deepEqual(issueReportsDbContract.writes, { append: true, update: true, delete: false })
assert.equal('valueInput' in issueReportsDbContract, false)

process.env.ISSUE_REPORTS_SPREADSHEET_ID = 'issue-reports-test-spreadsheet'
const firstRepository = getIssueReportsRepository()
assert.strictEqual(getIssueReportsRepository(), firstRepository)
for (const method of ['read', 'append', 'batchAppend', 'update', 'delete'] as const) {
  assert.equal(typeof firstRepository[method], 'function')
}

const issueReportModule = await import('../../../../../server/modules/issue-reports/issue-report.module.js')
assert.ok(issueReportModule.issueReportService instanceof BaseCrudService)
assert.ok(issueReportModule.issueReportRoutes.collection)
assert.ok(issueReportModule.issueReportRoutes.item)

const collectionDelete = await issueReportModule.issueReportRoutes.collection.handleRequest({ method: 'DELETE', query: {}, body: undefined, headers: {}, params: {} })
assert.equal(collectionDelete.status, 405)
assert.equal(collectionDelete.headers?.Allow, 'GET, POST')
const itemDelete = await issueReportModule.issueReportRoutes.item!.handleRequest({ method: 'DELETE', query: {}, body: undefined, headers: {}, params: { id: 'ISS-3f8a1c92' } })
assert.equal(itemDelete.status, 405)
assert.equal(itemDelete.headers?.Allow, 'PATCH')

console.log('issue-report wiring dry test passed')

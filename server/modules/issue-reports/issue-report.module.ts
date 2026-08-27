import { z } from 'zod'
import { issueReportApiContract } from '../../../contracts/issue-reports/issue-report-api.schema.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'
import type { ApiRowFromFieldMap } from '../../shared/repositories/base.repository.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { getIssueReportsRepository } from '../../sheets/IssueReports/IssueReports.repository.js'
import { issueReportsRowSchema } from '../../sheets/IssueReports/IssueReports.db-contract.js'
import { generateShortId } from '../../shared/utils/id.js'

type IssueReportDbRow = z.infer<typeof issueReportsRowSchema>

export const issueReportFieldMap = {
  IssueReportID: 'issueReportId',
  Title: 'title',
  Description: 'description',
  Status: 'status',
  ScreenshotUrl: 'screenshotUrl',
  CreatedAt: 'createdAt',
  CreatedBy: 'createdBy',
  UpdatedAt: 'updatedAt',
  UpdatedBy: 'updatedBy',
} as const satisfies Record<keyof IssueReportDbRow & string, string>

export const searchFields = ['issueReportId', 'title', 'description', 'createdBy'] as const

type IssueReportApiRow = ApiRowFromFieldMap<IssueReportDbRow, typeof issueReportFieldMap>
type IssueReportListQuery = z.infer<typeof issueReportApiContract.query.list>
type IssueReportCreate = z.infer<typeof issueReportApiContract.request.create>
type IssueReportUpdate = z.infer<typeof issueReportApiContract.request.update>
type IssueReportListResponse = z.infer<typeof issueReportApiContract.response.list>
type IssueReportDetailResponse = z.infer<typeof issueReportApiContract.response.detail>
type IssueReportCreateResponse = z.infer<typeof issueReportApiContract.response.create>
type IssueReportUpdateResponse = z.infer<typeof issueReportApiContract.response.update>

type IssueReportService = BaseCrudService<
  IssueReportApiRow,
  IssueReportListQuery,
  IssueReportCreate,
  IssueReportUpdate,
  IssueReportListResponse,
  IssueReportDetailResponse,
  IssueReportCreateResponse,
  IssueReportUpdateResponse,
  IssueReportDbRow,
  typeof issueReportFieldMap
>

/** 'ISS-' + 8 lowercase hex. Duplicate keys are rejected by append before any write. */
export function createIssueReportId(): string {
  return `ISS-${generateShortId()}`
}

// Server-owned columns are filled here, not in the request schema: the client
// never picks an id and never picks the initial status.
const issueReportRepository: SheetRepositoryContract<IssueReportDbRow> = {
  read: (query) => getIssueReportsRepository().read(query),
  append: (row) =>
    getIssueReportsRepository().append({
      ...row,
      IssueReportID: createIssueReportId(),
      Status: 'OPEN',
    }),
  batchAppend: (rows) => getIssueReportsRepository().batchAppend(rows),
  update: (keyValue, patch) => getIssueReportsRepository().update(keyValue, patch),
  delete: (keyValue, deletedBy) => getIssueReportsRepository().delete(keyValue, deletedBy),
}

export const issueReportService: IssueReportService = new BaseCrudService({
  repository: issueReportRepository,
  api: issueReportApiContract,
  searchFields,
  fieldMap: issueReportFieldMap,
})

export const issueReportRoutes = createCrudRoutes(issueReportService, issueReportApiContract)

// CreatedAt is deliberately not set in append; undefined makes repository audit.onAppend stamp fire.

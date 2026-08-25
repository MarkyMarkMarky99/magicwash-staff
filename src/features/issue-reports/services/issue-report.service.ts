import type { z } from 'zod'
import {
  issueReportCreateSchema,
  issueReportListQuerySchema,
  issueReportListResponseSchema,
  issueReportStatusSchema,
  issueReportUpdateSchema,
} from '@contracts/issue-reports/issue-report-api.schema'
import { apiGet, apiGetList, apiPatch, apiPost } from '@/shared/api/api-client'

export type IssueReportDto = z.infer<typeof issueReportListResponseSchema>
export type IssueReportListQuery = z.infer<typeof issueReportListQuerySchema>
export type IssueReportCreatePayload = z.infer<typeof issueReportCreateSchema>
export type IssueReportUpdatePayload = z.infer<typeof issueReportUpdateSchema>
export type IssueReportStatus = z.infer<typeof issueReportStatusSchema>

const ISSUE_REPORTS_ENDPOINT = '/api/issue-reports'

export async function listIssueReports(
  query: Partial<IssueReportListQuery> = {},
): Promise<IssueReportDto[]> {
  const { items } = await apiGetList<IssueReportDto>(ISSUE_REPORTS_ENDPOINT, {
    query,
    querySchema: issueReportListQuerySchema,
  })
  return items
}

export function getIssueReport(id: string): Promise<IssueReportDto> {
  return apiGet<IssueReportDto>(`${ISSUE_REPORTS_ENDPOINT}/${encodeURIComponent(id)}`)
}

export function createIssueReport(payload: IssueReportCreatePayload): Promise<IssueReportDto> {
  return apiPost<IssueReportDto>(ISSUE_REPORTS_ENDPOINT, {
    data: payload,
    requestSchema: issueReportCreateSchema,
  })
}

export function updateIssueReport(
  id: string,
  payload: IssueReportUpdatePayload,
): Promise<IssueReportDto> {
  return apiPatch<IssueReportDto>(`${ISSUE_REPORTS_ENDPOINT}/${encodeURIComponent(id)}`, {
    data: payload,
    requestSchema: issueReportUpdateSchema,
  })
}

import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

const issueReportStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])

/** KEY ORDER = physical IssueReports sheet column order. */
export const issueReportsRowSchema = z
  .object({
    IssueReportID: z.string().min(1),
    Title: z.string().min(1),
    Description: z.string().min(1),
    Status: issueReportStatusSchema,
    ScreenshotUrl: z.string().nullable(),
    CreatedAt: z.string(),
    CreatedBy: z.string().nullable(),
    UpdatedAt: z.string().nullable(),
    UpdatedBy: z.string().nullable(),
  })
  .strict()

// CreatedAt/UpdatedAt are Plain-Text columns by design: 'YYYY-MM-DD HH:mm:ss' text,
// never a Sheets datetime serial. Deliberately absent from valueInput.
export const issueReportsDbContract = {
  row: issueReportsRowSchema,
  primaryKey: 'IssueReportID',
  sheetName: 'IssueReports',
  spreadsheetId: 'ISSUE_REPORTS_SPREADSHEET_ID',
  audit: {
    onAppend: ['CreatedAt'],
    onUpdate: ['UpdatedAt'],
  },
  writes: { append: true, update: true, delete: false },
} satisfies SheetContract

import { z } from 'zod'
import { issueReportsDbContract, issueReportsRowSchema } from './IssueReports.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type IssueReportsRow = z.infer<typeof issueReportsRowSchema>

let repository: SheetRepository<IssueReportsRow> | undefined

export function getIssueReportsRepository(): SheetRepository<IssueReportsRow> {
  return repository ??= new SheetRepository({ contract: issueReportsDbContract })
}

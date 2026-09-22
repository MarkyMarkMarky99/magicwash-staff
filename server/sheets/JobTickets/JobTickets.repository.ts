import { z } from 'zod'
import { jobTicketsDbContract, jobTicketsRowSchema } from './JobTickets.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type JobTicketsRow = z.infer<typeof jobTicketsRowSchema>

let repository: SheetRepository<JobTicketsRow> | undefined

export function getJobTicketsRepository(): SheetRepository<JobTicketsRow> {
  return repository ??= new SheetRepository({ contract: jobTicketsDbContract })
}

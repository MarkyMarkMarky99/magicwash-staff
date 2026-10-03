import { z } from 'zod'
import { workTransactionsDbContract, workTransactionsRowSchema } from './WorkTransactions.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type WorkTransactionsRow = z.infer<typeof workTransactionsRowSchema>

let repository: SheetRepository<WorkTransactionsRow> | undefined

export function getWorkTransactionsRepository(): SheetRepository<WorkTransactionsRow> {
  return repository ??= new SheetRepository({ contract: workTransactionsDbContract })
}

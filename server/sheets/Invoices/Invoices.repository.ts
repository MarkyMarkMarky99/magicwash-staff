import { z } from 'zod'
import { invoicesDbContract, invoicesRowSchema } from './Invoices.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type InvoicesRow = z.infer<typeof invoicesRowSchema>

let repository: SheetRepository<InvoicesRow> | undefined

export function getInvoicesRepository(): SheetRepository<InvoicesRow> {
  return repository ??= new SheetRepository({ contract: invoicesDbContract })
}

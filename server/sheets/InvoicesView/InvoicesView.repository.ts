import { z } from 'zod'
import { invoicesViewDbContract, invoicesViewRowSchema } from './InvoicesView.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type InvoicesViewRow = z.infer<typeof invoicesViewRowSchema>

let repository: SheetRepository<InvoicesViewRow> | undefined

export function getInvoicesViewRepository(): SheetRepository<InvoicesViewRow> {
  return repository ??= new SheetRepository({ contract: invoicesViewDbContract })
}

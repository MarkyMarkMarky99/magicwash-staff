import { z } from 'zod'
import { invoiceItemsDbContract, invoiceItemsRowSchema } from './InvoiceItems.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type InvoiceItemsRow = z.infer<typeof invoiceItemsRowSchema>

/** Serves the physical InvoiceItems sheet; supports reads, appends, and batch appends. */
let repository: SheetRepository<InvoiceItemsRow> | undefined

export function getInvoiceItemsRepository(): SheetRepository<InvoiceItemsRow> {
  return repository ??= new SheetRepository({ contract: invoiceItemsDbContract })
}

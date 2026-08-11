import { z } from 'zod'
import { paymentsDbContract, paymentsRowSchema } from './Payments.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type PaymentsRow = z.infer<typeof paymentsRowSchema>

/** Serves the physical Payments sheet; read and write are unavailable. */
let repository: SheetRepository<PaymentsRow> | undefined

export function getPaymentsRepository(): SheetRepository<PaymentsRow> {
  return repository ??= new SheetRepository({ contract: paymentsDbContract })
}

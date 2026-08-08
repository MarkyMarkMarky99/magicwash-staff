import { z } from 'zod'
import { orderFormDbContract, orderFormRowSchema } from './OrderForm.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type OrderFormRow = z.infer<typeof orderFormRowSchema>

/** Serves the physical OrderForm sheet; supports reads and contract-permitted updates. */
let repository: SheetRepository<OrderFormRow> | undefined

export function getOrderFormRepository(): SheetRepository<OrderFormRow> {
  return repository ??= new SheetRepository({ contract: orderFormDbContract })
}

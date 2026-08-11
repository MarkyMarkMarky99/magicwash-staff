import { z } from 'zod'
import { orderFormDbContract, orderFormRowSchema } from './OrderForm.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type OrderFormRow = z.infer<typeof orderFormRowSchema>

let repository: SheetRepository<OrderFormRow> | undefined

export function getOrderFormRepository(): SheetRepository<OrderFormRow> {
  return repository ??= new SheetRepository({ contract: orderFormDbContract })
}

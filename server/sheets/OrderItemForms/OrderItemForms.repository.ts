import { z } from 'zod'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'
import { orderItemFormsDbContract, orderItemFormsRowSchema } from './OrderItemForms.db-contract.js'

type OrderItemFormsDbRow = z.infer<typeof orderItemFormsRowSchema>

let repository: SheetRepository<OrderItemFormsDbRow> | undefined

export function getOrderItemFormsRepository(): SheetRepository<OrderItemFormsDbRow> {
  return repository ??= new SheetRepository({ contract: orderItemFormsDbContract })
}

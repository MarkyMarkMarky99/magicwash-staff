import { z } from 'zod'
import { orderItemFormsDbContract, orderItemFormsRowSchema } from './OrderItemForms.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type OrderItemFormsRow = z.infer<typeof orderItemFormsRowSchema>

let repository: SheetRepository<OrderItemFormsRow> | undefined

export function getOrderItemFormsRepository(): SheetRepository<OrderItemFormsRow> {
  return repository ??= new SheetRepository({ contract: orderItemFormsDbContract })
}

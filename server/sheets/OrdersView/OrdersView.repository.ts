import { z } from 'zod'
import { ordersViewDbContract, ordersViewRowSchema } from './OrdersView.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type OrdersViewRow = z.infer<typeof ordersViewRowSchema>

/** Serves the physical OrdersView sheet; read-only. */
let repository: SheetRepository<OrdersViewRow> | undefined

export function getOrdersViewRepository(): SheetRepository<OrdersViewRow> {
  return repository ??= new SheetRepository({ contract: ordersViewDbContract })
}

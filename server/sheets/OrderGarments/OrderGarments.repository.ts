import { z } from 'zod'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'
import { orderGarmentsDbContract, orderGarmentsRowSchema } from './OrderGarments.db-contract.js'

type OrderGarmentsRow = z.infer<typeof orderGarmentsRowSchema>

let repository: SheetRepository<OrderGarmentsRow> | undefined

export function getOrderGarmentsRepository(): SheetRepository<OrderGarmentsRow> {
  return repository ??= new SheetRepository({
    contract: orderGarmentsDbContract,
  })
}

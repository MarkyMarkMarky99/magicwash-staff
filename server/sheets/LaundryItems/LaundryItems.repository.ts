import { z } from 'zod'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'
import { laundryItemsDbContract, laundryItemsRowSchema } from './LaundryItems.db-contract.js'

type LaundryItemsRow = z.infer<typeof laundryItemsRowSchema>

let repository: SheetRepository<LaundryItemsRow> | undefined

export function getLaundryItemsRepository(): SheetRepository<LaundryItemsRow> {
  return repository ??= new SheetRepository({
    contract: laundryItemsDbContract,
  })
}

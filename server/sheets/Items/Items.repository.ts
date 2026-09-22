import { z } from 'zod'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'
import { itemsDbContract, itemsRowSchema } from './Items.db-contract.js'

type ItemsRow = z.infer<typeof itemsRowSchema>

let repository: SheetRepository<ItemsRow> | undefined

export function getItemsRepository(): SheetRepository<ItemsRow> {
  return repository ??= new SheetRepository({
    contract: itemsDbContract,
  })
}

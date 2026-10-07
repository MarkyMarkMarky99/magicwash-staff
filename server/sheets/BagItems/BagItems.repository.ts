import { z } from 'zod'
import { bagItemsDbContract, bagItemsRowSchema } from './BagItems.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type BagItemsRow = z.infer<typeof bagItemsRowSchema>

let repository: SheetRepository<BagItemsRow> | undefined

export function getBagItemsRepository(): SheetRepository<BagItemsRow> {
  return repository ??= new SheetRepository({ contract: bagItemsDbContract })
}

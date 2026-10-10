import type { z } from 'zod'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'
import { washProductsDbContract, type washProductsRowSchema } from './WashProducts.db-contract.js'

type WashProductsDbRow = z.infer<typeof washProductsRowSchema>

let repository: SheetRepository<WashProductsDbRow> | undefined
export function getWashProductsRepository(): SheetRepository<WashProductsDbRow> {
  return repository ??= new SheetRepository({ contract: washProductsDbContract })
}

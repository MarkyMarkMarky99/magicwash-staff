import type { z } from 'zod'
import { stockTakesDbContract, stockTakesRowSchema } from './StockTakes.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

export type StockTakesRow = z.infer<typeof stockTakesRowSchema>

let repository: SheetRepository<StockTakesRow> | undefined

export function getStockTakesRepository(): SheetRepository<StockTakesRow> {
  return repository ??= new SheetRepository({ contract: stockTakesDbContract })
}

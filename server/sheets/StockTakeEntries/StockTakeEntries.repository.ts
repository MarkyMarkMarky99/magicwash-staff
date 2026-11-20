import type { z } from 'zod'
import { stockTakeEntriesDbContract, stockTakeEntriesRowSchema } from './StockTakeEntries.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

export type StockTakeEntriesRow = z.infer<typeof stockTakeEntriesRowSchema>

let repository: SheetRepository<StockTakeEntriesRow> | undefined

export function getStockTakeEntriesRepository(): SheetRepository<StockTakeEntriesRow> {
  return repository ??= new SheetRepository({ contract: stockTakeEntriesDbContract })
}

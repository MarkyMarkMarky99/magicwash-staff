import { z } from 'zod'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'
import { priceListDbContract, priceListRowSchema } from './PriceList.db-contract.js'

type PriceListRow = z.infer<typeof priceListRowSchema>

let repository: SheetRepository<PriceListRow> | undefined

export function getPriceListRepository(): SheetRepository<PriceListRow> {
  return repository ??= new SheetRepository({ contract: priceListDbContract })
}

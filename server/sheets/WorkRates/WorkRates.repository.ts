import { z } from 'zod'
import { workRatesDbContract, workRatesRowSchema } from './WorkRates.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type WorkRatesRow = z.infer<typeof workRatesRowSchema>

let repository: SheetRepository<WorkRatesRow> | undefined

export function getWorkRatesRepository(): SheetRepository<WorkRatesRow> {
  return repository ??= new SheetRepository({ contract: workRatesDbContract })
}

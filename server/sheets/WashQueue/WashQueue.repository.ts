import type { z } from 'zod'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'
import { washQueueDbContract, type washQueueRowSchema } from './WashQueue.db-contract.js'

type WashQueueDbRow = z.infer<typeof washQueueRowSchema>

let repository: SheetRepository<WashQueueDbRow> | undefined
export function getWashQueueRepository(): SheetRepository<WashQueueDbRow> {
  return repository ??= new SheetRepository({ contract: washQueueDbContract })
}

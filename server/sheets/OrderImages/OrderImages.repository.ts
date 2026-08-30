import { z } from 'zod'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'
import { orderImagesDbContract, orderImagesRowSchema } from './OrderImages.db-contract.js'

type OrderImagesDbRow = z.infer<typeof orderImagesRowSchema>

let repository: SheetRepository<OrderImagesDbRow> | undefined

export function getOrderImagesRepository(): SheetRepository<OrderImagesDbRow> {
  return repository ??= new SheetRepository({ contract: orderImagesDbContract })
}

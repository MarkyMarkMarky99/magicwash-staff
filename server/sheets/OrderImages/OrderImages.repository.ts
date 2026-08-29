import { z } from 'zod'
import { orderImagesDbContract, orderImagesRowSchema } from './OrderImages.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type OrderImagesRow = z.infer<typeof orderImagesRowSchema>

let repository: SheetRepository<OrderImagesRow> | undefined

export function getOrderImagesRepository(): SheetRepository<OrderImagesRow> {
  return repository ??= new SheetRepository({ contract: orderImagesDbContract })
}

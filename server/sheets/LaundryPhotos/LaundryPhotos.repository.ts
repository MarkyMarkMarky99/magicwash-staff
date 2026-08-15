import { z } from 'zod'
import { laundryPhotosDbContract, laundryPhotosRowSchema } from './LaundryPhotos.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type LaundryPhotosRow = z.infer<typeof laundryPhotosRowSchema>

let repository: SheetRepository<LaundryPhotosRow> | undefined

export function getLaundryPhotosRepository(): SheetRepository<LaundryPhotosRow> {
  return repository ??= new SheetRepository({ contract: laundryPhotosDbContract })
}

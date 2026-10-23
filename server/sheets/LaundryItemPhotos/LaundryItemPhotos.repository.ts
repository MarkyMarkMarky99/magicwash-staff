import { z } from 'zod'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'
import { laundryItemPhotosDbContract, laundryItemPhotosRowSchema } from './LaundryItemPhotos.db-contract.js'

type LaundryItemPhotosRow = z.infer<typeof laundryItemPhotosRowSchema>

let repository: SheetRepository<LaundryItemPhotosRow> | undefined

export function getLaundryItemPhotosRepository(): SheetRepository<LaundryItemPhotosRow> {
  return repository ??= new SheetRepository({
    contract: laundryItemPhotosDbContract,
  })
}

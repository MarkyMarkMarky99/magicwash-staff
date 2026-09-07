import { z } from 'zod'
import { afterPhotoDbContract, afterPhotoRowSchema } from './AfterPhoto.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type AfterPhotoRow = z.infer<typeof afterPhotoRowSchema>

let repository: SheetRepository<AfterPhotoRow> | undefined

export function getAfterPhotoRepository(): SheetRepository<AfterPhotoRow> {
  return repository ??= new SheetRepository({ contract: afterPhotoDbContract })
}

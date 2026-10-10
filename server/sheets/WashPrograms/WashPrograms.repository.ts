import type { z } from 'zod'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'
import { washProgramsDbContract, type washProgramsRowSchema } from './WashPrograms.db-contract.js'

type WashProgramsDbRow = z.infer<typeof washProgramsRowSchema>

let repository: SheetRepository<WashProgramsDbRow> | undefined
export function getWashProgramsRepository(): SheetRepository<WashProgramsDbRow> {
  return repository ??= new SheetRepository({ contract: washProgramsDbContract })
}

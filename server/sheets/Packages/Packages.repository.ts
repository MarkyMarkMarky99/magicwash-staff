import { z } from 'zod'
import { packagesDbContract, packagesRowSchema } from './Packages.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type PackagesRow = z.infer<typeof packagesRowSchema>

let repository: SheetRepository<PackagesRow> | undefined

export function getPackagesRepository(): SheetRepository<PackagesRow> {
  return repository ??= new SheetRepository({ contract: packagesDbContract })
}

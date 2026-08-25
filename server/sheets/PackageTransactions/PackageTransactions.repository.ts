import { z } from 'zod'
import { packageTransactionsDbContract, packageTransactionsRowSchema } from './PackageTransactions.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type PackageTransactionsRow = z.infer<typeof packageTransactionsRowSchema>

let repository: SheetRepository<PackageTransactionsRow> | undefined

export function getPackageTransactionsRepository(): SheetRepository<PackageTransactionsRow> {
  return repository ??= new SheetRepository({ contract: packageTransactionsDbContract })
}

import { z } from 'zod'
import { customerPackagesDbContract, customerPackagesRowSchema } from './CustomerPackages.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type CustomerPackagesRow = z.infer<typeof customerPackagesRowSchema>

let repository: SheetRepository<CustomerPackagesRow> | undefined

export function getCustomerPackagesRepository(): SheetRepository<CustomerPackagesRow> {
  return repository ??= new SheetRepository({ contract: customerPackagesDbContract })
}

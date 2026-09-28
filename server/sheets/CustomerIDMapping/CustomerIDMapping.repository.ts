import { z } from 'zod'
import { customerIdMappingDbContract, customerIdMappingRowSchema } from './CustomerIDMapping.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type CustomerIdMappingRow = z.infer<typeof customerIdMappingRowSchema>

let repository: SheetRepository<CustomerIdMappingRow> | undefined

export function getCustomerIdMappingRepository(): SheetRepository<CustomerIdMappingRow> {
  return repository ??= new SheetRepository({ contract: customerIdMappingDbContract })
}

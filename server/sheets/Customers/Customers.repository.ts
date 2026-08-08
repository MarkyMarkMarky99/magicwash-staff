import { z } from 'zod'
import { customersDbContract, customersRowSchema } from './Customers.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type CustomersRow = z.infer<typeof customersRowSchema>

/**
 * Serves the physical Customers sheet; reads and contract-declared appends/updates are exposed,
 * but currently throw because the contract intentionally has no write target.
 */
let repository: SheetRepository<CustomersRow> | undefined

export function getCustomersRepository(): SheetRepository<CustomersRow> {
  return repository ??= new SheetRepository({ contract: customersDbContract })
}

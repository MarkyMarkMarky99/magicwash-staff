import { z } from 'zod'
import { customersDbContract, customersRowSchema } from './Customers.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type CustomersRow = z.infer<typeof customersRowSchema>

let repository: SheetRepository<CustomersRow> | undefined

export function getCustomersRepository(): SheetRepository<CustomersRow> {
  return repository ??= new SheetRepository({ contract: customersDbContract })
}

import { z } from 'zod'
import {
  customerPackageViewDbContract,
  customerPackageViewRowSchema,
} from './CustomerPackageView.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type CustomerPackageViewRow = z.infer<typeof customerPackageViewRowSchema>

let repository: SheetRepository<CustomerPackageViewRow> | undefined

export function getCustomerPackageViewRepository(): SheetRepository<CustomerPackageViewRow> {
  return repository ??= new SheetRepository({ contract: customerPackageViewDbContract })
}

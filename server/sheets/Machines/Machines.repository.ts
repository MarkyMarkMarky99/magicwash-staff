import type { z } from 'zod'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'
import { machinesDbContract, type machinesRowSchema } from './Machines.db-contract.js'

type MachinesDbRow = z.infer<typeof machinesRowSchema>

let repository: SheetRepository<MachinesDbRow> | undefined
export function getMachinesRepository(): SheetRepository<MachinesDbRow> {
  return repository ??= new SheetRepository({ contract: machinesDbContract })
}

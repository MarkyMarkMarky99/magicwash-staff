import { z } from 'zod'
import { appointmentsDbContract, appointmentsRowSchema } from './Appointments.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type AppointmentsRow = z.infer<typeof appointmentsRowSchema>

/** Serves the physical Appointments sheet; supports reads, appends, and updates. */
let repository: SheetRepository<AppointmentsRow> | undefined

export function getAppointmentsRepository(): SheetRepository<AppointmentsRow> {
  return repository ??= new SheetRepository({ contract: appointmentsDbContract })
}

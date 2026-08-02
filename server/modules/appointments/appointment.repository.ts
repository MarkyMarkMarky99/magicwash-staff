import { appointmentContract } from './appointment.contract.js'
import { GSheetRepository } from '../../shared/repositories/gsheet.repository.js'
import { createAppointmentTransformer } from './appointment.transformer.js'

// ── Data access: the Google Sheets implementation behind the repository contract.
//    The whole `appointmentContract` drives every inferred type — DB row, mapped
//    API row, read filter, create/update inputs — so this file declares no
//    repository-derived aliases. The transformer is the DB-side escape hatch: on
//    create it packs the flat customer snapshot fields into the DB `Address` JSON
//    and drops the helpers; on every response it flattens that snapshot back to
//    customerName/customerCode/phone/location before the mapper runs. All other
//    transport detail (column letters, GViz strings, Apps Script writes) stays
//    inside GSheetRepository. Lazily constructed and memoized behind a getter so
//    importing this file never triggers env reads or repository construction
//    until a caller actually asks for it. ──
let appointmentRepository: GSheetRepository<typeof appointmentContract> | undefined

export function getAppointmentRepository(): GSheetRepository<typeof appointmentContract> {
  return appointmentRepository ??= new GSheetRepository({
    contract: appointmentContract,
    sheetName: 'Appointments',
    target: 'Appointment',
    spreadsheetId: 'APPOINTMENTS_SPREADSHEET_ID',
    transformer: createAppointmentTransformer(),
  })
}

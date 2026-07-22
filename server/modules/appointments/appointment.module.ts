import { appointmentContract } from './appointment.contract.js'
import { GSheetRepository } from '../../shared/repositories/gsheet.repository.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { requireEnv } from '../../shared/utils/env.js'
import { createAppointmentTransformer } from './appointment.transformer.js'

// ── Data access: the Google Sheets implementation behind the repository contract.
//    The whole `appointmentContract` drives every inferred type — DB row, mapped
//    API row, read filter, create/update inputs — so this file declares no
//    repository-derived aliases. The transformer is the DB-side escape hatch: on
//    create it packs the flat customer snapshot fields into the DB `Address` JSON
//    and drops the helpers; on every response it flattens that snapshot back to
//    customerName/customerCode/phone/location before the mapper runs. All other
//    transport detail (column letters, GViz strings, Apps Script writes) stays
//    inside GSheetRepository. ──
const appointmentRepository = new GSheetRepository({
  contract: appointmentContract,
  sheetName: 'Appointments',
  spreadsheetId: requireEnv('APPOINTMENTS_SPREADSHEET_ID'),
  scriptUrl: requireEnv('APPSCRIPT_URL'),
  transformer: createAppointmentTransformer(),
})

// ── API behavior: BaseCrudService validates the request, builds the read query
//    (ReadQueryDTO.fromQuery with searchFields), calls the repository, and
//    projects each response by its schema shape. searchFields stays on real
//    queryable columns only — `address` is excluded on purpose because at query
//    time it is still the raw serialized snapshot JSON, so searching it would
//    match constant JSON keys (Phone/Line/Email/…) on every row. Customer-name
//    keyword search needs a real column and is out of scope. ──
export const appointmentService = new BaseCrudService({
  repository: appointmentRepository,
  api: appointmentContract.api,
  searchFields: ['appointmentId', 'customerId', 'notes'],
})

export const appointmentRoutes = createCrudRoutes(appointmentService, appointmentContract.api)

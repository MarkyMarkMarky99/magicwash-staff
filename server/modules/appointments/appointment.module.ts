import { z } from 'zod'
import { createGoogleSheetRepository, createSheetService } from '../../shared/sheet-crud'
import { appointmentApiSchemas, appointmentListQuerySchema } from '../../../contracts/appointments/appointment-api.schema'
import { appointmentDbSchemas, appointmentRowSchema } from './appointment-db.schema'

// ── Types derived from the schemas — the schemas stay the single source of
//    truth; the aliases live with their only consumer (this module) rather
//    than as extra exports on the schema files. ──
type AppointmentRow = z.infer<typeof appointmentRowSchema>
type AppointmentFilter = z.infer<typeof appointmentListQuerySchema>

// ── Data access: the Google Sheets implementation behind the repository
//    contract. Transport detail (letters, GViz strings, env) stays in here.
//    The filter clauses are domain logic with no better home yet — everything
//    else in this file is pure wiring of the two contract bundles. ──
const appointmentRepository = createGoogleSheetRepository<AppointmentRow, AppointmentFilter>({
  sheet: {
    sheetName: 'Appointments',
    sheetNameEnv: 'APPOINTMENTS_SHEET_NAME',
    spreadsheetIdEnv: 'APPOINTMENTS_SPREADSHEET_ID',
    scriptUrlEnv: 'APPSCRIPT_APPOINTMENT_URL',
  },
  db: appointmentDbSchemas,
  clauses: (clause, columns) => {
    // dateFrom/dateTo act as one period clause; includePending widens it to
    // also match PENDING rows regardless of date.
    const datePeriod = clause.dateRange('dateFrom', 'dateTo', 'AppointmentDate')

    return [
      clause.contains('keyword', ['AppointmentID', 'CustomerID', 'Address', 'Notes']),
      (filter) => {
        const dateClause = datePeriod(filter)
        if (!filter.includePending) {
          return dateClause
        }
        const pending = `${columns.Status} = 'PENDING'`
        return dateClause ? `(${dateClause} or ${pending})` : pending
      },
      clause.eq('customerId', 'CustomerID'),
      clause.eq('orderId', ['PickupOrderID', 'DeliveryOrderID']),
      clause.eq('status', 'Status'),
      clause.eq('appointmentType', 'AppointmentType'),
      clause.eq('timeSlot', 'TimeSlot'),
      clause.eq('serviceTier', 'ServiceTier'),
    ]
  },
})

// ── API behavior: the two contract bundles do the talking. ──
export const appointmentService = createSheetService({
  resourceName: 'Appointment',
  repository: appointmentRepository,
  api: appointmentApiSchemas,
  db: appointmentDbSchemas,
  // No hooks: appointments has no write-time business logic yet.
})

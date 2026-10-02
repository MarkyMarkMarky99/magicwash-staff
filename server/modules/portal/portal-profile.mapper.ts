import type { SourceRow } from './portal.mapper.js'
import { reactCell } from './portal-source-reader.js'

export const customerFields = {
  customerId: 'CustomerID', customerIndex: 'CustomerIndex', customerName: 'CustomerName', phone: 'Phone',
  address: 'Address', location: 'Location', registeredDate: 'RegisteredDate', facebook: 'Facebook', lineId: 'Line',
  whatsapp: 'Whatsapp', email: 'Email', customerType: 'CustomerType', source: 'Source', scheduledDays: 'ScheduledDays',
  lastVisitDate: 'LastVisitDate', preferredContactMethod: 'PreferredContactMethod',
}
export const appointmentFields = {
  appointmentId: 'AppointmentID', customerId: 'CustomerID', appointmentType: 'AppointmentType', appointmentDate: 'AppointmentDate',
  timeSlot: 'TimeSlot', status: 'Status', pickupOrderId: 'PickupOrderID', deliveryOrderId: 'DeliveryOrderID',
  notes: 'Notes', deletedAt: 'DeletedAt', createdAt: 'CreatedAt',
}

export function projectPortalProfile(row: SourceRow, fields: Record<string, string>) {
  return Object.fromEntries(Object.entries(fields).map(([field, column]) =>
    [field, reactCell(row[column], ['registeredDate', 'lastVisitDate', 'appointmentDate'].includes(field))]))
}

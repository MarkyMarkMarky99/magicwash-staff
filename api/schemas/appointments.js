// Schema for Appointments sheet used by the Vue scheduling screens.
// Expected column order is based on the existing Vue GViz queries:
// A=AppointmentID, B=CustomerID, C=AppointmentType, D=AppointmentDate,
// E=TimeSlot, F=Status. Adjust this file if the sheet headers differ.

export const columns = [
  'appointmentId', 'customerId', 'appointmentType', 'appointmentDate',
  'timeSlot', 'status', 'address', 'notes', 'createdAt', 'createdBy',
  'updatedAt', 'updatedBy', 'deletedAt',
];

export const dateColumns = new Set(['appointmentDate', 'createdAt', 'updatedAt', 'deletedAt']);

export const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Appointments',
  type: 'object',
  required: ['appointmentId', 'customerId', 'appointmentType', 'appointmentDate', 'timeSlot', 'status'],
  properties: {
    appointmentId:   { type: 'string' },
    customerId:      { type: 'string' },
    appointmentType: { type: 'string' },
    appointmentDate: { type: 'string', format: 'date' },
    timeSlot:        { type: 'string' },
    status:          { type: 'string' },
    address:         { type: ['string', 'null'] },
    notes:           { type: ['string', 'null'] },
    createdAt:       { type: ['string', 'null'] },
    createdBy:       { type: ['string', 'null'] },
    updatedAt:       { type: ['string', 'null'] },
    updatedBy:       { type: ['string', 'null'] },
    deletedAt:       { type: ['string', 'null'] },
  },
};

// Schema for Appointments sheet used by the backend GViz proxy.
// Source: Database/GoogleSheets/Appointment.json

export const columns = [
  'appointmentId', 'customerId', 'appointmentType', 'appointmentDate',
  'timeSlot', 'status', 'address', 'pickupOrderId', 'deliveryOrderId',
  'notes', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'serviceTier',
];

export const dateColumns = new Set(['appointmentDate', 'createdAt', 'updatedAt']);

export const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Appointments',
  type: 'object',
  required: ['appointmentId', 'customerId', 'appointmentType', 'appointmentDate', 'timeSlot', 'status'],
  properties: {
    appointmentId:   { type: 'string' },
    customerId:      { type: 'string' },
    appointmentType: { type: 'string', enum: ['PICKUP', 'DELIVERY', 'PICKUP_DELIVERY'] },
    appointmentDate: { type: 'string', format: 'date' },
    timeSlot:        { type: 'string', enum: ['10:00-12:00', '13:00-15:00', '15:00-17:00', '18:00-20:00'] },
    status:          { type: 'string', enum: ['PENDING', 'CONFIRMED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] },
    address:         { type: ['string', 'null'] },
    pickupOrderId:   { type: ['string', 'null'] },
    deliveryOrderId: { type: ['string', 'null'] },
    notes:           { type: ['string', 'null'] },
    createdAt:       { type: 'string' },
    updatedAt:       { type: ['string', 'null'] },
    createdBy:       { type: ['string', 'null'] },
    updatedBy:       { type: ['string', 'null'] },
    serviceTier:     { type: 'string', enum: ['PRIORITY', 'STANDARD', 'ECONOMY'] },
  },
};

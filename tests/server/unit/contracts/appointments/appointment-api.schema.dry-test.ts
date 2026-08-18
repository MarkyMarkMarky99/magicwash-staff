import assert from 'node:assert/strict'
import * as appointmentApi from '../../../../../contracts/appointments/appointment-api.schema.js'

type EnumWithOptions = { options: readonly string[] }

const hasEnumOptions = (value: unknown): value is EnumWithOptions =>
  typeof value === 'object' &&
  value !== null &&
  'options' in value &&
  Array.isArray((value as { options?: unknown }).options)

const isWritableTypeExport = (
  entry: [string, unknown],
): entry is [string, EnumWithOptions] => {
  const [exportName, value] = entry
  return (
    exportName !== 'appointmentTypeSchema' &&
    hasEnumOptions(value) &&
    value.options.length === 2 &&
    value.options[0] === 'PICKUP' &&
    value.options[1] === 'DELIVERY'
  )
}

const exportedAppointmentSchemas: [string, unknown][] = Object.entries(appointmentApi)
const writableTypeExports = exportedAppointmentSchemas.filter(isWritableTypeExport)

assert.equal(
  writableTypeExports.length,
  1,
  'the writable appointment type enum must be one separate exported value',
)
const writableAppointmentTypeSchema = writableTypeExports[0]?.[1]
if (!writableAppointmentTypeSchema) {
  throw new Error('writable appointment type enum export is missing')
}

const {
  appointmentTypeSchema,
  appointmentDetailResponseSchema,
  createAppointmentRequestSchema,
  updateAppointmentRequestSchema,
} = appointmentApi

assert.deepEqual(appointmentTypeSchema.options, [
  'PICKUP',
  'DELIVERY',
  'PICKUP_DELIVERY',
])
assert.deepEqual(writableAppointmentTypeSchema.options, ['PICKUP', 'DELIVERY'])
assert.notEqual(writableAppointmentTypeSchema, appointmentTypeSchema)

assert.equal(
  createAppointmentRequestSchema.shape.appointmentType,
  writableAppointmentTypeSchema,
)
const updateAppointmentObjectSchema = updateAppointmentRequestSchema.innerType()
assert.equal(updateAppointmentObjectSchema.shape.appointmentType.isOptional(), true)
assert.equal(
  updateAppointmentObjectSchema.shape.appointmentType.unwrap(),
  writableAppointmentTypeSchema,
)
assert.equal(
  appointmentDetailResponseSchema.shape.appointmentType,
  appointmentTypeSchema,
)

assert.deepEqual(
  createAppointmentRequestSchema.partial().parse({ appointmentType: 'PICKUP' }),
  { appointmentType: 'PICKUP' },
)
assert.deepEqual(
  createAppointmentRequestSchema.partial().parse({ appointmentType: 'DELIVERY' }),
  { appointmentType: 'DELIVERY' },
)
assert.throws(() =>
  createAppointmentRequestSchema.partial().parse({ appointmentType: 'PICKUP_DELIVERY' }),
)
assert.throws(() =>
  createAppointmentRequestSchema.partial().parse({ appointmentType: 'ROUND' }),
)

assert.deepEqual(
  updateAppointmentRequestSchema.parse({ appointmentType: 'DELIVERY', updatedBy: 'tester' }),
  { appointmentType: 'DELIVERY', updatedBy: 'tester' },
)
assert.deepEqual(
  updateAppointmentRequestSchema.parse({ notes: null, updatedBy: 'tester' }),
  { notes: null, updatedBy: 'tester' },
)
assert.throws(() =>
  updateAppointmentRequestSchema.parse({ appointmentType: 'PICKUP_DELIVERY', updatedBy: 'tester' }),
)
assert.throws(() =>
  updateAppointmentRequestSchema.parse({ appointmentType: 'ROUND', updatedBy: 'tester' }),
)

for (const appointmentType of ['PICKUP_DELIVERY', 'PICKUP', 'DELIVERY'] as const) {
  assert.deepEqual(
    appointmentDetailResponseSchema.partial().parse({ appointmentType }),
    { appointmentType },
  )
}

console.log('appointment-api.schema.dry-test: OK')

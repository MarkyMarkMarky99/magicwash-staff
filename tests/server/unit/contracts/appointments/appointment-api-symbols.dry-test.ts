import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as appointmentApi from '../../../../../contracts/appointments/appointment-api.schema.js'

const deprecatedSchemaNames = ['appointmentCreateSchema', 'appointmentUpdateSchema'] as const
const canonicalSchemaNames = [
  'createAppointmentRequestSchema',
  'updateAppointmentRequestSchema',
] as const

const filesThatMustNotUseDeprecatedNames = [
  new URL('../../../../../contracts/appointments/appointment-api.schema.ts', import.meta.url),
  new URL('../../../../../server/modules/appointments/appointment.service.ts', import.meta.url),
  new URL('../../../../modules/appointments/appointment-write.fixtures.ts', import.meta.url),
]

for (const deprecatedSchemaName of deprecatedSchemaNames) {
  assert.equal(
    deprecatedSchemaName in appointmentApi,
    false,
    `${deprecatedSchemaName} must not be exported from the appointment API contract`,
  )
}

for (const canonicalSchemaName of canonicalSchemaNames) {
  assert.equal(
    canonicalSchemaName in appointmentApi,
    true,
    `${canonicalSchemaName} must be exported from the appointment API contract`,
  )
}

for (const fileUrl of filesThatMustNotUseDeprecatedNames) {
  const filePath = fileURLToPath(fileUrl)
  const source = readFileSync(filePath, 'utf8')

  for (const deprecatedSchemaName of deprecatedSchemaNames) {
    assert.equal(
      source.includes(deprecatedSchemaName),
      false,
      `${filePath} must not reference ${deprecatedSchemaName}`,
    )
  }
}

console.log('appointment-api-symbols.dry-test: OK')

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const readSource = (path: string) => readFileSync(
  new URL(`../../../../../${path}`, import.meta.url),
  'utf8',
)

const appSource = readSource('src/App.vue')
const headerSource = readSource('src/shared/components/AppHeader.vue')
const layoutSource = readSource('src/shared/layouts/AppLayout.vue')
const scheduleSource = readSource('src/features/appointments/pages/AppointmentSchedulePage.vue')
const injectionKeySource = readSource('src/shared/appointment-pending-count.ts')

assert.match(injectionKeySource, /InjectionKey<Readonly<Ref<number>>>/)
assert.match(appSource, /provide\(appointmentPendingCountKey, pendingCount\)/)
assert.match(headerSource, /inject\(appointmentPendingCountKey, ref\(0\)\)/)
assert.doesNotMatch(headerSource, /@\/data\//, 'shared header must not import the data layer')
assert.match(
  headerSource,
  /route\.name === ['"]appointment-schedule['"]/,
  'the pending action must remain limited to the schedule route',
)
assert.match(layoutSource, /<AppHeader\s*\/>/)
assert.doesNotMatch(layoutSource, /pendingCount|pending-count/)
assert.doesNotMatch(scheduleSource, /pendingCount|pending-count/)

console.log('app-header-pending-count.dry-test: OK')

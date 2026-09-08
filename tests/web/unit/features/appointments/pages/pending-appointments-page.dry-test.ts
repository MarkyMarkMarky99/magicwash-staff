import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../../../../../../src/features/appointments/pages/PendingAppointmentsPage.vue', import.meta.url),
  'utf8',
)

assert.match(source, /import ListContainer from '@\/shared\/components\/ListContainer\.vue'/)
assert.match(source, /<ListContainer[\s\S]*title="Pending Requests"[\s\S]*:loading="loading"[\s\S]*:error="error"[\s\S]*:empty="pendingItems\.length === 0"/)
assert.match(source, /<template #actions>[\s\S]*@click\.stop="store\.loadPending\(true\)"/)
assert.match(source, /class="flex h-\[22px\] w-\[22px\][^"]*hover:bg-surface-container[^"]*active:scale-95[^"]*"/)
assert.match(source, /aria-label="Refresh pending requests"/)
assert.doesNotMatch(source, /v-if="loading" class="divide-y/, 'ListContainer must own collection states')

console.log('pending appointments page dry tests passed')

import assert from 'node:assert/strict'
import { isStaffCardCode } from '@/shared/utils/staff-card'

for (const code of ['MWS-abc', ' mws-AbC ', 'MwS-', '\tmWs-123\n']) assert.equal(isStaffCardCode(code), true)
for (const code of ['', 'MWS', 'MWSx-abc', 'JOB-MWS-abc', 'MW-abc']) assert.equal(isStaffCardCode(code), false)
console.log('staff card dry test passed')

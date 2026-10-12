import assert from 'node:assert/strict'
import type { MachineDto } from '@/data/machines/machines.service'
import { machineTagLetter, nextTagCode } from '@/features/wash-queue/tag-code'

const machine = (id: string, type: 'WSH' | 'DRY', sortOrder: number | null, status: MachineDto['status'] = 'ACTIVE'): MachineDto =>
  ({ id, type, name: id, capacityKg: 10, status, sortOrder, note: null })
const machines = [
  machine('DRY30-01', 'DRY', 3), machine('WSH24-01', 'WSH', 3), machine('WSH10-01', 'WSH', 1),
  machine('DRY08-01', 'DRY', 1), machine('WSH15-01', 'WSH', 2, 'RETIRED'), machine('DRY15-01', 'DRY', 2),
]
// Letters follow sort_order within each type, retired machines included; dryers start at N and skip O.
assert.equal(machineTagLetter('WSH10-01', machines), 'A')
assert.equal(machineTagLetter('WSH15-01', machines), 'B')
assert.equal(machineTagLetter('WSH24-01', machines), 'C')
assert.equal(machineTagLetter('DRY08-01', machines), 'N')
assert.equal(machineTagLetter('DRY15-01', machines), 'P')
assert.equal(machineTagLetter('DRY30-01', machines), 'Q')
assert.equal(machineTagLetter('unknown', machines), null)
assert.equal(machineTagLetter(null, machines), null)
const washers = Array.from({ length: 14 }, (_, index) => machine(`WSH-${index}`, 'WSH', index))
assert.equal(machineTagLetter('WSH-12', washers), 'M')
assert.equal(machineTagLetter('WSH-13', washers), null)

const today = '2026-10-13'
const row = (tagCode: string | null, createdAt = `${today} 09:00:00`) => ({ tagCode, createdAt })
assert.equal(nextTagCode('A', [], today), 'A001')
assert.equal(nextTagCode('A', [row('A001'), row('A007'), row('B009'), row('A'), row(null), row('A050', '2026-10-12 09:00:00')], today), 'A008')
assert.equal(nextTagCode('A', [row('A999')], today), null)
console.log('wash queue tag code dry test passed')

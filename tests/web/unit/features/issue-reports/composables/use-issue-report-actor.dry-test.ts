import assert from 'node:assert/strict'
import {
  readStoredActor,
  writeStoredActor,
} from '../../../../../../src/features/issue-reports/composables/use-issue-report-actor'

const values = new Map<string, string>()
const storage = {
  getItem(key: string) {
    return values.get(key) ?? null
  },
  setItem(key: string, value: string) {
    values.set(key, value)
  },
}

assert.equal(readStoredActor(storage), '', 'a missing stored actor must read as an empty string')
values.set('issue-reports.actor', '  มานี  ')
assert.equal(readStoredActor(storage), 'มานี', 'stored actor names must be trimmed when read')

writeStoredActor(storage, '  มานะ  ')
assert.equal(values.get('issue-reports.actor'), 'มานะ', 'stored actor names must be trimmed when written')

console.log('issue-report actor dry tests passed')

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../../../../../../src/features/staff/pages/StaffListPage.vue', import.meta.url),
  'utf8',
)

const loadBody = source.match(/async function load\(\): Promise<void> \{([\s\S]*?)\n\}/)?.[1]
const refreshBody = source.match(/async function refresh\(\): Promise<void> \{([\s\S]*?)\n\}/)?.[1]
assert.ok(loadBody)
assert.ok(refreshBody)

let staffLoads = 0
let scoreLoads = 0
const staffStore = {
  loaded: true,
  async load() { staffLoads += 1 },
}
const loadScores = async () => { scoreLoads += 1 }
const run = async (body: string) => new Function('staffStore', 'loadScores', `return (async () => {${body}})()`)(staffStore, loadScores)

await run(loadBody)
assert.equal(staffLoads, 0)
assert.equal(scoreLoads, 1)
staffStore.loaded = false
await run(loadBody)
assert.equal(staffLoads, 1)
assert.equal(scoreLoads, 2)
staffStore.loaded = true
await run(refreshBody)
assert.equal(staffLoads, 2)
assert.equal(scoreLoads, 3)

assert.match(source, /watch\(status, \(value\) => \{\s*if \(value === 'signedIn' && route.name === 'staff-list'\) load\(\)/)
assert.match(source, /onActivated\(\(\) => \{\s*if \(status.value === 'signedIn'\) load\(\)/)
assert.match(source, /<ListContainer :refresh="refresh"/)

console.log('passed - staff list page dry-tests')

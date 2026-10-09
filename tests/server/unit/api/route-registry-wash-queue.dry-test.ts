import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../../../../server/api/route-registry.ts', import.meta.url), 'utf8')
assert.match(source, /'wash-queue':\s*\(\).*import\(['"]\.\.\/modules\/wash-queue\/wash-queue\.module\.js['"]\)/s)
assert.doesNotMatch(source, /import\s+.*from\s+['"].*wash-queue\/wash-queue\.module\.js['"]/, 'WashQueue must load lazily')
delete process.env.JOB_TICKETS_SPREADSHEET_ID
const { resolveRoute } = await import('../../../../server/api/route-registry.js')
const routes = await resolveRoute('wash-queue')
assert.ok(routes.collection)
assert.ok(routes.item)
console.log('wash queue lazy route dry test passed')

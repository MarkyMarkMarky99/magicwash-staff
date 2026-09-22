import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('../../../../server/api/route-registry.ts', import.meta.url)), 'utf8')
assert.match(source, /items:\s*\(\).*import\(['"]\.\.\/modules\/items\/items\.module\.js['"]\)/s)
assert.doesNotMatch(source, /import\s+.*from\s+['"].*items\/items\.module\.js['"]/, 'Items must load lazily')

const previous = process.env.PRICE_LIST_SPREADSHEET_ID
delete process.env.PRICE_LIST_SPREADSHEET_ID
try {
  const { resolveRoute } = await import('../../../../server/api/route-registry.js')
  await assert.doesNotReject(() => resolveRoute('items'))
} finally {
  if (previous === undefined) delete process.env.PRICE_LIST_SPREADSHEET_ID
  else process.env.PRICE_LIST_SPREADSHEET_ID = previous
}

console.log('items lazy route dry test passed')

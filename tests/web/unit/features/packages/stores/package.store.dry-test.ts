import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../../../../../../src/features/packages/stores/package.store.ts', import.meta.url),
  'utf8',
)

assert.match(source, /let loadPromise: Promise<void> \| null = null/, 'load must guard concurrent requests')
assert.match(source, /if \(loadPromise\) return loadPromise/, 'concurrent loads must share one request')
assert.match(source, /listPackages\(\{ perPage: 200 \}\)/, 'load must request the complete catalog')
assert.match(source, /item\.deletedAt === null/, 'active packages must exclude deactivated rows')
assert.match(source, /items\.value = \[\.\.\.items\.value, created\]/, 'create must append its API DTO')
assert.match(source, /item\.packageCode === packageCode \? updated : item/, 'update must replace by immutable package code')
assert.match(source, /error\.value = errorMessage\(reason, 'Unable to load packages'\)/, 'load failures must remain visible')
assert.match(source, /throw reason/, 'write failures must be rethrown')

console.log('package store dry tests passed')

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { resolveRoute } from '../../../../server/api/route-registry.js'

const routeRegistryPath = fileURLToPath(
  new URL('../../../../server/api/route-registry.ts', import.meta.url),
)
const source = readFileSync(routeRegistryPath, 'utf8')

assert.match(
  source,
  /'laundry-photos'\s*:\s*\(\)\s*:\s*ReturnType<RouteLoader>\s*=>\s*import\(\s*['"]\.\.\/modules\/laundry-photos\/laundry-photo\.module\.js['"]\s*\)\.then\(\(module\)\s*=>\s*module\.laundryPhotoRoutes\)/,
)
assert.doesNotMatch(
  source,
  /(?:^|\n)\s*import\s+[^;\n]+from\s+['"][^'"]*laundry-photos\/laundry-photo\.module\.[jt]s['"]/
)

const resolved = await resolveRoute('laundry-photos')
const module = await import('../../../../server/modules/laundry-photos/laundry-photo.module.js')
assert.strictEqual(resolved, module.laundryPhotoRoutes)
assert.ok(resolved.collection)
assert.ok(resolved.item)

const service = module.laundryPhotoService as unknown as {
  list: (query: unknown) => Promise<unknown>
  getById: (id: string) => Promise<unknown>
  update: (id: string, payload: unknown) => Promise<unknown>
}
const originals = { list: service.list, getById: service.getById, update: service.update }
service.list = async () => ({ items: [], pagination: { page: 1, perPage: 1 } })
service.getById = async () => ({ laundryPhotoId: 'photo-1' })
service.update = async () => ({ laundryPhotoId: 'photo-1' })

const request = (method: string, body: unknown = undefined, params: Record<string, string> = {}) => ({
  method, query: {}, body, headers: {}, params,
})

try {
  assert.equal((await resolved.collection.handleRequest(request('GET'))).status, 200)
  const collectionPost = await resolved.collection.handleRequest(request('POST'))
  assert.equal(collectionPost.status, 405)
  assert.equal(collectionPost.headers?.Allow, 'GET')
  const collectionDelete = await resolved.collection.handleRequest(request('DELETE'))
  assert.equal(collectionDelete.status, 405)
  assert.equal(collectionDelete.headers?.Allow, 'GET')

  assert.equal((await resolved.item!.handleRequest(request('GET', undefined, { id: 'photo-1' }))).status, 200)
  assert.equal((await resolved.item!.handleRequest(request('PATCH', {}, { id: 'photo-1' }))).status, 200)
  const itemPost = await resolved.item!.handleRequest(request('POST', {}, { id: 'photo-1' }))
  assert.equal(itemPost.status, 405)
  assert.equal(itemPost.headers?.Allow, 'GET, PATCH')
  const itemDelete = await resolved.item!.handleRequest(request('DELETE', undefined, { id: 'photo-1' }))
  assert.equal(itemDelete.status, 405)
  assert.equal(itemDelete.headers?.Allow, 'GET, PATCH')
} finally {
  service.list = originals.list
  service.getById = originals.getById
  service.update = originals.update
}

console.log('laundry-photos route registry dry test passed')

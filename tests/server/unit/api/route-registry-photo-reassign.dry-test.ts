import assert from 'node:assert/strict'
import { resolveRoute } from '../../../../server/api/route-registry.js'
import { laundryPhotoService } from '../../../../server/modules/laundry-photos/laundry-photo.module.js'
import { afterPhotoService } from '../../../../server/modules/after-photos/after-photo.module.js'

for (const [name, service] of [
  ['laundry-photos', laundryPhotoService],
  ['after-photos', afterPhotoService],
] as const) {
  const original = service.reassign
  let calls = 0
  service.reassign = async (payload: unknown) => {
    calls += 1
    assert.deepEqual(payload, { photoIds: ['photo-1'], orderItemId: 'item-2', updatedBy: 'staff-1' })
    return { photos: [] }
  }
  try {
    const routes = await resolveRoute(name)
    const request = (method: string, id: string) => ({
      method, query: {}, headers: {}, params: { id },
      body: { photoIds: ['photo-1'], orderItemId: 'item-2', updatedBy: 'staff-1' },
    })
    const result = await routes.item!.handleRequest(request('POST', 'reassign'))
    assert.equal(result.status, 200)
    assert.deepEqual((result.body as { data: unknown }).data, { photos: [] })
    assert.equal(calls, 1)
    assert.equal((await routes.item!.handleRequest(request('POST', 'photo-1'))).status, 404)
    assert.equal((await routes.item!.handleRequest(request('GET', 'reassign'))).status, 404)
    assert.equal((await routes.item!.handleRequest(request('PATCH', 'reassign'))).status, 404)
    assert.equal(calls, 1)
  } finally {
    service.reassign = original
  }
}

console.log('photo reassign route registry dry test passed')

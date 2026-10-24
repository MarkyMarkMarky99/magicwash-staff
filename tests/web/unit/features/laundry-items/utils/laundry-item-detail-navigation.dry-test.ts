import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp, effectScope, nextTick } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { useOrderIntakeOverlayRoute } from '@/features/orders/composables/useOrderIntakeOverlayRoute'
import { useLaundryItemDetailOverlayRoute } from '@/features/laundry-items/composables/useLaundryItemDetailOverlayRoute'

async function navigate(router: Router, action: () => void) {
  const finished = new Promise<void>(resolve => {
    const remove = router.afterEach(() => { remove(); resolve() })
  })
  action()
  await finished
  await nextTick()
}

async function setup(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/intake', component: { render: () => null } }, { path: '/garments/:tagId', component: { render: () => null } }] })
  const app = createApp({ render: () => null })
  app.use(router)
  await router.push(path)
  const scope = effectScope()
  const routes = app.runWithContext(() => scope.run(() => ({ intake: useOrderIntakeOverlayRoute(), detail: useLaundryItemDetailOverlayRoute() }))!)
  return { router, scope, ...routes }
}

test('nested detail, album and viewer Back restore their exact hosts without leaving Intake', async () => {
  const { router, scope, intake, detail } = await setup('/intake?customer=c')
  await navigate(router, () => intake.open({ kind: 'row', key: 'shirt' }))
  await navigate(router, () => intake.open({ kind: 'item', tag: 'AAAA0001' }))
  await navigate(router, () => detail.open('album'))
  await navigate(router, () => detail.open('photo:one'))
  await navigate(router, () => detail.open('photo:two', true))
  await navigate(router, () => detail.close())
  assert.equal(router.currentRoute.value.query.garmentDetail, 'album')
  await navigate(router, () => detail.close())
  assert.equal(router.currentRoute.value.query.intake, 'item:AAAA0001')
  await navigate(router, () => intake.close())
  assert.equal(router.currentRoute.value.query.intake, 'row:shirt')
  await navigate(router, () => intake.close())
  assert.deepEqual(router.currentRoute.value.query, { customer: 'c' })
  scope.stop()
})

test('browser Back closes detail to its row and the row close still returns to Intake', async () => {
  const { router, scope, intake } = await setup('/intake')
  await navigate(router, () => intake.open({ kind: 'row', key: 'uncategorized' }))
  await navigate(router, () => intake.open({ kind: 'item', tag: 'AAAA0001' }))
  await navigate(router, () => router.back())
  assert.deepEqual(intake.overlay.value, { kind: 'row', key: 'uncategorized' })
  await navigate(router, () => intake.close())
  assert.equal(router.currentRoute.value.fullPath, '/intake')
  scope.stop()
})

test('refreshed Intake deep link closes with replace and preserves unrelated query state', async () => {
  const { router, scope, intake, detail } = await setup('/intake?intake=item:AAAA0001&garmentDetail=album&customer=c')
  await navigate(router, () => detail.close())
  assert.deepEqual(router.currentRoute.value.query, { intake: 'item:AAAA0001', customer: 'c' })
  await navigate(router, () => intake.close())
  assert.deepEqual(router.currentRoute.value.query, { customer: 'c' })
  scope.stop()
})

test('standalone photo deep link closes to the garment and picker has its own Back entry', async () => {
  const { router, scope, detail } = await setup('/garments/AAAA0001?garmentDetail=photo:one')
  await navigate(router, () => detail.close())
  assert.equal(router.currentRoute.value.fullPath, '/garments/AAAA0001')
  await navigate(router, () => detail.open('type'))
  await navigate(router, () => detail.close())
  assert.equal(router.currentRoute.value.fullPath, '/garments/AAAA0001')
  scope.stop()
})

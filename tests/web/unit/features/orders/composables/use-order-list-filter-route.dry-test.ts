import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp, effectScope, nextTick, watch } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useOrderListFilterRoute } from '@/features/orders/composables/use-order-list-filter-route'

test('keeps list filters while the report is active and updates them on return', async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { name: 'order-list', path: '/orders', component: { render: () => null } },
      { name: 'order-report', path: '/reports/orders', component: { render: () => null } },
    ],
  })
  await router.push('/orders?date=2026-10-05&keyword=shirt&dateField=dueDate&page=2')
  const app = createApp({ render: () => null })
  app.use(router)
  const scope = effectScope()
  try {
    const filters = scope.run(() => app.runWithContext(() => useOrderListFilterRoute()))!
    const snapshots = () => [filters.keyword.value, filters.dateField.value, filters.date.value, filters.page.value]
    let filterChanges = 0
    scope.run(() => watch([filters.keyword, filters.dateField, filters.date, filters.page], () => { filterChanges += 1 }))
    assert.equal(filters.date.value, '2026-10-05')
    assert.deepEqual(snapshots(), ['shirt', 'dueDate', '2026-10-05', 2])

    await router.push('/reports/orders')
    await nextTick()
    assert.equal(filters.date.value, '2026-10-05')
    assert.deepEqual(snapshots(), ['shirt', 'dueDate', '2026-10-05', 2])
    assert.equal(filterChanges, 0)

    await router.push('/orders?date=2026-10-04')
    await nextTick()
    assert.equal(filters.date.value, '2026-10-04')
    assert.deepEqual(snapshots(), ['', 'receivedDate', '2026-10-04', 1])
    assert.equal(filterChanges, 1)
  } finally {
    scope.stop()
  }
})

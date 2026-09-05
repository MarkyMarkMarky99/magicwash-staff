import assert from 'node:assert/strict'
import { createApp, reactive } from 'vue'
import { routeLocationKey, routerKey } from 'vue-router'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import {
  defaultPriceListFilter,
  filterFromQuery,
  filterToQuery,
  usePriceListFilterRoute,
} from '@/features/price-list/composables/usePriceListFilterRoute'

const tests: Array<{ name: string; run: () => void }> = []

function test(name: string, run: () => void) {
  tests.push({ name, run })
}

function createComposableContext(query: Record<string, unknown> = {}) {
  const route = reactive({ query })
  const replaceCalls: unknown[] = []
  const router = {
    // The real router writes the new query back onto the route, and `filter` is computed from
    // the route. A mock that only records the call leaves `filter` pinned to the initial query,
    // so every merge assertion reads a stale filter and passes no matter what updateFilter does.
    replace(location: { query?: Record<string, unknown> }) {
      replaceCalls.push(location)
      route.query = { ...(location.query ?? {}) }
    },
  }
  const app = createApp({ render: () => null })

  app.provide(routeLocationKey, route as RouteLocationNormalizedLoaded)
  app.provide(routerKey, router as Router)

  return {
    route,
    replaceCalls,
    composable: app.runWithContext(() => usePriceListFilterRoute()),
  }
}

test('defines the all-items filter as every dimension null', () => {
  assert.deepEqual(defaultPriceListFilter, { category: null, serviceType: null })
})

test('converts a category query to the corresponding filter', () => {
  assert.deepEqual(filterFromQuery({ category: 'shirts' }), { category: 'shirts', serviceType: null })
})

test('converts a serviceType query to the corresponding filter', () => {
  assert.deepEqual(filterFromQuery({ serviceType: 'DRCL' }), { category: null, serviceType: 'DRCL' })
  assert.deepEqual(
    filterFromQuery({ category: 'shirts', serviceType: 'IRON' }),
    { category: 'shirts', serviceType: 'IRON' },
  )
})

test('converts a missing, null, or empty category query to the all-items filter', () => {
  assert.deepEqual(filterFromQuery({}), { category: null, serviceType: null })
  assert.deepEqual(filterFromQuery({ category: null }), { category: null, serviceType: null })
  assert.deepEqual(filterFromQuery({ category: '' }), { category: null, serviceType: null })
  assert.deepEqual(filterFromQuery({ serviceType: '' }), { category: null, serviceType: null })
})

test('writes a query entry only for a truthy dimension', () => {
  assert.deepEqual(filterToQuery({ category: 'shirts', serviceType: null }), { category: 'shirts' })
  assert.deepEqual(filterToQuery({ category: null, serviceType: 'WASH' }), { serviceType: 'WASH' })
  assert.deepEqual(
    filterToQuery({ category: 'shirts', serviceType: 'WASH' }),
    { category: 'shirts', serviceType: 'WASH' },
  )
  assert.deepEqual(filterToQuery({ category: null, serviceType: null }), {})
  assert.deepEqual(filterToQuery({ category: '', serviceType: '' }), {})
})

test('derives its computed filter from the current route query', () => {
  const { route, composable } = createComposableContext({ category: 'shirts' })

  assert.deepEqual(composable.filter.value, { category: 'shirts', serviceType: null })

  route.query = { category: 'trousers', serviceType: 'DRCL' }

  assert.deepEqual(composable.filter.value, { category: 'trousers', serviceType: 'DRCL' })

  route.query = {}

  assert.deepEqual(composable.filter.value, { category: null, serviceType: null })
})

test('merges updates across both dimensions and drops the emptied ones', () => {
  const { replaceCalls, composable } = createComposableContext({ category: 'shirts' })

  assert.equal(composable.updateFilter({}), undefined)
  assert.deepEqual(replaceCalls[0], {
    name: 'price-list',
    query: { category: 'shirts' },
  })

  assert.equal(composable.updateFilter({ category: 'blankets' }), undefined)
  assert.deepEqual(replaceCalls[1], {
    name: 'price-list',
    query: { category: 'blankets' },
  })

  // The second dimension must survive an update that names only the first one.
  assert.equal(composable.updateFilter({ serviceType: 'IRON' }), undefined)
  assert.deepEqual(replaceCalls[2], {
    name: 'price-list',
    query: { category: 'blankets', serviceType: 'IRON' },
  })

  assert.equal(composable.updateFilter({ category: null }), undefined)
  assert.deepEqual(replaceCalls[3], {
    name: 'price-list',
    query: { serviceType: 'IRON' },
  })

  assert.equal(composable.updateFilter({ serviceType: null }), undefined)
  assert.deepEqual(replaceCalls[4], {
    name: 'price-list',
    query: {},
  })
})

for (const item of tests) {
  item.run()
}

console.log(`${tests.length} price-list filter route dry tests passed`)

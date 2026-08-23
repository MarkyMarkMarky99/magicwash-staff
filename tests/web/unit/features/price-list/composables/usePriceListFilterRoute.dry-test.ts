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
    replace(location: unknown) {
      replaceCalls.push(location)
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

test('defines the all-items filter as category null', () => {
  assert.deepEqual(defaultPriceListFilter, { category: null })
})

test('converts a category query to the corresponding filter', () => {
  assert.deepEqual(filterFromQuery({ category: 'shirts' }), { category: 'shirts' })
})

test('converts a missing, null, or empty category query to the all-items filter', () => {
  assert.deepEqual(filterFromQuery({}), { category: null })
  assert.deepEqual(filterFromQuery({ category: null }), { category: null })
  assert.deepEqual(filterFromQuery({ category: '' }), { category: null })
})

test('writes a category query only for a truthy category', () => {
  assert.deepEqual(filterToQuery({ category: 'shirts' }), { category: 'shirts' })
  assert.deepEqual(filterToQuery({ category: null }), {})
  assert.deepEqual(filterToQuery({ category: '' }), {})
})

test('derives its computed filter from the current route query', () => {
  const { route, composable } = createComposableContext({ category: 'shirts' })

  assert.deepEqual(composable.filter.value, { category: 'shirts' })

  route.query = { category: 'trousers' }

  assert.deepEqual(composable.filter.value, { category: 'trousers' })

  route.query = {}

  assert.deepEqual(composable.filter.value, { category: null })
})

test('merges updates and replaces the price-list route, removing an all-items category', () => {
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

  assert.equal(composable.updateFilter({ category: null }), undefined)
  assert.deepEqual(replaceCalls[2], {
    name: 'price-list',
    query: {},
  })
})

for (const item of tests) {
  item.run()
}

console.log(`${tests.length} price-list filter route dry tests passed`)

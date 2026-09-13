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

test('defaults to clothing with all subcategories and services', () => {
  assert.deepEqual(defaultPriceListFilter, { category: 'CLOTHING', subcategory: null, serviceType: null })
})

test('converts a category query to the corresponding filter', () => {
  assert.deepEqual(filterFromQuery({ category: 'CLOTHING' }), { category: 'CLOTHING', subcategory: null, serviceType: null })
  assert.deepEqual(filterFromQuery({ category: 'Clothing' }), { category: 'CLOTHING', subcategory: null, serviceType: null })
  assert.deepEqual(filterFromQuery({ category: 'ALL' }), { category: 'ALL', subcategory: null, serviceType: null })
})

test('converts subcategory and serviceType queries to the corresponding filter', () => {
  assert.deepEqual(filterFromQuery({ serviceType: 'DRCL' }), { category: 'CLOTHING', subcategory: null, serviceType: 'DRCL' })
  assert.deepEqual(
    filterFromQuery({ category: 'CLOTHING', subcategory: 'Shirts', serviceType: 'IRON' }),
    { category: 'CLOTHING', subcategory: 'Shirts', serviceType: 'IRON' },
  )
})

test('converts a missing, null, or empty category query to clothing', () => {
  assert.deepEqual(filterFromQuery({}), defaultPriceListFilter)
  assert.deepEqual(filterFromQuery({ category: null }), defaultPriceListFilter)
  assert.deepEqual(filterFromQuery({ category: '' }), defaultPriceListFilter)
  assert.deepEqual(filterFromQuery({ serviceType: '', subcategory: '' }), defaultPriceListFilter)
})

test('writes an explicit category and only selected optional dimensions', () => {
  assert.deepEqual(filterToQuery({ category: 'CLOTHING', subcategory: null, serviceType: null }), { category: 'CLOTHING' })
  assert.deepEqual(filterToQuery({ category: 'ALL', subcategory: null, serviceType: 'WASH' }), { category: 'ALL', serviceType: 'WASH' })
  assert.deepEqual(
    filterToQuery({ category: 'CLOTHING', subcategory: 'Shirts', serviceType: 'WASH' }),
    { category: 'CLOTHING', subcategory: 'Shirts', serviceType: 'WASH' },
  )
})

test('derives its computed filter from the current route query', () => {
  const { route, composable } = createComposableContext({ category: 'shirts' })

  assert.deepEqual(composable.filter.value, { category: 'SHIRTS', subcategory: null, serviceType: null })

  route.query = { category: 'trousers', subcategory: 'Pants', serviceType: 'DRCL' }

  assert.deepEqual(composable.filter.value, { category: 'TROUSERS', subcategory: 'Pants', serviceType: 'DRCL' })

  route.query = {}

  assert.deepEqual(composable.filter.value, defaultPriceListFilter)
})

test('merges updates across all dimensions and clears subcategory on category change', () => {
  const { replaceCalls, composable } = createComposableContext({ category: 'shirts' })

  assert.equal(composable.updateFilter({}), undefined)
  assert.deepEqual(replaceCalls[0], {
    name: 'price-list',
    query: { category: 'SHIRTS' },
  })

  assert.equal(composable.updateFilter({ subcategory: 'Shirts' }), undefined)
  assert.deepEqual(replaceCalls[1], {
    name: 'price-list',
    query: { category: 'SHIRTS', subcategory: 'Shirts' },
  })

  assert.equal(composable.updateFilter({ serviceType: 'IRON' }), undefined)
  assert.deepEqual(replaceCalls[2], {
    name: 'price-list',
    query: { category: 'SHIRTS', subcategory: 'Shirts', serviceType: 'IRON' },
  })

  assert.equal(composable.updateFilter({ category: 'BEDDING', subcategory: null }), undefined)
  assert.deepEqual(replaceCalls[3], {
    name: 'price-list',
    query: { category: 'BEDDING', serviceType: 'IRON' },
  })

  assert.equal(composable.updateFilter({ category: 'ALL', serviceType: null }), undefined)
  assert.deepEqual(replaceCalls[4], {
    name: 'price-list',
    query: { category: 'ALL' },
  })
})

for (const item of tests) {
  item.run()
}

console.log(`${tests.length} price-list filter route dry tests passed`)

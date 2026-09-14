import assert from 'node:assert/strict'
import type { RouteLocationRaw, Router } from 'vue-router'
import { closeRoute } from '../../../../../src/shared/navigation/use-close-route'

const fallback: RouteLocationRaw = { name: 'customer-list' }

function createRouterCalls() {
  const calls: Array<{ action: 'back' } | { action: 'replace'; target: RouteLocationRaw }> = []
  const router = {
    back: () => calls.push({ action: 'back' }),
    replace: (target: RouteLocationRaw) => {
      calls.push({ action: 'replace', target })
      return Promise.resolve()
    },
  } as Pick<Router, 'back' | 'replace'>

  return { calls, router }
}

{
  const { calls, router } = createRouterCalls()
  closeRoute(router, fallback, true)
  assert.deepEqual(calls, [{ action: 'back' }])
}

{
  const { calls, router } = createRouterCalls()
  closeRoute(router, fallback, false)
  assert.deepEqual(calls, [{ action: 'replace', target: fallback }])
}

console.log('2 use-close-route dry tests passed')

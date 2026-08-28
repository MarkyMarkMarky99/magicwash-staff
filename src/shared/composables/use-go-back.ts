import { useRoute, useRouter } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    parent?: string
    searchable?: boolean
  }
}

type BackTarget =
  | { action: 'back' }
  | { action: 'push'; name: string }
  | { action: 'fallback'; name: string }

export function resolveBackTarget(
  hasHistoryBack: boolean,
  parent: string | undefined,
): BackTarget {
  if (hasHistoryBack) return { action: 'back' }
  if (parent) return { action: 'push', name: parent }
  return { action: 'fallback', name: 'customer-list' }
}

export function useGoBack() {
  const route = useRoute()
  const router = useRouter()

  function goBack() {
    const target = resolveBackTarget(Boolean(history.state?.back), route.meta.parent)

    if (target.action === 'back') {
      router.back()
      return
    }

    if (target.action === 'fallback') {
      const routeLabel = route.name ? `name "${String(route.name)}"` : `path "${route.path}"`
      console.warn(`Route ${routeLabel} has no meta.parent; falling back to customer-list.`)
    }

    router.push({ name: target.name })
  }

  return { goBack }
}

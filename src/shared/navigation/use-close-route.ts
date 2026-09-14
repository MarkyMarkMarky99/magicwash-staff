import { useRouter, type RouteLocationRaw, type Router } from 'vue-router'

type CloseRouter = Pick<Router, 'back' | 'replace'>

export function closeRoute(
  router: CloseRouter,
  fallback: RouteLocationRaw,
  hasHistoryBack: boolean,
) {
  if (hasHistoryBack) {
    router.back()
    return
  }

  void router.replace(fallback)
}

export function useCloseRoute(fallback: RouteLocationRaw) {
  const router = useRouter()

  function close() {
    closeRoute(router, fallback, Boolean(window.history.state?.back))
  }

  return { close }
}

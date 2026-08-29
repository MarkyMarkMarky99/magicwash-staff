import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const readString = (value: unknown) => {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === undefined || raw === null ? '' : String(raw)
}

const readPage = (value: unknown) => {
  const page = Number(readString(value))
  return Number.isInteger(page) && page > 0 ? page : 1
}

export function useOrderListFilterRoute() {
  const route = useRoute()
  const router = useRouter()
  const keyword = computed(() => readString(route.query.keyword))
  const status = computed(() => readString(route.query.status))
  const page = computed(() => readPage(route.query.page))

  function replaceQuery(next: Record<string, string | undefined>) {
    const query = { ...route.query, ...next }
    Object.keys(query).forEach((key) => { if (query[key] === undefined || query[key] === '') delete query[key] })
    void router.replace({ name: 'order-list', query })
  }

  function setKeyword(value: string) { replaceQuery({ keyword: value, page: undefined }) }
  function setStatus(value: string) { replaceQuery({ status: value, page: undefined }) }
  function setPage(value: number) { replaceQuery({ page: value > 1 ? String(value) : undefined }) }

  return { keyword, status, page, setKeyword, setStatus, setPage }
}

import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { normalizeSheetDate, todaySheetDate } from '@/shared/utils/sheet-date'

export const ORDER_LIST_DATE_FIELDS = [
  { key: 'receivedDate', label: 'Received' },
  { key: 'dueDate', label: 'Due' },
  { key: 'createdAt', label: 'Created' },
] as const

export type OrderListDateField = (typeof ORDER_LIST_DATE_FIELDS)[number]['key']

const readString = (value: unknown) => {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === undefined || raw === null ? '' : String(raw)
}

const readDateField = (value: unknown): OrderListDateField => {
  const field = readString(value)
  return ORDER_LIST_DATE_FIELDS.find((option) => option.key === field)?.key ?? 'receivedDate'
}

const readDate = (value: unknown) => normalizeSheetDate(readString(value)) ?? todaySheetDate()

const readPage = (value: unknown) => {
  const page = Number(readString(value))
  return Number.isInteger(page) && page > 0 ? page : 1
}

export function useOrderListFilterRoute() {
  const route = useRoute()
  const router = useRouter()
  const listQuery = ref(route.query)
  watch(() => route.query, (query) => {
    if (route.name === 'order-list') listQuery.value = query
  })
  const keyword = computed(() => readString(listQuery.value.keyword))
  const dateField = computed(() => readDateField(listQuery.value.dateField))
  const date = computed(() => readDate(listQuery.value.date))
  const page = computed(() => readPage(listQuery.value.page))

  function replaceQuery(next: Record<string, string | undefined>) {
    const query = { ...route.query, ...next }
    Object.keys(query).forEach((key) => { if (query[key] === undefined || query[key] === '') delete query[key] })
    void router.replace({ name: 'order-list', query })
  }

  function setKeyword(value: string) { replaceQuery({ keyword: value, page: undefined }) }
  function setDateField(value: OrderListDateField) { replaceQuery({ dateField: value === 'receivedDate' ? undefined : value, page: undefined }) }
  function setDate(value: string) { replaceQuery({ date: value === todaySheetDate() ? undefined : value, page: undefined }) }
  function setPage(value: number) { replaceQuery({ page: value > 1 ? String(value) : undefined }) }

  return { keyword, dateField, date, page, setKeyword, setDateField, setDate, setPage }
}

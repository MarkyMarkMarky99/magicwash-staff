import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { STAFF_FILTER_KEYS, type StaffFilterKey } from '../utils/staff-presentation'

export function readStaffFilter(value: unknown): StaffFilterKey {
  const raw = Array.isArray(value) ? value[0] : value
  return (STAFF_FILTER_KEYS as readonly unknown[]).includes(raw) ? (raw as StaffFilterKey) : 'all'
}

export function useStaffFilterRoute() {
  const route = useRoute()
  const router = useRouter()

  const filter = computed<StaffFilterKey>(() => readStaffFilter(route.query.status))

  function updateFilter(next: StaffFilterKey) {
    void router.replace({
      name: 'staff-list',
      query: next === 'all' ? {} : { status: next },
    })
  }

  return { filter, updateFilter }
}

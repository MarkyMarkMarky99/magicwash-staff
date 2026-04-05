import { ref, computed } from 'vue'
import { gvizQuery } from '../utils/gviz'
import { APP_CONFIG } from '../utils/constants'

// ── Module-level singleton — shared across all callers ──
const allCustomers = ref([])
const loading      = ref(false)
const error        = ref(null)
const cacheLoaded  = ref(false)

const CUSTOMER_TYPES = [
  { key: 'all',       label: 'All' },
  { key: 'general',   label: 'General' },
  { key: 'member',    label: 'Member' },
  { key: 'corporate', label: 'Corporate' },
]

function mapRow(row) {
  return {
    id:             row.CustomerID   || '',
    index:          row.CustomerIndex || '',
    name:           row.CustomerName || '',
    phone:          row.Phone        || '',
    address:        row.Address      || '',
    registeredDate: row.RegisteredDate || '',
    line:           row.Line         || '',
    email:          row.Email        || '',
    type:           row.CustomerType || '',
    source:         row.Source       || '',
    scheduledDays:  row.ScheduledDays || '',
    lastVisitDate:  row.LastVisitDate || '',
  }
}

export function useCustomerStore() {

  async function loadAll() {
    if (cacheLoaded.value) return

    const sid = APP_CONFIG.CUSTOMERS_SPREADSHEET_ID || APP_CONFIG.APPOINTMENTS_SPREADSHEET_ID
    if (!sid) {
      error.value = 'No spreadsheet ID configured for customers.'
      return
    }

    loading.value = true
    error.value   = null

    try {
      const rows = await gvizQuery(
        sid,
        'Customers',
        'SELECT B,C,D,E,F,H,J,L,M,N,O,P WHERE T is null ORDER BY C',
      )
      allCustomers.value = rows.map(mapRow)
      cacheLoaded.value  = true
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  function byType(type) {
    if (type === 'all') return allCustomers.value
    const label = CUSTOMER_TYPES.find(t => t.key === type)?.label
    return allCustomers.value.filter(c => c.type === label)
  }

  const customerCounts = computed(() =>
    Object.fromEntries(
      CUSTOMER_TYPES.map(t => [t.key, byType(t.key).length]),
    ),
  )

  function invalidate() {
    cacheLoaded.value = false
  }

  return {
    allCustomers, loading, error, cacheLoaded,
    CUSTOMER_TYPES,
    loadAll, byType, customerCounts, invalidate,
  }
}

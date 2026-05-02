You are reviewing a Vue 3 webapp refactor. The app manages laundry pickup appointments, fetching data from Google Sheets via GViz JSONP queries.

## What was refactored

Two separate composables (useAppointments.js and usePendingAppointments.js) were merged into a single module-level singleton store (useAppointmentStore.js). Key architectural changes:

1. Per-day fetch → monthly cache: Instead of querying on every date change, data is fetched once per month and cached. Day-switching filters locally.
2. Unified data store: Both DailyTasksPage (shows appointments grouped by timeslot) and PendingPage (shows all PENDING appointments) now share one data source.
3. Combined GViz query: Single query fetches monthly data OR all PENDING items:
   `SELECT * WHERE (D >= date 'YYYY-MM-01' AND D < date 'YYYY-MM+1-01') OR F = 'PENDING' ORDER BY D, E`

---

## New store file: useAppointmentStore.js

```js
import { ref, computed } from 'vue'
import { gvizQuery, toDateStr, parseGvizDate } from '../utils/gviz'
import { APP_CONFIG, ICON_MAP } from '../utils/constants'
import { pendingCount } from './usePendingCount'

function apptCardStatus(status) {
  if (status === 'COMPLETED') return 'complete'
  if (status === 'IN_TRANSIT') return 'actions'
  return 'default'
}

const TIME_SLOTS = [
  { label: '10:00–12:00', start: '10:00', icon: 'wb_twilight' },
  { label: '13:00–15:00', start: '13:00', icon: 'wb_sunny' },
  { label: '15:00–17:00', start: '15:00', icon: 'light_mode' },
  { label: '18:00–20:00', start: '18:00', icon: 'nights_stay' },
]

// Module-level singleton — shared across all callers
const allItems   = ref([])
const loading    = ref(false)
const error      = ref(null)
const activeDate = ref('')
const cacheKey   = ref(null)   // { year, month } | null

const pendingItems = computed(() =>
  allItems.value.filter(a => a.rawStatus === 'PENDING')
)

const slots = computed(() =>
  TIME_SLOTS.map(s => ({
    ...s,
    items: allItems.value.filter(a =>
      a.date === activeDate.value &&
      a.rawStatus !== 'PENDING' &&
      a.time === s.start
    ),
  }))
)

// Internal fetch — no cache check
async function _fetch(year, month) {
  const { APPOINTMENTS_SPREADSHEET_ID, CUSTOMERS_SPREADSHEET_ID } = APP_CONFIG

  if (!APPOINTMENTS_SPREADSHEET_ID) {
    error.value = 'Set APP_CONFIG.APPOINTMENTS_SPREADSHEET_ID to load live data.'
    return
  }

  loading.value = true
  error.value   = null

  try {
    const firstDay    = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const firstOfNext = toDateStr(new Date(year, month + 1, 1))

    const appts = await gvizQuery(
      APPOINTMENTS_SPREADSHEET_ID,
      'Appointments',
      `SELECT * WHERE (D >= date '${firstDay}' AND D < date '${firstOfNext}') OR F = 'PENDING' ORDER BY D, E`
    )

    const ids = [...new Set(appts.map(a => a.CustomerID).filter(Boolean))]
    const nameMap = {}
    if (ids.length) {
      const filter    = ids.map(id => `A = '${id.replace(/'/g, "\\'")}'`).join(' OR ')
      const customers = await gvizQuery(
        CUSTOMERS_SPREADSHEET_ID || APPOINTMENTS_SPREADSHEET_ID,
        'Customers',
        `SELECT A, B, C WHERE ${filter}`
      )
      customers.forEach(c => {
        nameMap[c.CustomerID] = [c.FirstName, c.LastName].filter(Boolean).join(' ') || c.CustomerID
      })
    }

    allItems.value = appts.map(a => ({
      appointmentId: a.AppointmentID,
      rawStatus:     a.Status,
      date:          parseGvizDate(a.AppointmentDate),
      time:          a.TimeSlot ? a.TimeSlot.split('-')[0] : '',
      timeSlot:      a.TimeSlot || '',
      customer:      nameMap[a.CustomerID] || a.CustomerID || '—',
      address:       a.Address || '',
      icon:          ICON_MAP[a.AppointmentType] || 'event',
      status:        apptCardStatus(a.Status),
      type:          a.AppointmentType,
    }))

    pendingCount.value = pendingItems.value.length
    cacheKey.value = { year, month }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

export function useAppointmentStore() {

  async function loadMonth(year, month, dateStr) {
    activeDate.value = dateStr
    if (cacheKey.value?.year === year && cacheKey.value?.month === month) return
    if (loading.value) return
    await _fetch(year, month)
  }

  async function refresh() {
    const key = cacheKey.value
    cacheKey.value = null
    if (key) await _fetch(key.year, key.month)
  }

  async function handleStatusUpdate(appointmentId, newStatus) {
    const url = APP_CONFIG.APPOINTMENTS_SCRIPT_URL
    if (!url) throw new Error('APPOINTMENTS_SCRIPT_URL is not configured.')
    const resp = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      body: JSON.stringify({ action: 'UPDATE', appointmentId, status: newStatus }),
    })
    const json = await resp.json()
    if (json.status !== 'success') throw new Error(json.message)

    allItems.value = allItems.value.map(item =>
      item.appointmentId === appointmentId
        ? { ...item, rawStatus: newStatus, status: apptCardStatus(newStatus) }
        : item
    )
    pendingCount.value = pendingItems.value.length
  }

  async function rescheduleAppointment(appointmentId, newDate, newTime, reason) {
    const url = APP_CONFIG.APPOINTMENTS_SCRIPT_URL
    if (!url) throw new Error('APPOINTMENTS_SCRIPT_URL is not configured.')
    const resp = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      body: JSON.stringify({
        action: 'UPDATE', appointmentId,
        appointmentDate: newDate, timeSlot: newTime,
        status: 'PENDING', notes: reason,
      }),
    })
    const json = await resp.json()
    if (json.status !== 'success') throw new Error(json.message)

    await refresh()
  }

  async function createAppointment(customerId, appointmentDate, timeSlot, notes) {
    const url = APP_CONFIG.APPOINTMENTS_SCRIPT_URL
    if (!url) throw new Error('APPOINTMENTS_SCRIPT_URL is not configured.')
    const resp = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      body: JSON.stringify({
        action: 'CREATE', customerId,
        appointmentType: 'PICKUP',
        appointmentDate, timeSlot, notes,
        status: 'PENDING',
      }),
    })
    const json = await resp.json()
    if (json.status !== 'success') throw new Error(json.message)

    cacheKey.value = null
    return json
  }

  return {
    allItems, loading, error,
    pendingItems, slots,
    loadMonth, refresh,
    handleStatusUpdate, rescheduleAppointment, createAppointment,
  }
}
```

---

## Changes in other files

### App.vue
Before: `onMounted(() => fetchPending())` — only loaded PENDING items
After: `onMounted(() => loadMonth(today.getFullYear(), today.getMonth(), toDateStr(today)))` — loads monthly + PENDING

### DailyTasksPage.vue
Before: `watch(selected, (dateStr) => fetchAppointments(dateStr), { immediate: true })`
After:
```js
// Day tap — cache hit = no fetch
watch(selected, (dateStr) => {
  loadMonth(navYear.value, navMonth.value, dateStr)
}, { immediate: true })

// Month nav — reset selected to 1st of new month then fetch
watch([navYear, navMonth], ([year, month]) => {
  selected.value = toDateStr(new Date(year, month, 1))
})
```

### PendingPage.vue
Before: `const { pendingItems, loading, error, fetchPending, handleStatusUpdate } = usePendingAppointments()`
After: `const { pendingItems, loading, error, refresh, handleStatusUpdate } = useAppointmentStore()`
Refresh button calls `refresh` instead of `fetchPending`

### RescheduleFormPage.vue / BookPickupPage.vue
Only import name changed: `useAppointments` → `useAppointmentStore`

---

## Review checklist — please assess each with severity (critical / warning / minor):

1. **Bugs / logic errors** that will fail at runtime
2. **Race conditions** — App.vue and DailyTasksPage both call loadMonth on startup. Is `if (loading.value) return` guard sufficient? What if second call arrives before loading is set to true?
3. **GViz OR query** — will PENDING items that also fall in the current month be returned as duplicates? SQL OR semantics?
4. **KeepAlive + reschedule flow** — app uses `<KeepAlive>`. After reschedule succeeds, `refresh()` is awaited inside `rescheduleAppointment` before `router.back()` is called in the page. Does this guarantee DailyTasksPage sees fresh data?
5. **Cache invalidation gaps** — after `createAppointment`, only `cacheKey = null` (lazy bust, no re-fetch). If user navigates back to DailyTasksPage without changing month, will stale data be shown?
6. **activeDate correctness** — when user navigates DailyTasksPage → PendingPage → back to DailyTasksPage, is `activeDate` still set correctly?
7. **loading guard gap** — `loadMonth` sets `activeDate` then checks cache, then checks `loading`. If two calls with different months come in rapidly, second call is silently dropped. Is this acceptable?
8. **GViz column mapping** — query filters use column letters (D, E, F) but returned row objects use header label names (AppointmentDate, TimeSlot, Status, etc.). Is there a risk these don't match?
9. **pendingCount badge** — updated in `_fetch` and `handleStatusUpdate`. Is there any scenario it gets out of sync (e.g., after error, after refresh with no data)?
10. **Any other issues** not listed above

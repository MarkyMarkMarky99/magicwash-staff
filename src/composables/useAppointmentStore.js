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

// ── Module-level singleton — shared across all callers ──
const allItems   = ref([])
const loading    = ref(false)
const error      = ref(null)
const activeDate = ref('')
const cacheKey   = ref(null)   // { year, month } | null
let   _fetchToken = 0          // incremented on every fetch; stale results are discarded

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

// ── Internal fetch — no cache check ──
async function _fetch(year, month) {
  const { APPOINTMENTS_SPREADSHEET_ID, CUSTOMERS_SPREADSHEET_ID } = APP_CONFIG

  if (!APPOINTMENTS_SPREADSHEET_ID) {
    error.value = 'Set APP_CONFIG.APPOINTMENTS_SPREADSHEET_ID to load live data.'
    return
  }

  // Token: if a newer fetch starts while we await, our result is discarded
  const myToken = ++_fetchToken
  loading.value = true
  error.value   = null

  try {
    const firstDay    = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const firstOfNext = toDateStr(new Date(year, month + 1, 1))

    // Single query: this month's appointments + all PENDING from any month
    const appts = await gvizQuery(
      APPOINTMENTS_SPREADSHEET_ID,
      'Appointments',
      `SELECT * WHERE (D >= date '${firstDay}' AND D < date '${firstOfNext}') OR F = 'PENDING' ORDER BY D, E`
    )

    if (myToken !== _fetchToken) return  // stale — a newer fetch is in flight

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

    if (myToken !== _fetchToken) return  // stale — check again after second query

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
    if (myToken === _fetchToken) error.value = err.message
  } finally {
    if (myToken === _fetchToken) loading.value = false
  }
}

export function useAppointmentStore() {

  // ── Load month with cache check ──
  async function loadMonth(year, month, dateStr) {
    activeDate.value = dateStr

    // Cache hit: update activeDate only, no fetch needed
    if (cacheKey.value?.year === year && cacheKey.value?.month === month) return

    // No loading guard — token in _fetch discards stale results automatically
    await _fetch(year, month)
  }

  // ── Force re-fetch current month (used by Refresh button) ──
  async function refresh() {
    const key = cacheKey.value
    cacheKey.value = null
    if (key) await _fetch(key.year, key.month)
  }

  // ── Status update — mutates shared allItems ──
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

  // ── Create new appointment ──
  async function createAppointment(customerId, date, time, serviceType, notes) {
    const url = APP_CONFIG.APPOINTMENTS_SCRIPT_URL
    if (!url) throw new Error('APPOINTMENTS_SCRIPT_URL is not configured.')
    const resp = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      body: JSON.stringify({
        action: 'CREATE',
        customerId,
        appointmentDate: date,
        timeSlot: time,
        appointmentType: serviceType,
        notes,
      }),
    })
    const json = await resp.json()
    if (json.status !== 'success') throw new Error(json.message)

    await refresh()
  }

  // ── Reschedule — re-fetch so KeepAlive pages see fresh data on return ──
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

  return {
    allItems, loading, error,
    pendingItems, slots,
    loadMonth, refresh,
    handleStatusUpdate, rescheduleAppointment, createAppointment,
  }
}

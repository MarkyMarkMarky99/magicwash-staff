import { ref, computed } from 'vue'
import { gvizQuery } from '../utils/gviz'
import { APP_CONFIG, ICON_MAP } from '../utils/constants'

function apptCardStatus(status) {
  if (status === 'COMPLETED') return 'complete'
  if (status === 'IN_TRANSIT') return 'actions'
  return 'default'
}

export function useAppointments() {
  const allItems = ref([])
  const loading  = ref(false)
  const error    = ref(null)

  // ── Derived sections ──
  const pending = computed(() => allItems.value.filter(a => a.rawStatus === 'PENDING'))

  const TIME_SLOTS = [
    { label: '10:00–12:00', start: '10:00', icon: 'wb_twilight' },
    { label: '13:00–15:00', start: '13:00', icon: 'wb_sunny' },
    { label: '15:00–17:00', start: '15:00', icon: 'light_mode' },
    { label: '18:00–20:00', start: '18:00', icon: 'nights_stay' },
  ]

  const slots = computed(() =>
    TIME_SLOTS.map(s => ({
      ...s,
      items: allItems.value.filter(a => a.rawStatus !== 'PENDING' && a.time === s.start),
    }))
  )

  // ── Fetch ──
  async function fetchAppointments(dateStr) {
    const { APPOINTMENTS_SPREADSHEET_ID, CUSTOMERS_SPREADSHEET_ID } = APP_CONFIG

    if (!APPOINTMENTS_SPREADSHEET_ID) {
      error.value = 'Set APP_CONFIG.APPOINTMENTS_SPREADSHEET_ID to load live data.'
      loading.value = false
      return
    }

    loading.value = true
    error.value   = null
    allItems.value = []

    try {
      const appts = await gvizQuery(
        APPOINTMENTS_SPREADSHEET_ID,
        'Appointments',
        `SELECT * WHERE D = date '${dateStr}' ORDER BY E`
      )

      // Resolve customer names
      const ids = [...new Set(appts.map(a => a.CustomerID).filter(Boolean))]
      const nameMap = {}
      if (ids.length) {
        const filter = ids.map(id => `A = '${id.replace(/'/g, "\\'")}'`).join(' OR ')
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
        time:          a.TimeSlot ? a.TimeSlot.split('-')[0] : '',
        customer:      nameMap[a.CustomerID] || a.CustomerID || '—',
        address:       a.Address || '',
        icon:          ICON_MAP[a.AppointmentType] || 'event',
        status:        apptCardStatus(a.Status),
        type:          a.AppointmentType,
      }))
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  // ── Status update (returns Promise so SwipeCard can await) ──
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

    // Update local state optimistically
    allItems.value = allItems.value.map(item =>
      item.appointmentId === appointmentId
        ? { ...item, rawStatus: newStatus, status: apptCardStatus(newStatus) }
        : item
    )
  }

  // ── Reschedule ──
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
  }

  // ── Create new appointment ──
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
    return json
  }

  return {
    allItems, loading, error,
    pending, slots,
    fetchAppointments, handleStatusUpdate, rescheduleAppointment, createAppointment,
  }
}

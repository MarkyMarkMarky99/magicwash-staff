import { ref } from 'vue'
import { gvizQuery, toDateStr } from '../utils/gviz'
import { APP_CONFIG, ICON_MAP } from '../utils/constants'
import { pendingCount } from './usePendingCount'

function apptCardStatus(status) {
  if (status === 'COMPLETED') return 'complete'
  if (status === 'IN_TRANSIT') return 'actions'
  return 'default'
}

// GViz returns date columns as "Date(2025,3,5)" strings (month is 0-indexed)
function parseGvizDate(val) {
  if (!val) return ''
  const m = String(val).match(/^Date\((\d+),(\d+),(\d+)\)$/)
  if (m) return toDateStr(new Date(+m[1], +m[2], +m[3]))
  return String(val)
}

export function usePendingAppointments() {
  const pendingItems = ref([])
  const loading      = ref(false)
  const error        = ref(null)

  async function fetchPending() {
    const { APPOINTMENTS_SPREADSHEET_ID, CUSTOMERS_SPREADSHEET_ID } = APP_CONFIG

    if (!APPOINTMENTS_SPREADSHEET_ID) {
      error.value = 'Set APP_CONFIG.APPOINTMENTS_SPREADSHEET_ID to load live data.'
      return
    }

    loading.value      = true
    error.value        = null
    pendingItems.value = []

    try {
      const appts = await gvizQuery(
        APPOINTMENTS_SPREADSHEET_ID,
        'Appointments',
        `SELECT * WHERE F = 'PENDING' ORDER BY D, E`
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

      pendingItems.value = appts.map(a => ({
        appointmentId: a.AppointmentID,
        rawStatus:     a.Status,
        date:          parseGvizDate(a.AppointmentDate),
        timeSlot:      a.TimeSlot || '',
        customer:      nameMap[a.CustomerID] || a.CustomerID || '—',
        address:       a.Address || '',
        icon:          ICON_MAP[a.AppointmentType] || 'event',
        status:        apptCardStatus(a.Status),
        type:          a.AppointmentType,
      }))

      pendingCount.value = pendingItems.value.length
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
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

    pendingItems.value = pendingItems.value.filter(i => i.appointmentId !== appointmentId)
    pendingCount.value = pendingItems.value.length
  }

  return { pendingItems, loading, error, fetchPending, handleStatusUpdate }
}

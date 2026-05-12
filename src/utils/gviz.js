// GViz JSONP helper — queries a public Google Sheet
// Mirrors window.gvizQuery from daily-tasks.html

const _gvizPending = {}
let _gvizReqId = 0

// Install the global callback that GViz JSONP calls back into
if (typeof window !== 'undefined') {
  window.google = {
    visualization: {
      Query: {
        setResponse(json) {
          const pending = _gvizPending[json.reqId]
          if (!pending) return
          clearTimeout(pending.timer)
          delete _gvizPending[json.reqId]
          document.getElementById(pending.scriptId)?.remove()

          if (json.status !== 'ok') {
            pending.reject(new Error(json.errors?.[0]?.message || 'GViz query failed'))
            return
          }
          const cols = json.table.cols.map(c => c.label || c.id)
          const rows = (json.table.rows || []).map(row =>
            Object.fromEntries(cols.map((col, i) => [col, row.c?.[i]?.v ?? '']))
          )
          pending.resolve(rows)
        }
      }
    }
  }
}

export function gvizQuery(spreadsheetId, sheetName, query) {
  return new Promise((resolve, reject) => {
    const reqId = String(_gvizReqId++)
    const scriptId = `_gviz_s${reqId}`

    const timer = setTimeout(() => {
      delete _gvizPending[reqId]
      document.getElementById(scriptId)?.remove()
      reject(new Error(`GViz timeout — sheet: ${sheetName}`))
    }, 15000)

    _gvizPending[reqId] = { resolve, reject, timer, scriptId, sheetName }

    const url =
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq` +
      `?sheet=${encodeURIComponent(sheetName)}` +
      `&headers=1` +
      `&tq=${encodeURIComponent(query)}` +
      `&tqx=reqId:${reqId}`

    const script = document.createElement('script')
    script.id = scriptId
    script.src = url
    script.onerror = () => {
      clearTimeout(timer)
      delete _gvizPending[reqId]
      reject(new Error('GViz script load failed — check Spreadsheet ID and public sharing'))
    }
    document.head.appendChild(script)
  })
}

export function toDateStr(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// GViz returns date columns as "Date(2025,3,5)" strings (month is 0-indexed)
export function parseGvizDate(val) {
  if (!val) return ''
  const m = String(val).match(/^Date\((\d+),(\d+),(\d+)\)$/)
  if (m) return toDateStr(new Date(+m[1], +m[2], +m[3]))
  return String(val)
}

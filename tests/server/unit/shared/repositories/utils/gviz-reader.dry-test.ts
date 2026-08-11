import assert from 'node:assert/strict'
import { fetchGVizRows } from '../../../../../../server/shared/repositories/utils/gviz-reader.js'

const originalFetch = globalThis.fetch

try {
  globalThis.fetch = async () =>
    new Response(
      `google.visualization.Query.setResponse(${JSON.stringify({
        status: 'ok',
        table: {
          cols: [{ id: 'B' }],
          rows: [{ c: [{ v: 'shifted-value' }] }],
        },
      })});`,
    )

  await assert.rejects(
    () =>
      fetchGVizRows({
        spreadsheetId: 'spreadsheet-id',
        sheetName: 'Appointments',
        query: 'select *',
        columns: { appointmentId: 'A' },
      }),
    /No DB field resolves for GViz column 'B'/,
  )

  console.log('gviz-reader.dry-test: OK')
} finally {
  globalThis.fetch = originalFetch
}

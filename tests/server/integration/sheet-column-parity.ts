/**
 * Live-sheet contract parity check. This hits the live Google Sheets GViz
 * endpoints and compares each readable sheet's returned column labels and
 * order with its DB row schema. Run it before deploying a contract change.
 *
 * Example: node --env-file=.env.local --import=tsx/esm tests/server/integration/sheet-column-parity.ts
 */

import { requireEnv } from '../../../server/shared/utils/env.js'
import { appointmentsDbContract } from '../../../server/sheets/Appointments/Appointments.db-contract.js'
import { customersDbContract } from '../../../server/sheets/Customers/Customers.db-contract.js'
import { invoiceItemsDbContract } from '../../../server/sheets/InvoiceItems/InvoiceItems.db-contract.js'
import { invoicesDbContract } from '../../../server/sheets/Invoices/Invoices.db-contract.js'
import { ordersViewDbContract } from '../../../server/sheets/OrdersView/OrdersView.db-contract.js'
import { invoicesViewDbContract } from '../../../server/sheets/InvoicesView/InvoicesView.db-contract.js'
import { customerPackageViewDbContract } from '../../../server/sheets/CustomerPackageView/CustomerPackageView.db-contract.js'
import { laundryPhotosDbContract } from '../../../server/sheets/LaundryPhotos/LaundryPhotos.db-contract.js'
import { orderFormDbContract } from '../../../server/sheets/OrderForm/OrderForm.db-contract.js'

const GVIZ_BASE_URL = 'https://docs.google.com/spreadsheets/d'

interface RowSchemaLike {
  shape: Record<string, unknown>
}

interface ReadableSheet {
  name: string
  sheetName: string
  spreadsheetIdEnv: string
  rowSchema: RowSchemaLike
}

interface GvizColumn {
  label?: string
}

interface GvizTable {
  cols: GvizColumn[]
}

interface GvizResponse {
  status: 'ok' | 'warning' | 'error'
  table?: GvizTable
  errors?: { message?: string; detailed_message?: string }[]
}

const readableSheets: readonly ReadableSheet[] = [
  {
    name: 'Appointments',
    sheetName: appointmentsDbContract.sheetName,
    spreadsheetIdEnv: appointmentsDbContract.spreadsheetId!,
    rowSchema: appointmentsDbContract.row,
  },
  {
    name: 'OrderForm',
    sheetName: orderFormDbContract.sheetName,
    spreadsheetIdEnv: orderFormDbContract.spreadsheetId!,
    rowSchema: orderFormDbContract.row,
  },
  {
    name: 'Invoices',
    sheetName: invoicesDbContract.sheetName,
    spreadsheetIdEnv: invoicesDbContract.spreadsheetId!,
    rowSchema: invoicesDbContract.row,
  },
  {
    name: 'InvoiceItems',
    sheetName: invoiceItemsDbContract.sheetName,
    spreadsheetIdEnv: invoiceItemsDbContract.spreadsheetId!,
    rowSchema: invoiceItemsDbContract.row,
  },
  {
    name: 'Customers',
    sheetName: customersDbContract.sheetName,
    spreadsheetIdEnv: customersDbContract.spreadsheetId!,
    rowSchema: customersDbContract.row,
  },
  {
    name: 'OrdersView',
    sheetName: ordersViewDbContract.sheetName,
    spreadsheetIdEnv: ordersViewDbContract.spreadsheetId!,
    rowSchema: ordersViewDbContract.row,
  },
  {
    name: 'InvoicesView',
    sheetName: invoicesViewDbContract.sheetName,
    spreadsheetIdEnv: invoicesViewDbContract.spreadsheetId!,
    rowSchema: invoicesViewDbContract.row,
  },
  {
    name: 'CustomerPackageView',
    sheetName: customerPackageViewDbContract.sheetName,
    spreadsheetIdEnv: customerPackageViewDbContract.spreadsheetId!,
    rowSchema: customerPackageViewDbContract.row,
  },
  {
    name: 'LaundryPhotos',
    sheetName: laundryPhotosDbContract.sheetName,
    spreadsheetIdEnv: laundryPhotosDbContract.spreadsheetId!,
    rowSchema: laundryPhotosDbContract.row,
  },
]

async function fetchTable(sheet: ReadableSheet): Promise<GvizTable> {
  const spreadsheetId = requireEnv(sheet.spreadsheetIdEnv)
  const url =
    `${GVIZ_BASE_URL}/${spreadsheetId}/gviz/tq` +
    `?tqx=out:json&headers=1&sheet=${encodeURIComponent(sheet.sheetName)}` +
    `&tq=select%20%2A%20limit%201`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`GViz read failed: ${response.status} ${response.statusText}`)
  }

  const body = await response.text()
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end === -1) {
    throw new Error('GViz response is not parseable JSON')
  }

  const parsed = JSON.parse(body.slice(start, end + 1)) as GvizResponse
  if (parsed.status === 'error') {
    const reason = parsed.errors?.[0]?.detailed_message ?? parsed.errors?.[0]?.message ?? 'unknown error'
    throw new Error(`GViz query error: ${reason}`)
  }

  return parsed.table ?? { cols: [] }
}

async function checkSheet(sheet: ReadableSheet): Promise<void> {
  const expectedColumns = Object.keys(sheet.rowSchema.shape)
  const table = await fetchTable(sheet)
  const actualColumns = table.cols.map((column) => column.label ?? '')

  if (
    actualColumns.length !== expectedColumns.length ||
    actualColumns.some((column, index) => column !== expectedColumns[index])
  ) {
    throw new Error(
      `expected ${expectedColumns.length} columns [${expectedColumns.join(', ')}], ` +
        `got ${actualColumns.length} [${actualColumns.join(', ')}]`,
    )
  }

  console.log(`${sheet.name}: ${actualColumns.length} columns — PASS`)
}

async function main(): Promise<void> {
  let failed = false

  for (const sheet of readableSheets) {
    try {
      await checkSheet(sheet)
    } catch (error) {
      failed = true
      console.error(`${sheet.name}: FAIL — ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (failed) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

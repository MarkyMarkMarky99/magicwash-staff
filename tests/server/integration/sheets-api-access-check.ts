/**
 * Read-only Sheets API access check for the workbooks in the §2.9 write migration.
 * OrderForm's workbook is already written through the Sheets API; Appointments and
 * Invoices/InvoiceItems are not yet. Reading successfully does NOT prove write
 * permission — every workbook in this project is public-read.
 *
 * This proves service-account authentication and read access to each workbook, and
 * this script never writes.
 *
 * Run with:
 * node --env-file=.env.local --import=tsx/esm tests/server/integration/sheets-api-access-check.ts
 */

import { getGoogleAccessToken } from '../../../server/shared/repositories/google-auth.js'
import { requireEnv } from '../../../server/shared/utils/env.js'
import { appointmentsDbContract } from '../../../server/sheets/Appointments/Appointments.db-contract.js'
import { invoiceItemsDbContract } from '../../../server/sheets/InvoiceItems/InvoiceItems.db-contract.js'
import { invoicesDbContract } from '../../../server/sheets/Invoices/Invoices.db-contract.js'
import { orderFormDbContract } from '../../../server/sheets/OrderForm/OrderForm.db-contract.js'

const SHEETS_API_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets'

interface AccessTarget {
  name: string
  sheetName: string
  spreadsheetIdEnv: string
}

const accessTargets: readonly AccessTarget[] = [
  {
    name: 'OrderForm',
    sheetName: orderFormDbContract.sheetName,
    spreadsheetIdEnv: orderFormDbContract.spreadsheetId!,
  },
  {
    name: 'Appointments',
    sheetName: appointmentsDbContract.sheetName,
    spreadsheetIdEnv: appointmentsDbContract.spreadsheetId!,
  },
  {
    name: 'Invoices',
    sheetName: invoicesDbContract.sheetName,
    spreadsheetIdEnv: invoicesDbContract.spreadsheetId!,
  },
  {
    name: 'InvoiceItems',
    sheetName: invoiceItemsDbContract.sheetName,
    spreadsheetIdEnv: invoiceItemsDbContract.spreadsheetId!,
  },
]

const requiredEnvironmentKeys = [
  'GOOGLE_SERVICE_ACCOUNT_KEY',
  ...new Set(accessTargets.map((target) => target.spreadsheetIdEnv)),
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isHeaderValues(value: unknown): value is unknown[][] {
  return Array.isArray(value) && value.length > 0 && Array.isArray(value[0])
}

function spreadsheetPrefix(spreadsheetId: string): string {
  return `${spreadsheetId.slice(0, 8)}…`
}

function validateEnvironment(): void {
  const missing = requiredEnvironmentKeys.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`)
  }
}

async function readHeader(target: AccessTarget, accessToken: string): Promise<number> {
  const spreadsheetId = requireEnv(target.spreadsheetIdEnv)
  const range = encodeURIComponent(`${target.sheetName}!1:1`)
  const url = `${SHEETS_API_BASE_URL}/${encodeURIComponent(spreadsheetId)}/values/${range}`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new Error(`${target.name} Sheets API request failed before receiving a response`)
  }

  if (!response.ok) {
    throw new Error(`${target.name} Sheets API read failed with HTTP ${response.status}`)
  }

  let body: unknown
  try {
    body = (await response.json()) as unknown
  } catch {
    throw new Error(`${target.name} Sheets API returned invalid JSON`)
  }

  const values = isRecord(body) ? body.values : undefined
  if (!isHeaderValues(values)) {
    throw new Error(`${target.name} Sheets API returned no readable header`)
  }

  return values[0].length
}

async function main(): Promise<void> {
  validateEnvironment()
  const accessToken = await getGoogleAccessToken()
  const results = await Promise.all(
    accessTargets.map(async (target) => {
      const spreadsheetId = requireEnv(target.spreadsheetIdEnv)
      try {
        const columnCount = await readHeader(target, accessToken)
        console.log(
          `${target.name} [${spreadsheetPrefix(spreadsheetId)}]: header read PASS (${columnCount} columns)`,
        )
        return true
      } catch (error) {
        console.error(
          `${target.name} [${spreadsheetPrefix(spreadsheetId)}]: FAIL — ${error instanceof Error ? error.message : String(error)}`,
        )
        return false
      }
    }),
  )

  if (results.some((result) => !result)) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(`Sheets API access check: FAIL — ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})

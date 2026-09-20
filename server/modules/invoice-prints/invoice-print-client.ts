import {
  invoicePrintResponseSchema,
  type InvoicePrintRequest,
  type InvoicePrintResponse,
} from '../../../contracts/invoices/invoice-api.schema.js'

const REQUEST_TIMEOUT_MS = 15_000

export type InvoicePrintClientResult =
  | { outcome: 'accepted'; data: InvoicePrintResponse }
  | { outcome: 'configuration_error'; missing: string[] }
  | { outcome: 'upstream_error' }

function readConfig():
  | { ok: true; url: string; clientId: string; clientSecret: string }
  | { ok: false; missing: string[] } {
  const printServerUrl = process.env.PRINT_SERVER_URL
  const clientId = process.env.CF_ACCESS_CLIENT_ID
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET
  const missing = [
    !printServerUrl && 'PRINT_SERVER_URL',
    !clientId && 'CF_ACCESS_CLIENT_ID',
    !clientSecret && 'CF_ACCESS_CLIENT_SECRET',
  ].filter((name): name is string => Boolean(name))

  if (missing.length > 0) return { ok: false, missing }
  return { ok: true, url: printServerUrl!, clientId: clientId!, clientSecret: clientSecret! }
}

function printEndpoint(baseUrl: string): string | null {
  try {
    return new URL('print-invoice', `${baseUrl.replace(/\/+$/, '')}/`).toString()
  } catch {
    return null
  }
}

export async function requestInvoicePrint(
  request: InvoicePrintRequest,
): Promise<InvoicePrintClientResult> {
  const config = readConfig()
  if (!config.ok) return { outcome: 'configuration_error', missing: config.missing }

  const endpoint = printEndpoint(config.url)
  if (endpoint === null) {
    return { outcome: 'configuration_error', missing: ['PRINT_SERVER_URL (invalid URL)'] }
  }

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Access-Client-Id': config.clientId,
        'CF-Access-Client-Secret': config.clientSecret,
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    return { outcome: 'upstream_error' }
  }

  if (!response.ok) return { outcome: 'upstream_error' }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { outcome: 'upstream_error' }
  }

  const parsed = invoicePrintResponseSchema.safeParse(body)
  if (!parsed.success) return { outcome: 'upstream_error' }
  return { outcome: 'accepted', data: parsed.data }
}

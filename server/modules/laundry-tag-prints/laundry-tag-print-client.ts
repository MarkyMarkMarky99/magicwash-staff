import {
  laundryTagPrintResponseSchema,
  type LaundryTagPrintRequest,
  type LaundryTagPrintResponse,
} from '../../../contracts/laundry-tag-prints/laundry-tag-print.schema.js'

const REQUEST_TIMEOUT_MS = 45_000

export type LaundryTagPrintClientResult =
  | { outcome: 'accepted'; data: LaundryTagPrintResponse }
  | { outcome: 'configuration_error'; missing: string[] }
  | { outcome: 'upstream_error' }

export async function requestLaundryTagPrint(
  request: LaundryTagPrintRequest,
): Promise<LaundryTagPrintClientResult> {
  const printServerUrl = process.env.PRINT_SERVER_URL
  const clientId = process.env.CF_ACCESS_CLIENT_ID
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET
  const missing = [
    !printServerUrl && 'PRINT_SERVER_URL',
    !clientId && 'CF_ACCESS_CLIENT_ID',
    !clientSecret && 'CF_ACCESS_CLIENT_SECRET',
  ].filter((name): name is string => Boolean(name))

  if (missing.length > 0) return { outcome: 'configuration_error', missing }

  let endpoint: string
  try {
    endpoint = new URL('print-order-tags', `${printServerUrl!.replace(/\/+$/, '')}/`).toString()
  } catch {
    return { outcome: 'configuration_error', missing: ['PRINT_SERVER_URL (invalid URL)'] }
  }

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Access-Client-Id': clientId!,
        'CF-Access-Client-Secret': clientSecret!,
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

  const parsed = laundryTagPrintResponseSchema.safeParse(body)
  if (!parsed.success || parsed.data.totalCount !== request.totalCount) {
    return { outcome: 'upstream_error' }
  }
  return { outcome: 'accepted', data: parsed.data }
}

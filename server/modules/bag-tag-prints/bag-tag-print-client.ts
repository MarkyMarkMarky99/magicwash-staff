import {
  bagTagPrintRequestSchema,
  bagTagPrintResponseSchema,
  type BagTagPrintResponse,
} from '../../../contracts/bag-tag-prints/bag-tag-print.schema.js'

const REQUEST_TIMEOUT_MS = 10_000
const RESPONSE_BODY_PREFIX_LENGTH = 500

type FailureKind =
  | 'configuration_error'
  | 'invalid_configuration'
  | 'fetch_timeout'
  | 'fetch_error'
  | 'http_error'
  | 'invalid_json'
  | 'invalid_response_schema'
  | 'invalid_request'

type ErrorDetails = {
  errorName: string
  errorCode?: string | number
}

export type BagTagPrintClientResult =
  | { outcome: 'accepted'; data: BagTagPrintResponse }
  | { outcome: 'configuration_error'; missing: string[] }
  | { outcome: 'upstream_error' }

function redactSensitiveValues(value: string, sensitiveValues: string[]): string {
  return sensitiveValues.reduce(
    (redacted, sensitiveValue) => redacted.split(sensitiveValue).join('[REDACTED]'),
    value,
  )
}

function errorDetails(error: unknown, sensitiveValues: string[]): ErrorDetails {
  if (typeof error !== 'object' || error === null) {
    return { errorName: typeof error }
  }

  const candidate = error as { name?: unknown; code?: unknown }
  const details: ErrorDetails = {
    errorName: typeof candidate.name === 'string'
      ? redactSensitiveValues(candidate.name, sensitiveValues)
      : 'UnknownError',
  }
  if (typeof candidate.code === 'string') {
    details.errorCode = redactSensitiveValues(candidate.code, sensitiveValues)
  } else if (typeof candidate.code === 'number') {
    details.errorCode = candidate.code
  }
  return details
}

function logFailure(
  startedAt: number,
  failureKind: FailureKind,
  details: Record<string, unknown> = {},
): void {
  console.error(JSON.stringify({
    event: 'bag_tag_print_failure',
    upstream: 'print_server',
    elapsedMs: Date.now() - startedAt,
    failureKind,
    ...details,
  }))
}

export async function requestBagTagPrint(
  request: unknown,
): Promise<BagTagPrintClientResult> {
  const startedAt = Date.now()
  const printServerUrl = process.env.PRINT_SERVER_URL
  const clientId = process.env.CF_ACCESS_CLIENT_ID
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET
  const sensitiveValues = [printServerUrl, clientId, clientSecret]
    .filter((value): value is string => Boolean(value))
  const missing = [
    !printServerUrl && 'PRINT_SERVER_URL',
    !clientId && 'CF_ACCESS_CLIENT_ID',
    !clientSecret && 'CF_ACCESS_CLIENT_SECRET',
    !process.env.BAG_TAG_TRACKING_URL_BASE && 'BAG_TAG_TRACKING_URL_BASE',
  ].filter((name): name is string => Boolean(name))

  if (missing.length > 0) {
    logFailure(startedAt, 'configuration_error', { missing })
    return { outcome: 'configuration_error', missing }
  }

  const validatedRequest = bagTagPrintRequestSchema.safeParse(request)
  if (!validatedRequest.success) {
    logFailure(startedAt, 'invalid_request', { fields: validatedRequest.error.issues.map((issue) => issue.path.join('.')) })
    return { outcome: 'upstream_error' }
  }

  let endpoint: string
  try {
    endpoint = new URL('print-bag-tag', `${printServerUrl!.replace(/\/+$/, '')}/`).toString()
  } catch {
    logFailure(startedAt, 'invalid_configuration', { field: 'PRINT_SERVER_URL' })
    return { outcome: 'configuration_error', missing: ['PRINT_SERVER_URL (invalid URL)'] }
  }
  sensitiveValues.push(endpoint)

  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Access-Client-Id': clientId!,
        'CF-Access-Client-Secret': clientSecret!,
      },
      body: JSON.stringify(validatedRequest.data),
      signal: timeoutSignal,
    })
  } catch (error) {
    const details = errorDetails(error, sensitiveValues)
    logFailure(
      startedAt,
      timeoutSignal.aborted || details.errorName === 'TimeoutError'
        ? 'fetch_timeout'
        : 'fetch_error',
      details,
    )
    return { outcome: 'upstream_error' }
  }

  if (!response.ok) {
    let responseBodyPrefix: string | undefined
    let bodyReadError: ErrorDetails | undefined
    const cfRay = response.headers.get('cf-ray')
    try {
      responseBodyPrefix = redactSensitiveValues(await response.text(), sensitiveValues)
        .slice(0, RESPONSE_BODY_PREFIX_LENGTH)
    } catch (error) {
      bodyReadError = errorDetails(error, sensitiveValues)
    }

    logFailure(startedAt, 'http_error', {
      status: response.status,
      cfRay: cfRay ? redactSensitiveValues(cfRay, sensitiveValues) : undefined,
      responseBodyPrefix,
      bodyReadError,
    })
    return { outcome: 'upstream_error' }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    const details = errorDetails(error, sensitiveValues)
    logFailure(startedAt, timeoutSignal.aborted || details.errorName === 'TimeoutError'
      ? 'fetch_timeout' : 'invalid_json', details)
    return { outcome: 'upstream_error' }
  }

  const parsed = bagTagPrintResponseSchema.safeParse(body)
  if (!parsed.success) {
    logFailure(startedAt, 'invalid_response_schema', {
      issues: parsed.error.issues.map((issue) => ({
        code: issue.code,
        path: redactSensitiveValues(issue.path.join('.'), sensitiveValues),
        message: redactSensitiveValues(issue.message, sensitiveValues),
      })),
    })
    return { outcome: 'upstream_error' }
  }
  return { outcome: 'accepted', data: parsed.data }
}

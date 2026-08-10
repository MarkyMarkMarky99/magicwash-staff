import { createSign } from 'node:crypto'

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const TOKEN_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const JWT_LIFETIME_SECONDS = 3600
const TOKEN_CACHE_SAFETY_WINDOW_SECONDS = 60
const MAX_TOKEN_REQUEST_ATTEMPTS = 3
const TOKEN_RETRY_DELAY_MS = 100
const TOKEN_REQUEST_TIMEOUT_MS = 5000

interface ServiceAccountCredentials {
  clientEmail: string
  privateKey: string
}

interface TokenResponse {
  accessToken: string
  expiresIn: number
}

interface CachedToken {
  accessToken: string
  expiresAt: number
}

export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GoogleAuthError'
  }
}

let cachedToken: CachedToken | undefined
let inFlightRefresh: Promise<string> | undefined

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toBase64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

function readServiceAccountCredentials(): ServiceAccountCredentials {
  const encodedKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!encodedKey) {
    throw new GoogleAuthError('GOOGLE_SERVICE_ACCOUNT_KEY is not set')
  }

  if (
    encodedKey.length % 4 === 1 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(encodedKey) ||
    (encodedKey.includes('=') && !encodedKey.endsWith('='))
  ) {
    throw new GoogleAuthError('GOOGLE_SERVICE_ACCOUNT_KEY is not valid base64')
  }

  let decodedKey: string
  try {
    decodedKey = Buffer.from(encodedKey, 'base64').toString('utf8')
  } catch {
    throw new GoogleAuthError('GOOGLE_SERVICE_ACCOUNT_KEY could not be decoded')
  }

  let parsedKey: unknown
  try {
    parsedKey = JSON.parse(decodedKey) as unknown
  } catch {
    throw new GoogleAuthError('GOOGLE_SERVICE_ACCOUNT_KEY does not contain valid JSON')
  }

  if (
    !isRecord(parsedKey) ||
    typeof parsedKey.client_email !== 'string' ||
    parsedKey.client_email.length === 0 ||
    typeof parsedKey.private_key !== 'string' ||
    parsedKey.private_key.length === 0
  ) {
    throw new GoogleAuthError(
      'GOOGLE_SERVICE_ACCOUNT_KEY JSON is missing client_email or private_key',
    )
  }

  return {
    clientEmail: parsedKey.client_email,
    privateKey: parsedKey.private_key,
  }
}

function createJwtAssertion(credentials: ServiceAccountCredentials): string {
  const issuedAt = Math.floor(Date.now() / 1000)
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  }
  const claims = {
    iss: credentials.clientEmail,
    scope: TOKEN_SCOPE,
    aud: TOKEN_ENDPOINT,
    iat: issuedAt,
    exp: issuedAt + JWT_LIFETIME_SECONDS,
  }
  const encodedHeader = toBase64Url(JSON.stringify(header))
  const encodedClaims = toBase64Url(JSON.stringify(claims))
  const signingInput = `${encodedHeader}.${encodedClaims}`

  try {
    const signer = createSign('RSA-SHA256')
    signer.update(signingInput)
    signer.end()
    const signature = signer.sign(credentials.privateKey)
    return `${signingInput}.${toBase64Url(signature)}`
  } catch {
    throw new GoogleAuthError('Could not sign the service-account JWT')
  }
}

function parseTokenResponse(value: unknown): TokenResponse {
  if (
    !isRecord(value) ||
    typeof value.access_token !== 'string' ||
    value.access_token.length === 0 ||
    typeof value.expires_in !== 'number' ||
    !Number.isFinite(value.expires_in) ||
    value.expires_in <= 0
  ) {
    throw new GoogleAuthError('Token endpoint returned an invalid token response')
  }

  return {
    accessToken: value.access_token,
    expiresIn: value.expires_in,
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function waitBeforeTokenRetry(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, TOKEN_RETRY_DELAY_MS)
  })
}

async function requestAccessToken(): Promise<TokenResponse> {
  const credentials = readServiceAccountCredentials()
  const assertion = createJwtAssertion(credentials)
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  })

  for (let attempt = 1; attempt <= MAX_TOKEN_REQUEST_ATTEMPTS; attempt += 1) {
    const timeoutSignal = AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: timeoutSignal,
      })
    } catch {
      if (attempt < MAX_TOKEN_REQUEST_ATTEMPTS) {
        await waitBeforeTokenRetry()
        continue
      }
      throw new GoogleAuthError(
        timeoutSignal.aborted
          ? 'Timeout while requesting an access token'
          : 'Network error while requesting an access token',
      )
    }

    if (!response.ok) {
      if (isRetryableStatus(response.status) && attempt < MAX_TOKEN_REQUEST_ATTEMPTS) {
        await waitBeforeTokenRetry()
        continue
      }
      throw new GoogleAuthError(
        `Token endpoint rejected the request with HTTP ${response.status}`,
      )
    }

    let responseBody: unknown
    try {
      responseBody = (await response.json()) as unknown
    } catch {
      throw new GoogleAuthError('Token endpoint returned invalid JSON')
    }
    return parseTokenResponse(responseBody)
  }

  throw new GoogleAuthError('Could not obtain an access token')
}

async function refreshAccessToken(): Promise<string> {
  const token = await requestAccessToken()
  cachedToken = {
    accessToken: token.accessToken,
    expiresAt: Math.floor(Date.now() / 1000) + token.expiresIn,
  }
  return token.accessToken
}

/**
 * Returns a cached service-account access token or performs one shared refresh.
 *
 * Refreshing when 60 seconds or less remain, and deliberately not falling back
 * to the still-valid old token when that refresh fails, is an intentional risk
 * decision. A near-expiry token could receive a 401 after a write has already
 * been sent, changing a safe `rejected` pre-write failure into an `unknown`
 * post-write outcome. If this causes a real operational problem,
 * fix token acquisition or increase the safety window; do not reintroduce the
 * fallback without a write-deadline and outcome-classification design.
 */
export function getGoogleAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.expiresAt - now > TOKEN_CACHE_SAFETY_WINDOW_SECONDS) {
    return Promise.resolve(cachedToken.accessToken)
  }

  if (!inFlightRefresh) {
    let refreshPromise: Promise<string>
    refreshPromise = refreshAccessToken().finally(() => {
      if (inFlightRefresh === refreshPromise) {
        inFlightRefresh = undefined
      }
    })
    inFlightRefresh = refreshPromise
  }

  return inFlightRefresh
}

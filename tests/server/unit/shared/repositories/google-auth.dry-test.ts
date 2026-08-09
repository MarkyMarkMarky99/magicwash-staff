import assert from 'node:assert/strict'
import { createVerify, generateKeyPairSync, type KeyObject } from 'node:crypto'

type GoogleAuthModule = typeof import('../../../../../server/shared/repositories/google-auth.js')

interface GeneratedCredentials {
  clientEmail: string
  privateKey: string
  publicKey: KeyObject
}

interface CaseContext {
  nowMs: number
  fetchCalls: number
  responseToken: string
  fetchShouldFail: boolean
  requestBodies: string[]
}

interface TestCase {
  name: string
  run: () => void | Promise<void>
}

type CaseRunner = (
  auth: GoogleAuthModule,
  context: CaseContext,
  credentials: GeneratedCredentials,
) => void | Promise<void>

const AUTH_MODULE_PATH = '../../../../../server/shared/repositories/google-auth.js'
const originalDateNow = Date.now
const originalFetch = globalThis.fetch

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getNumberClaim(claims: Record<string, unknown>, name: string): number {
  const value = claims[name]
  if (typeof value !== 'number') {
    throw new Error(`JWT claim ${name} is not a number`)
  }
  return value
}

function decodeBase64Url(part: string): Buffer {
  assert.match(part, /^[A-Za-z0-9_-]+$/)
  const base64 = part.replaceAll('-', '+').replaceAll('_', '/')
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  return Buffer.from(`${base64}${padding}`, 'base64')
}

function decodeJwtJson(part: string): Record<string, unknown> {
  const decoded = JSON.parse(decodeBase64Url(part).toString('utf8')) as unknown
  if (!isRecord(decoded)) {
    throw new Error('JWT segment is not a JSON object')
  }
  return decoded
}

function generateCredentials(): GeneratedCredentials {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  return {
    clientEmail: 'google-auth-dry-test@example.test',
    privateKey: String(privateKey.export({ format: 'pem', type: 'pkcs8' })),
    publicKey,
  }
}

async function importFresh(caseId: string): Promise<GoogleAuthModule> {
  delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  return import(`${AUTH_MODULE_PATH}?case=${caseId}`)
}

async function withCredentials(caseId: string, run: CaseRunner): Promise<void> {
  const auth = await importFresh(caseId)
  const credentials = generateCredentials()
  const context: CaseContext = {
    nowMs: 1_700_000_000_000,
    fetchCalls: 0,
    responseToken: 'token-1',
    fetchShouldFail: false,
    requestBodies: [],
  }

  process.env.GOOGLE_SERVICE_ACCOUNT_KEY = Buffer.from(
    JSON.stringify({
      client_email: credentials.clientEmail,
      private_key: credentials.privateKey,
    }),
  ).toString('base64')
  Date.now = () => context.nowMs
  globalThis.fetch = async (_input, init) => {
    context.fetchCalls += 1
    if (context.fetchShouldFail) {
      throw new Error('simulated network failure')
    }
    context.requestBodies.push(String(init?.body ?? ''))
    return new Response(
      JSON.stringify({ access_token: context.responseToken, expires_in: 3600 }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    )
  }

  try {
    await run(auth, context, credentials)
  } finally {
    Date.now = originalDateNow
    globalThis.fetch = originalFetch
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  }
}

async function runImportCase(): Promise<void> {
  const auth = await importFresh('import-without-env')
  assert.equal(typeof auth.getGoogleAccessToken, 'function')
  assert.equal(typeof auth.GoogleAuthError, 'function')
  delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY
}

const tests: TestCase[] = [
  {
    name: 'imports without GOOGLE_SERVICE_ACCOUNT_KEY',
    run: runImportCase,
  },
  {
    name: 'shares one in-flight refresh across concurrent callers',
    run: () =>
      withCredentials('concurrent', async (auth, context) => {
        const tokens = await Promise.all([
          auth.getGoogleAccessToken(),
          auth.getGoogleAccessToken(),
          auth.getGoogleAccessToken(),
        ])
        assert.deepEqual(tokens, ['token-1', 'token-1', 'token-1'])
        assert.equal(context.fetchCalls, 1)
      }),
  },
  {
    name: 'sends an RS256 service-account JWT with the expected claims',
    run: () =>
      withCredentials('jwt', async (auth, context, credentials) => {
        assert.equal(await auth.getGoogleAccessToken(), 'token-1')
        assert.equal(context.requestBodies.length, 1)

        const form = new URLSearchParams(context.requestBodies[0])
        assert.equal(form.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer')
        const assertion = form.get('assertion')
        assert.ok(assertion)

        const parts = assertion.split('.')
        assert.equal(parts.length, 3)
        for (const part of parts) {
          assert.match(part, /^[A-Za-z0-9_-]+$/)
        }

        const header = decodeJwtJson(parts[0])
        const claims = decodeJwtJson(parts[1])
        assert.equal(header.alg, 'RS256')
        assert.equal(claims.iss, credentials.clientEmail)
        assert.equal(claims.scope, 'https://www.googleapis.com/auth/spreadsheets')
        assert.equal(claims.aud, 'https://oauth2.googleapis.com/token')

        const issuedAt = getNumberClaim(claims, 'iat')
        const expiresAt = getNumberClaim(claims, 'exp')
        assert.equal(issuedAt, Math.floor(context.nowMs / 1000))
        assert.equal(expiresAt - issuedAt, 3600)

        const verifier = createVerify('RSA-SHA256')
        verifier.update(`${parts[0]}.${parts[1]}`)
        verifier.end()
        assert.equal(verifier.verify(credentials.publicKey, decodeBase64Url(parts[2])), true)
      }),
  },
  {
    name: 'uses the resolved token from cache',
    run: () =>
      withCredentials('cache', async (auth, context) => {
        assert.equal(await auth.getGoogleAccessToken(), 'token-1')
        assert.equal(await auth.getGoogleAccessToken(), 'token-1')
        assert.equal(context.fetchCalls, 1)
      }),
  },
  {
    name: 'refreshes a token with 60 seconds or less remaining',
    run: () =>
      withCredentials('expiry', async (auth, context) => {
        assert.equal(await auth.getGoogleAccessToken(), 'token-1')
        context.nowMs += 3_540_000
        context.responseToken = 'token-2'
        assert.equal(await auth.getGoogleAccessToken(), 'token-2')
        assert.equal(context.fetchCalls, 2)
      }),
  },
  {
    name: 'clears a failed refresh so the next call can retry',
    run: () =>
      withCredentials('failure-recovery', async (auth, context) => {
        context.fetchShouldFail = true
        await assert.rejects(
          auth.getGoogleAccessToken(),
          (error: unknown) =>
            error instanceof auth.GoogleAuthError &&
            error.message === 'Network error while requesting an access token',
        )
        const failedRefreshCalls = context.fetchCalls

        context.fetchShouldFail = false
        context.responseToken = 'token-3'
        assert.equal(await auth.getGoogleAccessToken(), 'token-3')
        assert.ok(context.fetchCalls > failedRefreshCalls)
      }),
  },
  {
    name: 'times out an unsettled token request and retries it',
    run: () =>
      withCredentials('timeout', async (auth, context) => {
        globalThis.fetch = async (_input, init) => {
          context.fetchCalls += 1
          const signal = init?.signal
          if (!signal) {
            throw new Error('test fetch did not receive an abort signal')
          }
          return new Promise<Response>((_resolve, reject) => {
            const rejectOnAbort = () => reject(new Error('simulated abort'))
            if (signal.aborted) {
              rejectOnAbort()
              return
            }
            signal.addEventListener('abort', rejectOnAbort, { once: true })
          })
        }

        const startedAt = originalDateNow()
        const keepAlive = setInterval(() => undefined, 1000)
        try {
          await assert.rejects(
            auth.getGoogleAccessToken(),
            (error: unknown) =>
              error instanceof auth.GoogleAuthError &&
              error.message === 'Timeout while requesting an access token',
          )
        } finally {
          clearInterval(keepAlive)
        }
        const elapsedMs = originalDateNow() - startedAt
        assert.equal(context.fetchCalls, 3)
        assert.ok(elapsedMs >= 15_000)
        assert.ok(elapsedMs < 30_000)
      }),
  },
]

let failures = 0
for (const test of tests) {
  try {
    await test.run()
    console.log(`PASS ${test.name}`)
  } catch (error: unknown) {
    failures += 1
    console.error(`FAIL ${test.name}`)
    console.error(error)
  }
}

if (failures > 0) {
  process.exitCode = 1
}

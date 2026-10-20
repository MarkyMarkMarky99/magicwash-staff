// Local stand-in for the MagicwashAI gateway, answering exactly as its HTTP contract does.
// Usage: node scripts/mock-ai-gateway/server.mjs   then set VITE_AI_GATEWAY_URL=http://127.0.0.1:3111
// Switch behaviour while it runs: open http://127.0.0.1:3111/__mode/<mode>
import http from 'node:http'
import { readFileSync } from 'node:fs'

const PORT = Number(process.env.MOCK_AI_PORT) || 3111
const DELAY_MS = Number(process.env.MOCK_AI_DELAY_MS) || 3000
const fixture = JSON.parse(readFileSync(new URL('./read-slip.cryo.json', import.meta.url), 'utf8'))

const MODES = {
  ok: 'success with the real CRYO reading',
  warnings: 'success with an extra item warning on White Bathrobe',
  busy: '503 BUSY',
  timeout: '504 TIMEOUT',
  unauthorized: '401 UNAUTHORIZED',
  'bad-json': '200 with a body that is not JSON',
  'bad-shape': '200 envelope whose result breaks the read-slip schema',
  'codex-down': 'health says codexReady: false',
  offline: 'health and tasks drop the connection',
}
let mode = process.env.MOCK_AI_MODE in MODES ? process.env.MOCK_AI_MODE : 'ok'

function cors(req, res) {
  const origin = req.headers.origin
  if (origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Acting-Staff-Id')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  }
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function failure(res, status, code, message, task) {
  send(res, status, { ok: false, requestId: 'mock', task, error: { code, message } })
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}

const server = http.createServer(async (req, res) => {
  cors(req, res)
  const url = new URL(req.url, `http://${req.headers.host}`)
  if (req.method === 'OPTIONS') return void res.writeHead(204).end()

  const switchTo = url.pathname.match(/^\/__mode\/([\w-]+)$/)?.[1]
  if (switchTo) {
    if (switchTo in MODES) mode = switchTo
    return send(res, switchTo in MODES ? 200 : 400, { mode, modes: MODES })
  }

  if (mode === 'offline' && url.pathname !== '/__mode') return void req.socket.destroy()

  if (req.method === 'GET' && url.pathname === '/health') {
    return send(res, 200, { ok: true, codexReady: mode !== 'codex-down', busy: false, queued: 0 })
  }

  const task = url.pathname.match(/^\/tasks\/([\w-]+)$/)?.[1]
  if (req.method === 'POST' && task) {
    const body = await readBody(req)
    const priceGroup = body.toString('latin1').match(/"priceGroup"\s*:\s*"([^"]*)"/)?.[1] ?? '?'
    console.log(`${new Date().toLocaleTimeString()} POST /tasks/${task} mode=${mode} priceGroup=${priceGroup} bytes=${body.length} auth=${req.headers.authorization ? 'Bearer …' : 'none'}`)
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
    if (task !== 'read-slip') return failure(res, 404, 'UNKNOWN_TASK', `unknown task: ${task}`, task)
    if (mode === 'busy') return failure(res, 503, 'BUSY', 'codex queue is full', task)
    if (mode === 'timeout') return failure(res, 504, 'TIMEOUT', 'codex timed out', task)
    if (mode === 'unauthorized') return failure(res, 401, 'UNAUTHORIZED', 'Missing or invalid credentials.', task)
    if (mode === 'bad-json') {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      return void res.end('not json')
    }
    let result = structuredClone(fixture)
    if (mode === 'bad-shape') result = { ...result, items: [{ itemCode: 'ITM-0117', count: 'eight' }] }
    if (mode === 'warnings') {
      result.warnings.push({ field: 'items.ITM-0117', source: 'ai', message: 'Tally for White Bathrobe is partly smudged.' })
    }
    return send(res, 200, { ok: true, requestId: 'mock', task, taskVersion: 2, ms: DELAY_MS, result })
  }

  return failure(res, 404, 'NOT_FOUND', 'route not found', null)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Mock AI gateway on http://127.0.0.1:${PORT} — mode "${mode}", delay ${DELAY_MS} ms`)
  for (const [name, text] of Object.entries(MODES)) console.log(`  /__mode/${name.padEnd(13)} ${text}`)
})

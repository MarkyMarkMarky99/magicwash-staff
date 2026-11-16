import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cancelAppointmentReminder,
  getAppointmentNotes,
  getAppointmentsHistory,
  listAppointmentReminders,
  sendAppointmentsMessage,
} from '../../../shared/ai-gateway/tasks/appointments-agent.js'
import { AiGatewayError } from '../../../shared/ai-gateway/ai-gateway.errors.js'

const access = { baseUrl: 'http://stub.invalid/', getToken: async () => 'token-1' }
const event = { id: 'e1', at: '2026-11-16 09:00:00', kind: 'staff', speaker: { staffId: 'S1', name: 'Mali' }, text: 'hi' }
const reminder = { id: 'r1', dueAt: '2026-11-17 09:00:00', note: 'call', createdAt: '2026-11-16 09:00:00', status: 'pending' }

test('send posts the chat task and returns the accepted turn', async () => {
  const accepted = await sendAppointmentsMessage({ ...access, message: 'book', fetchImpl: async (url, init) => {
    assert.equal(url, 'http://stub.invalid/tasks/chat')
    assert.equal(init?.method, 'POST')
    assert.deepEqual(JSON.parse(init!.body as string).input, { agentId: 'appointments', message: 'book' })
    assert.equal((init!.headers as Record<string, string>).Authorization, 'Bearer token-1')
    return Response.json({ ok: true, requestId: 'r', task: 'chat', taskVersion: 1, ms: 1, result: { accepted: true, turnId: 't1', eventId: 'e2' } }, { status: 202 })
  } })
  assert.deepEqual(accepted, { accepted: true, turnId: 't1', eventId: 'e2' })
})

test('send rejects an empty message without a request', async () => {
  await assert.rejects(sendAppointmentsMessage({ ...access, message: '  ', fetchImpl: async () => { throw new Error('no request') } }),
    (error: unknown) => error instanceof AiGatewayError && error.code === 'INVALID_INPUT')
})

test('history sends after and limit and accepts a bare or enveloped body', async () => {
  for (const wrap of [false, true]) {
    const body = { events: [event], busy: true }
    const history = await getAppointmentsHistory({ ...access, after: 'e0', limit: 50, fetchImpl: async (url, init) => {
      assert.equal(url, 'http://stub.invalid/agents/appointments/history?after=e0&limit=50')
      assert.equal(init?.method, 'GET')
      return Response.json(wrap ? { ok: true, requestId: 'r', task: 'x', taskVersion: 1, ms: 1, result: body } : body)
    } })
    assert.equal(history.busy, true)
    assert.equal(history.events[0]!.id, 'e1')
  }
})

test('history without options has no query string', async () => {
  await getAppointmentsHistory({ ...access, fetchImpl: async (url) => {
    assert.equal(url, 'http://stub.invalid/agents/appointments/history')
    return Response.json({ events: [], busy: false })
  } })
})

test('reminders list, cancel and notes use their endpoints', async () => {
  assert.deepEqual(await listAppointmentReminders({ ...access, fetchImpl: async (url) => {
    assert.equal(url, 'http://stub.invalid/agents/appointments/reminders')
    return Response.json({ reminders: [reminder] })
  } }), [reminder])
  const cancelled = await cancelAppointmentReminder({ ...access, id: 'r/1', fetchImpl: async (url, init) => {
    assert.equal(url, 'http://stub.invalid/agents/appointments/reminders/r%2F1/cancel')
    assert.equal(init?.method, 'POST')
    return Response.json({ reminder: { ...reminder, status: 'cancelled' } })
  } })
  assert.equal(cancelled.status, 'cancelled')
  const notes = await getAppointmentNotes({ ...access, fetchImpl: async () => Response.json({ files: [{ name: 'a.md', content: 'x', updatedAt: '2026-11-16 09:00:00' }] }) })
  assert.equal(notes[0]!.name, 'a.md')
})

test('error envelope and invalid bodies become AiGatewayError', async () => {
  await assert.rejects(getAppointmentNotes({ ...access, fetchImpl: async () => Response.json({ ok: false, requestId: null, task: null, error: { code: 'FORBIDDEN', message: 'Admins only' } }, { status: 403 }) }),
    (error: unknown) => error instanceof AiGatewayError && error.code === 'FORBIDDEN' && error.status === 403)
  await assert.rejects(getAppointmentNotes({ ...access, fetchImpl: async () => Response.json({ nope: true }) }),
    (error: unknown) => error instanceof AiGatewayError && error.code === 'INVALID_RESPONSE')
})

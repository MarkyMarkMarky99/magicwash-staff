import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cancelTeamAgentReminder,
  getTeamAgentImage,
  getTeamAgentNotes,
  getTeamAgentHistory,
  listTeamAgentReminders,
  sendTeamAgentMessage,
} from '../../../shared/ai-gateway/tasks/team-agent.js'
import { AiGatewayError } from '../../../shared/ai-gateway/ai-gateway.errors.js'

const access = { agentId: 'appointments' as const, baseUrl: 'http://stub.invalid/', getToken: async () => 'token-1' }
const event = { id: 'e1', at: '2026-11-16 09:00:00', kind: 'staff', speaker: { staffId: 'S1', name: 'Mali' }, text: 'hi' }
const reminder = { id: 'r1', dueAt: '2026-11-17 09:00:00', note: 'call', createdAt: '2026-11-16 09:00:00', status: 'pending' }

test('send posts the chat task and returns the accepted turn', async () => {
  const accepted = await sendTeamAgentMessage({ ...access, message: 'book', fetchImpl: async (url, init) => {
    assert.equal(url, 'http://stub.invalid/tasks/chat')
    assert.equal(init?.method, 'POST')
    assert.deepEqual(JSON.parse(init!.body as string).input, { agentId: 'appointments', message: 'book' })
    assert.equal((init!.headers as Record<string, string>).Authorization, 'Bearer token-1')
    return Response.json({ ok: true, requestId: 'r', task: 'chat', taskVersion: 1, ms: 1, result: { accepted: true, turnId: 't1', eventId: 'e2' } }, { status: 202 })
  } })
  assert.deepEqual(accepted, { accepted: true, turnId: 't1', eventId: 'e2' })
})

test('send with images posts multipart with reference attachments and allows an empty message', async () => {
  const jpeg = new Blob(['a'], { type: 'image/jpeg' })
  const png = new Blob(['b'], { type: 'image/png' })
  const accepted = await sendTeamAgentMessage({ ...access, message: '', files: [{ blob: jpeg, filename: 'image-1.jpg' }, { blob: png, filename: 'image-2.png' }], fetchImpl: async (url, init) => {
    assert.equal(url, 'http://stub.invalid/tasks/chat')
    assert.equal((init!.headers as Record<string, string>).Authorization, 'Bearer token-1')
    assert.equal((init!.headers as Record<string, string>)['Content-Type'], undefined)
    const form = init!.body as FormData
    const request = JSON.parse(form.get('request') as string)
    assert.deepEqual(request.input, { agentId: 'appointments', message: '' })
    assert.deepEqual(request.attachments, [{ file: 'file0', role: 'reference' }, { file: 'file1', role: 'reference' }])
    assert.equal((form.get('file0') as File).name, 'image-1.jpg')
    assert.equal((form.get('file1') as File).name, 'image-2.png')
    return Response.json({ ok: true, requestId: 'r', task: 'chat', taskVersion: 1, ms: 1, result: { accepted: true, turnId: 't1', eventId: 'e2' } }, { status: 202 })
  } })
  assert.equal(accepted.eventId, 'e2')
})

test('send rejects bad attachments without a request', async () => {
  const noRequest = async () => { throw new Error('no request') }
  const good = { blob: new Blob(['a'], { type: 'image/jpeg' }), filename: 'a.jpg' }
  for (const files of [
    [good, good, good, good],
    [{ blob: new Blob(['a'], { type: 'image/gif' }), filename: 'a.gif' }],
    [{ blob: new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/jpeg' }), filename: 'big.jpg' }],
  ]) {
    await assert.rejects(sendTeamAgentMessage({ ...access, message: 'x', files, fetchImpl: noRequest }),
      (error: unknown) => error instanceof AiGatewayError && error.code === 'INVALID_ATTACHMENT')
  }
})

test('image fetch sends the bearer token and returns a blob', async () => {
  const blob = await getTeamAgentImage({ ...access, id: 'img/1', fetchImpl: async (url, init) => {
    assert.equal(url, 'http://stub.invalid/agents/appointments/images/img%2F1')
    assert.equal(init?.method, 'GET')
    assert.equal((init!.headers as Record<string, string>).Authorization, 'Bearer token-1')
    return new Response(new Blob(['png-bytes'], { type: 'image/png' }), { headers: { 'Content-Type': 'image/png' } })
  } })
  assert.equal(blob.type, 'image/png')
  assert.equal(await blob.text(), 'png-bytes')
  await assert.rejects(getTeamAgentImage({ ...access, id: 'x', fetchImpl: async () => Response.json({ ok: false, requestId: null, task: null, error: { code: 'NOT_FOUND', message: 'No image' } }, { status: 404 }) }),
    (error: unknown) => error instanceof AiGatewayError && error.status === 404)
  await assert.rejects(getTeamAgentImage({ ...access, id: 'x', fetchImpl: async () => new Response('boom', { status: 500 }) }),
    (error: unknown) => error instanceof AiGatewayError && error.code === 'INVALID_RESPONSE')
})

test('history events keep images metadata', async () => {
  const history = await getTeamAgentHistory({ ...access, fetchImpl: async () => Response.json({
    events: [{ ...event, images: [{ id: 'img1', name: 'a.jpg', type: 'image/jpeg' }] }, event], busy: false,
  }) })
  assert.deepEqual(history.events[0]!.images, [{ id: 'img1', name: 'a.jpg', type: 'image/jpeg' }])
  assert.equal(history.events[1]!.images, undefined)
})

test('send rejects an empty message without a request', async () => {
  await assert.rejects(sendTeamAgentMessage({ ...access, message: '  ', fetchImpl: async () => { throw new Error('no request') } }),
    (error: unknown) => error instanceof AiGatewayError && error.code === 'INVALID_INPUT')
})

test('history sends after and limit and accepts a bare or enveloped body', async () => {
  for (const wrap of [false, true]) {
    const body = { events: [event], busy: true }
    const history = await getTeamAgentHistory({ ...access, after: 'e0', limit: 50, fetchImpl: async (url, init) => {
      assert.equal(url, 'http://stub.invalid/agents/appointments/history?after=e0&limit=50')
      assert.equal(init?.method, 'GET')
      return Response.json(wrap ? { ok: true, requestId: 'r', task: 'x', taskVersion: 1, ms: 1, result: body } : body)
    } })
    assert.equal(history.busy, true)
    assert.equal(history.events[0]!.id, 'e1')
  }
})

test('history without options has no query string', async () => {
  await getTeamAgentHistory({ ...access, fetchImpl: async (url) => {
    assert.equal(url, 'http://stub.invalid/agents/appointments/history')
    return Response.json({ events: [], busy: false })
  } })
})

test('reminders list, cancel and notes use their endpoints', async () => {
  assert.deepEqual(await listTeamAgentReminders({ ...access, fetchImpl: async (url) => {
    assert.equal(url, 'http://stub.invalid/agents/appointments/reminders')
    return Response.json({ reminders: [reminder] })
  } }), [reminder])
  const cancelled = await cancelTeamAgentReminder({ ...access, id: 'r/1', fetchImpl: async (url, init) => {
    assert.equal(url, 'http://stub.invalid/agents/appointments/reminders/r%2F1/cancel')
    assert.equal(init?.method, 'POST')
    return Response.json({ reminder: { ...reminder, status: 'cancelled' } })
  } })
  assert.equal(cancelled.status, 'cancelled')
  const notes = await getTeamAgentNotes({ ...access, fetchImpl: async () => Response.json({ files: [{ name: 'a.md', content: 'x', updatedAt: '2026-11-16 09:00:00' }] }) })
  assert.equal(notes[0]!.name, 'a.md')
})

test('error envelope and invalid bodies become AiGatewayError', async () => {
  await assert.rejects(getTeamAgentNotes({ ...access, fetchImpl: async () => Response.json({ ok: false, requestId: null, task: null, error: { code: 'FORBIDDEN', message: 'Admins only' } }, { status: 403 }) }),
    (error: unknown) => error instanceof AiGatewayError && error.code === 'FORBIDDEN' && error.status === 403)
  await assert.rejects(getTeamAgentNotes({ ...access, fetchImpl: async () => Response.json({ nope: true }) }),
    (error: unknown) => error instanceof AiGatewayError && error.code === 'INVALID_RESPONSE')
})

test('washing and ironing use their own paths and agent id', async () => {
  for (const agentId of ['washing', 'ironing'] as const) {
    const washing = { ...access, agentId }
    await sendTeamAgentMessage({ ...washing, message: 'hi', fetchImpl: async (_url, init) => {
      assert.deepEqual(JSON.parse(init!.body as string).input, { agentId, message: 'hi' })
      return Response.json({ ok: true, requestId: 'r', task: 'chat', taskVersion: 1, ms: 1, result: { accepted: true, turnId: 't1', eventId: 'e2' } }, { status: 202 })
    } })
    await getTeamAgentHistory({ ...washing, after: 'e0', fetchImpl: async (url) => {
      assert.equal(url, `http://stub.invalid/agents/${agentId}/history?after=e0`)
      return Response.json({ events: [], busy: false })
    } })
    await getTeamAgentImage({ ...washing, id: 'i1', fetchImpl: async (url) => {
      assert.equal(url, `http://stub.invalid/agents/${agentId}/images/i1`)
      return new Response(new Blob(['x'], { type: 'image/png' }), { headers: { 'Content-Type': 'image/png' } })
    } })
    await listTeamAgentReminders({ ...washing, fetchImpl: async (url) => {
      assert.equal(url, `http://stub.invalid/agents/${agentId}/reminders`)
      return Response.json({ reminders: [] })
    } })
    await cancelTeamAgentReminder({ ...washing, id: 'r1', fetchImpl: async (url) => {
      assert.equal(url, `http://stub.invalid/agents/${agentId}/reminders/r1/cancel`)
      return Response.json({ reminder })
    } })
    await getTeamAgentNotes({ ...washing, fetchImpl: async (url) => {
      assert.equal(url, `http://stub.invalid/agents/${agentId}/notes`)
      return Response.json({ files: [] })
    } })
  }
})

test('history accepts close and reopen action events', async () => {
  const history = await getTeamAgentHistory({ ...access, agentId: 'washing', fetchImpl: async () => Response.json({
    events: ['close', 'reopen'].map((type, index) => ({ ...event, id: `a${index}`, kind: 'action', text: type, action: { type, outcome: 'ok' } })), busy: false,
  }) })
  assert.deepEqual(history.events.map(item => item.action?.type), ['close', 'reopen'])
})

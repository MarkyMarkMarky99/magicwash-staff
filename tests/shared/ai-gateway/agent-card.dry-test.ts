import assert from 'node:assert/strict'
import test from 'node:test'
import { agentCardSchema } from '../../../contracts/ai-gateway/agent-card.schema.js'

const text = { type: 'text', text: 'Order ready' }
const bubble = { type: 'bubble', title: 'Ready', body: [text] }
const image = {
  type: 'image',
  source: { url: 'https://firebasestorage.googleapis.com/v0/b/orders/o/packed.jpg' },
  action: { type: 'photo' },
}
const routeAction = { type: 'route', route: 'order-detail', params: { orderId: 'ORD-1042' } }
const button = { type: 'button', label: 'Open order', action: routeAction }
const table = {
  type: 'table',
  columns: [{ label: 'Item' }, { label: 'Quantity', align: 'end' }],
  rows: [['Shirt', '2']],
}
const box = { type: 'box', layout: 'row', contents: [text] }

test('parses a bubble with every part kind and both button action types', () => {
  const card = {
    ...bubble,
    tone: 'brand',
    hero: { ...image, alt: 'Packed order', aspect: 'wide' },
    body: [
      { ...text, size: 'lg', weight: 'bold', tone: 'primary', maxLines: 2 },
      { type: 'badge', text: 'Washed', tone: 'success' },
      { type: 'separator' },
      image,
      button,
      table,
      { ...box, gap: 'sm', contents: [text, table] },
    ],
    footer: [
      { type: 'button', label: 'Confirm', style: 'primary', action: { type: 'message', text: 'Confirm order' } },
      { type: 'button', label: 'Open schedule', style: 'link', action: { type: 'route', route: 'appointment-schedule', params: {} } },
    ],
  }

  assert.deepEqual(agentCardSchema.parse(card), card)
})

test('accepts null and missing optional fields', () => {
  const card = {
    ...bubble,
    tone: null,
    hero: null,
    footer: null,
    body: [
      { ...text, size: null, weight: null, tone: null, maxLines: null },
      { type: 'badge', text: 'Washed', tone: null },
      { ...image, aspect: null, alt: null, action: null },
      { ...button, style: null },
      { ...table, columns: [{ label: 'Item', align: null }], rows: [] },
      { ...box, gap: null },
      text,
    ],
  }

  assert.deepEqual(agentCardSchema.parse(card), card)
  assert.deepEqual(agentCardSchema.parse(bubble), bubble)
})

test('parses a carousel of bubbles', () => {
  const card = { type: 'carousel', contents: [bubble, { ...bubble, title: 'Next order' }] }

  assert.deepEqual(agentCardSchema.parse(card), card)
})

test('strips unknown keys from card objects and parts', () => {
  assert.deepEqual(agentCardSchema.parse({ ...bubble, extra: true, body: [{ ...text, extra: true }] }), bubble)
})

const mismatchedTable = { ...table, rows: [['Shirt']] }
const invalidBodies = [
  ['a non-Firebase host', [{ ...image, source: { url: 'https://firebasestorage.googleapis.com.example.com/photo' } }]],
  ['an HTTP URL', [{ ...image, source: { url: 'http://firebasestorage.googleapis.com/photo' } }]],
  ['a URL with credentials', [{ ...image, source: { url: 'https://staff:secret@firebasestorage.googleapis.com/photo' } }]],
  ['a URL with an unexpected port', [{ ...image, source: { url: 'https://firebasestorage.googleapis.com:444/photo' } }]],
  ['a box inside a box', [{ ...box, contents: [box] }]],
  ['a photo action on a button', [{ ...button, action: { type: 'photo' } }]],
  ['a message action on an image', [{ ...image, action: { type: 'message', text: 'Show photo' } }]],
  ['an unknown route', [{ ...button, action: { ...routeAction, route: 'unknown' } }]],
  ['missing route params', [{ ...button, action: { ...routeAction, params: {} } }]],
  ['extra route params', [{ ...button, action: { ...routeAction, params: { orderId: 'ORD-1042', extra: 'x' } } }]],
  ['an extra __proto__ route param', [{ ...button, action: { ...routeAction, params: { orderId: 'ORD-1042', ['__proto__']: 'x' } } }]],
  ['an empty route param', [{ ...button, action: { ...routeAction, params: { orderId: '' } } }]],
  ['a mismatched table row', [mismatchedTable]],
  ['a mismatched table row inside a box', [{ ...box, contents: [mismatchedTable] }]],
  ['an unknown part type', [{ type: 'html' }]],
] as const

for (const [reason, body] of invalidBodies) {
  test(`rejects ${reason}`, () => {
    assert.equal(agentCardSchema.safeParse({ ...bubble, body }).success, false)
  })
}

test('rejects a carousel with only one bubble', () => {
  assert.equal(agentCardSchema.safeParse({ type: 'carousel', contents: [bubble] }).success, false)
})

test('rejects a footer with four buttons', () => {
  assert.equal(agentCardSchema.safeParse({ ...bubble, footer: [button, button, button, button] }).success, false)
})

test('enforces the serialized card limit across a carousel', () => {
  const longBubble = { ...bubble, body: Array(9).fill({ ...text, text: 'x'.repeat(2000) }) }
  assert.equal(agentCardSchema.safeParse(longBubble).success, true)

  const card = { type: 'carousel', contents: [longBubble, longBubble] }
  assert.ok(JSON.stringify(card).length > 32768)
  assert.equal(agentCardSchema.safeParse(card).success, false)
})

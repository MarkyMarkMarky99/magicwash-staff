import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope } from 'vue'
import { slipPrefill } from '@/features/orders/utils/slip-prefill'
import { useCorporateOrderDraft } from '@/features/orders/composables/useCorporateOrderDraft'
import { addedLine, corporateOrderCreatePayload, mergeListLines } from '@/features/orders/utils/corporate-order-draft'
import { slipResult } from '../../../../../shared/ai-gateway/read-slip.fixture'

const items = slipResult.items.map((item) => ({ itemCode: item.itemCode, nameEn: item.nameEn, nameTh: item.nameTh, imageUrl: null }))

test('maps by itemCode, resets missing and null counts, replaces old added lines with unknown items and unlisted', () => {
  const current = mergeListLines([], [...items, { itemCode: 'missing', nameEn: null, nameTh: 'Missing', imageUrl: null }])
    .map((line) => ({ ...line, counted: 99 }))
  current.push(addedLine('old', 'Old extra', 9))
  const result = structuredClone(slipResult)
  result.items.reverse()
  result.items.push({ itemCode: 'unknown', nameEn: 'Extra robe', nameTh: 'Thai', count: 4 })
  result.items.push({ itemCode: 'thai', nameEn: null, nameTh: 'Thai fallback', count: null })
  result.warnings.push({ field: 'items.ITM-0117', source: 'ai', message: 'Check robe' },
    { field: 'items.unknown', source: 'ai', message: 'Check extra' })
  const before = structuredClone(current)
  const prefill = slipPrefill(current, result)
  assert.deepEqual(prefill.lines.map((line) => line.counted), [8, null, null, 4, null, 2])
  assert.deepEqual(prefill.lines.filter((line) => line.added).map((line) => line.nameTh), ['Extra robe', 'Thai fallback', slipResult.unlisted[0]!.name])
  assert.equal(prefill.lines.some((line) => line.key === 'old'), false)
  assert.equal(new Set(prefill.lines.map((line) => line.key)).size, prefill.lines.length)
  assert.deepEqual(prefill.flaggedKeys, ['ITM-0117', prefill.lines[3]!.key])
  assert.deepEqual(prefill.warnings, result.warnings)
  assert.deepEqual(current, before)
})

test('receivedDate accepts calendar dates; invalid or null dates leave it null', () => {
  for (const [date, expected] of [['2026-09-13', '2026-09-13'], ['2026-02-30', null], ['garbage', null], [null, null]] as const) {
    const result = { ...slipResult, header: { ...slipResult.header, collectionDate: { text: null, date } } }
    assert.equal(slipPrefill([], result).receivedDate, expected)
  }
})

test('AI and staff draft functions produce identical Save payloads', () => {
  const scope = effectScope()
  scope.run(() => {
    const ai = useCorporateOrderDraft(() => 'customer-1')
    const hand = useCorporateOrderDraft(() => 'customer-1')
    ai.setListItems(items)
    hand.setListItems(items)
    ai.addLine('Old line', 100)
    const prefill = slipPrefill(ai.draft.lines, slipResult)
    ai.setStartingValues(prefill.lines, prefill.receivedDate)
    hand.setCounted('ITM-0117', 8)
    hand.setCounted('ITM-0100', null)
    hand.addLine(slipResult.unlisted[0]!.name, 2)
    hand.draft.receivedDate = '2026-09-13'
    const rows = [{ id: 'item-1', itemCode: 'ITM-0117', active: true }]
    assert.deepEqual(corporateOrderCreatePayload(ai.draft, rows, 'staff-1'), corporateOrderCreatePayload(hand.draft, rows, 'staff-1'))
  })
  scope.stop()
})

test('single slip replacement, removal and scope disposal release old preview URLs', () => {
  const scope = effectScope()
  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL
  const revoked: string[] = []
  let sequence = 0
  URL.createObjectURL = () => `blob:test-${++sequence}`
  URL.revokeObjectURL = (url) => { revoked.push(url) }
  try {
    const form = scope.run(() => useCorporateOrderDraft(() => 'customer-1'))!
    const first = new File(['first'], 'first.jpg')
    const second = new File(['second'], 'second.jpg')
    form.setSlipPhoto(first)
    assert.equal(form.draft.slipPhotos.length, 1)
    form.setSlipPhoto(second)
    assert.equal(form.draft.slipPhotos.length, 1)
    assert.equal(form.draft.slipPhotos[0]!.file, second)
    assert.deepEqual(revoked, ['blob:test-1'])
    form.removeSlipPhoto()
    assert.equal(form.draft.slipPhotos.length, 0)
    assert.deepEqual(revoked, ['blob:test-1', 'blob:test-2'])
    form.setSlipPhoto(first)
    scope.stop()
    assert.deepEqual(revoked, ['blob:test-1', 'blob:test-2', 'blob:test-3'])
  } finally {
    scope.stop()
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
  }
})

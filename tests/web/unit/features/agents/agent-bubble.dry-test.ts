import assert from 'node:assert/strict'
import {
  bubbleLeft,
  clampBubbleY,
  isDismissed,
  parseBubblePosition,
  parseDismissed,
  plainBubbleText,
  snapSide,
} from '../../../../../src/features/agents/utils/agent-bubble.ts'

assert.equal(plainBubbleText('**สวัสดี** ค่ะ\n\n- งาน `A1` เสร็จ\n- [ลิงก์](https://x.test)'), 'สวัสดี ค่ะ งาน A1 เสร็จ ลิงก์')
assert.equal(plainBubbleText('## หัวข้อ\n1. หนึ่ง\n> อ้างอิง'), 'หัวข้อ หนึ่ง อ้างอิง')
assert.equal(plainBubbleText('ออเดอร์ #12 snake_case'), 'ออเดอร์ #12 snake_case')

const bounds = { width: 400, height: 800, top: 0, bottom: 88 }
assert.equal(clampBubbleY(-50, 60, bounds), 12)
assert.equal(clampBubbleY(9999, 60, bounds), 800 - 60 - 12 - 88)
assert.equal(clampBubbleY(300, 60, bounds), 300)
assert.equal(bubbleLeft('left', 300, 400), 12)
assert.equal(bubbleLeft('right', 300, 400), 88)
assert.equal(snapSide(20, 300, 400), 'left')
assert.equal(snapSide(90, 300, 400), 'right')

assert.deepEqual(parseBubblePosition('{"side":"left","y":120}'), { side: 'left', y: 120 })
assert.equal(parseBubblePosition('{"side":"top","y":1}'), null)
assert.equal(parseBubblePosition('nope'), null)
assert.equal(parseBubblePosition(null), null)

const dismissed = parseDismissed('{"id":"e5","at":"2026-11-18 10:00:00"}')
assert.ok(dismissed)
assert.equal(isDismissed({ eventId: 'e5', at: '2026-11-18 10:00:00' }, dismissed), true)
assert.equal(isDismissed({ eventId: 'e3', at: '2026-11-18 09:00:00' }, dismissed), true, 'an older message stays hidden')
assert.equal(isDismissed({ eventId: 'e6', at: '2026-11-18 10:00:05' }, dismissed), false, 'a newer message shows again')
assert.equal(isDismissed({ eventId: 'e6', at: '2026-11-18 10:00:05' }, null), false)
assert.equal(parseDismissed('{"id":1}'), null)

console.log('agent-bubble.dry-test: OK')

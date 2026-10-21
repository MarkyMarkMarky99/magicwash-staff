import type { AgentChatReply, AgentChatRequest, AgentId } from '../agent-chat.types'

const FAKE_REPLY_DELAY_MS = 2000

const cannedReplies: Record<AgentId, Omit<AgentChatReply, 'sessionId'>> = {
  'register-customer': {
    reply: 'อ่านข้อความแล้วค่ะ ร่างข้อมูลลูกค้าใหม่ไว้ให้ตามนี้ ตรวจดูก่อนเปิดฟอร์มนะคะ',
    proposal: {
      customerName: 'คุณสมชาย ใจดี',
      phone: '0812345678',
      address: '99/12 ซ.สุขุมวิท 31 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110',
      lineId: 'somchai.j',
      facebook: null,
      whatsapp: null,
      email: null,
      customerType: 'Regular',
    },
    warnings: [{ field: 'address', source: 'ai', message: 'ที่อยู่ไม่ระบุชั้น/ห้อง — ควรถามลูกค้าเพิ่ม' }],
  },
  'price-check': {
    reply: 'เจอรายการที่ใกล้เคียงในใบราคาค่ะ',
    proposal: {
      rows: [
        { itemCode: 'CMF-60', name: 'ผ้านวม 6 ฟุต', serviceType: 'ซัก', priceGroup: 'Standard', unit: 'ผืน', price: 250 },
        { itemCode: 'CMF-50', name: 'ผ้านวม 5 ฟุต', serviceType: 'ซัก', priceGroup: 'Standard', unit: 'ผืน', price: 200 },
        { itemCode: 'CMF-35', name: 'ผ้านวม 3.5 ฟุต', serviceType: 'ซัก', priceGroup: 'Standard', unit: 'ผืน', price: 150 },
      ],
    },
    warnings: [],
  },
  'order-tracking': {
    reply: 'เจอออเดอร์แล้วครับ ตอนนี้อยู่ขั้นตอนอบ',
    proposal: {
      orderId: 'ORD-1042',
      customerName: 'คุณสมชาย ใจดี',
      statusLabel: 'กำลังอบ',
      steps: [
        { label: 'รับผ้าแล้ว', detail: '20 ต.ค. 09:10 · ถุง 2 ใบ', state: 'done' },
        { label: 'ซักเสร็จ', detail: '20 ต.ค. 13:40 · เครื่อง W-03', state: 'done' },
        { label: 'กำลังอบ', detail: 'เริ่ม 21 ต.ค. 08:15 · เครื่อง D-02', state: 'current' },
        { label: 'พร้อมรับ', detail: 'คาดว่า 21 ต.ค. บ่าย', state: 'upcoming' },
      ],
    },
    warnings: [],
  },
}

export async function sendAgentMessage(request: AgentChatRequest): Promise<AgentChatReply> {
  await new Promise(resolve => setTimeout(resolve, FAKE_REPLY_DELAY_MS))
  if (request.message.trim() === 'error') throw new Error('AI unavailable')
  return { sessionId: request.sessionId ?? `fake-${request.agentId}`, ...cannedReplies[request.agentId] }
}

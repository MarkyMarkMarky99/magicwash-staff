import type { AgentId } from './agent-chat.types'

export interface AgentInfo {
  id: AgentId
  name: string
  role: string
  description: string
  greeting: string
  suggestions: { icon: string; text: string }[]
}

export const AGENTS: AgentInfo[] = [
  {
    id: 'register-customer',
    name: 'น้องลงทะเบียน',
    role: 'New customer',
    description: 'ส่งข้อความหรือแคปแชต LINE แล้วช่วยกรอกข้อมูลลูกค้าใหม่',
    greeting: 'สวัสดีค่ะ หนูช่วยกรอกข้อมูลลูกค้าใหม่ให้ได้ แปะข้อความหรือแนบแคปแชต LINE มาได้เลยค่ะ',
    suggestions: [
      { icon: 'content_paste', text: 'แปะข้อความจาก LINE ของลูกค้า' },
      { icon: 'image', text: 'แนบรูปแคปแชตที่มีชื่อและที่อยู่' },
      { icon: 'phone_iphone', text: 'ลูกค้าใหม่ เบอร์ 081-234-5678' },
    ],
  },
  {
    id: 'price-check',
    name: 'น้องราคา',
    role: 'Price check',
    description: 'ถามราคาบริการและรายการผ้าจากใบราคา',
    greeting: 'สวัสดีค่ะ ถามราคาได้เลย หนูค้นจากใบราคาของร้านให้ค่ะ',
    suggestions: [
      { icon: 'bed', text: 'ซักผ้านวม 6 ฟุต ราคาเท่าไหร่' },
      { icon: 'checkroom', text: 'ราคารีดเสื้อเชิ้ต' },
      { icon: 'dry_cleaning', text: 'ซักแห้งสูททั้งชุดกี่บาท' },
    ],
  },
  {
    id: 'order-tracking',
    name: 'น้องติดตาม',
    role: 'Order tracking',
    description: 'ถามสถานะออเดอร์จากเลขออเดอร์หรือเบอร์ลูกค้า',
    greeting: 'สวัสดีครับ บอกเลขออเดอร์หรือเบอร์โทรลูกค้า เดี๋ยวผมเช็กสถานะให้ครับ',
    suggestions: [
      { icon: 'tag', text: 'สถานะออเดอร์ ORD-1042' },
      { icon: 'call', text: 'ออเดอร์ของเบอร์ 081-234-5678' },
      { icon: 'schedule', text: 'วันนี้มีออเดอร์ที่ใกล้ครบกำหนดไหม' },
    ],
  },
]

export function agentById(id: AgentId): AgentInfo {
  return AGENTS.find(agent => agent.id === id) as AgentInfo
}

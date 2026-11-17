import type { StaffSession } from '@/data/auth/auth.service'
import type { AgentId } from './agent-chat.types'

type StaffRole = StaffSession['role']

export interface AgentInfo {
  id: AgentId
  name: string
  role: string
  description: string
  greeting: string
  suggestions: { icon: string; text: string }[]
  /** Roles that may see and open the agent; absent means every signed-in role. */
  roles?: readonly StaffRole[]
}

export const AGENTS: AgentInfo[] = [
  {
    id: 'register-customer',
    name: 'น้องลงทะเบียน',
    role: 'New customer',
    description: 'Send a message or LINE chat screenshot to fill in a new customer',
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
    description: 'Ask for service and item prices from the price list',
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
    description: 'Ask for an order status by order number or customer phone',
    greeting: 'สวัสดีครับ บอกเลขออเดอร์หรือเบอร์โทรลูกค้า เดี๋ยวผมเช็กสถานะให้ครับ',
    suggestions: [
      { icon: 'tag', text: 'สถานะออเดอร์ ORD-1042' },
      { icon: 'call', text: 'ออเดอร์ของเบอร์ 081-234-5678' },
      { icon: 'schedule', text: 'วันนี้มีออเดอร์ที่ใกล้ครบกำหนดไหม' },
    ],
  },
  {
    id: 'appointments',
    name: 'น้องนัดหมาย',
    role: 'Appointments',
    description: 'Shared team chat that books, reschedules and cancels pickup appointments',
    greeting: 'สวัสดีค่ะ หนูดูแลนัดหมายรับผ้าให้ทั้งทีม สั่งให้สร้าง เลื่อน หรือยกเลิกนัดได้เลยค่ะ',
    suggestions: [],
    roles: ['admin'],
  },
  {
    id: 'washing',
    name: 'น้องซักผ้า',
    role: 'Washing',
    description: 'Shared team chat for the Washing department: open and slow work, closing and reopening tickets',
    greeting: 'สวัสดีค่ะ หนูดูแลงานแผนกซักผ้าให้ทั้งทีม ถามงานค้าง งานช้า หรือสั่งปิดงานได้เลยค่ะ',
    suggestions: [],
    roles: ['admin', 'staff'],
  },
  {
    id: 'ironing',
    name: 'น้องรีดผ้า',
    role: 'Ironing',
    description: 'Shared team chat for the Ironing department: open and slow work, closing and reopening tickets',
    greeting: 'สวัสดีค่ะ หนูดูแลงานแผนกรีดผ้าให้ทั้งทีม ถามงานค้าง งานช้า หรือสั่งปิดงานได้เลยค่ะ',
    suggestions: [],
    roles: ['admin', 'staff'],
  },
]

export function agentVisibleToRole(agent: AgentInfo, role: StaffRole | null): boolean {
  return !agent.roles || (role !== null && agent.roles.includes(role))
}

export function agentById(id: AgentId): AgentInfo {
  return AGENTS.find(agent => agent.id === id) as AgentInfo
}

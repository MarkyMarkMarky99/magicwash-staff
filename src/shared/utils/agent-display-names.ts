/** Display names of the AI agents; the agent catalog and the assignment cards both read them. */
export const AGENT_DISPLAY_NAMES = {
  'register-customer': 'น้องลงทะเบียน',
  'price-check': 'น้องราคา',
  'order-tracking': 'น้องติดตาม',
  appointments: 'น้องนัดหมาย',
  washing: 'น้องซักผ้า',
  ironing: 'น้องรีดผ้า',
  personal: 'ผู้ช่วยส่วนตัว',
  secretary: 'เลขาส่วนตัว',
} as const

export type AgentDisplayNameId = keyof typeof AGENT_DISPLAY_NAMES

export function agentDisplayName(agentId: string): string | undefined {
  return Object.hasOwn(AGENT_DISPLAY_NAMES, agentId) ? AGENT_DISPLAY_NAMES[agentId as AgentDisplayNameId] : undefined
}

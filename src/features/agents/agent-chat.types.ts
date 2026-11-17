import { TEAM_AGENT_IDS } from '@contracts/ai-gateway/chat-api.schema'
import type { TeamAgentId } from '@shared/ai-gateway/tasks/team-agent'

export { TEAM_AGENT_IDS }
export type { TeamAgentId }

export const CHAT_AGENT_IDS = ['register-customer', 'price-check', 'order-tracking'] as const

export type ChatAgentId = typeof CHAT_AGENT_IDS[number]

export const AGENT_IDS = [...CHAT_AGENT_IDS, ...TEAM_AGENT_IDS] as const

export type AgentId = typeof AGENT_IDS[number]

export interface AgentWarning {
  field: string
  source: 'ai' | 'rule'
  message: string
}

export interface CustomerProposal {
  customerName: string | null
  phone: string | null
  address: string | null
  lineId: string | null
  facebook: string | null
  whatsapp: string | null
  email: string | null
  customerType: 'Member' | 'Regular' | 'Corporate' | null
}

export interface PriceProposalRow {
  itemCode: string
  name: string
  serviceType: string
  priceGroup: string
  unit: string | null
  price: number
}

export interface PriceProposal {
  rows: PriceProposalRow[]
}

export interface TrackingStep {
  label: string
  detail: string
  state: 'done' | 'current' | 'upcoming'
}

export interface TrackingProposal {
  orderId: string
  customerName: string
  statusLabel: string
  steps: TrackingStep[]
}

export type AgentProposal = CustomerProposal | PriceProposal | TrackingProposal

export interface AgentChatReply {
  sessionId: string
  reply: string
  proposal: AgentProposal | null
  warnings: AgentWarning[]
}

export interface AgentChatRequest {
  agentId: ChatAgentId
  sessionId: string | null
  message: string
  images: File[]
}

export interface DraftImage {
  id: string
  file: File
  url: string
}

export type ChatMessage =
  | { id: string; role: 'staff'; text: string; imageUrls: string[] }
  | { id: string; role: 'agent'; text: string; proposal: AgentProposal | null; warnings: AgentWarning[] }
  | { id: string; role: 'error'; text?: string }

export interface AgentChat {
  sessionId: string | null
  messages: ChatMessage[]
  thinking: boolean
  draftText: string
  draftImages: DraftImage[]
}

export const MAX_DRAFT_IMAGES = 3

export function isCustomerProposal(proposal: AgentProposal): proposal is CustomerProposal {
  return 'customerName' in proposal
}

export function isPriceProposal(proposal: AgentProposal): proposal is PriceProposal {
  return 'rows' in proposal
}

export function isTrackingProposal(proposal: AgentProposal): proposal is TrackingProposal {
  return 'steps' in proposal
}

export function isTeamAgentId(value: unknown): value is TeamAgentId {
  return typeof value === 'string' && (TEAM_AGENT_IDS as readonly string[]).includes(value)
}

export function isChatAgentId(value: unknown): value is ChatAgentId {
  return typeof value === 'string' && (CHAT_AGENT_IDS as readonly string[]).includes(value)
}

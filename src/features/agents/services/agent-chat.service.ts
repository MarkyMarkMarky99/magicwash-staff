import { AiGatewayError } from '@shared/ai-gateway/ai-gateway.errors'
import { sendChat } from '@shared/ai-gateway/tasks/chat'
import { aiGatewayBaseUrl, aiGatewayToken } from '@/shared/ai-gateway/ai-gateway.config'
import { downscaleScreenshot } from '../utils/downscale-screenshot'
import type { AgentChatReply, AgentChatRequest } from '../agent-chat.types'

const FAKE_REPLY_DELAY_MS = 2000

const cannedReplies: Record<'order-tracking', Omit<AgentChatReply, 'sessionId'>> = {
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

export async function sendAgentMessage(request: AgentChatRequest, signal?: AbortSignal): Promise<AgentChatReply> {
  if (request.agentId !== 'order-tracking') {
    const baseUrl = aiGatewayBaseUrl()
    if (!baseUrl) throw new AiGatewayError('NOT_CONFIGURED', 'AI gateway is not configured')
    const files = await Promise.all(request.images.map(async (image, index) => ({
      blob: await downscaleScreenshot(image), filename: `image-${index + 1}.jpg`,
    })))
    const result = await sendChat({
      baseUrl, getToken: aiGatewayToken, agentId: request.agentId,
      message: request.message, sessionId: request.sessionId, files, signal,
    })
    const proposal = result.proposal
    if (proposal && 'customerName' in proposal) {
      const { warnings, ...customer } = proposal
      return { sessionId: result.sessionId, reply: result.reply, proposal: customer, warnings: result.warnings }
    }
    return { sessionId: result.sessionId, reply: result.reply, proposal, warnings: result.warnings }
  }
  await new Promise(resolve => setTimeout(resolve, FAKE_REPLY_DELAY_MS))
  if (request.message.trim() === 'error') throw new Error('AI unavailable')
  return { sessionId: request.sessionId ?? `fake-${request.agentId}`, ...cannedReplies[request.agentId] }
}

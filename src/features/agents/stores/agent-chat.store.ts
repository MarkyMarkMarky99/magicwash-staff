import { defineStore } from 'pinia'
import { ref } from 'vue'
import { AiGatewayError } from '@shared/ai-gateway/ai-gateway.errors'
import { sendAgentMessage } from '../services/agent-chat.service'
import {
  MAX_DRAFT_IMAGES,
  type AgentChat,
  type AgentChatRequest,
  type AgentId,
} from '../agent-chat.types'

function emptyChat(): AgentChat {
  return { sessionId: null, messages: [], thinking: false, draftText: '', draftImages: [] }
}

let messageCounter = 0
function nextId(): string {
  messageCounter += 1
  return `m${messageCounter}`
}

export const useAgentChatStore = defineStore('agent-chat', () => {
  const chats = ref<Record<AgentId, AgentChat>>({
    'register-customer': emptyChat(),
    'price-check': emptyChat(),
    'order-tracking': emptyChat(),
  })
  const generations: Record<AgentId, number> = { 'register-customer': 0, 'price-check': 0, 'order-tracking': 0 }
  const controllers: Partial<Record<AgentId, AbortController>> = {}
  const lastRequests: Partial<Record<AgentId, AgentChatRequest>> = {}

  function setDraftText(agentId: AgentId, text: string): void {
    chats.value[agentId].draftText = text
  }

  function addDraftImages(agentId: AgentId, files: File[]): void {
    const chat = chats.value[agentId]
    for (const file of files) {
      if (chat.draftImages.length >= MAX_DRAFT_IMAGES) break
      if (!file.type.startsWith('image/')) continue
      chat.draftImages.push({ id: nextId(), file, url: URL.createObjectURL(file) })
    }
  }

  function removeDraftImage(agentId: AgentId, id: string): void {
    const chat = chats.value[agentId]
    const image = chat.draftImages.find(item => item.id === id)
    if (!image) return
    URL.revokeObjectURL(image.url)
    chat.draftImages = chat.draftImages.filter(item => item.id !== id)
  }

  async function deliver(agentId: AgentId, request: AgentChatRequest): Promise<void> {
    const chat = chats.value[agentId]
    const generation = generations[agentId]
    lastRequests[agentId] = request
    chat.thinking = true
    const controller = new AbortController()
    controllers[agentId] = controller
    try {
      const reply = await sendAgentMessage(request, controller.signal)
      if (generations[agentId] !== generation) return
      chat.sessionId = reply.sessionId
      chat.messages.push({ id: nextId(), role: 'agent', text: reply.reply, proposal: reply.proposal, warnings: reply.warnings })
    } catch (error) {
      if (generations[agentId] !== generation) return
      if (error instanceof AiGatewayError && error.code === 'SESSION_NOT_FOUND') {
        chat.sessionId = null
        chat.messages.push({ id: nextId(), role: 'error', text: 'The previous chat expired and a new one started. Tap Retry to send again.' })
      } else {
        chat.messages.push({ id: nextId(), role: 'error' })
      }
    } finally {
      if (generations[agentId] === generation) {
        chat.thinking = false
        delete controllers[agentId]
      }
    }
  }

  async function send(agentId: AgentId): Promise<void> {
    const chat = chats.value[agentId]
    const text = chat.draftText.trim()
    if (chat.thinking || (!text && !chat.draftImages.length)) return
    const images = chat.draftImages
    chat.messages.push({ id: nextId(), role: 'staff', text, imageUrls: images.map(image => image.url) })
    chat.draftText = ''
    chat.draftImages = []
    await deliver(agentId, { agentId, sessionId: chat.sessionId, message: text, images: images.map(image => image.file) })
  }

  async function sendText(agentId: AgentId, text: string): Promise<void> {
    setDraftText(agentId, text)
    await send(agentId)
  }

  async function retry(agentId: AgentId): Promise<void> {
    const chat = chats.value[agentId]
    const request = lastRequests[agentId]
    if (chat.thinking || !request) return
    chat.messages = chat.messages.filter(message => message.role !== 'error')
    await deliver(agentId, { ...request, sessionId: chat.sessionId })
  }

  function reset(agentId: AgentId): void {
    const chat = chats.value[agentId]
    for (const message of chat.messages) {
      if (message.role === 'staff') message.imageUrls.forEach(url => URL.revokeObjectURL(url))
    }
    chat.draftImages.forEach(image => URL.revokeObjectURL(image.url))
    generations[agentId] += 1
    controllers[agentId]?.abort()
    delete controllers[agentId]
    delete lastRequests[agentId]
    chats.value[agentId] = emptyChat()
  }

  return { chats, setDraftText, addDraftImages, removeDraftImage, send, sendText, retry, reset }
})

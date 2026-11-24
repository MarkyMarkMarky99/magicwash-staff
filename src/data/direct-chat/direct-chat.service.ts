import * as gateway from '@shared/ai-gateway/tasks/direct-chat'
import { aiGatewayBaseUrl, aiGatewayToken } from '@/shared/ai-gateway/ai-gateway.config'

export type { DirectChatMessage, DirectChatInbox, DirectChatPeer, DirectChatSend, DirectChatTranslation, DirectChatTranslationUpdate } from '@shared/ai-gateway/tasks/direct-chat'
const access = () => ({ baseUrl: aiGatewayBaseUrl() ?? '', getToken: aiGatewayToken })
export const fetchInbox = () => gateway.getDirectChatInbox(access())
export const createConversation = (peerStaffId: string) => gateway.createDirectChatConversation(access(), peerStaffId)
export const fetchHistory = (id: string, options: { before?: number, limit?: number } = {}) => gateway.getDirectChatHistory(access(), id, options)
export const fetchAfter = (id: string, after: number) => gateway.getDirectChatAfter(access(), id, after)
export const sendMessage = (id: string, body: gateway.DirectChatSend, files: File[] = []) => gateway.sendDirectChatMessage(access(), id, body, files)
export const markRead = (id: string, eventId: string) => gateway.markDirectChatRead(access(), id, eventId)
export const retryTranslation = (id: string, seq: number) => gateway.retryDirectChatTranslation(access(), id, seq)
export const fetchImage = (id: string, imageId: string) => gateway.getDirectChatImage(access(), id, imageId)

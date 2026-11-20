import { authReady } from '@/shared/api/firebase-auth'
import { auth } from '@/firebase'

export function aiGatewayBaseUrl(): string | null {
  return import.meta.env.VITE_AI_GATEWAY_URL?.trim() || null
}

export async function aiGatewayToken(): Promise<string | null> {
  await authReady()
  return auth.currentUser?.getIdToken() ?? null
}

import { authReady } from '@/shared/api/firebase-auth'

export function aiGatewayBaseUrl(): string | null {
  return import.meta.env.VITE_AI_GATEWAY_URL?.trim() || null
}

export async function aiGatewayToken(): Promise<string | null> {
  const user = await authReady()
  return user ? user.getIdToken() : null
}

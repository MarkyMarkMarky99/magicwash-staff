export async function triggerLaundryItemClassification(
  actorStaffId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const base = process.env.VITE_AI_GATEWAY_URL?.trim()
  const secret = process.env.AI_GATEWAY_SECRET?.trim()
  if (!base || !secret) {
    console.warn('laundry_item_classification: missing gateway configuration')
    return false
  }
  try {
    const response = await fetchImpl(`${base.replace(/\/+$/, '')}/tasks/classify-laundry-items`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${secret}`,
        'x-acting-staff-id': actorStaffId,
      },
      body: JSON.stringify({ input: {} }),
      signal: AbortSignal.timeout(15_000),
    })
    if (response.ok) return true
    console.warn('laundry_item_classification: HTTP failure', { status: response.status })
  } catch {
    console.warn('laundry_item_classification: request failed')
  }
  return false
}

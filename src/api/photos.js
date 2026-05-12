const GATEWAY_URL = 'https://script.google.com/macros/s/AKfycbycje0WWsGgIXjrH6uVJpkUnyoVNzOuATLMq3uc2T-Jr_Fnno_KFKVYuGpf5wLPWaVC/exec'

async function post(body) {
  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'sheet', ...body }),
  })
  const json = await response.json()
  // Apps Script always returns HTTP 200 — check status field instead
  if (json.status !== 'ok') throw new Error(json.message ?? 'Request failed')
  return json
}

/**
 * @param {{ id: string, order_id: string, image_url: string, created_by: string }} data
 */
export async function savePhoto(data) {
  return post({
    action: 'APPEND',
    target: 'AfterPhoto',
    data,
  })
}

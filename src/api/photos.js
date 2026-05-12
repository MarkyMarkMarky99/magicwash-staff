import { gvizQuery } from '../utils/gviz'

const GATEWAY_URL = 'https://script.google.com/macros/s/AKfycbycje0WWsGgIXjrH6uVJpkUnyoVNzOuATLMq3uc2T-Jr_Fnno_KFKVYuGpf5wLPWaVC/exec'
const PHOTOS_SPREADSHEET_ID = '1_0gUApQJTz_b1b3FiIFt7K2nJuToHtXFZb3emt1vrn4'

async function post(body) {
  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    body: JSON.stringify({ resource: 'sheet', ...body }),
  })
  const json = await response.json()
  // Apps Script always returns HTTP 200 — check status field instead
  if (json.status !== 'ok') throw new Error(json.message ?? 'Request failed')
  return json
}

// columns: A=id, B=order_id, C=orderitem_id, D=item_id, E=image_path,
//          F=image_url, G=notes, H=created_at, I=created_by, ...
export async function getPhotosByOrderId(orderId) {
  const safeId = String(orderId).replace(/'/g, '')
  const rows = await gvizQuery(
    PHOTOS_SPREADSHEET_ID,
    'AfterPhoto',
    `SELECT A, F, G WHERE B='${safeId}'`,
  )
  return rows.filter(r => r.image_url)
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

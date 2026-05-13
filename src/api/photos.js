import { gvizQuery } from '../utils/gviz'

const GATEWAY_URL = 'https://script.google.com/macros/s/AKfycbycje0WWsGgIXjrH6uVJpkUnyoVNzOuATLMq3uc2T-Jr_Fnno_KFKVYuGpf5wLPWaVC/exec'

const SPREADSHEET_ID = {
  BEF: '1tfgJvjXMkH8MIoJ38No9-1DBdG7o0lcPG8dVhPCGw-E',
  AFT: '1_0gUApQJTz_b1b3FiIFt7K2nJuToHtXFZb3emt1vrn4',
}

const SHEET_TARGET = {
  BEF: 'BeforePhoto',
  AFT: 'AfterPhoto',
}

const READ_SHEET = {
  BEF: 'LaundryPhotos',
  AFT: 'AfterPhoto',
}

async function post(body) {
  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    body: JSON.stringify({ resource: 'sheet', ...body }),
  })
  const json = await response.json()
  if (json.status !== 'ok') throw new Error(json.message ?? 'Request failed')
  return json
}

// columns: A=id, B=order_id, C=orderitem_id, D=item_id, E=image_path,
//          F=image_url, G=notes, H=created_at, I=created_by, ...
export async function getPhotos(type, orderId, orderitemId = null) {
  const safeOrderId = String(orderId).replace(/'/g, '')
  let query = `SELECT A, F, G WHERE B='${safeOrderId}'`
  if (orderitemId) {
    const safeItemId = String(orderitemId).replace(/'/g, '')
    query += ` AND C='${safeItemId}'`
  }
  const rows = await gvizQuery(SPREADSHEET_ID[type], READ_SHEET[type], query)
  return rows.filter(r => r.image_url)
}

export async function savePhoto(type, data) {
  return post({
    action: 'APPEND',
    target: SHEET_TARGET[type],
    data,
  })
}

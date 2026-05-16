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

const ORDER_ITEM_FORMS_SHEET = 'OrderItemForms'

function safeQueryValue(value) {
  return String(value ?? '').replace(/'/g, '')
}

function rowValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key]
  }
  return ''
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
  const safeOrderId = safeQueryValue(orderId)
  let query = `SELECT A, F, G WHERE B='${safeOrderId}'`
  if (orderitemId) {
    const safeItemId = safeQueryValue(orderitemId)
    query += ` AND C='${safeItemId}'`
  }
  const rows = await gvizQuery(SPREADSHEET_ID[type], READ_SHEET[type], query)
  return rows.filter(r => r.image_url)
}

async function getBeforePhotoRows(orderId, orderitemId = null) {
  const safeOrderId = safeQueryValue(orderId)
  let query = `SELECT A, C, F, G WHERE B='${safeOrderId}'`
  if (orderitemId) {
    const safeItemId = safeQueryValue(orderitemId)
    query += ` AND C='${safeItemId}'`
  }

  const rows = await gvizQuery(SPREADSHEET_ID.BEF, READ_SHEET.BEF, query)
  return rows.map((row) => ({
    id: rowValue(row, ['id', 'A']),
    orderitem_id: rowValue(row, ['orderitem_id', 'C']),
    image_url: rowValue(row, ['image_url', 'F']),
    notes: rowValue(row, ['notes', 'G']),
  })).filter((photo) => photo.image_url)
}

async function getOrderItemDescriptions() {
  const rows = await gvizQuery(
    SPREADSHEET_ID.BEF,
    ORDER_ITEM_FORMS_SHEET,
    'SELECT A, D',
  )

  return new Map(rows.map((row) => {
    const id = String(rowValue(row, ['id', 'A'])).trim()
    const description = String(rowValue(row, ['description', 'D'])).trim()
    return [id, description]
  }).filter(([id]) => id))
}

function getAlbumTitle(photo, descriptionsByItemId) {
  const orderitemId = String(photo.orderitem_id ?? '').trim()
  const description = descriptionsByItemId.get(orderitemId)

  if (description) return description
  if (orderitemId) return `รายการ ${orderitemId}`
  return 'ไม่ระบุรายการ'
}

export async function getBeforePhotoCollections(orderId, orderitemId = null) {
  const [photos, descriptionsByItemId] = await Promise.all([
    getBeforePhotoRows(orderId, orderitemId),
    getOrderItemDescriptions(),
  ])

  const collections = photos.reduce((albumMap, photo, index) => {
    const albumTitle = getAlbumTitle(photo, descriptionsByItemId)
    if (!albumMap[albumTitle]) albumMap[albumTitle] = []

    albumMap[albumTitle].push({
      id: photo.id || `bef-${index}`,
      src: photo.image_url,
      image_url: photo.image_url,
      label: photo.notes || null,
      notes: photo.notes || null,
      orderitem_id: photo.orderitem_id || null,
      removable: false,
    })

    return albumMap
  }, {})

  return Object.keys(collections).length ? collections : []
}

export async function savePhoto(type, data) {
  return post({
    action: 'APPEND',
    target: SHEET_TARGET[type],
    data,
  })
}

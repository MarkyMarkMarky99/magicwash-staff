import { gvizQuery } from '../utils/gviz'

const SPREADSHEET_ID = {
  BEF: '1tfgJvjXMkH8MIoJ38No9-1DBdG7o0lcPG8dVhPCGw-E',
  AFT: '1_0gUApQJTz_b1b3FiIFt7K2nJuToHtXFZb3emt1vrn4',
}

// Physical tab names. `AfterPhoto` is the Apps Script target name, not a tab — the AFT workbook
// has a single tab called `after`. GViz silently falls back to the first tab when asked for a
// name that does not exist, so a wrong name here would only start failing once a second tab is
// added to that workbook.
const READ_SHEET = {
  BEF: 'LaundryPhotos',
  AFT: 'after',
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

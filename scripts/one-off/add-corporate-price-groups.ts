// One-off (2026-10-21): add the KLINIQ / KLINIQUE / MAISON / MAISON_GAYSORN / SOULTEL corporate item lists
// from the customers' paper slips, and point the customers' PriceGroup at them.
// Rows are appended in paper-slip order. Items new to the catalog get the next ITM code.
// Prices are 0: these customers are billed by weight.
//
// Dry run:  npx tsx --env-file=.env.local scripts/one-off/add-corporate-price-groups.ts
// Write:    add --write
import { getGoogleAccessToken } from '../../server/shared/repositories/google-auth.js'
import { generateShortId } from '../../shared/utils/id.js'

const WRITE = process.argv.includes('--write')
const EFFECTIVE_FROM = '2026-10-21'

type Spec = { th: string, en: string } & ({ code: string } | { item: [string, string, string, string | null] })
const T = (th: string, en: string, code: string): Spec => ({ th, en, code })
const N = (th: string, en: string, ...item: [string, string, string, string | null]): Spec => ({ th, en, item })

const FOOT_GREY = ['Household', 'Towels', 'Foot Towel', 'Grey'] as const
const SPA = 'Spa Linen'

const GROUPS: Record<string, Spec[]> = {
  KLINIQ: [
    N('ผ้าเท้า เทา', 'Grey Foot Towel', ...FOOT_GREY),
    T('ปลอกหมอน', 'Pillowcase', 'ITM-0006'),
    N('ผ้าปูเตียงสปา', 'Spa Bed Sheet', 'Bedding', 'Bedding Covers', 'Bedsheet', 'Spa Bed'),
    N('ผ้าห่ม เทา', 'Grey Blanket', 'Bedding', 'Blankets Duvets', 'Blanket', 'Grey'),
    N('กางเกงนวดไทย เทา', 'Grey Thai Massage Pants', 'Clothing', 'Bottoms', 'Thai Massage Pants', 'Grey'),
    N('เสื้อนวดไทย เทา', 'Grey Thai Massage Shirt', 'Clothing', 'Tops', 'Thai Massage Shirt', 'Grey'),
    T('ชุดคลุมอาบน้ำ', 'Bathrobe', 'ITM-0076'),
    N('ผ้าเช็ดเท้าสปา ขาว', 'White Spa Foot Towel', 'Household', 'Towels', 'Foot Towel', 'White'),
    N('ผ้าขาวรองหมอน มีโลโก้', 'White Logo Pillow Cloth', 'Bedding', 'Bedding Covers', 'Pillow Cloth', 'White Logo'),
    N('ผ้าร้อนเล็ก ขาว', 'Small White Hot Towel', 'Household', 'Towels', 'Hot Towel', 'Small White'),
    T('ผ้าเช็ดตัว ขาว', 'Bath Towel', 'ITM-0022'),
    T('ผ้าห่มใหญ่ ขาว', 'Large Blanket', 'ITM-0014'),
    N('bedsheet', 'Bed Sheet', 'Bedding', 'Bedding Covers', 'Bedsheet', null),
    N('ผ้าสเกิร์ต', 'Spa Skirt Wrap', 'Household', SPA, 'Skirt Wrap', null),
  ],
  KLINIQUE: [
    N('ผ้าคลุมคอ', 'Neck Cover', 'Household', SPA, 'Neck Cover', null),
    N('ผ้าคลุมคอเทาบาง', 'Thin Grey Neck Cover', 'Household', SPA, 'Neck Cover', 'Thin Grey'),
    N('ผ้าคลุมคอขาว', 'White Neck Cover', 'Household', SPA, 'Neck Cover', 'White'),
    N('ผ้าปู', 'Bed Sheet', 'Bedding', 'Bedding Covers', 'Bedsheet', null),
    N('ผ้าปูเทาบาง', 'Thin Grey Bed Sheet', 'Bedding', 'Bedding Covers', 'Bedsheet', 'Thin Grey'),
    N('ผ้าปูเตียงเวลล่า', 'Vela Bed Sheet', 'Bedding', 'Bedding Covers', 'Bedsheet', 'Vela Bed'),
    N('ผ้าปูไฟฟ้า', 'Electric Bed Sheet', 'Bedding', 'Bedding Covers', 'Bedsheet', 'Electric Bed'),
    N('ผ้าห่ม', 'Blanket', 'Bedding', 'Blankets Duvets', 'Blanket', null),
    N('ผ้าห่มเทาบาง', 'Thin Grey Blanket', 'Bedding', 'Blankets Duvets', 'Blanket', 'Thin Grey'),
    N('เกาะอก สีขาว', 'White Tube Wrap', 'Household', SPA, 'Tube Wrap', 'White'),
    N('เกาะอก สีเทา', 'Grey Tube Wrap', 'Household', SPA, 'Tube Wrap', 'Grey'),
    N('เกาะอก สีเขียว', 'Green Tube Wrap', 'Household', SPA, 'Tube Wrap', 'Green'),
    N('เกาะอกลาย', 'Patterned Tube Wrap', 'Household', SPA, 'Tube Wrap', 'Patterned'),
    T('ผ้าห่ม(เล็ก) สีขาว', 'Small Blanket', 'ITM-0012'),
    T('ผ้าห่ม(ใหญ่) สีขาว', 'Large Blanket', 'ITM-0014'),
    N('เสื้อเขียว', 'Green Top', 'Clothing', 'Tops', 'Top', 'Green'),
    N('กางเกงเขียว', 'Green Pants', 'Clothing', 'Bottoms', 'Long Pants', 'Green'),
    T('ชุดคลุม สีขาว', 'White Bathrobe', 'ITM-0117'),
    T('ชุดคลุม สีเทา', 'Grey Bathrobe', 'ITM-0101'),
    T('เสื้อกาวน์หมอ', "Doctor's Lab Coat", 'ITM-0057'),
    N('ผ้าเขียว', 'Green Cloth', 'Household', SPA, 'Cloth', 'Green'),
  ],
  MAISON: [],
  MAISON_GAYSORN: [],
  SOULTEL: [
    T('ปลอกหมอน', 'Pillowcase', 'ITM-0006'),
    N('ปลอกนวม 3 ฟุต', 'Duvet Cover 3 ft', 'Bedding', 'Bedding Covers', 'Duvet Cover', '3 ft'),
    N('ปลอกผ้านวม 3.5 ฟุต', 'Duvet Cover 3.5 ft', 'Bedding', 'Bedding Covers', 'Duvet Cover', '3.5 ft'),
    N('ปลอกผ้านวม 5 ฟุต', 'Duvet Cover 5 ft', 'Bedding', 'Bedding Covers', 'Duvet Cover', '5 ft'),
    N('ปลอกผ้านวม 6 ฟุต', 'Duvet Cover 6 ft', 'Bedding', 'Bedding Covers', 'Duvet Cover', '6 ft'),
    N('ผ้าปู 3 ฟุต', 'Bed Sheet 3 ft', 'Bedding', 'Bedding Covers', 'Bedsheet', '3 ft'),
    N('ผ้าปู 3.5 ฟุต', 'Bed Sheet 3.5 ft', 'Bedding', 'Bedding Covers', 'Bedsheet', '3.5 ft'),
    N('ผ้าปู 5 ฟุต', 'Bed Sheet 5 ft', 'Bedding', 'Bedding Covers', 'Bedsheet', '5 ft'),
    N('ผ้าปู 6 ฟุต', 'Bed Sheet 6 ft', 'Bedding', 'Bedding Covers', 'Bedsheet', '6 ft'),
    T('ผ้าเช็ดตัว', 'Bath Towel', 'ITM-0022'),
    T('ผ้าเช็ดหน้า', 'Facial Towel', 'ITM-0111'),
    N('ผ้าเช็ดเท้า', 'Foot Towel', 'Household', 'Towels', 'Foot Towel', null),
    T('เสื้อคลุมอาบน้ำ', 'Bathrobe', 'ITM-0076'),
  ],
}

const maison = {
  hand: N('ผ้าเช็ดมือ12"x12"', 'Hand Towel 12"x12"', 'Household', 'Towels', 'Hand Towel', '12x12 in'),
  thick: N('ผ้าขนหนู 15"x30" (หนา)', 'Thick Towel 15"x30"', 'Household', 'Towels', 'Towel', '15x30 in Thick'),
  hot: N('ผ้าขนหนู 15"x30" (ร้อน/เย็น)', 'Hot/Cold Towel 15"x30"', 'Household', 'Towels', 'Hot Towel', '15x30 in'),
  foot: N('ผ้าเช็ดเท้า 15"x30" (น้ำตาลอ่อน)', 'Light Brown Foot Towel 15"x30"', 'Household', 'Towels', 'Foot Towel', '15x30 in Light Brown'),
  bath: N('ผ้าขนหนูเช็ดตัว 27"x54"', 'Bath Towel 27"x54"', 'Household', 'Towels', 'Towel', '27x54 in'),
  bed: N('ผ้าขนหนูปูเตียง 40"x80"', 'Bed Towel 40"x80"', 'Household', 'Towels', 'Towel', '40x80 in Bed'),
  robe: T('ชุดคลุมอาบน้ำ', 'Bathrobe', 'ITM-0076'),
  hair: T('ผ้าคาดผม', 'Headband', 'ITM-0115'),
  shorts: N('กางเกงขาสั้นฟ้า', 'Blue Shorts', 'Clothing', 'Bottoms', 'Shorts', 'Blue'),
  knit: N('ผ้าห่มไหมพรม', 'Knit Blanket', 'Bedding', 'Blankets Duvets', 'Blanket', 'Knit'),
  insert: N('ไส้ผ้านวมเล็ก', 'Small Duvet Insert', 'Bedding', 'Blankets Duvets', 'Comforter Duvet', 'Small Insert'),
  slipper: N('รองเท้าสลิปเปอร์', 'Slippers', 'Others', 'Accessories', 'Shoes', 'Slippers'),
  tube: N('เกาะอก', 'Tube Wrap', 'Household', SPA, 'Tube Wrap', null),
  fitted: N('ผ้าปูเตียงรัดมุม', 'Fitted Sheet', 'Bedding', 'Bedding Covers', 'Fitted Sheet', null),
  scarf: T('ผ้าคาดเตียง', 'Bed Scarf', 'ITM-0116'),
  duvet: N('ปลอกผ้านวม', 'Duvet Cover', 'Bedding', 'Bedding Covers', 'Duvet Cover', null),
  round: N('ปลอกหมอนกลม', 'Round Pillowcase', 'Bedding', 'Bedding Covers', 'Pillowcase', 'Round'),
}
const m = maison
GROUPS.MAISON = [m.hand, m.thick, m.hot, m.foot, m.bath, m.bed, m.robe, m.hair, m.shorts, m.knit, m.insert, m.slipper, m.fitted, m.scarf, m.duvet, m.round]
GROUPS.MAISON_GAYSORN = [m.hand, m.thick, m.hot, m.foot, m.bath, m.bed, m.hair, m.shorts, m.knit, m.insert, m.slipper, m.tube, m.fitted, m.scarf, m.duvet, m.round, m.robe]

const CUSTOMER_GROUPS: Record<string, string> = {
  '692816af': 'KLINIQ', // KLINIQ - CTW
  '9dba20aa': 'KLINIQ', // KLINIQ - SIAM
  '50f24d1d': 'KLINIQUE', // The Kliniquo
  f37129e2: 'MAISON', // MAISON YSAÉ
  c35ddacd: 'MAISON_GAYSORN', // Maison+gaysorn
  e5b936f3: 'SOULTEL', // SOULTEL (คุณยิม)
}

const token = await getGoogleAccessToken()
const api = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json() as Promise<any>
}
const base = (id: string) => `https://sheets.googleapis.com/v4/spreadsheets/${id}`
const readSheet = async (id: string, sheet: string) => {
  const values: string[][] = (await api(`${base(id)}/values/${encodeURIComponent(`'${sheet}'`)}?valueRenderOption=UNFORMATTED_VALUE`)).values ?? []
  const [header, ...rows] = values
  return { header: header!, rows: rows.map((row) => Object.fromEntries(header!.map((h, i) => [h, row[i] ?? '']))) }
}
const append = async (id: string, sheet: string, header: string[], rows: Record<string, unknown>[]) => {
  if (!rows.length) return
  const values = rows.map((row) => header.map((h) => (h in row ? row[h] ?? '' : '')))
  for (const row of rows) for (const key of Object.keys(row)) if (!header.includes(key)) throw new Error(`${sheet} has no column ${key}`)
  await api(`${base(id)}/values/${encodeURIComponent(`'${sheet}'!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: 'POST', body: JSON.stringify({ values }),
  })
}

const PRICE = process.env.PRICE_LIST_SPREADSHEET_ID!
const CUSTOMERS = process.env.CUSTOMERS_SPREADSHEET_ID!
const items = await readSheet(PRICE, 'Items')
const priceList = await readSheet(PRICE, 'PriceList')
const customers = await readSheet(CUSTOMERS, 'Customers')

const existingGroups = new Set(priceList.rows.map((r) => r.price_group))
for (const group of Object.keys(GROUPS)) if (existingGroups.has(group)) throw new Error(`PriceList already has group ${group}`)

const key = (c: string, s: string, t: string, v: string | null) => [c, s, t, v ?? ''].join('|')
const itemByKey = new Map(items.rows.map((r) => [key(r.category, r.subcategory, r.itemtype, r.variant || null), r]))
const itemByCode = new Map(items.rows.map((r) => [r.item_code, r]))
let maxCode = Math.max(...[...items.rows, ...priceList.rows].map((r) => Number(/^ITM-(\d+)$/.exec(r.item_code)?.[1] ?? 0)))
const ids = new Set([...items.rows, ...priceList.rows].map((r) => r.id))
const newId = () => { let id; do id = generateShortId(); while (ids.has(id)); ids.add(id); return id }

const newItems: Record<string, unknown>[] = []
const priceRows: Record<string, unknown>[] = []
for (const [group, specs] of Object.entries(GROUPS)) {
  for (const spec of specs) {
    let item: Record<string, any> | undefined
    if ('code' in spec) {
      item = itemByCode.get(spec.code)
      if (!item) throw new Error(`${group}: ${spec.code} not in Items`)
    } else {
      const [c, s, t, v] = spec.item
      item = itemByKey.get(key(c, s, t, v))
      if (!item) {
        item = { id: newId(), item_code: `ITM-${String(++maxCode).padStart(4, '0')}`, category: c, subcategory: s, itemtype: t, variant: v ?? '', display_name_th: spec.th, display_name_en: spec.en, active: true, image_url: '' }
        itemByKey.set(key(c, s, t, v), item)
        newItems.push(item)
      }
    }
    priceRows.push({
      id: newId(), item_code: item.item_code, category: item.category, subcategory: item.subcategory, itemtype: item.itemtype,
      variant: item.variant ?? '', display_name_th: spec.th, display_name_en: spec.en, service_type: 'WASH', price_group: group,
      unit: 'piece', price: 0, credit_eligible: false, effective_from: EFFECTIVE_FROM, effective_to: '', active: true, image_url: item.image_url ?? '',
    })
  }
}

const groupCol = customers.header.indexOf('PriceGroup')
const idCol = customers.header.indexOf('CustomerID')
if (groupCol < 0 || idCol < 0) throw new Error('Customers header missing PriceGroup or CustomerID')
const colLetter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)))
const customerUpdates = Object.entries(CUSTOMER_GROUPS).map(([customerId, group]) => {
  const index = customers.rows.findIndex((r) => r.CustomerID === customerId)
  if (index < 0) throw new Error(`Customer ${customerId} not found`)
  const row = customers.rows[index]!
  return { range: `'Customers'!${colLetter(groupCol)}${index + 2}`, values: [[group]], name: `${row.CustomerIndex} ${row.CustomerName}`, before: row.PriceGroup }
})

console.log(`mode ${WRITE ? 'WRITE' : 'DRY RUN'}`)
console.log(`new Items: ${newItems.length}`)
for (const i of newItems) console.log(`  ${i.item_code}  ${i.category} / ${i.subcategory} / ${i.itemtype} / ${i.variant || '–'}  ${i.display_name_th}`)
for (const group of Object.keys(GROUPS)) {
  const rows = priceRows.filter((r) => r.price_group === group)
  console.log(`PriceList ${group}: ${rows.length} rows`)
  for (const r of rows) console.log(`  ${r.item_code}  ${r.display_name_th}  |  ${r.display_name_en}`)
}
for (const u of customerUpdates) console.log(`Customer ${u.name}: PriceGroup "${u.before}" -> ${u.values[0]![0]}`)

if (WRITE) {
  await append(PRICE, 'Items', items.header, newItems)
  await append(PRICE, 'PriceList', priceList.header, priceRows)
  await api(`${base(CUSTOMERS)}/values:batchUpdate`, {
    method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data: customerUpdates.map(({ range, values }) => ({ range, values })) }),
  })
  console.log('written')
}

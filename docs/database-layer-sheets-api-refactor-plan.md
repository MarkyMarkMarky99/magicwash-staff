# Database Layer แยกจาก API + สลับ Write Transport เป็น Sheets API

## Context

`server/modules/<feature>/` สมมติว่า 1 module = 1 กลุ่ม sheet ซึ่งไม่จริง — feature module คือ
use case/route แต่ physical sheet คือ resource ที่ใช้ร่วมกัน ผลคือ `invoices` ต้อง import
`OrderForm` contract/repository ข้าม module จาก `orders` (`server/modules/orders/order.repository.ts:1`)

รากของปัญหาลึกกว่านั้น: `BaseRepository` ผูกกับ **API contract** ตั้งแต่ระดับ generic
(`base.repository.ts:114-119` — generic ทุกตัวเป็น API shape) และ `GSheetRepository` รับ
`ModuleContract` ทั้งก้อน (api + db) ทำให้ repository ของชีตหนึ่งไปผูกกับ API ของ module หนึ่ง
โดยอัตโนมัติ

**เป้าหมาย: ออกแบบ database layer ใหม่ที่ไม่ผูกกับ API contract เลย**

- sheet repo รู้แค่ `read` / `append` / `update` / `delete` / batch บน DB shape ของชีตตัวเอง
- module ไหนก็เรียก repo ไหนก็ได้ ไม่มี module→module edge
- module รู้จัก **schema/contract ของ sheet** ที่ตัวเองใช้ + API contract ของตัวเอง
  แต่ไม่รู้จัก API contract ของ module อื่น
- DB↔API mapping และการแพ็ค/แกะ domain เป็นหน้าที่ของ module ไม่ใช่ repository

พร้อมกันนั้นเปลี่ยน write path จาก Apps Script (SheetLib) → Google Sheets API + service account
เพราะช้าและ error บ่อย ราคาที่จ่ายอยู่เห็นได้ใน `gsheet.repository.ts:345-461` ซึ่งเป็นโค้ด
กันเหนียวที่มีอยู่เพราะ SheetLib ตอบไม่ชัดล้วนๆ

**ไม่แตะ read path** — GViz อยู่ต่อ ปลายทางระยะยาวคือ Supabase งานที่ลงกับ Sheets API read layer
จะเป็นของทิ้ง และ GViz ให้ server-side `WHERE` มาฟรี

**ไม่ลบ Apps Script** — `APPSCRIPT_INVOICE_VIEW_SYNC_URL` คือ trigger คำนวณ materialized view
ยังต้องใช้ หลังจบงานนี้: Apps Script = คำนวณ/trigger, Sheets API = CRUD writes, GViz = reads

แผนนี้ผ่าน codex 3 รอบที่ให้ผลจริง ทุก finding ถูกตรวจยืนยันกับโค้ด/Apps Script source จริง
ก่อนรับเข้ามา (มีอีก 1 รอบที่ session context เต็มแล้วจบโดยไม่ออกบทรีวิว — ไม่นับ)

---

## สถานะ (ปิด Phase 1 — 2026-08-09)

**Phase 1 เสร็จครบทุกขั้น (1.1–1.8)** อยู่บน `refactor/sheet-layer` ยังไม่ merge เข้า main
Phase 2 §2.0–§2.3 เสร็จแล้ว; §2.4 เป็นขั้นถัดไป

commits ของ Phase 2 ที่เสร็จแล้ว:

- §2.0 — `93329fe`
- §2.1 — `749393e`
- §2.2 — `1e28213`
- §2.2 append endpoint fix — `07c8d55`
- §2.3 — `0d1a975`

ผลลัพธ์: 1 repository ต่อ 1 physical sheet, repository ไม่รู้จัก API contract, DB↔API mapping
อยู่ที่ module, `primaryKey` เป็นชื่อคอลัมน์ DB จริง, **module→module edge = 0** (ปัญหาตั้งต้น)
และ stack เก่า (`GSheetRepository`, `ModuleContract`, module contract/repository เดิม) ถูกลบทิ้ง
สุทธิ −3,900 บรรทัด

### ยืนยันบน Google Sheets จริงแล้ว (preview deploy)

`/api/invoices` `customer` เป็น object · `/api/customer-packages/:id` `transactions` เป็น array ·
`/api/appointments` `Address` แกะเป็น 4 ฟิลด์แบน · `/api/orders` `items` เป็น array, `quantity`
เป็น number — **การอ่านครบทั้ง 5 module**

### ⬜ ยังค้าง — ต้องทำก่อน merge เข้า main

**เส้นทางเขียนยังไม่เคยยืนยันกับของจริง** invoice create เขียน 4 ชีต ไม่ idempotent
ไม่มีเทสต์อัตโนมัติครอบได้ ต้องกดผ่าน staff UI 1 ครั้งด้วย order ที่ทิ้งได้ แล้วเปิดชีตตรวจ:
`Invoices.customer`/`.adjustments` ต้องเป็น JSON string ที่ parse ได้ (ไม่ใช่ `[object Object]`),
`InvoiceItems` แถวครบและ `sku` ว่างไม่ใช่คอลัมน์เลื่อน, `OrderForm.invoice_id` ถูกเขียน
บันทึกผลลง `docs/sheets-api-migration-smoke-checklist.md`

### สิ่งที่ทำต่างจากแผนนี้ — ตั้งใจ ไม่ใช่ของตกหล่น

- **`decodeJsonCells` ถูกถอดออกจาก database layer ทั้งหมด** แผนเดิม (§1.9) บอกให้เก็บไว้ใน repo
  เจ้าของโปรเจกต์ตัดสินว่า JSON ใน cell ไม่ใช่โครงสร้างจริง เป็นวิธี materialize portal view
  ⇒ คอลัมน์ nested ประกาศเป็น `z.string()` และ module parse เองผ่าน `jsonColumns`
- **backend เลิก normalize วันที่ GViz** — format เป็นหน้าที่ frontend `/api/orders` จึงคืน
  `Date(y,m,d)` เหมือน `/api/invoices` และ `/api/appointments` ที่ทำแบบนี้อยู่แล้ว
  นี่เป็น behavior change ที่ตั้งใจ และเป็นจุดเดียวที่ characterization test ถูกแก้
- **Customers write ตัดออกจาก scope** (M3) — เขียนผ่าน `appscript/customer-sheet/API.js`
  ซึ่งเป็น Apps Script คนละโปรเจกต์ที่มี lock + CustomerIndex allocation + LINE notification
  route POST/PATCH คงไว้ให้ fail แบบเดิม ไม่ถอดออก
- **`Invoices`/`InvoiceItems` ยังไม่มี `spreadsheetId`** ต่างจากตาราง §1.5 — สองชีตนี้เขียน
  อย่างเดียวไม่เคยอ่าน และ `INVOICES_SPREADSHEET_ID` ยังไม่มีบน Vercel ⇒ เพิ่มตอน §2.0
- **`sheet-column-parity.ts` ไม่มีในแผนเดิม** เกิดจากบั๊กที่ทำ `/api/appointments` ล่มบน preview

### บทเรียนที่แผนนี้ทำนายไม่ถูก

§1.9 เตือนเรื่อง **ลำดับ** คอลัมน์ แต่สิ่งที่ระเบิดจริงคือ **จำนวน** คอลัมน์ — ชีต Appointments
มี 17 คอลัมน์ แต่ registry ประกาศ 15 เราเชื่อ registry แล้วตัด `DeletedAt`/`DeletedBy` ทิ้ง
GViz คืนคอลัมน์ที่ resolve ไม่ได้ → `tableToRows` throw → `INTERNAL_ERROR` บน production

typecheck + dry-test 25 ไฟล์ + `npm run build` ไม่จับเลย เพราะ **fixture ถูกแก้ให้ตรงกับโค้ด
แทนที่จะตรงกับชีต** — characterization test ที่บันทึกสิ่งที่โค้ดทำ แย่กว่าไม่มีเทสต์

⇒ **registry เป็นเอกสารและตกยุคได้ ชีตคือความจริง** เวลาชุดคอลัมน์สำคัญให้ยืนยันกับชีตจริง
ด้วย `tests/server/integration/sheet-column-parity.ts` ก่อน deploy ทุกครั้งที่แตะ contract
(registry ถูกแก้ให้ตรงแล้วเมื่อ 2026-08-09 โดยได้รับอนุญาตเฉพาะครั้งนั้น)

---

## แยกเป็น 2 เฟส

การแยกนี้เป็นไปได้เพราะ `SheetRepository` เป็น **คลาสกลางคลาสเดียว** — พอมันไม่รู้จัก API แล้ว
การสลับ transport คือแก้ไฟล์เดียว ไม่ใช่แก้ทีละ sheet **แต่ละ sheet ยังย้ายรอบเดียวเหมือนเดิม**

| | Phase 1 — layer split | Phase 2 — transport swap |
|---|---|---|
| ทำอะไร | ย้าย 9 sheet เข้า `server/sheets/`, repo พูด DB shape, mapping ขึ้น module, ฆ่า `ModuleContract` | สลับ write ของ `SheetRepository` เป็น Sheets API |
| behavior เปลี่ยนไหม | **ไม่เปลี่ยนเลย** ยังเขียนผ่าน SheetLib | เปลี่ยน |
| ตรวจยังไง | typecheck + dry-test **+ characterization test ที่ต้องเขียนก่อนย้าย** (§1.2, §1.9) | ต้อง smoke test กับชีตจริง |
| ถ้าพัง | รู้ทันทีว่าเป็นเรื่อง refactor | รู้ทันทีว่าเป็นเรื่อง transport |

ทำรวมกันแล้วพังจะแยกไม่ออกว่าพังเพราะอะไร

---

## สถาปัตยกรรมปลายทาง

```
contracts/<feature>/<m>-api.schema.ts   ← API shape (แชร์กับ frontend)
          ↑
server/modules/<feature>/               ← service + routes + DB↔API mapping
          ↓  (import repo ไหนก็ได้)
server/sheets/<Sheet>/                  ← db-contract + lazy repo getter
          ↓
server/shared/repositories/             ← SheetRepository (ไม่รู้จัก API เลย)
```

**`server/shared/repositories/sheet.repository.ts`** — `SheetRepository<TDbRow>`

```
read(query?)            → Partial<TDbRow>[]
append(row)             → TDbRow
batchAppend(rows)       → TDbRow[]
update(keyValue, patch) → TDbRow
delete(keyValue, by)    → TDbRow        // soft delete
```

DB shape เข้า DB shape ออก ทุก method เป็นเจ้าของ transport ทั้งหมด (GViz read, write,
header map, serialization, error classification) **ไม่มี `fieldMap` ไม่มี API generic**

**`server/sheets/<Sheet>/<Sheet>.db-contract.ts`** — row schema (ชื่อคอลัมน์ DB), `primaryKey`,
per-column `valueInputOption` policy, `spreadsheetId` env key, `sheetName`
ไม่มีอะไรที่เกี่ยวกับ API

**`server/sheets/<Sheet>/<Sheet>.repository.ts`** — lazy memoized getter (`let` + `??=`)

**module** — เป็นเจ้าของ `fieldMap` (DB↔API) และการแพ็ค/แกะ domain
โค้ด mapping มีอยู่แล้วที่ `base.repository.ts:78-102,190-241` (`Mapper`, `mapQueryToDb`,
`mapResponseToApi`) — **ย้ายขึ้นมา ไม่ต้องเขียนใหม่**

`BaseCrudService` รับ `fieldMap` **และ `transformer`** เพิ่มเข้ามาแล้วรัน pipeline เอง เพื่อให้
module CRUD ธรรมดายัง declarative เหมือนเดิม — รายละเอียดและเหตุผลว่าทำไม `fieldMap` อย่างเดียว
ไม่พอ อยู่ที่ §1.6

**transformer ของ Appointments** (แพ็ค flat fields ↔ `Address` JSON cell,
`appointment.transformer.ts:48`) กลายเป็นงานของ appointment module — ตรงตามที่ตกลง: module
รู้จัก DB contract ของชีตที่มันใช้ การรู้ว่า `Address` เป็น JSON column จึงถูกต้องแล้ว
(codex เคยค้านว่าจะทำให้ service รู้จัก storage — ข้อค้านนั้นตกไปเพราะ design ใหม่ตั้งใจให้รู้)

---

## ข้อเท็จจริงที่ตรวจยืนยันแล้ว

- **`certainty` อยู่บน public API contract** (`contracts/invoices/invoice-api.schema.ts:199,211,225,239`)
  ห้ามยุบ error taxonomy
- **`BaseCrudService.update()` project แถวเต็มที่ repository คืน** (`base-crud.service.ts:184-185`)
  → repo ต้องคืนแถวสมบูรณ์ ไม่ใช่ patch
- **SheetLib ใช้ `Values.append(... INSERT_ROWS)` อยู่แล้ว** (`appscript/SheetLib/SheetService.js:106`)
  `LockService` ที่นั่นกัน append+read-back และ lookup+write+read-back ของ `update()` (`:171`)
  **ไม่ได้**กันการแย่ง allocate แถว — ข้อสรุปว่า direct append ไม่ต้อง lock ยังถูก แต่เหตุผลที่ผม
  เคยอธิบายไว้ผิด
- **SheetLib เขียนด้วย `USER_ENTERED` ไม่ใช่ `RAW`** (`SheetService.js:106`)
- **OrderForm ถูก auto-stamp `updated_at` อยู่จริง** — `Handler.js:30` เรียก `SheetService.update()`
  ไม่ส่ง `stamp` → default `true` → `updated_at = updated_at || _now()` (`SheetService.js:171`)
  **comment ที่ `order.contract.ts:133` ว่าไม่ stamp นั้นผิด**
- **SheetLib DELETE = soft delete** — `Handler.js:31-35` แปลง DELETE เป็น `update()` ที่เซ็ต
  `deleted_at`/`deleted_by` → `SheetRepository.delete()` ทำแบบเดียวกัน
- **`formatBangkokTimestamp` (`appointment.service.ts:102`) ตรงกับ `_now()` ของ SheetLib**
  (`SheetService.js:53`) ทั้งคู่ Asia/Bangkok → reuse ได้ ย้ายไป `server/shared/utils/`
- **`deriveGVizColumns` map ตาม index ของ key** (`utils/gviz-query.builder.ts:14-22`)
  read ผูกกับลำดับ key จริง — ข้อบังคับนี้คงอยู่สำหรับ read

### Landmine ที่เจอตอนตรวจ registry

**M1 — OrderForm อยู่คนละ workbook กับที่โค้ดชี้** `OrderForm.json` ประกาศ `1tfgJvj…` แต่
`.env.local ORDERS_SPREADSHEET_ID = 1ucqeUq…` (portal) วันนี้ไม่มีผลเพราะ OrderForm ไม่เคยถูก
GViz อ่าน แต่พอเขียนผ่าน Sheets API ค่านี้ชี้ workbook จริงทันที
**ยืนยันแล้ว: registry ถูก** → แยก env เป็น prerequisite ของ Phase 2

**M2 — Customers write พังอยู่แล้ววันนี้** `customer.repository.ts` ไม่มี `target` แต่
`customer.module.ts:19` mount POST/PATCH → `requireWriteTarget()` throw

**M3 — Customers ไม่ได้เขียนผ่าน SheetLib เลย** `appscript/customer-sheet/API.js` เป็น Apps Script
คนละโปรเจกต์ มี `LockService` ของตัวเอง (`:302-305`) ตอน CREATE จอง `CustomerIndex` จากชีต
`CustomerIDMapping` (`:3,45`), เช็คเบอร์ซ้ำ, ยิง LINE notification
⇒ ย้าย Customers write = เขียน business flow ใหม่ ไม่ใช่ migration → **ตัด write ออกจาก scope**
(read ย้ายเข้า `server/sheets/Customers/` ได้ปกติ) และอธิบาย M2 ไปในตัว

`INVOICES_SPREADSHEET_ID = 1zfhguJ…` มีอยู่ใน registry แล้ว ไม่ใช่ blocker

---

## กฎที่ห้ามละเมิด

1. ห้ามมี `index.ts` / barrel / registry object ใต้ `server/sheets/` — deep import เท่านั้น
2. lazy memoized getter (`let` + `??=`) ห้าม construct repository ตอน import
   ⚠ `customer.module.ts:14` เรียก getter ตอน import อยู่ — แก้ตอนย้าย
3. ทุก relative import/export ต้องมี `.js` — typecheck และ `vercel dev` จับไม่ได้ ต้อง deploy จริง
4. ห้ามใช้ tsconfig `paths` alias กับ backend
5. ห้ามให้ `SheetRepository` หรืออะไรใต้ `server/sheets/` import จาก `contracts/` หรือ `server/modules/`
6. ห้ามยุบ error taxonomy (`certainty` เป็น public contract)
7. ห้าม auto-retry write ที่ยิงออกไปแล้ว
8. **`G:\My Drive\Magicwash\Database\GoogleSheets\*.json` เป็น READ-ONLY สำหรับ agent ทุกตัว**
   registry คือ source of truth ที่ใช้ร่วมกับโปรเจกต์ Python ที่ root — ไม่ใช่ไฟล์ของโปรเจกต์นี้
   เมื่อ registry ไม่ตรงกับโค้ด **ให้แก้ที่โค้ดหรือรายงาน ห้ามแก้ registry เพื่อให้ตรง**
   เพราะคำสั่งว่า "ทำให้ตรงกัน" มีทางออกสองทางเสมอ และทางที่ผิดจะไปเปลี่ยนข้อมูลกลางของธุรกิจ
   การแก้ registry เป็นการตัดสินใจของคน ไม่ใช่ของ agent
   งานที่ delegate ให้ agent เขียนโค้ดต้องใช้ sandbox `workspace-write` เท่านั้น
   (จำกัดการเขียนไว้ใน repo โดยโครงสร้าง) **ห้ามใช้ full-auto หรือ bypass sandbox**

---

## Phase 1 — Database layer แยกจาก API (ไม่เปลี่ยน behavior)

**1.1** ลบไฟล์ร่าง `server/sheets/OrderForm/OrderForm.db-contract.ts` ที่ทำ branch typecheck แดง
(มันตัด `fieldMap` ออกแต่ `ModuleDbContract` ยังบังคับ) — จะสร้างใหม่ใน 1.3
**ห้ามผ่อน `fieldMap` เป็น optional** เพราะ `GSheetRepository` dereference มันอยู่ (`:27,166,175`)

**1.2 characterization test — ปักพฤติกรรมปัจจุบันก่อนแตะอะไรทั้งสิ้น** (ดูรายการใน §Tests)
ต้องทำตอนที่ยังไม่มีอะไรเปลี่ยน ไม่งั้นเสี่ยงปักพฤติกรรมที่เพี้ยนไปแล้วโดยไม่รู้ตัว
แล้ว test จะกลายเป็นตรายางแทนที่จะเป็นด่าน

**1.3 นิยาม contract ระดับ database — ต้องมาก่อน implementation**

ของเดิมมี 2 ชั้นและทั้งคู่ต้องมีคู่แฝดฝั่ง DB:

*(ก) `server/shared/contracts/sheet-contract.ts` — `SheetContract`*
structural guard ที่ `<Sheet>.db-contract.ts` ทุกตัวถูก `satisfies` (แทน `ModuleDbContract`)

```
row            DbRowSchema   // ต้องมี .shape — deriveGVizColumns ใช้ลำดับ key
primaryKey     string        // ⚠ ชื่อ "คอลัมน์ DB" ไม่ใช่ชื่อ field API
sheetName      string
spreadsheetId  string        // ชื่อ ENV KEY ไม่ใช่ค่า id
writes         { append, update, delete: boolean }
decodeJsonCells?  boolean
valueInput?    Record<column, 'RAW' | 'USER_ENTERED'>   // ใส่จริงตอน Phase 2
```

`writes` มาแทน convention เดิมที่ใช้ `z.never()` ประกาศ "ชีตนี้ห้ามเขียน"
(`customer-package-view.contract.ts:16`, `invoice-view.contract.ts:26`,
`invoice.contract.ts:534` Payments, `order.contract.ts:53` OrdersView)
**คงหลักการเดิมไว้: ประกาศชัด ไม่ใช่ปลอดภัยด้วยการละไว้** — แค่เปลี่ยนรูปเพราะ repo ใหม่ไม่
validate payload แล้ว การใช้ zod schema เพื่อสื่อว่า "never" จึงอ้อมโดยไม่จำเป็น
`isUnsupportedDbOperation` (`gsheet.repository.ts:112-114`) เปลี่ยนไปอ่าน `writes` แทน

ตามกฎของโปรเจกต์: ไฟล์ contract เป็น runtime contract ล้วน **ห้าม export `z.infer`**
type alias ให้ derive ข้างที่ใช้

*(ข) `server/shared/repositories/sheet-repository.contract.ts` — `SheetRepositoryContract<TDbRow>`*
abstract interface ที่ storage-agnostic (read/append/batchAppend/update/delete บน DB shape)
`SheetRepository` (Google Sheets) เป็น implementation หนึ่งของมัน
**นี่คือสิ่งที่ทำให้ seam ของ Supabase มีอยู่จริง** — ถ้าไม่มีชั้นนี้ `server/sheets/` จะผูกกับ
Google Sheets ถาวร แล้ว §8.2 ก็เป็นแค่คำพูด

**1.4** สร้าง `server/shared/repositories/sheet.repository.ts` — implement
`SheetRepositoryContract` **ยังใช้ SheetLib เขียนภายใน** ย้ายโค้ด transport จาก
`gsheet.repository.ts` มาตรงๆ ตัดส่วนที่เกี่ยวกับ API/fieldMap ออก

**1.5** ย้าย 9 sheet เข้า `server/sheets/<Sheet>/` — commit ละ sheet ชื่อโฟลเดอร์ = ชื่อ tab จริง

| Sheet | spreadsheetId env | write วันนี้ | หมายเหตุ |
|---|---|---|---|
| `OrderForm` | `ORDERS_SPREADSHEET_ID` | SheetLib | ผูกกับ M1 |
| `Appointments` | `APPOINTMENTS_SPREADSHEET_ID` | SheetLib | transformer ขึ้น module |
| `Invoices` / `InvoiceItems` | (ไม่มี → `INVOICES_SPREADSHEET_ID`) | SheetLib | `InvoiceItems` มี batchAppend |
| `Payments` | — | ไม่รองรับ | ย้ายไฟล์เฉยๆ |
| `Customers` | `CUSTOMERS_SPREADSHEET_ID` | **ไม่แตะ** (M3) | read อย่างเดียว |
| `OrdersView` / `InvoicesView` / `CustomerPackageView` | `ORDERS_SPREADSHEET_ID` (§2.0 เฟส A → `PORTAL_SPREADSHEET_ID`) | read-only | คอลัมน์ `*Json` คืนเป็น string ดิบ — ไม่มี `decodeJsonCells` แล้ว ดู §1.9 |

**1.6** module รับ mapping — api contract import จาก `contracts/<feature>/<m>-api.schema.js` ตรงๆ

**ผู้ใช้ `BaseCrudService` มี 5 ราย ไม่ใช่ 4** — `grep "new BaseCrudService"` เจอ 4
(`order.module.ts:9` OrdersView, `invoice.service.ts:176` InvoicesView,
`customer-package-view.module.ts:8`, `customer.module.ts:14` Customers) แต่ยังมีรายที่ 5
ที่ใช้ผ่าน **inheritance**: `AppointmentService extends BaseCrudService` (`appointment.service.ts:55`)
ซึ่งเป็นรายที่หนักที่สุดเพราะมี transformer + CRUD ครบ

**`BaseCrudService` ต้องรับ `fieldMap` *และ* `transformer` ไม่ใช่ `fieldMap` อย่างเดียว**

`fieldMap` เพียงอย่างเดียวพังทันที 2 ราย:
- **OrdersView** — transformer ถูก wire ผ่าน repository อยู่ (`order.repository.ts:18`) และ
  `transformOrderRow` (`orders.transformer.ts:49`) ไม่ได้แค่เปลี่ยนชื่อ แต่**สร้าง `items` จาก
  `itemsJson`**, normalize วันที่ GViz, แปลง quantity → ถ้าไม่มี transformer จะได้ `items: undefined`
  (มันอ่าน field ชื่อ API ได้เพราะ fieldMap ของ OrdersView เป็น identity — `order.contract.ts:27`)
- **Appointments** — flow create/update ที่ inherit มาต้องการลำดับ
  map→transform→transport→transform→map เป๊ะ (`appointment.transformer.ts:48,76`)

⇒ `BaseCrudServiceOptions` เปลี่ยนเป็น: `repository: SheetRepository<TDbRow>` + `fieldMap`
+ `transformer?` แล้ว service derive `TApiRow` ด้วย `ApiRowFromFieldMap<TDbRow, TFieldMap>`
(type utility นี้**มีอยู่แล้ว** ที่ `base.repository.ts:19-28` แค่ย้ายที่อยู่)
`AppointmentService` ส่ง transformer ของตัวเองเข้า `super()` — ไม่ต้องเลิก inherit

**`id` folding อยู่ที่ repository ไม่ใช่ service** — ปัจจุบัน `resolveWhere` fold `id` เข้า
`where[primaryKey]` ด้วยชื่อ API แล้วค่อย rename (`base.repository.ts:204,254`) พอ repo พูด DB shape
ให้ **repo fold เองด้วย DB primary key ของตัวมัน** service จะได้ไม่ต้องรู้ PK
ถ้าไม่ทำ: Customers detail/update, CustomerPackage detail, Invoice detail, Appointment
detail/update พังหมด

**1.7** `invoice.service.ts` import OrderForm repo จาก `server/sheets/OrderForm/`
→ **module→module edge หายไป**

**1.8** ลบ `ModuleContract`, `gsheet.repository.ts`, `order.contract.ts:79-180`,
re-export `invoiceViewContract` ที่ `invoice.contract.ts:10`

**1.9 จุดที่ Phase 1 จะเปลี่ยน behavior เงียบๆ ถ้าไม่ระวัง**

- ⚠ **Customers: ห้ามถอด POST/PATCH ออก** — API contract ประกาศ create/update ไว้
  (`contracts/customers/customer-api.schema.ts:119`) → `createCrudRoutes` mount route อยู่
  (`crud-routes.ts:17`) วันนี้มัน fail เพราะ repo ไม่มี `target` (M2) การถอด route ออกจะเปลี่ยน
  "fail แบบ 500" เป็น "404/unsupported" ซึ่งคือ behavior change
  ⇒ **คงพื้นผิว route ไว้เหมือนเดิม พังเหมือนเดิม** แค่ไม่ย้าย write transport เท่านั้น
- ⚠ **`primaryKey` เปลี่ยนความหมาย — กระทบ 8 จาก 9 sheet** วันนี้ `ModuleDbContract.primaryKey`
  คือ **ชื่อ field ฝั่ง API** (`module-db-contract.ts:45` ระบุชัด "NOT the DB column") และ
  `GSheetRepository` ต้อง invert fieldMap เพื่อหาชื่อคอลัมน์จริง (`:175-177`)
  ค่าปัจจุบันเป็น camelCase ฝั่ง API ทุกตัว — `appointmentId`, `customerId`, `invoiceNumber` (×2),
  `invoiceItemId`, `paymentId`, `orderId`, `customerPackageId` — **มีแค่ OrderForm ตัวเดียว
  (`order.contract.ts:170` = `'id'`) ที่บังเอิญเหมือนกันทั้งสองฝั่ง**
  ⇒ ต้องแปลงเป็นชื่อคอลัมน์ DB ทีละ sheet โดยอ่านจาก fieldMap ของ sheet นั้น
  **ห้าม copy ค่าเดิมมาเด็ดขาด** และ typecheck จับไม่ได้เลยเพราะทั้งคู่เป็น `string`
  ⇒ `column-order.dry-test.ts` ใน 1.2 ต้องปัก `primaryKey` → คอลัมน์จริง ไว้ด้วย
- **ลำดับ pipeline ต้องคงเดิม** — ปัจจุบันคือ `mapper.toDb` → `transformer.request` → execute →
  `transformer.response` → `mapper.toApi` (`base.repository.ts:149-172`) พอย้ายขึ้น module
  module ต้องทำ map-to-DB **ก่อน** pack (`Address` JSON) และ unpack **ก่อน** map-to-API
  สลับลำดับเมื่อไหร่ผลต่างทันที
- **guard ของ update/delete ต้องย้ายตามไปด้วย** — `resolveWhere` throw เมื่อ update/delete ไม่มี id
  (`base.repository.ts:261-263`) และ `mapQueryToDb` throw เมื่อไม่มี query เลย (`:195-197`)
  ถ้าลืมย้าย จะกลายเป็นเขียนทั้งชีตแทนที่จะ error
- **`resolveWhere` fold `id` เข้า `where[primaryKey]` ด้วยชื่อ API** แล้วค่อย map เป็น DB
  ลำดับนี้ต้องคงไว้ ไม่งั้น fold ด้วยชื่อผิด
- **row schema ต้องย้ายแบบคง key order เป๊ะ** — `deriveGVizColumns` map ตาม index
  (`gviz-query.builder.ts:14-22`) สลับ key เมื่อไหร่ read อ่านผิดคอลัมน์ทันที
- ⚠ **`decodeJsonCells` ถูกถอดออกจาก database layer แล้ว (กลับข้อสรุปเดิม)**
  เดิมสรุปว่าเป็น storage behavior ต้องอยู่ใน repo เจ้าของโปรเจกต์ตัดสินว่า JSON ใน cell
  ไม่ใช่โครงสร้างจริง เป็นแค่วิธี materialize portal view ⇒ คอลัมน์ nested ทุกตัวประกาศเป็น
  `z.string()` ตามที่ชีตเก็บจริง และ DB layer ไม่แกะอะไรให้ใคร
  (`SheetContract` ไม่มีฟิลด์นี้แล้ว)
  **ผลที่ต้องรับมือใน §1.6:** วันนี้ repo เก่าแกะให้ (`gviz-reader.ts:50,76` ซึ่ง parse ทุก string
  ที่หน้าตาเป็น object/array — เหวี่ยงแหทั้งชีต) พอย้ายมา layer ใหม่ **module ต้อง parse เอง**
  ไม่งั้น response ของ `/api/invoices` และ `/api/customer-packages` จะเปลี่ยนจาก object/array
  เป็น string ซึ่งเป็น behavior change ที่ผู้ใช้ปลายทางเห็น
  8 คอลัมน์ที่กระทบ: `Invoices.customer`/`.adjustments`, `InvoiceItems.adjustments`,
  `InvoicesView.customerJson`/`.itemsJson`/`.adjustmentsJson`/`.paymentsJson`,
  `CustomerPackageView.transactionsJson`
- ⚠ **`invoice.service.ts:410` เรียก repository ตรงๆ ข้าม `BaseCrudService`** (date-range read)
  เส้นนี้ต้องมี mapping ของตัวเอง — วันนี้รอดอยู่เพราะ fieldMap ของ InvoicesView เป็น identity
  ห้ามพึ่งความบังเอิญนั้นต่อ

**เกณฑ์ผ่าน Phase 1:** `npm run typecheck:api` เขียว + dry-test เดิมผ่านครบ + deploy + curl
ผ่านทุก endpoint

⚠ **typecheck + dry-test ที่มีอยู่ *ไม่* พิสูจน์ว่า behavior ไม่เปลี่ยน** — codex ชี้ถูก
key order ที่สลับยัง type-correct, transformer ถูกทดสอบแยกเป็นฟังก์ชันไม่ได้ทดสอบตอน wire เข้า
service, และ column mapping ของ Customers/Appointments ส่วนใหญ่ไม่มี test ปักไว้
⇒ ต้องเพิ่ม test ปัก column order ต่อ sheet + test ที่ wire transformer ผ่าน service จริง
**ก่อน**ย้าย ไม่ใช่หลังย้าย

---

## Phase 2 — สลับ write transport เป็น Sheets API

**2.0 Prerequisites**

*แยก env สองเฟส (M1)* — เฟส A: เพิ่ม `PORTAL_SPREADSHEET_ID` = `1ucqeUq…` แก้ 3 view
(`OrdersView`, `InvoicesView`, `CustomerPackageView`) ให้ชี้ตัวใหม่ + แก้ test ที่ set env เอง
(`invoice-api.workflow.dry-test.ts:19`, `invoice-read.workflow.dry-test.ts:16`,
`invoice-sheetlib.workflow.dry-test.ts:19`) → deploy + verify ก่อน
เฟส B: เปลี่ยน `ORDERS_SPREADSHEET_ID` เป็น `1tfgJvj…` + เพิ่ม `INVOICES_SPREADSHEET_ID`
⚠ โปรเจกต์ Python ที่ root มี `ORDERS_SPREADSHEET_ID` ของตัวเองชี้คนละ workbook — **ห้ามแตะ**

*Service account* — เปิด Sheets API, key base64 ใน `GOOGLE_SERVICE_ACCOUNT_KEY`
แชร์ Editor **เฉพาะ workbook ที่เขียนจริง 3 ตัว**: `1tfgJvj` (OrderForm), `1CvVl6a` (Appointments),
`1zfhguJ` (Invoices/InvoiceItems)
**ห้ามให้สิทธิ์ portal `1ucqeUq`** (GViz-read + Apps-Script-written เท่านั้น) และไม่ต้องให้
`17stv4n` (Customers ตัด write ออกแล้ว)

**2.1 `server/shared/repositories/google-auth.ts`** — JWT RS256 ด้วย `node:crypto`
(`createSign('RSA-SHA256')`) → `https://oauth2.googleapis.com/token` ไม่เพิ่ม dependency
(repo นี้มีประวัติเจ็บกับ `@vercel/node` bundling) scope `…/auth/spreadsheets`
cache token ที่ module scope หัก 60 วิ **กัน refresh ซ้อนเมื่อหลาย request เข้าพร้อมกัน**
อ่าน credentials แบบ lazy ห้ามอ่านตอน import

**2.2 `server/shared/repositories/sheets-api.client.ts`**

| operation | endpoint |
|---|---|
| `readHeader` | `values:get` แถว 1 |
| `appendRows` | `values:append` `insertDataOption=INSERT_ROWS` + `includeValuesInResponse=true` |
| `readColumn` | `values:get` คอลัมน์ key |
| `updateCells` | `values:batchUpdate` |

`INSERT_ROWS` ทำให้ append ไม่ต้องมี lock — Google จอง row ฝั่ง server แบบ atomic
**ห้ามใช้ `values:update` กับแถวที่คำนวณเอง** timeout 15 วิเท่าเดิม

**2.3 addressing ด้วย header map ไม่ใช่ตำแหน่งจาก schema**

อ่าน header จริงครั้งเดียว สร้าง `columnName → columnLetter` cache ที่ instance
- **lazy ก่อน write ครั้งแรก ไม่ใช่ตอน construct** — constructor เป็น sync และ repo ของ
  Appointments/Customers ถูกสร้างเพื่อ read ด้วย จะลาก GViz read ไปผูกกับ SA auth โดยไม่จำเป็น
- validation: ขาดคอลัมน์ที่ต้องใช้ / header ซ้ำ / header ว่างกลางแถว / ไม่มี PK → throw ก่อนเขียน
- **คอลัมน์ในชีตที่ schema ไม่รู้จัก → ไม่ต้อง throw** ปล่อยว่างตอน append (เข้มเกินไปจะทำให้
  เพิ่มคอลัมน์แล้วระบบล่ม)
- ยอมรับว่า header ที่เปลี่ยนระหว่าง warm instance จะไม่ถูกตรวจ

ผลสำคัญ: **ไม่ต้องมีกติกา "ลำดับ key = ลำดับคอลัมน์" สำหรับ write** และเขียน subset ได้ปลอดภัย
ซึ่งจำเป็นจริง — `InvoiceItem` create ไม่ส่ง `sku` ที่อยู่กลางแถว, `Invoice` ไม่ส่ง
`updated_*`/`deleted_*`, `OrderForm` patch แตะ 2 จาก 21 คอลัมน์

**Implementation note (commit `0d1a975`)** — สร้างและทดสอบ `sheet-header-map.ts` กับ
`SheetHeaderMapResolver` แล้ว โดย resolver มี lazy, success-only และ in-flight cache semantics
พร้อมใช้ แต่ ownership/wiring เข้า `SheetRepository` เลื่อนไป §2.9 ซึ่งเป็นจุดแรกที่มี Sheets API
write consumer การ wire ก่อนหน้านั้นทำได้เพียงเพิ่ม dead field/public test hook หรือดึง header/auth
เข้า SheetLib/GViz path จึง **ห้าม** ต่อ resolver เข้า constructor, read หรือ SheetLib write ก่อน §2.9

**2.4 serialization + `valueInputOption`**
- object/array (`customer`, `adjustments`, `Address`) ต้อง `JSON.stringify` — SheetLib ทำให้อยู่
  (`invoice.contract.ts:59`)
- คอลัมน์ที่ไม่ส่ง → `''` **ห้ามส่ง `null`** (Values API ข้าม null แล้วคอลัมน์เลื่อน)
- append ประกอบ array เต็มความกว้างตาม header map เสมอ
- **`USER_ENTERED` ไม่ใช่ `RAW`** — `Appointment.json` ระบุว่า `AppointmentDate` **ตั้งใจเก็บเป็น
  Sheets date จริง** เพื่อให้ GViz คืนค่า localized และ query ด้วยฟังก์ชันวันที่ได้
  → `RAW` จะกลายเป็น text แล้ว **GViz date filter พังทันที**
- แต่ `USER_ENTERED` ทั้งแถวก็อันตรายฝั่งตรงข้าม (เบอร์ขึ้นต้น 0, ค่าขึ้นต้น `=`/`+`/`-`
  กลายเป็นสูตร) → **policy ต่อคอลัมน์** ประกาศข้าง row schema ของแต่ละ sheet

**2.5 error classification ตาม phase — 3 สถานะภายใน, public เหลือ 2 เหมือนเดิม**

| phase | internal | public `certainty` |
|---|---|---|
| ก่อนยิง write (auth/header/key lookup/serialization fail) | `WriteRejectedError` | `rejected` |
| write ตอบ 4xx authoritative (400/403/404/409) | `WriteRejectedError` | `rejected` |
| ไม่มีคำตอบ authoritative (5xx/network/timeout) | `WriteTransportError` | `unknown` |
| **2xx แล้วแต่อ่าน response ไม่ได้** (ไม่มี `updates`, row count ไม่ตรง, follow-up GET พัง) | `WriteCommittedUnreadableError` | `unknown` |

แถวสุดท้ายสำคัญ — **เขียนสำเร็จแน่นอนแล้ว** แค่อ่านผลกลับไม่ได้ ของเดิมก็แยกไว้
(`gsheet.repository.ts:379`) message ต้องบอกชัดว่า **ห้าม retry**
`classifyWriteFailure` (`invoice.service.ts:85-96`) classify error ที่ไม่รู้จักเป็น `unknown` เสมอ
→ error ก่อนยิง write **ต้อง throw คลาสที่ถูกต้อง** ไม่งั้นถูกรายงานผิด

**retry:** 429/401 สังเกตได้หลังยิงเท่านั้น → **ไม่ auto-retry write ใดๆ** retry เฉพาะ token acquisition

**2.6 response ต้องเป็นแถวสมบูรณ์**
- append → `updates.updatedData.values` ⚠ Sheets **ตัด trailing blank ทิ้ง** → pad เต็มความกว้าง
  header แล้วแปลงกลับเป็น `null` ตาม blank semantics เดิม ระบุ `responseValueRenderOption` ให้ชัด
- update → **ไม่ต้องใช้** `includeValuesInResponse` เพราะ `updatedRange` ของ batchUpdate คือ range
  เฉพาะ cell ที่ patch → ประกอบ range `A<row>:<lastCol><row>` เอง แล้ว **ตรวจว่า PK ของแถวที่อ่านกลับ
  ตรงกับ key ที่ขอ** ถ้าไม่ตรงแปลว่าแถวขยับ → error ไม่ใช่คืนแถวผิดเงียบๆ

**2.7 timestamp ต่อ sheet**
- `formatBangkokTimestamp` reuse ได้ (ตรงกับ `_now()` ของ SheetLib) ย้ายไป `server/shared/utils/`
- Invoice `created_at` ที่ SheetLib เคย stamp → stamp ใน `InvoiceService` ด้วยตัวเดียวกัน
- **OrderForm ต้อง stamp `updated_at`** — วันนี้ SheetLib stamp ให้อยู่ ไม่ทำ behavior เปลี่ยน
- ⚠ `Invoice.json` บรรยาย `created_at` ว่า ISO-8601 แต่ของจริงเป็น `YYYY-MM-DD HH:mm:ss` ไม่มี
  offset → **แก้ registry ให้ตรงความจริง** (ไม่เปลี่ยน format จะได้ไม่ต้อง backfill)

**2.8 keyed update — ยอมรับ race (ตัดสินใจแล้ว)**

`update()` = อ่าน key column → หา row index → เขียน คือ TOCTOU วันนี้ SheetLib ทำใต้ `LockService`
(`SheetService.js:171`) จึงทนต่อแถวขยับ นี่คือจุดเดียวที่ถอยหลังจริง และเจ้าของโปรเจกต์เลือกยอมรับ
— ไม่ทำ verification read เพิ่ม, ไม่ทำ CAS, ไม่ตั้ง protected range

**บังคับ:** เขียน doc comment บน `update()` ว่าเป็น **ความเสี่ยงที่ยอมรับโดยตั้งใจ ไม่ใช่การมองข้าม**
พร้อมทางแก้ถ้าเกิดจริง ไม่งั้น agent ตัวถัดไปจะนึกว่าเป็นบั๊กแล้วไปแก้เอง
(หมายเหตุ: การตรวจ PK ใน 2.6 จับได้เฉพาะกรณีแถวขยับ *ระหว่าง* write กับ read-back
ไม่ได้แก้ race ช่วง lookup→write)

**2.9 ลำดับสลับ transport** — `OrderForm` (blast radius ต่ำสุด แต่**พิสูจน์ได้แค่ keyed PATCH**)
→ `Appointments` (ตัวจริงที่พิสูจน์ append + JSON cell + date + Bangkok timestamp + CRUD response
เต็ม) → `Invoices`/`InvoiceItems` (batchAppend + partial-persistence outcomes)

**2.10 ลบของเก่า** — SheetLib write path, `write-errors.ts` alias ชื่อเดิม, env `APPSCRIPT_URL` /
`APPSCRIPT_GATEWAY_URL` / `APPSCRIPT_APPOINTMENT_URL`
**ห้ามลบ `APPSCRIPT_INVOICE_VIEW_SYNC_URL`**

---

## Tests

ย้ายตาม subject → `tests/server/unit/sheets/<Sheet>/` (`appointment.transformer`,
`appointment.transport`, `appointment-write.fixtures`, `orders.transformer`,
`orderForm.repository`, `invoice.repository`) ที่เหลือแก้แค่ import path

**Phase 1 — ต้องเขียน *ก่อน* ย้าย ไม่ใช่หลัง** (characterization test ที่ปักพฤติกรรมปัจจุบันไว้):
- `column-order.dry-test.ts` ต่อ sheet — ปัก `deriveGVizColumns(rowSchema)` ให้ได้ column letter
  ที่คาดไว้ทุก field โดยเฉพาะ **Customers และ Appointments** ที่วันนี้แทบไม่มี test ปักไว้
  นี่คือด่านเดียวที่จับ key order สลับได้ (typecheck จับไม่ได้)
- `service-wiring.dry-test.ts` — เรียกผ่าน service จริง (ไม่ใช่เรียก transformer ตรงๆ) แล้วยืนยันว่า
  OrdersView ยังได้ `items` ที่ parse แล้ว, วันที่ normalize แล้ว, quantity เป็น number
  และ Appointments ยัง flatten `Address` snapshot ถูก
- `sheet.repository.dry-test.ts` — DB shape เข้า-ออก ไม่มี API field รั่วเข้ามา
- `base-crud-mapping.dry-test.ts` — mapping + transformer ที่ย้ายขึ้นมาให้ผลเท่าเดิม
  ครอบ `where` / `select` / `search.fields` / `sort.field` / `pagination` (ต้องไม่ถูกแปลง)
  และ `fromId` fold `id` ถูกตัว

Phase 2 เพิ่มใต้ `tests/server/unit/shared/repositories/`:
- `sheets-api.client.dry-test.ts` — 4xx→rejected, 5xx/timeout→transport, 2xx ที่ body ไม่มี
  `updates`→committed-unreadable, row count ไม่ตรง→committed-unreadable
- `write-phase-classification.dry-test.ts` — auth/header/key-lookup fail ต้องได้ `rejected` **ไม่ใช่** `unknown`
- `header-map.dry-test.ts` — คอลัมน์สลับตำแหน่งยังเขียนถูกช่อง, header ซ้ำ/ว่าง/ไม่มี PK → throw,
  คอลัมน์เกินที่ schema ไม่รู้จัก → ผ่าน
- `value-serialization.dry-test.ts` — object/array → JSON, ไม่ส่ง → `''`, `valueInputOption` ต่อคอลัมน์
- `response-shape.dry-test.ts` — trailing blank ที่ถูกตัด ต้อง pad และคืน `null` ตาม semantics เดิม
- `row-identity.dry-test.ts` — follow-up GET ที่ PK ไม่ตรง ต้อง error ไม่ใช่คืนแถวผิด
- `google-auth.dry-test.ts` — token cache, expiry, **concurrent refresh ไม่ยิงซ้อน**
- อัปเดต `invoice.service.dry-test.ts` — `certainty` ยังแยกถูกกับ error 3 คลาส

⚠ `USER_ENTERED` vs date/phone **mock ไม่พอ** ต้องยิงกับ spreadsheet ทิ้งได้จริงแล้วอ่านกลับ
ผ่าน **GViz** เพื่อยืนยันว่า `AppointmentDate` ยัง filter ด้วยฟังก์ชันวันที่ได้

---

## เอกสาร — บังคับ

ทั้งสองไฟล์เขียนกฎที่ห้าม refactor นี้ไว้ตรงๆ ถ้าไม่แก้ agent ตัวถัดไปจะ revert:
- **`AGENTS.md` (root) `:33-45`** — บังคับ `ModuleContract` + module-owned repository + SheetLib
- **`api/CLAUDE.md`** — Project Structure, Complex modules, Architecture Rules, Testing

เนื้อหาใหม่: sheet เป็นเจ้าของ repository ไม่ใช่ module; repository ไม่รู้จัก API contract;
mapping อยู่ที่ module; writes = Sheets API, reads = GViz, Apps Script เหลือเฉพาะ view recompute;
คงข้อห้าม central registry/barrel; เพิ่ม `tests/server/unit/sheets/`

---

## Verification

workspace เป็น PowerShell — คำสั่งต้องรันได้บน pwsh

```powershell
npm run typecheck:api
```

```powershell
Get-ChildItem -Recurse tests/server -Filter *.dry-test.ts | ForEach-Object { Write-Host "--- $($_.FullName)"; npx tsx $_.FullName; if ($LASTEXITCODE -ne 0) { throw "FAILED: $($_.Name)" } }
```

```powershell
npm run build
```

```powershell
git diff --check
```

สามคำสั่งแรกจับ `.js` extension ที่หายไม่ได้ — ใช้ Grep tool หา relative import ที่ไม่ลงท้าย `.js`
ใต้ `server/`, `api/`, `tests/server/` เป็นด่านก่อน

deploy: push ขึ้น branch ให้ GitHub integration (`vercel deploy` จาก CLI โดน git-identity block)
⚠ **branch deploy ได้ preview URL ไม่ใช่ production alias** → curl ที่ preview URL ของ deployment
นั้นก่อน แล้วค่อย promote และ curl ซ้ำที่ prod alias

ทุกเส้นต้อง `200` + envelope `{ data, meta }`: `/api/customers?perPage=1`, `/api/orders?perPage=1`,
`/api/appointments?perPage=1`, `/api/customer-packages?perPage=1`, `/api/invoices?perPage=1`,
`/api/invoices/<invoice-number-จริง>`

**write path ทดสอบมือ ไม่อัตโนมัติ** — ก่อนแตะ production sheet ให้ทดสอบ append/update/
serialization/error paths กับ **spreadsheet ทิ้งได้** ก่อน แล้วจึง:
1. OrderForm update — order ที่ทิ้งได้ ตรวจ `invoice_id`/`updated_by`/`updated_at` ลงถูกคอลัมน์
   และคอลัมน์อื่นไม่ถูกแตะ
2. Appointment create + patch — `Address` JSON, `AppointmentDate` ยัง filter ได้ผ่าน GViz,
   response เต็มแถว
3. Invoice create — เขียน 4 ชีต ตรวจครบ + `sku` ต้องว่างไม่ใช่คอลัมน์เลื่อน

บันทึกผลลง `docs/sheets-api-migration-smoke-checklist.md` (ตามแบบ
`docs/invoice-refactor-smoke-checklist.md` ที่มีอยู่แล้ว)

---

## สิ่งที่ *ไม่* ทำ

- ไม่ย้าย read ไป Sheets API (GViz อยู่ต่อ — Supabase คือปลายทาง)
- **ไม่แตะ Customers write** (M3) — read ย้ายเข้า `server/sheets/Customers/` ได้ปกติ
  แต่ **route POST/PATCH ต้องคงไว้ให้ fail เหมือนเดิม** ห้ามถอดออก (จะกลายเป็น behavior change)
  การซ่อม M2 ให้ถูกต้องคือการ implement flow ของ `appscript/customer-sheet/API.js` ใหม่ — งานแยก
- ไม่ทำ multi-sheet transaction สำหรับ invoice create — วันนี้ก็ไม่มี และ
  `invoice.service.ts:236-306` มี outcome kind รับมือ partial failure อยู่แล้ว
  (แก้ความเข้าใจผิด: `values:batchUpdate` **ไม่ใช่**ทางไปสู่ atomic multi-tab append เพราะต้อง
  ระบุ range ล่วงหน้าและไม่มี `INSERT_ROWS`)
- ไม่แก้ uniqueness/idempotency ของ append — `invoice_number` มาจาก client และ id 8 hex ไม่เช็คชน
  ทั้งคู่เป็นแบบนี้อยู่แล้ว direct append ไม่ได้ทำแย่ลงและไม่ได้ช่วย
- ไม่แตะ `certainty` / outcome kinds บน public API contract

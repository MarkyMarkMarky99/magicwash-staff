# Handoff — Phase 2 (จบแล้ว)

เขียนเมื่อ 2026-08-09 ตอนปิด Phase 1 · merge เข้า main และขึ้น production 2026-08-11
(`main` = `9c96c01`, merge commit `ee4ed38`) · อัปเดต 2026-08-14 — ตรวจสถานะเทียบโค้ดจริง
ทั้งฉบับ แก้ตารางที่ตกยุค และลบของค้าง (ดูหมวด "cleanup 2026-08-14") · **อัปเดตล่าสุด
2026-08-15 — ปิดงาน timestamp ของ Appointments พร้อมแก้ข้อมูลจริง 373 เซลล์**

# ✅ Phase 2 จบครบแล้ว ทั้งโค้ดและการพิสูจน์

ทั้ง 4 ชีตที่เขียนได้ (OrderForm, Appointments, Invoices, InvoiceItems) ย้ายจาก Apps Script
มา Sheets API และพิสูจน์กับ Google จริงครบทุกชีต · SheetLib write path ถูกลบทิ้งแล้ว
(`154445b`) เหลือทางเขียนทางเดียวทั้งระบบ · `certainty` ของ appointments (`78efaad`) ·
ผ่าน preview ทั้งอ่านและเขียนก่อน merge · **branch ทั้งหมดลบแล้ว เหลือ `main` อย่างเดียว**

**ไม่มีตัวบล็อกของ Phase 2 เหลืออยู่** — งานที่ค้างเป็นงานเลือกทำ อยู่ที่หมวด 1c

> 🔴 **แต่มีตัวบล็อกก่อนเปิดใช้กับผู้ใช้จริง ซึ่งไม่ใช่ของ Phase 2** (ยืนยันกับโค้ด 2026-08-14):
> 1. **API ไม่มี authentication เลย** — `api-gateway.ts:25-51` dispatch ต่อโดยไม่ตรวจ token
>    ⇒ ทุก write route เปิดสาธารณะ · รายละเอียดหมวดท้ายไฟล์
> 2. **invoice create ไม่ idempotent** — `invoice.service.ts:396` เริ่ม `batchAppend()` โดยไม่มี
>    pre-flight ตรวจ `invoiceNumber`/`OrderForm.invoice_id` และ `batchAppend()` ไม่มี
>    duplicate-key guard (ต่างจาก `append()` เดี่ยว) ⇒ retry แล้วได้ line item ซ้ำ
> 3. **อัปโหลดรูปยัง bypass backend** — `src/api/photos.js:3` ยิง Apps Script ตรงจาก browser

> 🔴 **dry-test suite แดงอยู่บน `main` — 4 ไฟล์** (ตรวจ 2026-08-15 โดย checkout `main` สะอาด
> แล้วรันเอง จึงไม่ใช่ผลจาก branch งานใหม่) ⇒ ประโยค "dry-test 38/38 ✅" ตอน merge **ตกยุคแล้ว**
> `appointment.transport` · `service-wiring` · `invoice-api.workflow` · `invoice-sheetlib.workflow`
> ทั้งสี่พังเหมือนกันหมดที่ `WriteTransportError: readColumn did not receive a response` —
> `rejectDuplicateAppendKey` เรียก `findRowNumberByKey` → `readColumn` เพิ่มมาทีหลัง แต่ mock
> `fetch` ในเทสต์ไม่ได้ stub GET ตัวนั้น · **ยังไม่มีใครแก้ ไม่ได้อยู่ใน scope งานไหน**

> ⚠️ **เอกสารฉบับนี้คือสถานะจริง** เอกสารอื่นใน `docs/` เป็นบันทึกประวัติศาสตร์ ดูรายชื่อ
> ท้ายหมวด 1c ก่อนเชื่ออะไรในนั้น

**นี่คือครั้งแรกที่ `GOOGLE_SERVICE_ACCOUNT_KEY` ฝั่ง server ถูกใช้เขียนจริง** — เจอปัญหาจริง 1 ข้อ
ระหว่างทาง (env var scope บน Vercel) แก้แล้ว รายละเอียดอยู่หมวด 2

---

## 1. อยู่ตรงไหนแล้ว

`refactor/sheet-layer` — **merge เข้า `main` และขึ้น production แล้ว (2026-08-11, `ee4ed38`)
branch ถูกลบแล้ว** · รายละเอียดการ merge อยู่หมวด "merge เข้า main และขึ้น production แล้ว"

> ย่อหน้าถัดไปเป็นบันทึกตอน Phase 1 จบ เก็บไว้เพราะสรุปสถาปัตยกรรมที่ได้มา

Phase 1 จบครบ 8 ขั้น ได้สถาปัตยกรรม: 1 repository ต่อ 1 physical sheet ใต้ `server/sheets/`,
repository ไม่รู้จัก API contract, DB↔API mapping อยู่ที่ module, `primaryKey` เป็นชื่อคอลัมน์ DB จริง,
module→module edge เป็นศูนย์ และ stack เก่าถูกลบทิ้ง (−3,900 บรรทัด)

**การอ่านยืนยันบน production จริงแล้วครบ 5 module** — ยิงผ่าน preview deploy จริง ไม่ใช่ stub

### ✅ ตัวบล็อกก่อน merge — ปิดไปแล้วตอน §2.7 (2026-08-09)

เจ้าของกดผ่าน staff UI จริงและตรวจครบทุกข้อแล้ว รายละเอียดผลอยู่ในหมวด 1b
**ข้อความด้านล่างเก็บไว้เป็นบันทึกว่าตรวจอะไรไปบ้าง ไม่ใช่งานค้าง**

**invoice create ไม่เคยรันจริงเลยหลังย้ายมา stack ใหม่** มันเขียน 4 ชีต ไม่ idempotent
เทสต์ครอบได้แค่ผ่าน stub ต้องกดผ่าน staff UI 1 ครั้งด้วย order ที่ทิ้งได้ แล้วเปิดชีตตรวจ:

- `Invoices.customer` / `.adjustments` เป็น JSON string ที่ parse ได้ **ไม่ใช่ `[object Object]`**
- `InvoiceItems` แถวครบ และ `sku` ว่าง (ไม่ใช่คอลัมน์เลื่อน)
- `OrderForm.invoice_id` ถูกเขียน

จุดเสี่ยงคือ §1.7 ย้ายการ serialize มาไว้ที่ service (เดิม SheetLib ทำให้) — mutation test
ชี้ว่านี่คือจุดที่พังแล้วเงียบที่สุดในระบบ

---

## 1b. Phase 2 เดินไปแล้ว 8 ขั้น (อัปเดต 2026-08-09)

| ขั้น | สถานะ | commit |
|---|---|---|
| §2.0 แยก `PORTAL_SPREADSHEET_ID` | ✅ | `93329fe` |
| §2.1 google-auth (JWT RS256 → access token) | ✅ | `749393e` |
| §2.2 `sheets-api.client.ts` | ✅ | `1e28213` |
| §2.2 append endpoint fix | ✅ | `07c8d55` |
| §2.3 header-map addressing | ✅ | `0d1a975` |
| §2.4 serialization + `valueInputOption` | ✅ | `d83f480` |
| §2.5 error classification ตาม phase | ✅ | `bedc81e` |
| §2.6 response ต้องเป็นแถวสมบูรณ์ | ✅ | `0e0ca23` |
| §2.7 timestamp ต่อ sheet (โค้ด) | ✅ | `3f9a178` |
| §2.7 registry description fix | ✅ **เจ้าของโปรเจกต์ทำเอง** | |
| §2.7 smoke test (invoice create + timestamp ใหม่ รวมรอบเดียว) | ✅ | |
| §2.7 follow-up — Invoices/OrderForm timestamps ประกาศ `USER_ENTERED` (ดูหมวด "การตัดสินใจ" ด้านล่าง) | ✅ | `9f53013` |
| §2.8 keyed update — ยอมรับ race + `sheet-row-lookup.ts` | ✅ | `037a4b8` |
| prerequisite ก่อน §2.9 (env + parity 3 ชีต + ด่านกัน portal) | ✅ | `2f9e6ac` |
| §2.9 test charter (`test-pipeline` Phase A) | ✅ | `29384c1` `e4341f3` |
| §2.9 **stage 1 — OrderForm keyed PATCH ผ่าน Sheets API** | ✅ **ผ่าน smoke test จริงแล้ว (2026-08-10)** | `e7f75df` + logging `1f00893` |
| §2.9 stage 2A — `appendThroughSheetsApi` (ไม่แตะ contract ใด) | ✅ | `ef521d8` |
| §2.9 stage 2B — Appointments opt-in `writeTransport: 'sheets-api'` | ✅ **โค้ดเสร็จ ยังไม่ผ่าน smoke test** | `ddc1323` |
| §2.9 stage 2C — smoke test จริง (เจ้าของกดผ่าน staff UI) | ✅ **ผ่านครบ 5 ข้อ (2026-08-11)** | |
| §2.9 stage 3A — `batchAppendThroughSheetsApi` (ไม่แตะ contract ใด) | ✅ | `21a53ef` |
| §2.9 stage 3B — Invoices + InvoiceItems opt-in | ✅ | `0927dd4` |
| merge stage 3 กลับเข้า `refactor/sheet-layer` + ด่านครบ 4 ตัว | ✅ | `d52fd99` |
| preview deploy ครั้งแรก — ฝั่งอ่าน 4 endpoint ได้ 200 | ✅ | `d52fd99` |
| §2.9 stage 3C — smoke test จริง (สร้าง invoice) | ✅ **ผ่าน 12/12 (2026-08-11)** `INV260872306305` บน local dev | |
| งานแยกหลัง §2.9 — จัดระเบียบ timestamp ทุกชีตเป็น datetime | ✅ **Appointments ปิดแล้ว (2026-08-15)** แก้ข้อมูลจริง 373 เซลล์ · `Invoices`/`OrderForm` ยังไม่ได้ตรวจอาการเดียวกัน (เจ้าของสั่งไม่ต้องทำ) | `9f53013` + ดูหมวดล่าง |
| งานแยกหลัง §2.9 — `certainty` ของ Appointments (แก้ API contract) | ✅ | `78efaad` |
| §2.10 ลบ SheetLib write path | ✅ | `154445b` |

**§2.2/§2.3 ต่อเข้า `SheetRepository` แล้วตั้งแต่ §2.9 stage 1 (`e7f75df`)** และหลัง §2.10
(`154445b`) **ไม่มี dual path เหลือแล้ว** — `writeTransport` / `scriptUrl` หายไปจากทั้ง repo
(grep ยืนยัน 2026-08-14 ว่าเหลือศูนย์ที่ใน `server/`) `SheetContract` ไม่มีฟิลด์นี้อีกต่อไป
(`sheet-contract.ts:21-42`) และ append / batchAppend / update วิ่งเข้า Sheets API ทั้งหมด
(`sheet.repository.ts:141` `:328` `:435`)

⇒ **ทั้ง 4 ชีตที่เขียนได้ใช้ทางเดียวกันหมดแล้ว** ย่อหน้าเก่าที่เคยเขียนว่า "วันนี้มี OrderForm
ชีตเดียวที่ opt-in ... เป็น dual path ต่อชีต" **ตกยุคแล้ว ลบทิ้ง** · Apps Script ที่ยังเหลือใน
ระบบมีอย่างเดียวคือ sync `InvoicesView` (`invoice-view-sync-client.ts:31-40`) ซึ่ง
**ไม่ใช่การเขียนแถวลงชีต**

### ของที่ §2.2 จงใจเลื่อนไป — มี comment กำกับในโค้ดแล้ว

- header-map cache + ความกว้าง header ที่แน่นอน → §2.3 (เสร็จแล้ว) / §2.6
- full-row GET หลัง update + verify primary key → §2.6
- serialize object/array และ `valueInputOption` ต่อคอลัมน์ → §2.4 (เสร็จแล้ว)
  (เทสต์ที่ยิงสำเร็จใช้ `USER_ENTERED` แล้ว เพราะ `RAW` จะทำให้ GViz filter วันที่พัง)

### §2.4 / §2.5 เสร็จแล้ว และต่อเข้า `SheetRepository` แล้วบางส่วนที่ stage 1

§2.4 (`d83f480`) ส่งมอบ `SheetContract.valueInput` + `sheet-value-serializer.ts`
(`serializeCellValue`, `buildRowValues`, `resolveValueInputOption`,
`resolveRowValueInputOptions`) พร้อม policy ประกาศครบ 4 sheet ที่เขียนจริง

`serializeCellValue` + `resolveValueInputOption` **ถูกเรียกจริงแล้ว** ใน `updateThroughSheetsApi`
(`sheet.repository.ts:264-287`) แต่ **`buildRowValues` / `resolveRowValueInputOptions` ยังไม่มี
caller** เพราะเป็นของฝั่ง append ซึ่ง `append()` ยังไม่มีสาขา Sheets API ⇒ **นั่นคืองานของ stage 2**

§2.5 (`bedc81e`) พบว่า **ทำไปแล้วจริงตั้งแต่ §2.2** — `sheets-api.client.ts` classify ครบทุก
phase ตามตาราง §2.5 อยู่แล้ว เหลือแค่เทสต์ 2 เคสที่ implement ไว้แต่ไม่มี dry-test คลุม (ปิด
ไปแล้ว ไม่มีโค้ด production เปลี่ยน) รายละเอียดอยู่ที่ implementation note ใต้ §2.4/§2.5 ใน
`docs/database-layer-sheets-api-refactor-plan.md`

§2.6 (`0e0ca23`) มีโค้ด production จริง 4 ชิ้น: `appendRows` รับ `knownWidth?` (Part A),
`buildRowRange` / `parseRowValues` / `readRange` / `sheet-row-identity.ts`'s
`verifyRowIdentity` + `WriteRowIdentityMismatchError` (Part B) — รายละเอียดที่ implementation
note ใต้ §2.6 ในแผน

**Part B ต่อเข้า `updateThroughSheetsApi` แล้ว** (`buildRowRange` / `readRange` / `parseRowValues` /
`verifyRowIdentity` ที่ `sheet.repository.ts:291-320`) ส่วน **Part A (`appendRows` + `knownWidth`)
ยังไม่มี caller** เพราะ `append()` ยังไม่มีสาขา Sheets API — งานของ stage 2

**ครั้งแรกที่ `luna-pipeline` เจอ edge case ของตัวเอง** — รอบ §2.6 subagent จบ turn ตัวเองก่อน
งานเสร็จจริง (อ้างว่า "ตั้ง background monitor รอ notification" ทั้งที่ subagent ไม่มีช่องทาง
รับ notification แบบนั้น) ต้องส่งข้อความสั่งให้กลับไปทำต่อ รอบสองมันแก้ปัญหาได้เองถูกต้อง —
เช็ค `git status` ก่อน, รัน verify เองแทนที่จะเชื่อผลจาก codex session ที่ยังไม่เสถียร (เจอ
`CreateProcessAsUserW 1312` ระหว่างทางอีกแต่ฟื้นเองได้) แล้ว mutation-test ครบทั้ง 4 guard จริง
⇒ **ต้องอ่าน result ของ `luna-pipeline` ก่อนเชื่อว่า "เสร็จ" เสมอ** ถ้ารายงานไม่มี verification
output จริงและไม่มี grok verdict ให้ resume สั่งทำต่อ อย่าเพิ่งรายงานผู้ใช้ว่าเสร็จ

**§2.7 คือครั้งแรกที่ตัวแผนเองเปลี่ยนพฤติกรรมบน live path** ต่างจาก §2.2–2.6 ที่เป็น building
block เฉยๆ ทั้งหมด แจ้ง `luna-pipeline` ชัดเจนในตัว brief ว่างานนี้ต่างออกไป (ระวังเป็นพิเศษ)
ผลคือมันจับบั๊กตัวเองได้ก่อนส่ง grok (`fixedNow` ไม่ได้ประกาศ) และตอน grok รีวิวก็เจอ regression
จริงในไฟล์เทสต์ที่ brief ไม่ได้เอ่ยถึงเลย (`invoice-sheetlib.workflow.dry-test.ts` มี strict
`deepEqual` ที่ไม่รู้จัก field ใหม่) ⇒ **ยืนยันอีกครั้งว่าทำไมต้องให้ grok ตรวจ diff กว้างกว่าที่
brief เอ่ยชื่อไฟล์ไว้** — brief เขียนได้ดีแค่ไหนก็ยังไล่ผลกระทบข้ามไฟล์ไม่ครบ

### §2.7 smoke test เจอเรื่องจริง — Invoices/OrderForm timestamp กลายเป็น real Sheets date

เจ้าของกดผ่าน staff UI จริง (`order_id=2400fb5c` → `invoiceNumber=INV260851685113`) ปิด
blocker เดิมจาก Phase 1 ที่ค้างมาตั้งแต่ก่อนเปิด Phase 2 ได้สำเร็จ — `customer`/`adjustments`
เป็น JSON parse ได้, `InvoiceItems.sku` ว่างถูกตำแหน่ง, `OrderForm.invoice_id` เขียนถูก

แต่ยิง GViz ตรงเข้าไปเช็ค (`curl` ตรงไปที่ `.../gviz/tq`, ไม่ผ่านแอป) เจอว่า
**`Invoices.created_at` กับ `OrderForm.updated_at` ถูก Google Sheets auto-coerce เป็น
datetime cell จริง** (GViz คืน `type: "datetime"` ไม่ใช่ `string` ทั้งที่โค้ดส่ง plain-text
string ไป) — เกิดเพราะคอลัมน์ในชีตจริงไม่ได้ format เป็น Plain Text ตัวเลขที่**แสดงผล**ในชีต
(`.f` value) ยังถูกต้องเป๊ะ (`2026-08-09 23:15:21`) ไม่มีอะไรผิดตา แต่ type ที่เก็บจริงต่างจาก
ที่ contract ประกาศไว้ (`z.string()`)

ไล่ผลกระทบจริงพบว่า `gviz-reader.ts` ดึงค่าจาก `.v` เท่านั้น ไม่เคยใช้ `.f` และไม่มี parser
สำหรับ `Date(y,m,d,h,mi,s)` เลย — ถ้ามีอะไรอ่าน field นี้กลับมาจะได้ string ขยะ ไม่ crash
เพราะ policy ของโปรเจกต์คือ **reads ไม่ validate type กับ Zod** (`api/CLAUDE.md`) แต่ตอนนี้
รอดอยู่ได้เพราะ field นี้ไม่ถูก expose ผ่าน `/api/invoices`/`/api/orders` เลยในวันนี้

**เจ้าของโปรเจกต์พิจารณาแล้วตัดสินใจเก็บพฤติกรรม datetime นี้ไว้ตั้งใจ** (ไม่ใช่แก้กลับเป็น
Plain Text) เพราะมีประโยชน์กับคนที่เปิดชีตดู/กรองข้อมูลตรงๆ (อาจรวมถึงระบบอื่นที่อ่านชีตนี้ด้วย)
⇒ อัปเดตให้ตรงกับความตั้งใจ:
- **registry** (`Invoice.json`/`OrderForm.json`) — แก้ description ให้บอกว่าเป็น real
  Sheets date ตั้งใจ (แก้ตรงเองโดย Claude หลัก ไม่ใช่ subagent — ทั้งสองรอบ)
- **`valueInput`** ใน `Invoices.db-contract.ts`/`OrderForm.db-contract.ts` — เปลี่ยนจาก `{}`
  เป็น `USER_ENTERED` (`created_at`/`updated_at`/`deleted_at` และ `updated_at` ตามลำดับ)
  commit `9f53013` — **สำคัญเพราะ §2.9** ถ้าไม่ล็อก policy ไว้ตอนนี้ พอสลับ transport เป็น
  Sheets API จริง โค้ดจะส่ง `RAW` ตามค่า default เดิม แล้วพฤติกรรมจะเปลี่ยนจาก datetime (แบบ
  วันนี้) เป็น plain text แบบเงียบๆ โดยไม่ตั้งใจ
- Appointments' `CreatedAt`/`UpdatedAt`/`DeletedAt` — **§2.7 ไม่แตะ** แต่ข้ออ้างเดิมที่ว่า
  "ต้องเป็น Plain Text และการตัดสินใจนั้นยังยืนอยู่" **ไม่จริง** (ตรวจ 2026-08-10) ของจริงคือ:

  | คอลัมน์ | type ที่เก็บจริง | จำนวนแถว |
  |---|---|---|
  | `CreatedAt` | string | 20 |
  | `UpdatedAt` | **datetime** | 15 |
  | `DeletedAt` | ตัดสินไม่ได้ (ว่างหมด) | 0 |

  ⇒ ข้อสรุปตอนนั้นคือ *"พฤติกรรมถูกกำหนดโดย **cell format ของแต่ละคอลัมน์** ไม่ใช่โดย option
  ตอนเขียน"* — 🔴 **ข้อสรุปนี้ผิด แก้แล้ว 2026-08-15 ดูหมวด "รากของปัญหา timestamp" ด้านล่าง**
  ตัวเลข 20/15 ในตารางก็ผิด เพราะสคริปต์ตรวจใช้ `limit 20` จำนวนจริงคือ 364 แถว
  ⇒ **ตรวจซ้ำได้ด้วย `tests/server/integration/raw-column-type-check.ts`** (ระวัง `limit 20`)
  ⇒ คำตัดสิน 3.5 (2026-08-10) กำหนดปลายทางเป็น datetime จริงทุกชีต แต่ **ทำหลัง §2.9**
  รายละเอียดอยู่หมวด 3 ของ [`session-2026-08-10-overnight.md`](./session-2026-08-10-overnight.md)

### ✅ รากของปัญหา timestamp — locale ไม่ใช่ cell format (2026-08-15)

**สาเหตุจริง:** ไฟล์ MagicwashAppointment ตั้ง locale เป็น **`en_US`** แต่ pipeline เก่าเขียน
timestamp เป็น `dd/MM/yyyy HH:mm:ss` ⇒ Google อ่านช่องแรกเป็น *เดือน* ผลคือแตกเป็นสองกรณี:

| วันที่ในค่าเดิม | Google ทำอะไร | ผลที่เห็น |
|---|---|---|
| > 12 (เช่น `27/03/2026`) | เดือน 27 ไม่มีจริง parse ไม่ผ่าน | ค้างเป็น **text** — มองเห็นได้ |
| ≤ 12 (เช่น `03/08/2026`) | parse ผ่าน แต่**สลับวันกับเดือน** | เป็น datetime จริงที่ **วันที่ผิด** — มองไม่เห็น |

🔴 **กรณีที่สองอันตรายกว่ามาก** — ค่าดูปกติทุกอย่าง ไม่มีอะไรฟ้อง จับได้เพราะชีตเป็น append-only
ทำให้ `CreatedAt` ต้องไล่ขึ้นตามเลขแถว แล้วพบค่าที่ตกลำดับซึ่งพอสลับวัน/เดือนแล้วเข้าที่พอดี
**รวมทั้งเวลาในวันด้วย** (เช่นแถว 342 `2026-03-08 07:34:07` → `2026-08-03 07:34:07` ซึ่ง 07:34
มาก่อน 09:47 ของแถวถัดไป) — ความบังเอิญระดับวินาทีแบบนี้เป็นไปไม่ได้

**cell format ไม่เคยเป็นปัญหา** — คอลัมน์ K ตั้ง `DATE_TIME` (`yyyy-mm-dd hh:mm:ss`) ไว้อยู่แล้ว
format ไม่มีผลกับค่าที่เป็น text จึงไม่ต้องแก้อะไรในชีต

**บทเรียน:** GViz คืน type ระดับ **คอลัมน์** ไม่ใช่ระดับเซลล์ ⇒ คอลัมน์ที่ปนกันจะรายงานเป็น
`string` ทั้งคอลัมน์ นี่คือเหตุผลที่ smoke test §2.9 stage 2C บันทึกว่า `APPT-1ae7e6ef` มี
`CreatedAt` เป็น "string" ทั้งที่เซลล์นั้นเป็น datetime จริง — **อ่าน `userEnteredValue` ผ่าน
`spreadsheets.get?includeGridData=true` เท่านั้นถึงจะรู้ว่าเซลล์เก็บอะไรจริง** (`stringValue`
vs `numberValue`)

### ✅ migration ที่ลงจริงกับชีตลูกค้า (2026-08-15)

สแกนทั้ง 364 แถว (ไม่ใช่ 20 แถวแรก) แล้วแก้ **373 เซลล์** ผ่าน `values:batchUpdate` 4 batch
ด้วย `USER_ENTERED` ทีละเซลล์ (`Appointments!K42` ไม่ใช่ range คร่อม):

| | `CreatedAt` (K) | `UpdatedAt` (L) |
|---|---|---|
| text ยังไม่ถูก parse → แปลงเป็น `yyyy-MM-dd` | 165 | 13 |
| **datetime ที่วันเดือนสลับ → สลับกลับ** | **152** | 43 |
| ถูกต้องอยู่แล้ว ไม่แตะ | 47 | 26 |
| ว่างจริง ไม่แตะ | 0 | 282 |

ผลหลังแก้: GViz รายงานทั้งสองคอลัมน์เป็น `datetime` · เหลือ text 0 เซลล์ · 282 เซลล์ว่างยังว่างจริง
(ไม่ได้กลายเป็น empty string ซึ่งเป็นบั๊กชนิดเดียวกับที่กำลังแก้)

**วิธีตัดสินว่าเซลล์ไหนสลับ** ไม่ได้ใช้ลำดับแถวอย่างเดียว:
- `CreatedAt` — ใช้กฎ "สร้างเรคคอร์ดหลังวันนัดไปแล้วไม่ได้" (≤ สิ้นวัน `AppointmentDate`)
  ตัดได้ 0 เคสกำกวม · `AppointmentDate` เชื่อได้เพราะมีค่าอย่าง `2026-03-29` เก็บเป็น date จริง
  ถ้าคอลัมน์นั้นเคยถูกเขียนแบบ `dd/MM` วันที่ 29 ต้องค้างเป็น text เหมือนกัน แต่ไม่มีสักตัว
- `UpdatedAt` — **ใช้ลำดับแถวไม่ได้** เพราะแถวเก่าถูกแก้ทีหลังได้ ใช้กฎ "แก้ก่อนสร้างไม่ได้"
  (≥ `CreatedAt` ของแถวเดียวกัน) เหลือกำกวม 26 เคส ปิดด้วยกฎ **"ถ้า `CreatedAt` แถวนั้นสลับ
  `UpdatedAt` ก็สลับ"** — เขียนโดย pipeline เดียวกัน ฟอร์แมตเดียวกัน ในการเขียนครั้งเดียวกัน

**ตัวกันที่ทำให้กล้ารันกับข้อมูลจริง** — สคริปต์อ่านค่าปัจจุบันมาเทียบกับคอลัมน์ `current` ในไฟล์
input ให้ครบทุกเซลล์ก่อน **ถ้าไม่ตรงแม้เซลล์เดียวจะยกเลิกทั้งรอบ ไม่ใช่ข้ามเซลล์นั้น** เพราะถ้ามี
คนแทรกแถวหลังดัมพ์ข้อมูล เลขแถวที่เหลือจะเลื่อนทั้งหมด การเขียนต่อจะกระจาย timestamp ผิดลง
ข้อมูลลูกค้าโดยแยกไม่ออกว่าอันไหนผิด · หลังเขียนมี read-back verification บังคับว่าทุกเซลล์ต้องเป็น
`numberValue` ที่ render ตรงค่าเป้าหมาย ไม่ใช่แค่ได้ HTTP 200

สคริปต์: `tests/server/integration/appointments-timestamp-backfill.ts` — dry-run เป็นค่าเริ่มต้น
ต้องใส่ `--apply` ถึงจะเขียน และต้องระบุ `--input <path>` เสมอ (ไม่มี default เพื่อไม่ให้เผลอรัน
กับไฟล์เก่า) · ไฟล์ input ที่ใช้จริงเก็บไว้นอก repo ไม่ได้ commit

### 🔴 `valueInput` ใน `SheetContract` ไม่ใช่ค่าที่ส่งบน wire

จุดนี้ทำให้เข้าใจผิดได้ง่ายและเคยทำให้วินิจฉัยพลาดมาแล้วรอบหนึ่ง: `sheet-contract.ts:29-36`
ระบุว่ามันเป็น **intent declaration + guard เท่านั้น** — write path ส่ง `valueInputOption`
เดียวทั้ง request เป็น `'USER_ENTERED'` เสมอ (`sheet.repository.ts:209` append,
`:513` update) และใช้ map นี้แค่ **ปฏิเสธ** คอลัมน์ที่ประกาศเป็นอย่างอื่น

⇒ **คอลัมน์ที่ไม่ได้ประกาศ ไม่ได้ถูกส่งเป็น `RAW`** ⇒ การเพิ่ม `CreatedAt`/`UpdatedAt`/`DeletedAt`
เข้า `valueInput` ของ Appointments **ไม่ได้แก้บั๊กอะไร** เป็นการทำให้เจตนาที่ประกาศตรงกับสิ่งที่
เกิดขึ้นจริงบน wire และกันไม่ให้ใครมาเปลี่ยนทีหลังเงียบๆ เท่านั้น

⇒ **บทเรียน:** สโมคเทสต์ที่ดีไม่ใช่แค่ "กดผ่าน UI แล้วดูว่าไม่ error" — ต้องยิง query ตรงเข้าไป
เช็ค raw data type ด้วย (ไม่ใช่แค่ดูค่าที่ format ให้สวยแล้ว) ถึงจะเจอเรื่องแบบนี้ ซึ่ง UI/สายตา
มองไม่เห็นเลยเพราะ display value ถูกต้อง 100%

### §2.8 (2026-08-10) — ขอบเขตถูกขยายจากที่แผนเขียนไว้ โดยตั้งใจ

แผน §2.8 เดิมสั่งอย่างเดียว: "แปะ doc comment บน `update()` ว่ายอมรับ race" แต่ตรวจโค้ดจริงแล้ว
พบ 2 เรื่องที่ทำให้ทำตามตัวอักษรไม่ได้:

1. **`update()` วันนี้ยังไม่มี race** — ยังวิ่งผ่าน SheetLib ที่ทำ lookup+write ใต้ `LockService`
   ⇒ comment จะบรรยายสิ่งที่ยังไม่จริง ซึ่งคือกับดักหมวด 4 ข้อ "comment ที่ตายแล้วเป็นคำสั่งสำหรับ agent"
2. **ตัวที่ทำให้เกิด race ยังไม่มีในโค้ด** — ไม่มีฟังก์ชันหาเลขแถวจากค่า key เลย มีแค่ `readColumn`

⇒ ขยาย §2.8 ให้ส่งมอบ `server/shared/repositories/sheet-row-lookup.ts` เป็น building block
(ตอนนั้นยังไม่ต่อเข้า `SheetRepository`) แล้ววาง doc race ไว้ **ที่ตัว helper ซึ่งเป็นจุดที่ race
อยู่จริง** + note บน `update()`

🔴 **สถานะเปลี่ยนแล้วที่ stage 1 (`e7f75df`)** — `findRowNumberByKey` ถูกเรียกจริงใน
`updateThroughSheetsApi` (`sheet.repository.ts:227-232`) ⇒ **race ที่เอกสาร §2.8 เขียนว่า
"จะมีตอน §2.9" มีอยู่จริงแล้ววันนี้ สำหรับ OrderForm** ส่วนชีตที่ยังวิ่ง SheetLib ยังไม่มี
เพราะ lookup+write อยู่ใต้ `LockService` ⇒ ใครอ่าน note บน `update()` ต้องรู้ว่ามันจริงเฉพาะ
สาขา SheetLib ไม่ใช่ทั้งฟังก์ชัน
ตัวแผน §2.8 ถูกแก้ให้ตรงกับสิ่งที่ส่งมอบจริงแล้วใน commit เดียวกัน

การตัดสินใจเชิงพฤติกรรมที่ล็อกไว้: **key ซ้ำ → throw ไม่ใช่คืนแถวแรก** เพราะ key ซ้ำแปลว่า
ข้อมูลเสีย และการเขียนทับแถวแรกเงียบๆ คือการทำลายข้อมูล · **ไม่เจอ → คืน `null`** ให้ §2.9
เป็นคนแปลงเป็น not-found เอง

### prerequisite ของ §2.9 ปิดครบแล้ว (2026-08-10) — และเจอช่องโหว่ที่ไม่มีใครเห็นมาก่อน

เจ้าของโปรเจกต์แก้ env ให้เอง: `ORDERS_SPREADSHEET_ID` ชี้ workbook OrderForm จริงแล้ว
(เดิมชี้ portal ผิดเล่ม) และเพิ่ม `INVOICES_SPREADSHEET_ID` · ยืนยันแล้วว่า **ไม่มี read path
ไหนพัง** เพราะ `ORDERS_SPREADSHEET_ID` ถูกอ้างในโค้ด production จุดเดียวคือ
`OrderForm.db-contract.ts` และ OrderForm มี consumer เดียวคือ `invoice.service.ts` ที่เรียก
`.update()` อย่างเดียว ส่วน `/api/orders` อ่านจาก OrdersView + `PORTAL_*`

**ช่องโหว่ที่เจอ: `sheet-column-parity.ts` ไม่เคยครอบ OrderForm / Invoices / InvoiceItems เลย**
— ครอบแค่ 5 ชีตที่อ่านผ่าน GViz ทั้งที่ 3 ชีตนี้คือชีตที่ §2.9 กำลังจะเขียนทับ และ §2.3 ทำให้การ
เขียนใช้ header-map addressing ⇒ contract ไม่ตรงชีต = **เขียนผิดคอลัมน์** ไม่ใช่แค่อ่านพัง
(ตรวจไม่ได้มาก่อนเพราะ 2 ใน 3 ยังไม่มี `spreadsheetId`)

ผลหลังขยาย parity: **ทั้ง 8 ชีตผ่านหมด** — Appointments 17, OrderForm 21, Invoices 16,
InvoiceItems 14, Customers 20, OrdersView 13, InvoicesView 17, CustomerPackageView 19
⇒ ไม่มีบั๊กคอลัมน์ซ่อนอยู่ เดินหน้า §2.9 ได้

ของใหม่ที่ได้มาด้วย (`2f9e6ac`):
- `tests/server/unit/sheets/writing-workbook-binding.dry-test.ts` — **contract ที่ `writes`
  เป็น true ห้ามผูก `PORTAL_SPREADSHEET_ID`** ตรวจแบบไล่ค้น contract เอง ไม่ hardcode รายชื่อ
  (ชีตที่เพิ่มทีหลังจึงถูกคุมด้วย) มีไว้กันความผิดพลาดซ้ำแบบที่ `ORDERS_*` เพิ่งเป็นจนถึงเมื่อวาน
  ซึ่งไม่มีอะไรในระบบจับได้เลย
- `tests/server/integration/sheets-api-access-check.ts` — auth ด้วย service account แล้วอ่าน
  ผ่าน **Sheets API** (ไม่ใช่ GViz) พิสูจน์ว่าเส้นทาง auth ใช้ได้จริง ซึ่งไม่เคยถูกใช้บน production
  เลยสักครั้ง · ผ่านครบ 4 ชีต 3 workbook

**ข้อจำกัดที่ต้องรู้ก่อนไปเชื่อสคริปต์ตัวหลัง:** ทุก workbook เปิด public read ⇒ **การอ่านสำเร็จ
ไม่ได้แปลว่ามี Editor** สคริปต์นี้จึงพิสูจน์ได้แค่ "auth ทำงาน + เข้าถึงเล่มนั้นได้" ไม่ได้พิสูจน์
สิทธิ์เขียน (เขียนกำกับไว้ในหัวไฟล์แล้ว) การพิสูจน์สิทธิ์เขียนตรงๆ ต้องใช้ Drive API + ขยาย scope
ของ token ซึ่งพิจารณาแล้วว่าแลกไม่คุ้ม จึงเปลี่ยนไปกันที่ระดับ binding ด้วย dry-test ตัวข้างบนแทน

### บทเรียนจาก §2.2 — เพิ่มเข้ารายการหมวด 4

รอบแรกของไฟล์นี้ถูกเขียนค้างตอนเครื่องค้าง แล้วมี 2 ปัญหาที่ **typecheck จับไม่ได้**:

1. `A:Z` hardcode ในช่วง append — ตัน 26 คอลัมน์ ทั้งที่ Customers มี 20 แล้ว
   เพิ่มอีกไม่กี่คอลัมน์จะหลุดช่วงเงียบๆ
2. **เทสต์ classification ผ่านด้วยเหตุผลผิด** — mock assert พังแล้วโยน error,
   transport catch แปลง throw ทุกชนิดเป็น `WriteTransportError`, เทสต์ 5xx/network/timeout
   ก็คาด `WriteTransportError` พอดี ⇒ ผ่านไม่ว่า client จะตัดสินใจถูกหรือผิด

ข้อ 2 พิสูจน์ว่าแก้แล้วด้วยการทำ 5xx ให้จัดประเภทผิด → เทสต์แดง 6 ตัว (ก่อนแก้แดง 0)

⇒ **เวลาเขียนเทสต์ error classification ระวังว่า mock ที่พังเองอาจทำให้เทสต์ผ่าน**

### §2.9 stage 1 smoke test (2026-08-10) — ผ่านจริงบน local dev, เจอ 2 เรื่องระหว่างทาง

เจ้าของกด invoice create ผ่าน local dev (ไม่ใช่ preview — `npm run dev` มีแค่ vite/frontend,
backend จริงรันผ่าน `vercel dev` แยกต่างหาก) ด้วย `order_id=2400fb5c`

**เรื่องที่ 1 — false lead ที่ผมสร้างเอง อย่าเชื่อ history:** ตอนแรกเจอ `order_link_failed` /
`certainty: rejected` ไม่มี log อะไรเลยฝั่ง server ผมตั้งสมมติฐานว่า header ของ OrderForm ว่าง
7 คอลัมน์ (D/E/H/I/J/O/Q) จากสคริปต์ GViz ที่เขียนเอง — **สมมติฐานนี้ผิดทั้งหมด** สาเหตุคือสคริปต์
ใช้ `headers=0` แล้วอ่านค่าจาก row data โดยตรง ซึ่ง GViz จะ coerce ค่า text เป็น `null` เงียบๆ
เมื่อคอลัมน์นั้น majority type เป็น date/number/datetime (ผู้ใช้เปิด Google Sheets ตรวจด้วยตา
เจอว่า header มีครบ แล้วทักท้วง) ⇒ **บทเรียนใหม่: ตรวจ header ด้วย GViz ต้องใช้ `headers=1` แล้ว
อ่านจาก `table.cols[].label` เท่านั้น ห้ามอ่านจาก row data ของคอลัมน์ที่ typed** หรือใช้ Sheets
API v4 ตัวจริง (`SheetsApiClient.readHeader()`) ยืนยันแทน — สมมติฐานผิดนี้ยังถูกส่งต่อให้
grok-investigator ยืนยันไปแล้วรอบหนึ่งด้วย (มันตรวจ logic ถูกจากสมมติฐานที่ผิด = confirm ผิดตาม)
⇒ **agent ที่ตรวจสอบต้อง verify ข้อเท็จจริงเอง ไม่ใช่เชื่อ "fact" ที่ผู้เรียกป้อนให้**

**เรื่องที่ 2 — สาเหตุจริง หลังเพิ่ม logging (`1f00893`):** error ตัวจริงคือ
`WriteRejectedError: Google authentication failed before the request was sent.` เกิดเพราะ
`GOOGLE_SERVICE_ACCOUNT_KEY` บน Vercel ถูก mark เป็น **Sensitive** ตอนสร้าง ซึ่งจำกัด scope ให้
เลือกได้แค่ Production/Preview เท่านั้น (เลือก Development ไม่ได้) ⇒ `vercel dev` ที่รัน backend
local ไม่เคยเห็นค่านี้เลย เจ้าของเพิ่มตัวแยกสำหรับ Development แล้วแก้หาย ⇒ **บทเรียน:
env var ที่ mark Sensitive บน Vercel อาจไม่ครอบ Development tier แม้จะเลือก 3 environment ทั่วไป
ได้ปกติ — ต้องเช็คทุกตัวที่ backend local (`vercel dev`) ต้องใช้**

**เรื่องที่ 3 — ไม่เกี่ยว §2.9 แต่เจอระหว่างทาง:** retry รอบถัดมาเจอ `items_write_failed` /
`SheetLibTransportError: … aborted due to timeout` ที่ขั้นเขียน `InvoiceItems` (ยังวิ่ง Apps
Script อยู่ ไม่ใช่ Sheets API) — นี่คือพฤติกรรมเดิมที่มีอยู่แล้ว (`SHEETLIB_WRITE_TIMEOUT_MS =
15_000`, ไม่มี retry โดยตั้งใจ เพราะ timeout แปลว่า "ไม่รู้ว่าเขียนสำเร็จจริงหรือเปล่า" ห้าม
auto-retry) ตรวจ live ผ่าน GViz ยืนยันว่า **ไม่มีอะไรถูกเขียนค้างเลย** (0 แถวทั้ง Invoices/
InvoiceItems) ก่อนให้เจ้าของ resubmit อย่างปลอดภัย

**ผลตรวจ live หลัง resubmit สำเร็จ (`INV260848367235`, order `2400fb5c`):**
- `OrderForm.invoice_id` = `INV260848367235` ✅
- `OrderForm.updated_at` type = **`datetime` จริง** (ไม่ใช่ string) ✅ ตรงตาม `valueInput:
  USER_ENTERED` ที่ตั้งใจไว้
- อีก 18 คอลัมน์ของแถวนั้นค่าเดิมทั้งหมด ไม่ขยับ ✅
- `Invoices`/`InvoiceItems` เขียนครบตรงกับ response (`itemCount:1, invoiceTotal:140`) ✅

**เพิ่ม logging ถาวร (`1f00893`, ไม่ใช่โค้ด debug ชั่วคราว):** `sheets-api.client.ts` เก็บ
response body (สูงสุด 500 ตัวอักษร) ของ Sheets API เวลา non-2xx แนบเข้า error message แทนที่จะ
ทิ้งไป และ `invoice.service.ts` เพิ่ม `console.error` ก่อน return ทุก `*_failed` outcome — ไม่แตะ
business logic/response shape เลย (grok review ยืนยันแล้ว) เก็บไว้ถาวรเพราะแก้ observability gap
จริงที่จะเกิดกับ write failure ในอนาคตด้วย ไม่ใช่แค่ครั้งนี้ครั้งเดียว

### stage 3 merge กลับเข้า `refactor/sheet-layer` แล้ว (2026-08-11, `d52fd99`)

```
branch    refactor/sheet-layer-stage-3     แตกจาก refactor/sheet-layer
worktree  .worktrees\refactor-sheet-layer-stage-3
```

เหตุผลที่เคยแยก: stage 3 รันด้วย **`grok-pipeline`** ซึ่งให้ Grok ทำงานใน Docker ที่ mount เห็นแค่
worktree เท่านั้น ⇒ `.env.local` และ secret อื่นไปไม่ถึงมันโดยโครงสร้าง ไม่ใช่ด้วยการกรองชื่อไฟล์

**การแยกแบบนั้นเองคือเหตุผลที่ต้อง merge กลับก่อนทำ 3C** — worktree ไม่มี `.env.local` และไม่มี
`.vercel` โดยตั้งใจ ⇒ รัน `vercel dev` หรือ deploy จากที่นั่นไม่ได้เลย 3C ต้องใช้ของจริงทั้งคู่
merge สะอาด ไม่มี conflict · โค้ด production ที่เข้ามาจริงมีแค่ 3 ไฟล์ (`sheet.repository.ts`
+ db-contract ของ Invoices/InvoiceItems) ที่เหลือเป็นเทสต์

ผ่านด่านครบหลัง merge: `typecheck:api` เขียว · dry-test **37/37** · `npm run build` เขียว ·
`sheet-column-parity` ผ่านทั้ง 8 ชีต

✅ **branch และ worktree ถูกลบไปแล้วทั้งหมด** (2026-08-11 หลัง merge เข้า main) — หมวดนี้เก็บไว้
เป็นบันทึกว่าทำไมถึงเคยแยก ไม่ใช่คำสั่งให้ไปหาโค้ดที่นั่น

### §2.9 stage 2C — ผลตรวจจริง (2026-08-11) ✅

เจ้าของกด create + เลื่อนนัดผ่าน UI จริง (`APPT-4ad2901e`) ตรวจครบ 5 ข้อ ผ่านหมด:

| ตรวจ | ผล |
|---|---|
| type ทั้ง 4 คอลัมน์ไม่เปลี่ยนจากก่อน deploy | `CreatedAt` string · `UpdatedAt` datetime · `DeletedAt` ว่าง · `AppointmentDate` date ✅ |
| คอลัมน์ไม่เลื่อน | `PickupOrderID`/`DeliveryOrderID` ว่างอยู่ตำแหน่งถูก ✅ |
| `Address` JSON ชั้นเดียว parse เป็นอ็อบเจ็กต์ | ✅ |
| GViz date-range filter | ✅ query ช่วง 12-14 ส.ค. เจอแถวใหม่ |
| update แตะเฉพาะที่แก้ | `UpdatedAt` ขยับ ที่เหลือคงเดิม ✅ |

**ของแถม:** `CreatedAt` ที่เราเขียนเป็น `2026-08-11 03:00:56` — รูปแบบมาตรฐาน ต่างจากแถวเก่าใน
ชีตที่เป็น `27/03/2026 04:37:32` (ข้อมูลยุคก่อนหน้า ไม่ใช่ผลของโค้ดชุดนี้) ⇒ ข้อมูลใหม่สะอาด
ตั้งแต่วันนี้ · และ **`PATCH` คืนค่าให้ frontend ได้ปกติ** ⇒ ไม่ต้องแตะ `updateThroughSheetsApi`

⚠️ ทั้งหมดนี้ทดสอบบน **local dev** ยังไม่เคยผ่าน preview/production deploy สักครั้ง

### §2.9 stage 2C — สิ่งที่ต้องกดและต้องตรวจ (บันทึกไว้เป็นแบบให้ 3C ใช้ซ้ำ)

โค้ดฝั่ง Appointments พร้อมแล้ว แต่ **ยังไม่เคยยิงถึง Google เลยสักครั้ง** ทุกอย่างที่ผ่านมาเป็น
mock ทั้งหมด สิ่งที่ mock พิสูจน์ไม่ได้คือ Google เก็บอะไรจริง

**ต้องกด:** create 1 ครั้ง + update 1 ครั้ง ผ่าน staff UI ด้วยนัดหมายที่เจ้าของเลือกว่าทิ้งได้
(agent ห้ามเลือกเอง — เป็นข้อมูลลูกค้าจริง)

**ต้องตรวจหลังกด — ยิง query ตรง ไม่ใช่เปิดชีตดูด้วยตา:**

1. `raw-column-type-check.ts` — `CreatedAt` ต้องยัง**เป็น string**, `UpdatedAt` ต้องยัง**เป็น
   datetime**, `DeletedAt` ยังว่าง, `AppointmentDate` ยังเป็น date
   ⇒ เกณฑ์คือ **"ไม่เปลี่ยนจากที่วัดได้ก่อน deploy"** ไม่ใช่ "ต้องเป็น string ทั้งสามตัว"
2. คอลัมน์ไม่เลื่อน — Appointments มี nullable กลางแถว 5 ตัว เปิดแถวที่เพิ่งสร้างแล้วดูว่าค่าอยู่
   ตรงหัวคอลัมน์ที่ถูก
3. `Address` parse กลับได้เป็นอ็อบเจ็กต์ **ไม่ใช่ string ซ้อน string**
4. GViz date-range filter ยังใช้งานได้ (แผนระบุเองว่า mock พิสูจน์ข้อนี้ไม่ได้)
5. update แตะเฉพาะคอลัมน์ที่แก้ อีก 14 คอลัมน์บนแถวนั้นค่าเดิม

**คำถามที่จะได้คำตอบฟรีจากการกดครั้งนี้:** `POST` คืน `appointmentDate` จากค่าที่เราเขียน (ISO)
ส่วน `PATCH` คืนจากแถวที่อ่านกลับ ⇒ ดูว่า `PATCH` คืนรูปแบบไหน ถ้าเป็น ISO อยู่แล้วก็ไม่ต้องแก้อะไร
ถ้าไม่ ค่อยชั่งว่าคุ้มไหมที่จะแตะ `updateThroughSheetsApi` ซึ่งเป็น live path ของ OrderForm

**ควร deploy preview ไม่ใช่ local dev** — stage 1 พิสูจน์บน local เท่านั้น และบั๊กคลาส `.js`
extension ที่หายใน ESM import จับได้เฉพาะ deploy จริง (`tsc`/dry-test/`vercel dev` พลาดทั้งสามตัว
เคยทำ production ล่มมาแล้ว) · stage 2 เพิ่ม code path ใหม่ ⇒ ความเสี่ยงนี้กลับมา

---

## 1c. งานโค้ดของ Phase 2 จบครบแล้ว (สถานะ 2026-08-11)

**§2.9 และ §2.10 จบทั้งคู่** — ทั้ง 4 ชีตที่ระบบเขียนได้ (OrderForm, Appointments, Invoices,
InvoiceItems) ย้ายมา Sheets API หมด พิสูจน์กับ Google จริงครบทุกชีต **และ SheetLib write path
ถูกลบทิ้งแล้ว เหลือทางเขียนทางเดียวทั้งระบบ** ชีตที่เหลือเป็น read-only ทั้งสิ้น

### ✅ ด่านสุดท้ายหลัง §2.10 — ผ่านครบบน preview (2026-08-11)

กดบน preview จริง (`kkxnc0kcr`) หลังลบ SheetLib write path ทิ้งทั้งเส้น:

**invoice `INV260854062757` (order `6b7e06ff`) — 15/15**
ครั้งแรกที่มี **snapshot ของแถว OrderForm ก่อนเขียน** จึง diff ได้จริงแทนการอนุมาน:

```
ok  updated_at   Date(2026,5,21,15,35,50)  ->  Date(2026,7,11,16,36,43)
ok  updated_by   (ว่าง)                    ->  staff
ok  invoice_id   (ว่าง)                    ->  INV260854062757
18 จาก 21 คอลัมน์ ไม่ขยับเลย
```

⇒ **การเขียนแตะเฉพาะ 3 คอลัมน์ที่ contract ประกาศ** ปิดข้อค้างที่ 3C สองรอบแรกพิสูจน์ไม่ได้
⇒ ขั้นตอนที่ควรทำทุกครั้งต่อจากนี้: **ขอ `sourceOrderId` ก่อนเจ้าของกด แล้วเก็บ snapshot**
(`scratchpad/snapshot-order.mjs`) — pre-flight ยังกันการออกใบซ้ำได้ด้วย เพราะมันเตือนถ้า
`invoice_id` ไม่ว่าง

**appointment `APPT-1ae7e6ef` — 10/10**
`CreatedAt` string `2026-08-11 16:37:35` (รูปแบบมาตรฐาน) · `UpdatedAt` datetime ·
`AppointmentDate` date · `Address` parse เป็นอ็อบเจ็กต์ชั้นเดียว · nullable กลางแถวว่างตำแหน่งถูก
· GViz date filter หาเจอ ⇒ **type ทั้งสามไม่เปลี่ยนจาก baseline และ success path ทำงานปกติ**
ซึ่งเป็นเงื่อนไขที่ brief ของ `certainty` ล็อกไว้ว่าห้ามพัง

⇒ **เส้นทางเขียนผ่าน Sheets API พิสูจน์บน deploy จริงครบทั้ง invoice และ appointment**
ไม่มีบั๊ก ESM `.js` extension

### ✅ merge เข้า main และขึ้น production แล้ว (2026-08-11, `ee4ed38`)

86 commits · merge สะอาดไม่มี conflict · รัน gate ครบบน main ก่อน push (typecheck · dry-test
38/38 · build · parity 8 ชีต) · production ยิง 4 endpoint ได้ 200 และอ่านเห็นข้อมูลที่เพิ่งเขียน
วันนี้จริง (`INV260854062757`, `APPT-1ae7e6ef`)

**Phase 2 จบ** — ไม่มีตัวบล็อกเหลือ

⚠️ `APPT-1ae7e6ef` ไม่โผล่ใน `/api/appointments?perPage=500` เพราะ `perPage` ถูก cap และแถว
อยู่ท้ายชีต (~362) · กรองด้วย `customerId` แล้วเจอปกติ ⇒ **ไม่ใช่บั๊ก** แต่จำไว้เวลาตรวจ
ครั้งหน้า อย่าสรุปว่า "เขียนไม่ติด" จากการที่มันไม่อยู่ในหน้าแรก

ข้อ 4 (timestamp) เคยถูกพักไว้ **ปิดแล้ว 2026-08-15** ดูหมวด "รากของปัญหา timestamp"

### env — ✅ ลบครบแล้ว เหลือ orphan เก่าอีก 3 ตัว

`APPSCRIPT_URL` · `APPSCRIPT_GATEWAY_URL` · `APPSCRIPT_APPOINTMENT_URL` — **เจ้าของลบครบแล้ว
ทั้งบน Vercel และใน `.env.local` (2026-08-11)**

🔴 **`APPSCRIPT_INVOICE_VIEW_SYNC_URL` ต้องอยู่ต่อ** — ยังใช้จริงที่
`invoice-view-sync-client.ts:34` เพื่อ recompute InvoicesView **ไม่ใช่การเขียนแถวในชีต**
จึงไม่ถูกลบไปกับ §2.10

**✅ orphan ทั้งหมดถูกลบบน Vercel แล้ว (เจ้าของทำเอง 2026-08-15)** ตารางนี้เก็บไว้เป็นบันทึกว่า
เคยมีอะไรและทำไมถึงลบได้:

| ตัวแปร | หมายเหตุ |
|---|---|
| `APPSCRIPT_CUSTOMER_URL` | ไม่มีโค้ดใน webapp-vue อ้างถึง · **ระวังสับสน** โปรเจกต์ Python ที่ repo root ใช้ชื่อเดียวกันจริง แต่อ่านจาก `C:\MagicwashGemini\.env` คนละไฟล์ ⇒ ลบจาก Vercel ไม่กระทบ Python · **ลบแล้ว (2026-08-15)** |
| `VITE_APPOINTMENTS_SCRIPT_URL` | ไม่มีโค้ดอ้างถึง · **ลบออกจาก `.env.local` แล้ว (2026-08-14)** — `src/utils/gateway.js` ที่เคย hardcode URL ไว้ ตอนนี้ถูกลบไปทั้งไฟล์แล้วด้วย ⇒ **ลบบน Vercel แล้ว (2026-08-15)** |
| `CUSTOMERS_SHEET_NAME` | ไม่มีโค้ดอ้างถึง (ตรวจซ้ำ 2026-08-14 ยังไม่มี) · ยังอยู่ใน `.env.local` และจงใจไม่ใส่ใน `.env.example` |

⚠️ ทั้งสามข้อยืนยันได้แค่ว่า **ไม่มีอะไรใน webapp-vue อ้างถึง** นอกโปรเจกต์นี้ตรวจไม่ได้

✅ **`.env.example` เพิ่ม `APPSCRIPT_INVOICE_VIEW_SYNC_URL` แล้ว (2026-08-14)** — เดิมขาดไป
ทั้งที่ `invoice-view-sync-client.ts:34` อ่านผ่าน `requireEnv()` ⇒ deploy ที่ไม่ตั้งค่านี้จะพัง
ตอน sync view

**ต้องเก็บไว้แน่นอน:** `VITE_APPOINTMENTS_SPREADSHEET_ID` / `VITE_CUSTOMERS_SPREADSHEET_ID`
(`src/utils/constants.js:2-3`)

### 📚 เอกสารอื่นใน `docs/` เป็นบันทึกประวัติศาสตร์แล้ว — ไฟล์นี้คือสถานะจริง

ไฟล์ข้างล่างถูกเขียนระหว่างทางและ **ไม่ได้อัปเดตตามตอนปิด Phase 2** ยังอ่านได้เพื่อดู *เหตุผล*
ว่าทำไมถึงตัดสินใจแบบนั้น แต่ **อย่าเชื่อประโยคที่บอกสถานะ**

| ไฟล์ | ตกยุคตรงไหน |
|---|---|
| `session-2026-08-10-overnight.md` | log ตามวัน · หมวด 3 (ตารางคำตัดสิน) ยังมีค่า ที่เหลือคือสถานะของคืนนั้น |
| `phase-2-9-test-charter.md` | คอลัมน์สถานะทุกตารางเป็นบันทึก Phase A (แปะ banner บอกไว้ที่หัวไฟล์แล้ว 2026-08-14) · *เหตุผล* ของแต่ละข้อยังใช้ได้ |
| `database-layer-sheets-api-refactor-plan.md` | ยังบรรยาย dual-path SheetLib ซึ่ง §2.10 ลบทิ้งแล้ว · แผน §2.0–§2.10 ยังใช้อ้างอิงได้ |
| `appointment-gsheet-repository-refactor-plan.md` | แผนยุค SheetLib · checklist ติ๊กครบแล้ว |
| `invoice-module-refactor-plan.md` · `invoice-refactor-smoke-checklist.md` | รอบ refactor ก่อนหน้า ทับกับแผน sheets-API |

**จงใจไม่ลบและไม่ยุบรวม** — มันเก็บ *เหตุผล* ที่สร้างใหม่ไม่ได้ถ้าลบไป การแปะป้ายว่า
"ประวัติศาสตร์" ถูกกว่าและไม่ทำข้อมูลหาย · ถ้าจะทำต่อ ให้แปะหมายเหตุที่ **หัวไฟล์นั้นๆ** เอง
เพราะคนที่เปิดไฟล์ตรงไม่ได้ผ่านตารางนี้

### SheetLib ฝั่ง browser — ตรวจซ้ำ 2026-08-14 (grok-explorer + spot-check เอง), พบ 2 เส้นทาง คนละสถานะ

เดิมบันทึกไว้ว่า `src/utils/gateway.js` + `src/pages/FormOverlayPage.vue` ยิง Apps Script ตรง
**ข้าม API ไปเลย** และเป็นงานแยกที่ยังไม่แตะ — ของนี้ยังจริง แต่ตอนนี้ตรวจแล้วพบว่า:

1. **`gateway.js` + `FormOverlayPage.vue` (route `/forms`, `/forms/:formName`) — ✅ ลบครบแล้ว**
   ตรวจ 2026-08-14: `src/utils/gateway.js`, `src/pages/FormOverlayPage.vue`,
   `src/components/forms/CreateOrderForm.vue` **ไม่มีอยู่ในดิสก์แล้ว** และ route `/forms` หายไปจาก
   `src/router/index.js` แล้ว · ตัวสุดท้ายที่ค้างคือ `src/layouts/FormOverlayLayout.vue`
   (ไม่มีใคร import) **ลบแล้ว 2026-08-14** ⇒ เส้นทางนี้ปิดสมบูรณ์
   **`src/layouts/FormLayout.vue` เป็นคนละไฟล์ ยังใช้อยู่ อย่าลบตาม**
2. **`src/api/photos.js` (`savePhoto`) — ยังใช้งานจริง ไม่ใช่ของที่เคยบันทึกไว้ในหมวดนี้มาก่อน**
   เส้นทางจริง: การ์ด/รายละเอียด order → `/gallery/:key` → `OrderGalleryPage` →
   `usePhotoUpload` → `savePhoto` → Apps Script (hardcode URL ไว้เองที่ `src/api/photos.js:3`
   — เดิมเขียนว่า "URL เดียวกับ `gateway.js`" ซึ่งตอนนี้ `gateway.js` ถูกลบไปแล้ว)
   อัปโหลดรูป Before/After ของ order ยังพึ่ง Apps Script ตรงอยู่ ⇒ **เป็นงานย้ายมาผ่าน API
   แยกต่างหาก ไม่เกี่ยวกับ `/forms`** · `server/api/route-registry.ts` ยังไม่มี photo route

### ✅ cleanup 2026-08-14 — ลบของค้างที่ไม่มีใครใช้

| ลบอะไร | ทำไม |
|---|---|
| `src/features/invoices/components/InvoiceDevJsonPanel.vue` + การเรียกใช้ 2 จุดใน `InvoiceCreatePage.vue` | dev inspector ที่ป้ายตัวเองเขียนว่า "temporary, remove before shipping" แต่ถูก render อยู่ในหน้าสร้าง invoice ที่พนักงานใช้จริง |
| `src/layouts/FormOverlayLayout.vue` | residue ของ route `/forms` ที่ลบไปแล้ว ไม่มีใคร import |
| `VITE_APPOINTMENTS_SCRIPT_URL` ใน `.env.local` | orphan ตามตาราง env ด้านบน |

⚠️ **`requestPayload` กับ `result` ใน `InvoiceCreatePage.vue` ห้ามลบตามไปด้วย** — หน้าตาเหมือน
มีไว้ป้อน dev panel อย่างเดียว แต่จริงๆ `requestPayload` คือ request body ที่ส่งเข้า API จริง
(`:277` `:281`) และ `result` คือผลลัพธ์ที่ขับ UI สำเร็จ/ผิดพลาดของหน้านี้ · ยืนยันหลังลบแล้วว่า
ทั้งคู่ยังอยู่ครบและ `npm run build` ผ่าน

### 🔴 `vercel dev` ที่เปิดค้างไว้จะเสิร์ฟโค้ดเก่า

`vercel dev` โหลดโค้ดตอนที่มันสตาร์ท **ไม่ได้ reload เมื่อไฟล์เปลี่ยน** ⇒ ถ้าเปิดค้างข้ามวัน
แล้วกดทดสอบ จะได้ผลของโค้ดเวอร์ชันเก่าโดยไม่มีอะไรเตือนเลย

เจอจริง 2026-08-11: มีตัวที่เปิดค้างตั้งแต่ 2026-08-10 21:48 ยังรันโค้ดที่ยังมี SheetLib อยู่
ทั้งที่ §2.10 ลบทิ้งไปแล้ว **⇒ restart `vercel dev` ทุกครั้งหลังโค้ดเปลี่ยน ก่อนเชื่อผลทดสอบ local**

ของแถมที่เจอด้วย: `vercel dev` **spawn lambda ลูกต่อ function แล้วไม่เก็บกวาด** — สะสมได้ 28 ตัว
กินแรม 317 MB ในหนึ่งวัน · หมวด 3 เตือนว่า process ค้างเยอะทำให้ background task ถูก kill
โดยไม่มีสาเหตุชัดเจน ⇒ **ปิด-เปิดใหม่เป็นระยะ ไม่ใช่แค่เรื่องแรม**

| # | อะไร | ใคร | ติดอะไร |
|---|---|---|---|
| ~~1~~ | ~~3B~~ | | ✅ `0927dd4` |
| ~~2~~ | ~~**3C**~~ | | ✅ **ผ่านครบ 12/12 (2026-08-11)** `INV260872306305` — ดูหมวดล่าง |
| ~~3~~ | ~~**§2.10** ลบ SheetLib write path~~ | | ✅ **`154445b`** — `sheetlib-errors.ts` ถูกลบ, `writeTransport`/`target`/`scriptUrl` หายทั้งระบบ, `delete()` โยน not-supported · **env ที่เหลือเป็นของเจ้าของ** ดูล่าง |
| ~~4~~ | ~~timestamp ทุกชีตเป็น datetime จริง (คำตัดสิน 3.5)~~ | | ✅ **Appointments ปิดแล้ว 2026-08-15** — สาเหตุไม่ใช่ cell format อย่างที่เขียนไว้เดิม แต่เป็น locale `en_US` + ค่า `dd/MM/yyyy` · แก้ข้อมูลจริง 373 เซลล์ผ่าน `spreadsheets.values:batchUpdate` · **ไม่ต้องแตะ cell format เลย** ดูหมวดล่าง |
| ~~5~~ | ~~`certainty` ของ Appointments~~ | | ✅ **`78efaad`** — วางบน **error envelope** ไม่ใช่ discriminated union บน success ⇒ success shape เดิมเป๊ะ frontend list/get ไม่ต้องแก้ · ไม่มี retry logic โดยตั้งใจ |
| ~~6~~ | ~~**พิสูจน์บน preview deploy**~~ | | ✅ **ปิดครบแล้ว (2026-08-11)** อ่าน 4 endpoint + เขียน invoice จริง `INV260832407923` บน preview ⇒ ดูหมวดล่าง |

ข้อ 4 กับ 5 เป็น "งานแยกหลัง §2.9" ตามที่เจ้าของกำหนดลำดับไว้ ไม่ใช่ตัวบล็อก §2.9

### ✅ §2.9 stage 3C — ผ่านครบ 12/12 (2026-08-11, บน local dev)

`INV260872306305` · order `2400fb5c` · 2 รายการ รวม 150 · **ตรวจด้วย GViz query ตรง ไม่ใช่เปิดชีตดู**

| ตรวจ | ผล |
|---|---|
| `Invoices` 1 แถว · `customer` parse เป็นอ็อบเจ็กต์ · `adjustments` = `[]` | ✅ ไม่มี `[object Object]` ไม่มี string ซ้อน string |
| `created_at` = **datetime** · `issued_date`/`due_date` = **date** · `updated_at` ว่าง | ✅ ตรงกับ `valueInput: USER_ENTERED` ที่ตั้งใจ |
| `InvoiceItems` 2 แถว · `sku` ว่าง **อยู่ตำแหน่งที่ 6** · ไม่มีคอลัมน์เลื่อน | ✅ |
| `quantity × unit_price` รวม = 150 ตรงกับ response | ✅ 14×5 + 8×10 |
| `OrderForm.invoice_id` | ✅ |
| GViz date-range filter (`issued_date` 10–12 ส.ค.) | ✅ เจอใบนี้ |

**ยังไม่ได้ตรวจในรอบนี้:** ไม่มี snapshot ของแถว `OrderForm` ก่อนเขียน ⇒ ยืนยันได้แค่ว่า
`invoice_id` ถูกลิงก์ (ปิดช่องนี้ได้ในรอบ preview ด้านล่าง)

⚠️ **กดบน local dev ไม่ใช่ preview**

### ✅ ปิดข้อ 6 — invoice ใบที่สองสร้างบน preview deploy จริง (2026-08-11)

`INV260832407923` · order `581e844c` · เสื้อโปโล 1×25 + เสื้อยืดแขนยาว 2×30 = 85
**กดผ่าน preview URL ไม่ใช่ local dev** ⇒ เส้นทาง**เขียน**ผ่าน Sheets API รันบน deploy จริง
สำเร็จเป็นครั้งแรก · ตรวจซ้ำชุดเดิม **ผ่าน 12/12**

⇒ รวมกับฝั่งอ่านที่ผ่านไปแล้ว **ด่าน preview ปิดครบทั้งสองด้าน** ไม่มีบั๊ก ESM `.js` extension
ทั้งใน read path และ write path

**ได้คำตอบเรื่องคอลัมน์ไม่ขยับด้วย โดยไม่ต้องมี snapshot** — แถว `OrderForm` หลังเขียนแสดงว่า
`created_by` ยังเป็น `magicwashth@gmail.com` ของเดิม (ไม่ถูกทับด้วย `staff`), `received_date`/
`timestamp` ยังเป็นข้อมูลเดือน เม.ย. ของเดิม, `quantity`/`service_type`/`status` ครบ
⇒ การเขียนแตะแค่ **3 คอลัมน์ที่ควรแตะ** (`invoice_id`, `updated_at`, `updated_by`)
และ `Invoices.created_at` (15:25:06) กับ `OrderForm.updated_at` (15:25:07) ห่างกัน 1 วินาที
ซึ่งสอดคล้องกับ flow เดียว

⇒ **บทเรียน:** ถ้าไม่มี snapshot ก่อนเขียน ให้ดูคอลัมน์ที่ระบบ*ไม่ควร*แตะแต่มีค่าเก่าชัดเจน
(`created_by`, วันที่ในอดีต) แทน — พิสูจน์ได้เกือบเท่ากันโดยไม่ต้องเตรียมอะไรล่วงหน้า

**ข้อจำกัดที่เจอ:** `vercel logs <url>` บน Hobby สตรีมเฉพาะ log ใหม่นับจากเวลาที่สั่ง
⇒ ยืนยันย้อนหลังว่า request เข้า preview จริงไหมไม่ได้จาก CLI ต้องถามคนกด

**บทเรียนจากตัวสคริปต์ตรวจเอง:** รอบแรกยิง `where B` ผิดคอลัมน์ (ใน `InvoiceItems` คอลัมน์ B คือ
`invoice_item_id` ไม่ใช่ `invoice_number` ซึ่งอยู่ที่ A · ใน `Invoices` คอลัมน์ B คือ `status`
ไม่ใช่วันที่) ได้ 0 แถว **แต่เช็ค `sku` กับ `adjustments` กลับขึ้น PASS** เพราะ `every()` บน array
ว่างคืน `true` ⇒ **ด่านที่วนบนคอลเลกชันต้องบังคับจำนวนแถวก่อนเสมอ** ไม่งั้นมันจะเขียวดังที่สุด
พอดีตอนที่การเขียนล้มเหลว ซึ่งคือตอนที่เราต้องการมันที่สุด

### 🟢 preview deploy ครั้งแรกของ refactor นี้ — ฝั่งอ่านผ่านแล้ว (2026-08-11, `d52fd99`)

deploy สำเร็จ build 15 วิ · ยิง 4 endpoint ตามหมวด 5 **ได้ 200 พร้อมข้อมูลจริงครบทั้ง 4**
⇒ **บั๊กคลาส `.js` extension ที่หายใน ESM import ไม่มีในโค้ดชุดนี้** ซึ่งเป็นสิ่งเดียวที่
`tsc`/dry-test/`vercel dev` พิสูจน์ไม่ได้เลย และเคยทำ production ล่มทั้งระบบมาแล้ว

**นี่พิสูจน์แค่ฝั่งอ่าน** เพราะทั้ง 4 endpoint เป็น GET ล้วน ⇒ เส้นทางเขียนผ่าน Sheets API
(ของจริงที่ §2.9 ทำมาทั้งหมด) **ยังไม่เคยรันบน deploy จริงสักครั้ง** จนกว่า 3C จะกดบน preview

### เจอระหว่างทาง — GViz `Date(y,m,d)` ดิบหลุดออก API (ไม่ใช่ของใหม่)

`/api/invoices` คืน `"issuedDate":"Date(2026,7,10)"` และ `/api/orders` คืน
`"receivedDate":"Date(2026,2,22)"` — **เทียบกับ preview เก่าก่อน stage 3 แล้วเหมือนกันเป๊ะ
⇒ มีมาก่อน ไม่ใช่ regression ของ stage 3** ต้นเหตุคือ `gviz-reader.ts` ดึงจาก `.v` อย่างเดียว
และไม่มี parser สำหรับ `Date(y,m,d,...)` (เรื่องเดียวกับที่บันทึกไว้ตอน §2.7)

อยู่ในกรอบนโยบาย "reads คืนค่าตามที่เก็บ ไม่ normalize" ที่เจ้าของตัดสินไว้ **แต่ค่านี้ไม่ใช่
เรื่อง format — มันคือ artifact ของ GViz ที่ frontend ต้องแกะเอง** ⇒ ควรเป็นงานแยกต่างหาก
ไม่ใช่ตัวบล็อก 3C

✅ **ปิดแล้ว (ตรวจซ้ำ 2026-08-14) — ไม่ใช่งานค้าง** `src/shared/utils/sheet-date.ts`
(`parseSheetDate`) มี regex จับ `Date(y,m,d[,h,mi,s])` โดยตรงอยู่แล้ว (บรรทัด 179) แปลงเป็น
civil date / Bangkok instant ให้ใช้งานได้ปกติ ถูกเรียกใช้ทั่วทั้ง invoices/appointments/customers
⇒ frontend แกะ artifact นี้เองอยู่แล้วตามนโยบาย ไม่ต้องแก้ `gviz-reader.ts`

### ✅ ปิดงานคอมเมนต์ "กอง B" แล้ว (อัปเดต 2026-08-12)

(บันทึกย้อนหลัง 2026-08-11 · งานเกิด 2026-08-11 รอบกวาดคอมเมนต์ทั้ง repo)

รอบกวาดคอมเมนต์แบ่งของที่เจอเป็น 3 กอง:

| กอง | คืออะไร | สถานะ |
|---|---|---|
| A | คอมเมนต์ที่บอกสถานะโครงการ / เลขเฟส / tense ที่ชี้ไปแผน | ✅ แก้แล้ว 36 ไฟล์ (`35518a0`, `752993a`) |
| B | คอมเมนต์ที่ "พูดซ้ำสิ่งที่ไฟล์อื่นเขียนไว้แล้ว" | ✅ กวาด inventory ใหม่ แก้ 47 ไฟล์ และ merge เข้า `main` แล้ว (`51c9676`) |
| C | `api/CLAUDE.md` + `invoice-view-api.example.md` | ✅ แก้แล้ว |

กอง B ถูกเลื่อนในตอนแรกโดยตั้งใจ เพราะเป็นงานใช้วิจารณญาณ ไม่ใช่ "ผิดเพราะเป็นสถานะ" แบบกอง A
⇒ รอบปิดงานใช้ inventory ใหม่, แก้เฉพาะคอมเมนต์, และให้ reviewer ตรวจ diff ก่อน merge

🔴 **inventory เดิมใช้ไม่ได้แล้ว** — มันถูกทำขึ้นก่อนการรีไรต์ 36 ไฟล์ หลายรายการถูกเขียนใหม่ไป
แล้ว และ §2.10 เพิ่งลบโค้ดทิ้งอีกก้อนใหญ่ ⇒ รอบปิดงานจึงกวาดใหม่ทั้ง repository และไม่ยึดจำนวน
`~35` เดิม

⚠️ ระวังกฎข้อ (d) ของ `AGENTS.md` ("อย่าพูดซ้ำสิ่งที่ไฟล์อื่นบอก") **ยิงเกินเป้าได้ง่าย** —
คอมเมนต์ที่ช่วยให้คนอ่านรู้ทิศ หรือระบุ invariant ที่คนจะเผลอพัง มีค่าถึงจะดู "ซ้ำ" ก็ตาม
นั่นคือเหตุผลที่รอบปิดงานเก็บคอมเมนต์ invariant และข้อห้ามไว้ แม้จะลบคำอธิบาย pipeline,
field map, และสถานะ transport ที่ซ้ำหรือเก่า

**ตรวจแล้ว 2026-08-11: ก่อนหน้านี้เรื่องนี้ไม่ได้ถูกบันทึกไว้ที่ไหนเลย** ไม่มีทั้งในแผน ใน charter
หรือใน `AGENTS.md` — มีแต่กฎที่กันไม่ให้เขียนคอมเมนต์แบบนั้น*ใหม่* ซึ่งไม่ได้ทำให้ของเก่าหายไป
⇒ ตอนนี้ปิดงานและบันทึก commit ไว้ที่นี่แล้ว เพื่อไม่ให้สถานะหายไปพร้อม transcript

### ช่องว่างที่รู้ตัวแล้ว ไม่ใช่บั๊กที่เพิ่งทำพัง

- ~~`order_link_failed` มีเทสต์คลุมแค่ `rejected` ไม่มี `unknown`~~ ✅ **ตกยุคแล้ว (ตรวจซ้ำ
  2026-08-14)** — `tests/server/unit/modules/invoices/invoice.service.dry-test.ts:278-301` คลุม
  ครบทั้ง `rejected` และ `unknown` แล้วจริง ไม่ใช่ช่องว่างอีกต่อไป
- **ไม่มี idempotency key บน `invoice_number`** ⇒ retry หลัง `items_write_failed` ที่ certainty
  เป็น `unknown` จริงๆ ยังทำให้ line item ซ้ำได้ถ้ารอบแรกเขียนสำเร็จไปแล้ว
  🔴 **ตรวจซ้ำ 2026-08-14 (grok-explorer + spot-check เอง) — ข้อความนี้ตกยุคไปครึ่งนึง:**
  certainty gate **มีแล้วจริง** — `classifyWriteFailure` (`invoice.service.ts:156`) แยก
  `rejected`/`unknown`, ทุก outcome ที่เขียนพลาดพก `certainty` ติดไปด้วย, และ frontend
  `canRetry` (`src/features/invoices/utils/invoice-outcome.utils.ts:8-12`) บล็อก retry เมื่อ
  `unknown` อยู่แล้ว (allow เฉพาะ `items_write_failed` + `rejected`) ช่องว่างที่ยังจริงมีแค่:
  (1) ไม่มี pre-flight เช็คว่า `sourceOrderId` มี `invoice_id` อยู่แล้วก่อนสร้างใหม่
  (`invoice.service.ts:348-526` ไม่มีขั้น read-check ก่อน `batchAppend`) และ
  (2) `InvoiceItems.batchAppend` ไม่มี dup pre-check (`sheet.repository.ts:328-432`) ต่างจาก
  single `append` ที่มี `rejectDuplicateAppendKey` แล้ว (`sheet.repository.ts:207-275`) — item id
  สุ่มใหม่ทุกครั้ง (`invoice.service.ts:374`) เลยไม่มีอะไรชนกันเวลา retry
- **คอมเมนต์ในเส้นทาง serialize ยังเขียนว่า SheetLib** ทั้งที่สองชีตนี้ย้ายแล้ว — **§2.10 จะลบ
  เส้นทางนั้นทิ้งอยู่แล้ว จึงต้องเขียนคอมเมนต์ใหม่ตอนนั้น** แก้ตอนนี้จะเสียเปล่า

---

## 2. Prerequisite — ปิดครบแล้ว (2026-08-10) เหลือข้อเดียวที่ยังไม่ยืนยัน

| # | ทำอะไร | สถานะ |
|---|---|---|
| 1 | แยก `PORTAL_SPREADSHEET_ID` ออกจาก `ORDERS_SPREADSHEET_ID` | ✅ โค้ดแยกแล้ว + เจ้าของแก้ค่าให้ชี้ `1tfgJvj` (OrderForm) แล้ว · ยืนยันแล้วว่าไม่มี read path ไหนพัง |
| 2 | เพิ่ม `INVOICES_SPREADSHEET_ID` = `1zfhguJ…` | ✅ อยู่ใน `.env.local` และผูกเข้า `Invoices`/`InvoiceItems` contract แล้ว |
| 3 | Provision service account | ✅ แชร์ไว้แล้ว · `sheets-api-access-check.ts` ยิงผ่านครบ 3 workbook |

### ✅ env บน Vercel ตรวจแล้ว — ตรงกับ local ครบ

ตรวจคืน 2026-08-10 ด้วย `vercel env pull --environment=production` แล้วเทียบ prefix:
`ORDERS_SPREADSHEET_ID` `1tfgJvj`, `INVOICES_SPREADSHEET_ID` `1zfhguJ`,
`PORTAL_SPREADSHEET_ID` `1ucqeUq`, `APPOINTMENTS_SPREADSHEET_ID` `1CvVl6a` — **ตรงทั้ง 4**

### ✅ `GOOGLE_SERVICE_ACCOUNT_KEY` ฝั่ง server — พิสูจน์แล้ว (2026-08-10, ผ่าน local ไม่ใช่ preview)

`vercel env pull` **ไม่คืนค่าของ key นี้** (ตั้งเป็น Sensitive — ถูกต้องแล้วด้านความปลอดภัย)
เดิมกังวลว่า key บน server อาจเป็นคนละ service account กับ local — **สิ่งที่เจอจริงคือคนละเรื่อง:**
key ที่ mark Sensitive ไม่ได้ครอบ Development tier เลย (`vercel dev` จึงไม่เห็นค่า) เจ้าของเพิ่ม
key แยกสำหรับ Development แล้ว ตอนนี้พิสูจน์แล้วว่าเป็น service account เดียวกันและเขียนได้จริง
ผ่าน §2.9 stage 1 smoke test (ดูหมวด 1b) — **ยังไม่เคยพิสูจน์บน preview/production deploy จริง**
เพียงแต่ local dev ผ่านแล้วเท่านั้น ก่อน merge ควรพิสูจน์บน preview อย่างน้อยหนึ่งครั้งเช่นกัน

### ✅ เรื่องใหญ่ 6 ข้อ — ตัดสินครบแล้ว 2026-08-10

`writes: false` สำหรับ Customers (ชั่วคราว จะเปิดหลัง refactor) · `USER_ENTERED` ทั้งแถว ·
map error class ใหม่ให้ครบ · `delete` โยน "ยังไม่รองรับ" · **metadata timestamp ทุกชีตต้องเป็น
`2026-08-09 23:15:21` และเป็น datetime จริง** · Appointments ต้องมี `certainty`

**ตารางคำตัดสินเต็ม + ที่มา + ข้อจำกัดที่ต้องรู้** อยู่ที่หมวด 3 ของ
[`session-2026-08-10-overnight.md`](./session-2026-08-10-overnight.md)

**ลำดับที่เจ้าของกำหนด:** §2.9 ให้จบก่อน แล้วใช้การแก้ timestamp เป็น **smoke test ของ
transport ใหม่** (เขียน 1 แถว → ตรวจ → ยิงที่เหลือ)

รายละเอียดครบพร้อมทางเลือกอยู่ในหมวด 3 ของ **[`session-2026-08-10-overnight.md`](./session-2026-08-10-overnight.md)**
— รายงานงานที่ทำระหว่างเจ้าของโปรเจกต์นอน อ่านไฟล์นั้นก่อนเริ่ม §2.9

รายละเอียดอยู่ใน §2.0–§2.10 ของแผน

---

## 3. วิธีทำงาน — สามฝ่าย

| ใคร | ทำอะไร |
|---|---|
| **Claude** | เขียน brief, ตัดสินใจเชิงสถาปัตยกรรม, **ตรวจงาน** — ไม่แก้โค้ดเอง |
| **Codex `gpt-5.6-luna`** | เขียนและแก้โค้ดทั้งหมด |
| **Grok** | สำรวจโค้ด, สืบหาสาเหตุบั๊ก, audit — ไม่แก้อะไร |

คำสั่งเรียกอยู่ใน `CLAUDE.md` หมวด **Delegating code to Codex luna** — อ่านก่อนเริ่ม

**subagent `luna-pipeline`** (`.claude/agents/luna-pipeline.md`, local เท่านั้น — ไม่ push
เพราะ `.claude/` อยู่ใน `.gitignore`) ทำ loop dispatch→verify→grok review→ส่งกลับไปแก้ที่ luna
session เดิม→ทำซ้ำจนผ่าน ให้อัตโนมัติ **เมื่อ brief เขียนเสร็จแล้ว** มันไม่แก้/วิเคราะห์/เสนอ
อะไรกับ brief เอง เป็น pure executor เท่านั้น — งานเขียน brief กับการตัดสินใจเชิงสถาปัตยกรรม
ยังอยู่กับ Claude เหมือนเดิม

**สถิติจริงถึงตอนนี้ (2026-08-09): ใช้ 4 ครั้ง สำเร็จทั้ง 4** — §2.5 (1 review cycle, ไม่มี
finding), §2.6 (จบ turn ตัวเองก่อนเสร็จรอบแรก ต้อง resume สั่งทำต่อ — ดูหมวด 1b ด้านบน — รอบสองผ่าน),
§2.7 (2 review cycle, จับบั๊กตัวเอง 1 + grok เจอ regression ข้ามไฟล์ 1), valueInput fix
(1 review cycle, ไม่มี finding) **บั๊ก "จบ turn ก่อนงานเสร็จ" ที่เจอตอน §2.6 ถูกแก้เข้าไปใน
ตัว agent definition แล้ว** (ห้ามอ้างว่า "ตั้ง background monitor" อีก ต้องทำให้จบใน turn
เดียวเสมอ) — ไม่ต้องเตือนซ้ำใน prompt ทุกครั้งที่เรียกอีกต่อไป

**อัปเดต 2026-08-10: ใช้ 6 ครั้ง สำเร็จทั้ง 6** — เพิ่ม §2.8 (1 review cycle, ไม่มี finding)
และ prerequisite ของ §2.9 (1 review cycle, ไม่มี finding)

### `luna-pipeline` คือด่านตรวจรับ ไม่ใช่แค่คนรัน — Claude ห้ามตรวจซ้ำชั้นที่ 3

เจ้าของโปรเจกต์ระบุชัด (2026-08-10): สายงานคือ **grok รีวิว 1 ชั้น → sonnet ตรวจรับ 1 ชั้น →
Claude หลักเชื่อรายงานแล้วเดินต่อ** กฎ "ห้ามเชื่อรายงานของ agent" ในเอกสารนี้หมายถึง **luna
กับ grok** ไม่ได้หมายถึงตัว sonnet wrapper ซึ่งมีหน้าที่เป็นคนที่ใช้ความไม่เชื่อนั้นไปแล้ว

⇒ **เวลารายงานของ pipeline ดูไม่พอ ให้ไปแก้ที่ `.claude/agents/luna-pipeline.md` ไม่ใช่มา
ตรวจเองซ้ำ หรือแปะคำสั่งพิเศษเพิ่มใน prompt ทุกครั้ง**

สิ่งที่อุดเข้าไปแล้วรอบ 2026-08-10 (เดิมขาด ทำให้ต้องสั่งเสริมเองทุกครั้ง):
- รัน **ชุด dry-test ของ server ทั้งหมด** ไม่ใช่แค่ไฟล์ที่ luna แตะ (เดิมพลาดมาแล้วที่ §2.7 —
  grok เป็นคนเจอ regression ข้ามไฟล์ ไม่ใช่ pipeline)
- `npm run build` เสมอแม้เป็นงาน backend ล้วน เพราะ frontend ไม่มี type-check เลย
- ถ้า diff แตะ contract → รัน `sheet-column-parity.ts` ด้วย
- **ไฟล์ใต้ `tests/` ถูกแก้โดยที่ brief ไม่ได้อนุญาต = blocker ห้ามรายงานว่าผ่าน**
- report contract บังคับให้แนบ `git diff --stat` + ผล mutation test ทุกข้อ (พังยังไง แดงที่
  assertion ไหน revert สะอาดไหม)
- หมวดใหม่ "ห้ามรายงานว่าผ่านถ้า…" เพื่อให้คำว่า accepted มีความหมายเดียว

### `test-pipeline` — agent ใหม่สำหรับ §2.9 (`.claude/agents/test-pipeline.md`)

§2.9 ใหญ่และแตะข้อมูลจริงเป็นครั้งแรก จึงแยก **คนคิดเรื่องการทดสอบ** ออกจากคนเขียนโค้ด

| ด้าน | ที่ตั้งไว้ |
|---|---|
| หน้าที่ | ตอบคำถามเดียว — "ถ้ามันผิด เราจะรู้ได้ยังไง" ไม่ออกแบบฟีเจอร์ ไม่เถียงสถาปัตยกรรม |
| เขียนโค้ด | **ไม่เขียนเอง** สั่ง luna เขียนทั้งหมด ยกเว้น mutation test ชั่วคราวที่ revert เสมอ |
| ลูกทีม | luna (เขียน/แก้), grok (สืบสาเหตุตอนเทสต์แดง + รีวิว diff) เรียกตรงผ่าน Bash ไม่ spawn subagent |
| Phase A | วาง **test charter** ก่อน implementation: แต่ละข้อต้องพิสูจน์อะไร และจับได้ด้วยอะไร (dry-test offline / integration ยิงชีตจริง / เฉพาะ deploy จริง / เฉพาะคนเปิดชีตดู) แล้ว **หยุดรออนุมัติ** |
| Phase B | รันจริงหลัง §2.9 เขียนเสร็จ + mutation test ทุก guard + วนแก้สูงสุด 3 รอบ |

ข้อห้ามที่สำคัญที่สุดในตัวมัน: **ห้ามเขียนลงชีตเพื่อทดสอบเด็ดขาด** (ข้อมูลลูกค้าจริง) ถ้าต้อง
เขียนถึงจะพิสูจน์ได้ ให้บอกเจ้าของแล้วเจ้าของเป็นคนกดเอง · และ **ห้ามลดความปลอดภัยของระบบ
เพื่อให้เทสต์รันได้** (เปิด public, ขยาย scope, ปิด check)

### หัวใจ 4 ข้อ

**brief คือคานงัดเดียวที่มีต่อผลลัพธ์** ใส่กับดัก, สิ่งที่ห้ามเปลี่ยน, สิ่งที่ให้รายงานแทนแก้,
และระบุว่าเทสต์ตัวไหนได้รับอนุญาตให้เปลี่ยน ตัวไหนห้ามแตะ — **พร้อมเหตุผลเสมอ**
กฎที่มีเหตุผลจะอยู่รอด กฎเปล่าๆ จะถูกหาทางเลี่ยง (เคยเกิดจริง: สั่งข้อกำหนดที่เป็นไปไม่ได้
luna เลยยัด loader hack เข้าไปในไฟล์เทสต์เพื่อให้ผ่าน)

**ห้ามตรวจจากรายงานของ agent** luna รายงาน "สำเร็จ" ทุกครั้ง รวมถึงงานที่มีข้อบกพร่องจริง —
เทสต์ที่ผ่านทั้งที่ regression ยังอยู่, ชุดเทสต์ที่ "ผ่าน" แต่ทำให้คำสั่งในเอกสารพังไปแล้ว
ส่วน grok ก็เคยอ้างเหตุผลที่ผิด (บอกว่าไฟล์กู้ได้จาก git history ทั้งที่อยู่ใน `.gitignore`)

**ทุก guard ต้องพิสูจน์ด้วยการทำของพัง** เขียนเทสต์แล้วเห็นเขียวไม่ได้แปลว่ามันกันอะไรได้
กฎหลายข้อในโปรเจกต์นี้ typecheck มองไม่เห็นเลย — ลำดับ key ของ schema, lazy construction,
`kind` ของ JSON column, ค่าใน fieldMap ทั้งหมดผ่าน typecheck ได้ทั้งที่ผิด

**ถ้า workaround ที่ได้กลับมาใหญ่เกินสัดส่วนของปัญหา ให้สงสัย brief ก่อน ไม่ใช่สงสัยฝีมือมัน**

### resume หรือเปิดใหม่

ส่งงานเดิมกลับไปแก้ → `resume` (มันจำได้ว่าเพิ่งทำอะไร ไม่ต้องอ่านโค้ดใหม่ทั้งหมด)

งานใหม่คนละเรื่อง → session ใหม่ · **อย่าต่องานที่ไม่เกี่ยวกันเข้า session เดียวเพื่อประหยัด token**
เคยสะสมถึง 371k แล้ว compact ตัวเองทิ้งโดยไม่ออกรายงาน

### กฎเหล็ก

- **`G:\My Drive\Magicwash\Database\GoogleSheets\*.json` เป็น read-only** ห้ามเขียนโดยไม่ได้รับ
  อนุญาต**เฉพาะครั้งนั้น** — อนุญาตครั้งหนึ่งไม่ต่อเนื่องไปครั้งถัดไป และ agent ที่ delegate ไป
  **ห้ามเขียนเด็ดขาดทุกกรณี** ต้องเขียนข้อนี้ในทุก brief ที่พูดถึง registry
- delegate ด้วย `-s workspace-write` เท่านั้น **ห้าม full-auto หรือ bypass sandbox**
- ถ้ามี process ค้างเยอะ background task จะถูก kill โดยไม่มีสาเหตุชัดเจน — เคยค้าง 49 ตัว
  เก็บได้ 17 ตัว/416MB ตรวจด้วย `Get-CimInstance Win32_Process` แล้วฆ่าเฉพาะที่เริ่มก่อนวันนี้
  (ไล่ parent chain ของตัวเองออกมาก่อน อย่าฆ่า session ตัวเอง)

---

## 4. บทเรียนที่จ่ายด้วยของจริงมาแล้ว — อย่าเรียนซ้ำ

**registry เป็นเอกสาร และเอกสารตกยุคได้ ชีตคือความจริง**
`Appointment.json` ประกาศ 15 คอลัมน์ ชีตจริงมี 17 เราเชื่อ registry แล้วตัด 2 คอลัมน์ทิ้ง →
GViz คืนคอลัมน์ที่ resolve ไม่ได้ → `INTERNAL_ERROR` บน production
**typecheck + dry-test 25 ไฟล์ + `npm run build` ไม่จับเลยสักอย่าง**

⇒ รัน `sheet-column-parity.ts` ก่อน deploy ทุกครั้งที่แตะ contract

**fixture ต้องตรงกับความจริง ไม่ใช่ตรงกับโค้ด**
เทสต์ไม่จับบั๊กข้างบนเพราะ fixture ถูกแก้เป็น 15 คอลัมน์ให้ตรงกับโค้ด และ `rename-parity`
ถึงขั้น **assert ว่าคอลัมน์ที่หายไปนั้นถูกต้อง** — ปักบั๊กไว้เป็นความจริง

**deploy จริงเท่านั้นที่จับบั๊กบางคลาส**
`.js` extension ที่หายใน ESM import — typecheck, dry-test และ `vercel dev` มองไม่เห็นทั้งหมด
เคยทำ production ล่มทั้งระบบมาแล้วครั้งหนึ่ง

**comment ที่ตายแล้วเป็นคำสั่งสำหรับ agent**
มันแยกไม่ออกระหว่าง "เคยจริง" กับ "จริงอยู่" และ comment อยู่ใกล้โค้ดกว่าเอกสาร เวลาขัดกัน
comment ชนะ — เคยเจอ comment อ้างว่ามี runtime check ที่ไม่มีจริง ซึ่งทำให้ **reviewer
รับรองบั๊กว่าปลอดภัย** เวลาลบหรือเปลี่ยนพฤติกรรม ให้ล่า comment ที่อธิบายมันในรอบเดียวกัน

**การลบเทสต์คือจุดที่งานลบพลาดง่ายที่สุด** เพราะชุดเทสต์เขียวเหมือนกันทั้งสองแบบ
ตอนลบ stack เก่ามี 5 พฤติกรรมที่เหลือ **guard เดียวในระบบ** แล้วหายไปพร้อมเทสต์ที่ถูกลบ
ต้อง audit เสมอว่าพฤติกรรมที่เทสต์เก่าคุมไว้ ยังมีใครคุมอยู่ไหม

**`codex exec` บน Windows sandbox `elevated` มีบั๊ก upstream ที่เปิดอยู่** (ดู
[[codex-windows-apply-patch-fix]] ในความจำ) — ระหว่างรันอาจโยน `CreateProcessAsUserW failed:
1312` หรือ access violation ซ้ำๆ ตอนสั่ง shell และ background task อาจถูกรายงานว่า "killed"
ทั้งที่ `codex.exe` ลูกไม่ได้ตายจริง เหลือเป็น orphan ถือ lock ของ session thread ไว้ อาการ:
เรียก `resume` ซ้ำแล้วฟ้อง `thread ... already has an active writer`
วิธีแก้: เช็ค `git status` ก่อนว่ามีอะไรถูกเขียนจริงหรือยัง (ปกติยังสะอาดเพราะบั๊กมักเกิดตอน
อ่านไฟล์ ก่อนจะเขียนจริง) แล้วหา process ด้วย `Get-CimInstance Win32_Process` จับคู่ด้วย
command line ที่ตรงเป๊ะกับที่เราสั่งเอง + เวลาสร้างใกล้เคียง (**ห้าม kill process ที่จับคู่ไม่ชัด
เจน** อาจมี session อื่นที่ไม่เกี่ยวกันรันอยู่พร้อมกัน) `Stop-Process -Force` ตัวลูกก่อนแล้วค่อย
ตัวแม่ แล้ว `resume` ใหม่ ⇒ runbook นี้ถูกฝังเข้า `luna-pipeline` subagent แล้วแบบคำต่อคำ
ไม่ต้องมาไล่หาใหม่ทุกรอบ

**ค่าที่แสดงในชีตถูกต้อง ไม่ได้แปลว่า type ที่เก็บจริงตรงกับที่ประกาศไว้**
(2026-08-09, §2.7 smoke test) `Invoices.created_at` แสดงผล `2026-08-09 23:15:21` ถูกเป๊ะ
ตา — แต่ GViz รายงาน column type เป็น `datetime` ไม่ใช่ `string` ตามที่ `z.string()` ประกาศไว้
ใน db-contract เพราะคอลัมน์ในชีตไม่ได้ format เป็น Plain Text (Google Sheets auto-coerce
ให้เอง) มองจาก UI/สายตาไม่มีทางเจอเลย ต้องยิง GViz query ตรงเข้าไปเช็ค raw response ถึงจะเห็น
⇒ **สโมคเทสต์ต้องเช็ค raw data type ผ่าน query จริง ไม่ใช่แค่เปิดชีตด้วยตาดูว่าค่าดูโอเค**
(กรณีนี้จบด้วยการตัดสินใจเก็บ datetime ไว้ตั้งใจแทนที่จะแก้กลับ — ดูหมวด 1b ด้านบน)

**อ่านสำเร็จไม่ได้แปลว่ามีสิทธิ์เขียน — ทุก workbook ในโปรเจกต์นี้เปิด public read**
(2026-08-10) ตอนออกแบบด่านตรวจสิทธิ์ service account แผนแรกคือ "ยิงอ่าน portal แล้วต้องโดน
ปฏิเสธ" ซึ่งใช้ไม่ได้เลย เพราะใครก็อ่านได้อยู่แล้ว ⇒ เทสต์จะเขียวหรือแดงโดยไม่เกี่ยวกับสิทธิ์เขียน
สักนิด **เทสต์ที่ให้ความมั่นใจปลอมแย่กว่าไม่มีเทสต์** ⇒ เปลี่ยนไปกันที่ระดับ binding แทน
(contract ที่เขียนได้ ห้ามผูก portal) ซึ่งจับความผิดพลาดที่เกิดจริงได้ตรงกว่าและไม่ต้องพึ่งสิทธิ์เลย
⇒ **ก่อนเขียนเทสต์ ถามก่อนว่ามันแยกกรณีถูกออกจากกรณีผิดได้จริงไหม ไม่ใช่แค่ว่ามันรันผ่านไหม**

**ด่านที่ hardcode รายชื่อจะไร้ค่าพอดีตอนที่ต้องการมันที่สุด**
`writing-workbook-binding.dry-test.ts` ไล่ค้น contract ทุกตัวในระบบเอง ไม่ได้ลิสต์ชื่อชีตไว้
เพราะชีตที่ถูกเพิ่มเข้ามาในอนาคตคือชีตที่ยังไม่มีใครเคยตรวจ — ถ้าลิสต์ไว้ มันจะเงียบพอดีตอนมี
ของใหม่เข้ามา mutation test ข้อ 2 ของงานนั้นพิสูจน์เรื่องนี้โดยเฉพาะ (แก้ชีตที่เดิม read-only
ให้เขียนได้ แล้วด่านต้องแดงเอง)

**brief ของ agent ที่รันขนานกัน ต้องอยู่คนละโฟลเดอร์ที่อีกตัวมองไม่เห็น**
(2026-08-11) สั่ง luna-pipeline สองตัวขนานกัน (§2.10 กับ `certainty`) วาง brief ทั้งสองใบไว้ใน
scratchpad โฟลเดอร์เดียวกัน · Luna ฝั่ง `certainty` ทำงานตัวเองเสร็จถูกต้อง **แล้วไปทำ §2.10
ต่อเองโดยไม่มีใครสั่ง** — งานของอีกตัวที่ brief เขียนห้ามแตะไว้ชัดเจน
⇒ `-s workspace-write` จำกัด **การเขียน** ไว้ใน repo แต่ **ไม่จำกัดการอ่าน** มันจึงอ่านใบสั่งของ
อีกตัวเจอ · **การเขียน "ห้ามแตะ path นี้" ใน brief ไม่พอ ถ้ามันอ่านใบสั่งของคนอื่นได้ตั้งแต่แรก**
งานที่ถูกห้ามกลายเป็นงานที่ถูกเชิญ ⇒ ครั้งหน้าแยกโฟลเดอร์ต่อ agent

ผลที่ตามมาไม่ใช่แค่เรื่องระเบียบ: ทั้งสอง pipeline อ้างความเป็นเจ้าของไฟล์ §2.10 ชุดเดียวกัน
⇒ **แยกไม่ได้ว่าใครเขียนบรรทัดไหน** ทางออกที่ใช้จริงคือเลิกสนใจว่าใครเขียน แล้วพิสูจน์
**สถานะปลายทาง** แทน (ปลายทางที่ถูกมีหน้าตาเดียว ไม่ว่าใครพิมพ์) ซึ่งตรวจแล้วสะอาด ไม่มี
ร่องรอยทำซ้ำสองรอบ

**สิ่งที่ทำงานถูกในเหตุการณ์นั้น:** pipeline **ทั้งสองตัวหยุดและรายงาน ไม่ยอมรับรองงาน** — ตัวหนึ่ง
ปฏิเสธที่จะรัน verify บนทรีที่ปนเปื้อน (เพราะเขียวแล้วจะกลายเป็นการรับรองงานที่ไม่ได้สั่ง) อีกตัว
ปฏิเสธที่จะขยายขอบเขตตัวเองเพื่อให้ typecheck เขียว **นี่คือพฤติกรรมที่ต้องการเป๊ะ** ถ้ามันเงียบ
แล้วรายงานว่าผ่าน เราจะ merge ของที่ไม่มีใครตรวจ

**mutation test เป็นงานของ `test-pipeline` ไม่ใช่ของ Claude**
(2026-08-11) รอบ §2.10 + `certainty` Claude ตัดสินว่ารายงานเชื่อไม่ได้ (ถูก — ข้อยกเว้น "เชื่อ
sonnet wrapper" ตั้งอยู่บนสมมติฐานว่า pipeline ทำงานในกรอบ ซึ่งรอบนั้นไม่จริง) **แต่แล้วลงมือ
mutation test เอง ซึ่งต้องแก้ไฟล์ production** · ข้อยกเว้น "แก้ได้เฉพาะ mutation test ที่ revert
เสมอ" เขียนไว้สำหรับ **pipeline** ไม่ได้เขียนไว้สำหรับ Claude
⇒ ข้อสรุปที่ถูกควรนำไปสู่ **"เรียก `test-pipeline` Phase B"** ไม่ใช่ **"ลงมือเอง"**
ราคาที่จ่ายจริง: `appointment.service.ts` line ending เพี้ยน 91 บรรทัด (LF→CRLF) จากการที่
Claude ใช้ Edit แทน `apply_patch` ต้องเสียเวลาพิสูจน์ว่าไม่กระทบ

**commit ให้จบก่อนส่ง agent เสมอ — และห้ามแก้ไฟล์ในทรีขณะที่ agent กำลังทำงานอยู่**
(2026-08-11) ระหว่างที่ luna-pipeline รันงานกวาดคอมเมนต์ Claude ไปเขียนหมวดใหม่ใน `AGENTS.md`
พร้อมกัน · brief เขียนยกเว้นไว้แค่ `docs/*` ซึ่ง `AGENTS.md` อยู่ที่ราก จึงไม่เข้าข่าย ⇒ pipeline
เห็นไฟล์นอกขอบเขตถูกแก้ **จึงสั่ง revert ทิ้งอย่างถูกต้องตามคำสั่งทุกประการ** แล้วสรุปผิดว่าเป็น
scope creep ของ luna ทั้งที่เป็นงานของ Claude เอง
⇒ ทรีที่สะอาดคือสิ่งเดียวที่ทำให้ "งานของใคร" ตอบได้ และทำให้ทิ้งงานที่ผิดด้วย `checkout` ได้
⇒ **ขอบเขตใน brief ต้องระบุความเป็นเจ้าของเป็นราย path ให้ครบ ไม่ใช่ยกเว้นเป็น glob กว้างๆ**
glob ที่ครอบไม่ถึงคือช่องที่ agent จะลบงานของคนอื่นโดยทำตามคำสั่งเป๊ะ

**เมื่อแผนขัดกับความจริงของโค้ด ให้แก้แผนในคอมมิตเดียวกับที่ทำงาน**
§2.8 สั่งให้แปะ comment บนสิ่งที่ยังไม่เกิด ทำตามตัวอักษรแล้วจะได้ comment โกหก ⇒ ขยายขอบเขต
พร้อมเขียนข้อความแทนที่ §2.8 ในแผนให้ตรงกับของจริง **ในคอมมิตเดียวกัน** ถ้าปล่อยให้แผนค้างไว้
แบบเดิม session ถัดไปจะอ่านแผนแล้วสับสนกับโค้ด และ agent จะเชื่อเอกสารที่ผิด

---

## 5. ตรวจอะไรได้บ้าง

```bash
npm run typecheck:api
npx tsx tests/server/<path>/<name>.dry-test.ts
npx tsx --tsconfig jsconfig.json tests/web/<path>/<name>.dry-test.ts
npm run build
git diff --check
node --env-file=.env.local --import=tsx/esm tests/server/integration/sheet-column-parity.ts
node --env-file=.env.local --import=tsx/esm tests/server/integration/sheets-api-access-check.ts
```

ไม่มี test runner ในโปรเจกต์ รันทั้งชุดด้วยลูปนี้ (PowerShell):

```powershell
$fail=@(); Get-ChildItem -Recurse -Path tests/server -Filter *.dry-test.ts | ForEach-Object { npx tsx $_.FullName *> $null; if ($LASTEXITCODE -ne 0) { $fail += $_.FullName } }; if ($fail) { "FAILED:"; $fail } else { "ALL PASS" }
```

`tests/web` ต้องมี `--tsconfig` เพราะ import โค้ด `src/` ที่ใช้ `@/` alias ซึ่ง `tsx` เปล่าๆ resolve ไม่ได้
ส่วน `tests/server` ใช้ relative `.js` จึงไม่ต้อง

### ยิง API ทดสอบยังไง

**ตอนนี้ Vercel Authentication ถูกปิดอยู่** ⇒ `curl` ยิงตรงได้เลย ทั้ง preview และ production:

```bash
curl -s "<url>/api/appointments?perPage=1"
curl -s "<url>/api/invoices?perPage=1"
curl -s "<url>/api/customer-packages/tst00002"
curl -s "<url>/api/orders?customerId=4fa28819&perPage=1"   # ต้องมี customerId เสมอ
```

หา URL ล่าสุดด้วย `vercel ls` (แถวบนสุด = ใหม่สุด)

**ถ้าเปิด protection กลับแล้ว** `curl` จะได้ 302 ไป `vercel.com/sso-api` ต้องเปิดผ่าน Chrome
ที่ login Vercel ค้างอยู่แทน (Chrome automation ขับ profile ของ user ได้ · codex ต่อ profile ได้
แต่เคยโดน extension บล็อกด้วย `ERR_BLOCKED_BY_CLIENT`)

### ⚠️ ความเสี่ยงที่ต้องรู้ — protection ที่ปิดอยู่ตอนนี้

Hobby plan ปิด/เปิด Vercel Authentication **ได้แค่ทั้งหมดหรือไม่ทั้งหมด** เลือกเฉพาะ preview ไม่ได้
และ **Protection Bypass for Automation เป็นฟีเจอร์ของ Pro** ใช้ไม่ได้บน Hobby

การปิดจึงทำให้ **production เปิดโล่งไปด้วย** และตรวจแล้วว่า **API ไม่มี auth ชั้นของตัวเองเลย** —
ไม่มี `Authorization` header, ไม่มี bearer token, ไม่มี `verifyIdToken` ที่ไหนใน gateway หรือ handler
(Firebase ใช้ auth เฉพาะฝั่ง frontend ซึ่งไม่ได้ป้องกัน `/api/*`)

ยืนยันด้วยการยิง production จริงแล้วได้ข้อมูลลูกค้า — ชื่อ เบอร์โทร ที่อยู่ ยอดเงิน — โดยไม่ต้อง login

**เจ้าของโปรเจกต์รับทราบและตั้งใจปิดไว้ชั่วคราว** — ระบบยังไม่มีผู้ใช้จริง ความเสี่ยงตอนนี้จึงต่ำ
และจะเปิดกลับเมื่อ refactor เสร็จ อย่าไปเปิดกลับเองระหว่างทางเพราะจะทำให้ทดสอบไม่ได้

⇒ **ต้องเปิดกลับก่อนระบบเริ่มมีผู้ใช้จริง** ข้อมูลในชีตเป็นข้อมูลลูกค้าจริงแล้ววันนี้
ไม่ใช่ข้อมูลทดสอบ
⇒ **งานที่ควรทำแยกต่างหาก ไม่ใช่ส่วนหนึ่งของ Phase 2:** เพิ่ม auth ชั้น API เอง
(ตรวจ Firebase ID token ที่ `server/shared/http/api-gateway.ts` จุดเดียว) แล้วระบบจะไม่ต้องพึ่ง
Vercel Authentication อีก — ตอนนี้ความปลอดภัยอาศัยแค่ว่า URL เดายาก ซึ่งไม่ใช่การป้องกัน

---

## 6. ไฟล์ที่ควรรู้จัก

| ไฟล์ | คืออะไร |
|---|---|
| `docs/database-layer-sheets-api-refactor-plan.md` | แผนเต็ม + สถานะปิด Phase 1 |
| `CLAUDE.md` | กฎ frontend + **วิธี delegate ให้ luna** |
| `AGENTS.md` / `api/CLAUDE.md` | กฎ backend — เขียนใหม่แล้วให้ตรงสถาปัตยกรรมปัจจุบัน |
| `server/shared/repositories/sheet.repository.ts` | หัวใจของ write transport — แต่ **ไม่ใช่ไฟล์เดียวที่ต้องแก้** stage 1 แตะ 8 ไฟล์ (repo + `sheet-contract.ts` + db-contract ของชีตนั้น + service ที่ map error + เทสต์ 4 ไฟล์) |
| `server/shared/repositories/sheet-repository.contract.ts` | interface ที่ storage-agnostic — seam ของ Supabase |
| `server/shared/contracts/sheet-contract.ts` | structural guard ของ db-contract ทุกชีต |
| `server/shared/repositories/sheet-row-lookup.ts` | §2.8 — หาเลขแถวจากค่า key **+ doc เรื่อง race ที่ยอมรับไว้ อ่านก่อนแตะ §2.9** |
| `tests/server/integration/sheet-column-parity.ts` | ด่านเทียบ contract กับชีตจริง — ครบ 8 ชีตแล้ว |
| `tests/server/integration/sheets-api-access-check.ts` | ยืนยัน service account auth ใช้ได้จริง (ไม่ได้พิสูจน์สิทธิ์เขียน) |
| `tests/server/unit/sheets/writing-workbook-binding.dry-test.ts` | ชีตที่เขียนได้ ห้ามผูก `PORTAL_SPREADSHEET_ID` |
| `.claude/agents/luna-pipeline.md` | pipeline เขียนโค้ด + **ด่านตรวจรับ** (local เท่านั้น ไม่ push) |
| `.claude/agents/test-pipeline.md` | test architect + ด่านตรวจรับสำหรับ §2.9 (local เท่านั้น) |

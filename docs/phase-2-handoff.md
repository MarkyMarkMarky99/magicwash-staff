# Handoff — เริ่ม Phase 2

เขียนเมื่อ 2026-08-09 ตอนปิด Phase 1 สำหรับ session ใหม่ที่จะทำ Phase 2 ต่อ

แผนเต็มอยู่ที่ `docs/database-layer-sheets-api-refactor-plan.md` — **อ่านหมวด "สถานะ (ปิด Phase 1)"
ที่ต้นไฟล์นั้นก่อน** เอกสารนี้เสริมเรื่องที่แผนไม่ได้เขียน: วิธีทำงาน และสิ่งที่เรียนรู้มาด้วยราคาแพง

---

## 1. อยู่ตรงไหนแล้ว

`refactor/sheet-layer` — 24 commits, push แล้ว, **ยังไม่ merge เข้า main**

Phase 1 จบครบ 8 ขั้น ได้สถาปัตยกรรม: 1 repository ต่อ 1 physical sheet ใต้ `server/sheets/`,
repository ไม่รู้จัก API contract, DB↔API mapping อยู่ที่ module, `primaryKey` เป็นชื่อคอลัมน์ DB จริง,
module→module edge เป็นศูนย์ และ stack เก่าถูกลบทิ้ง (−3,900 บรรทัด)

**การอ่านยืนยันบน production จริงแล้วครบ 5 module** — ยิงผ่าน preview deploy จริง ไม่ใช่ stub

### ⛔ ตัวบล็อกก่อน merge

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
| **§2.8 keyed update — ยอมรับ race** | ⬜ **ขั้นถัดไป** | |
| §2.9–§2.10 | ⬜ | |

**§2.2 ยังไม่ถูกต่อเข้า `SheetRepository`** — transport ปัจจุบันยังเป็น Apps Script และ write path
ยังวิ่งผ่าน Apps Script อยู่; client เขียนเสร็จแต่ยังไม่มีใครเรียก §2.3 จงใจส่งมอบเป็น building
block ก่อน โดย actual resolver wiring จะทำใน §2.9 ซึ่งเป็นจุดแรกที่มี Sheets API write consumer
การสลับ transport จริงเป็นขั้นหลัง

### ของที่ §2.2 จงใจเลื่อนไป — มี comment กำกับในโค้ดแล้ว

- header-map cache + ความกว้าง header ที่แน่นอน → §2.3 (เสร็จแล้ว) / §2.6
- full-row GET หลัง update + verify primary key → §2.6
- serialize object/array และ `valueInputOption` ต่อคอลัมน์ → §2.4 (เสร็จแล้ว)
  (เทสต์ที่ยิงสำเร็จใช้ `USER_ENTERED` แล้ว เพราะ `RAW` จะทำให้ GViz filter วันที่พัง)

### §2.4 / §2.5 เสร็จแล้ว — เหมือน §2.2/§2.3 ยังเป็น building block ไม่ต่อเข้า `SheetRepository`

§2.4 (`d83f480`) ส่งมอบ `SheetContract.valueInput` + `sheet-value-serializer.ts`
(`serializeCellValue`, `buildRowValues`, `resolveValueInputOption`,
`resolveRowValueInputOptions`) พร้อม policy ประกาศครบ 4 sheet ที่เขียนจริง — ยังไม่มีใครเรียก
รอ wiring ที่ §2.9 เหมือนเดิม

§2.5 (`bedc81e`) พบว่า **ทำไปแล้วจริงตั้งแต่ §2.2** — `sheets-api.client.ts` classify ครบทุก
phase ตามตาราง §2.5 อยู่แล้ว เหลือแค่เทสต์ 2 เคสที่ implement ไว้แต่ไม่มี dry-test คลุม (ปิด
ไปแล้ว ไม่มีโค้ด production เปลี่ยน) รายละเอียดอยู่ที่ implementation note ใต้ §2.4/§2.5 ใน
`docs/database-layer-sheets-api-refactor-plan.md`

§2.6 (`0e0ca23`) มีโค้ด production จริง 4 ชิ้น: `appendRows` รับ `knownWidth?` (Part A),
`buildRowRange` / `parseRowValues` / `readRange` / `sheet-row-identity.ts`'s
`verifyRowIdentity` + `WriteRowIdentityMismatchError` (Part B) — รายละเอียดที่ implementation
note ใต้ §2.6 ในแผน ยังเป็น building block ไม่ต่อเข้า `SheetRepository`

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
- Appointments' `CreatedAt`/`UpdatedAt`/`DeletedAt` **ไม่เกี่ยว ไม่แตะ** — เป็นคนละการ
  ตัดสินใจที่ยังยืนอยู่ (ต้องเป็น Plain Text) อย่าสับสนสอง sheet นี้เข้าด้วยกัน

⇒ **บทเรียน:** สโมคเทสต์ที่ดีไม่ใช่แค่ "กดผ่าน UI แล้วดูว่าไม่ error" — ต้องยิง query ตรงเข้าไป
เช็ค raw data type ด้วย (ไม่ใช่แค่ดูค่าที่ format ให้สวยแล้ว) ถึงจะเจอเรื่องแบบนี้ ซึ่ง UI/สายตา
มองไม่เห็นเลยเพราะ display value ถูกต้อง 100%

### บทเรียนจาก §2.2 — เพิ่มเข้ารายการหมวด 4

รอบแรกของไฟล์นี้ถูกเขียนค้างตอนเครื่องค้าง แล้วมี 2 ปัญหาที่ **typecheck จับไม่ได้**:

1. `A:Z` hardcode ในช่วง append — ตัน 26 คอลัมน์ ทั้งที่ Customers มี 20 แล้ว
   เพิ่มอีกไม่กี่คอลัมน์จะหลุดช่วงเงียบๆ
2. **เทสต์ classification ผ่านด้วยเหตุผลผิด** — mock assert พังแล้วโยน error,
   transport catch แปลง throw ทุกชนิดเป็น `WriteTransportError`, เทสต์ 5xx/network/timeout
   ก็คาด `WriteTransportError` พอดี ⇒ ผ่านไม่ว่า client จะตัดสินใจถูกหรือผิด

ข้อ 2 พิสูจน์ว่าแก้แล้วด้วยการทำ 5xx ให้จัดประเภทผิด → เทสต์แดง 6 ตัว (ก่อนแก้แดง 0)

⇒ **เวลาเขียนเทสต์ error classification ระวังว่า mock ที่พังเองอาจทำให้เทสต์ผ่าน**

---

## 2. Prerequisite ที่เหลือ

| # | ทำอะไร | ทำไมต้องก่อน |
|---|---|---|
| 1 | แยก `PORTAL_SPREADSHEET_ID` ออกจาก `ORDERS_SPREADSHEET_ID` (deploy 2 เฟส) | **ตอนนี้ `ORDERS_SPREADSHEET_ID` ชี้ผิด workbook สำหรับ OrderForm** วันนี้ไม่มีผลเพราะ OrderForm ไม่เคยถูก GViz อ่าน แต่พอเขียนผ่าน Sheets API ค่านี้ชี้ workbook จริง → เขียนผิดที่ |
| 2 | เพิ่ม `INVOICES_SPREADSHEET_ID` = `1zfhguJ…` | `Invoices`/`InvoiceItems` ยังไม่มี `spreadsheetId` เพราะเขียนอย่างเดียว แต่ Sheets API ต้องใช้ |
| 3 | Provision service account | แชร์ Editor **เฉพาะ 3 workbook ที่เขียนจริง** — `1tfgJvj` OrderForm, `1CvVl6a` Appointments, `1zfhguJ` Invoices · **ห้ามให้สิทธิ์ portal `1ucqeUq`** |

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

---

## 5. ตรวจอะไรได้บ้าง

```bash
npm run typecheck:api
npx tsx tests/server/<path>/<name>.dry-test.ts
npx tsx --tsconfig jsconfig.json tests/web/<path>/<name>.dry-test.ts
npm run build
git diff --check
node --env-file=.env.local --import=tsx/esm tests/server/integration/sheet-column-parity.ts
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
| `server/shared/repositories/sheet.repository.ts` | **ไฟล์เดียวที่ Phase 2 ต้องแก้** (write transport) |
| `server/shared/repositories/sheet-repository.contract.ts` | interface ที่ storage-agnostic — seam ของ Supabase |
| `server/shared/contracts/sheet-contract.ts` | structural guard ของ db-contract ทุกชีต |
| `tests/server/integration/sheet-column-parity.ts` | ด่านเทียบ contract กับชีตจริง |

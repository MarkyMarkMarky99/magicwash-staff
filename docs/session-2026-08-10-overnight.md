# รายงานงานกลางคืน — 2026-08-10

เจ้าของโปรเจกต์ไปนอนหลังปิด §2.8 + prerequisite ของ §2.9 และมอบให้ทำต่อได้เอง
โดยมีเงื่อนไข: **เรื่องเล็กตัดสินใจแทนได้ เรื่องใหญ่ที่กระทบจุดอื่นให้บันทึกไว้ ห้ามตัดสินเอง**

ไฟล์นี้คือสิ่งที่เกิดขึ้นในช่วงนั้น อ่านคู่กับ `phase-2-handoff.md` ซึ่งเป็นเอกสารหลัก

**สรุปหนึ่งบรรทัด:** ไม่มีการแตะ implementation ของ §2.9 เลยตามที่ตกลงกันไว้ —
งานที่ทำคือปิดช่องโหว่ที่ค้าง, สำรวจ write path เพื่อเตรียม §2.9, และวาง test charter

---

## 1. ปิดช่องโหว่ env บน Vercel — จบแล้ว ไม่ต้องทำอะไรต่อ

ตอนหัวค่ำผมเขียนเตือนไว้ใน handoff ว่า "env บน Vercel ยังไม่ได้ตรวจ ถ้าค่าไม่ตรง §2.9 จะเขียน
ผิด workbook บน production ทั้งที่ local เขียวหมด" — ตรวจแล้ว **ไม่มีปัญหา**

| ตัวแปร | local | Vercel production | ผล |
|---|---|---|---|
| `ORDERS_SPREADSHEET_ID` | `1tfgJvj…` | `1tfgJvj…` | ตรง (OrderForm ถูกเล่ม) |
| `INVOICES_SPREADSHEET_ID` | `1zfhguJ…` | `1zfhguJ…` | ตรง · มีครบทั้ง Production/Preview/Development |
| `PORTAL_SPREADSHEET_ID` | `1ucqeUq…` | `1ucqeUq…` | ตรง |
| `APPOINTMENTS_SPREADSHEET_ID` | `1CvVl6a…` | `1CvVl6a…` | ตรง |

วิธีตรวจ: `vercel env pull --environment=production <ไฟล์นอก repo>` แล้วเทียบเฉพาะ prefix
(ไฟล์ที่ pull มาถูกลบทิ้งแล้ว ยืนยันด้วย `git status` ว่าไม่มีอะไรตกค้างใน repo)

### ⚠️ แต่เจอข้อจำกัดใหม่แทน — `GOOGLE_SERVICE_ACCOUNT_KEY` ตรวจแบบนี้ไม่ได้

`vercel env pull` **ไม่คืนค่าของ key นี้กลับมาเลย** ทั้ง production และ preview (น่าจะถูกตั้งเป็น
Sensitive ซึ่งอ่านย้อนไม่ได้ — เป็นการตั้งค่าที่ถูกต้องด้านความปลอดภัย ไม่ต้องไปแก้)

⇒ **ที่ยืนยันไปว่า "service account เข้าถึงชีตได้ครบ" เป็นการยืนยันด้วย key ใน `.env.local`
เท่านั้น** ยังไม่มีอะไรพิสูจน์ว่า key บน server เป็น service account ตัวเดียวกัน
พิสูจน์ได้ทางเดียวคือ **ยิงผ่าน preview deploy จริง** ⇒ ใส่ไว้ใน test charter แล้ว

---

## 2. แผนที่ write path ปัจจุบัน — เตรียมไว้สำหรับ §2.9

ให้ grok สำรวจแบบ read-only ผลสรุปที่ใช้เขียน brief ได้:

- จุดยิง HTTP ไป Apps Script มี **จุดเดียว** — `sendSheetLibRequest` (`sheet.repository.ts:267-314`)
  ทุก write (`append` / `batchAppend` / `update` / `delete`) ไหลผ่าน private hub `write()` ก่อน
- caller ของ write จริงมีแค่ **Appointments** (create/update ผ่าน `BaseCrudService`) และ
  **Invoices** (`batchAppend` InvoiceItems → `append` Invoice → `update` OrderForm)
- `delete` **ไม่มี production caller เลย** มีแต่ dry-test
- read แยก path ผ่าน GViz ไม่เกี่ยวกับ SheetLib
- เทสต์ที่จะต้องเขียนใหม่ตอนสลับ transport: `sheet.repository.dry-test.ts`,
  `appointment.transport.dry-test.ts`, `invoice-sheetlib.workflow.dry-test.ts`
  และ `invoice.service.dry-test.ts` ที่ผูกกับ `instanceof SheetLib*`

---

## 3. ⛔ เรื่องใหญ่ 4 ข้อ — รอเจ้าของตัดสิน ผมไม่ตัดสินให้

เรียงตามความอันตราย

### 3.1 Customers จะเปลี่ยนจาก "พังเสียงดัง" เป็น "เขียนจริง" โดยไม่มีใครสั่ง

`Customers.db-contract.ts` ประกาศ `writes` เป็น true แต่**ไม่มี `target`** วันนี้จึงโยน error
ก่อนยิงเสมอ (มี dry-test คุมอยู่ที่ `customers-wiring.dry-test.ts`) เพราะการเขียน Customers จริง
เป็นหน้าที่ของ Apps Script อีกโปรเจกต์หนึ่ง

**ปัญหา:** transport ใหม่ไม่ใช้ `contract.target` แล้ว มันใช้ `spreadsheetId` + `sheetName` ซึ่ง
Customers **มีครบทั้งคู่** ⇒ ถ้า §2.9 ถอด `requireWriteTarget` ออกไปเฉยๆ **Customers จะเริ่ม
เขียนลงชีตจริงทันทีโดยไม่มีใครตั้งใจ** และ dry-test เดิมที่คุมอยู่จะกลายเป็นเทสต์ที่ต้องแก้ให้
ผ่าน — ซึ่งเป็นรูปแบบเดียวกับที่เอกสารเตือนว่า "การลบเทสต์คือจุดที่งานลบพลาดง่ายที่สุด"

**ทางเลือก:** (ก) ตั้ง `writes` ของ Customers เป็น false ให้ตรงความจริง (ข) เก็บด่านห้ามเขียนไว้
แบบชัดเจนในโค้ดใหม่ (ค) ทำให้ Customers เขียนได้จริงเลยเพราะที่จริงก็ควรเขียนได้

ผมเอนไปทาง (ก) เพราะมันทำให้ contract ตรงกับความจริง และ `writing-workbook-binding.dry-test.ts`
กับ capability gate จะคุมให้เองโดยไม่ต้องมีโค้ดพิเศษ — **แต่ไม่ตัดสินให้ เพราะมันเปลี่ยน
ความหมายของ contract และอาจมีแผนจะเปิด write ในอนาคต**

### 3.2 `valueInputOption` ต่อคอลัมน์ ชนกับข้อจำกัดของ Sheets API

§2.4 ประกาศ `valueInput` **ต่อคอลัมน์** ไว้ใน contract แต่ Sheets API รับ `valueInputOption`
**หนึ่งค่าต่อหนึ่ง request** ⇒ แถวที่มีคอลัมน์คละแบบ (เช่น `Invoices` ที่ประกาศ `USER_ENTERED`
เฉพาะ `created_at`/`updated_at`/`deleted_at` ส่วนคอลัมน์อื่นเป็น default) จะเขียนใน request
เดียวไม่ได้ ต้องแตกเป็นหลาย request ⇒ **การเขียน 1 แถวกลายเป็นไม่ atomic**

ข้อสังเกตที่ควรพิจารณาก่อนตัดสิน: วันนี้ Apps Script `setValues` coerce ทั้งแถวอยู่แล้ว
(พฤติกรรมเทียบเท่า `USER_ENTERED` ทั้งแถว) และเหตุผลที่ Appointments เป็น Plain Text ได้คือ
**คอลัมน์ในชีตถูก format เป็น Plain Text** ไม่ใช่เพราะ option ตอนเขียน — ตรงกับที่ §2.7 ค้นพบว่า
คอลัมน์ของ Invoices *ไม่ได้* format เป็น Plain Text จึงถูก coerce เป็น datetime

⇒ ถ้าข้อสังเกตนี้ถูก **`USER_ENTERED` ทั้งแถวจะให้พฤติกรรมเท่ากับ production วันนี้เป๊ะ** และ
`valueInput` ต่อคอลัมน์จะกลายเป็นการประกาศเจตนา/ด่านตรวจ มากกว่าจะเป็นตัวกำหนดจำนวน request
แต่นี่คือการกลับทิศการออกแบบที่ §2.4 ส่งมอบไปแล้ว **ใหญ่เกินกว่าจะตัดสินตอนตี 4** และต้อง
ยืนยันสมมติฐานเรื่อง cell formatting กับชีตจริงก่อน

### 3.3 error bridge — `certainty` ของ invoice จะเปลี่ยนความหมายเงียบๆ

`InvoiceService.classifyWriteFailure` ตัดสิน `certainty` ด้วย `instanceof SheetLibRejectedError` /
`SheetLibTransportError` ส่วน transport ใหม่โยนคนละชุด (`WriteRejectedError`,
`WriteTransportError`, `WriteCommittedUnreadableError` + `DuplicateRowKeyError`,
`WriteRowIdentityMismatchError`)

ถ้าไม่ map ให้ครบ error ใหม่ทุกตัวจะตกลงไปที่ branch `unknown` **โดยที่ typecheck ไม่บ่นอะไรเลย**
และ `unknown` แปลว่า "อาจเขียนไปแล้ว" ⇒ ผู้ใช้จะเห็นข้อความกำกวมทั้งที่ระบบรู้คำตอบชัดเจน
โดยเฉพาะ `WriteCommittedUnreadableError` ที่ §2.5 สร้างมาเพื่อสื่อความหมายนี้โดยเฉพาะ

### 3.4 `delete` ไม่มีที่ยืนบน transport ใหม่

`SheetRepository.delete()` มีอยู่ ส่ง `deleted_by` ไปให้ SheetLib จัดการ soft-delete — แต่
building block ฝั่ง Sheets API **ไม่มีอะไรรองรับ delete เลย** และ **ไม่มี production caller**

⇒ ต้องตัดสินว่า §2.9 จะ (ก) ปล่อย delete ค้างไว้กับ SheetLib (ข) ทำให้มันโยน "ยังไม่รองรับ"
อย่างชัดเจน (ค) implement ให้ครบ · ผมเอนไปทาง (ข) เพราะไม่มีคนเรียก และการทิ้ง path เก่าไว้
ครึ่งเดียวจะทำให้ §2.10 (ลบ SheetLib) ทำไม่จบ — **แต่ไม่ตัดสินให้**

---

## 4. test charter ของ §2.9

ปล่อย `test-pipeline` (agent ใหม่ ดูหมวด 3 ของ handoff) เข้า Phase A เพื่อวางแผนว่า §2.9 ต้อง
พิสูจน์อะไรบ้าง **ก่อน** เขียน implementation ผลจะอยู่ที่ `docs/phase-2-9-test-charter.md`

Phase A จบแล้วมันจะหยุดรอ **ไม่เริ่ม Phase B เอง** — charter ต้องผ่านตาเจ้าของก่อน

---

## 5. สิ่งที่ **ไม่ได้** ทำ และเหตุผล

| ไม่ได้ทำ | ทำไม |
|---|---|
| implementation ของ §2.9 | ตกลงกันไว้ว่า charter ต้องผ่านการอนุมัติก่อน และเป็นการเขียนทับข้อมูลลูกค้าจริงครั้งแรก ไม่ควรเกิดตอนไม่มีคนดู |
| deploy อะไรก็ตาม | เหตุผลเดียวกัน |
| ตัดสิน 4 ข้อในหมวด 3 | เข้าเงื่อนไข "เรื่องใหญ่กระทบจุดอื่น" ที่เจ้าของสั่งให้บันทึกไว้ |
| เขียน/แก้ข้อมูลในชีต | ข้อมูลลูกค้าจริง |
| แตะ `G:\…\GoogleSheets\*.json` | registry เป็น read-only เสมอ |

---

## 6. พรุ่งนี้เริ่มตรงไหน

1. อ่านหมวด 3 ของไฟล์นี้ ตัดสิน 4 ข้อ (3.1 กับ 3.2 ต้องตัดสินก่อนเขียน §2.9 ได้)
2. อ่าน `docs/phase-2-9-test-charter.md` อนุมัติหรือแก้
3. ให้ Claude เขียน brief ของ §2.9 stage 1 (OrderForm keyed PATCH) จาก charter ที่อนุมัติแล้ว
4. §2.9 stage 1 ต้องพิสูจน์บน **preview deploy จริง** ไม่ใช่แค่ local — เพราะเป็นครั้งแรกที่
   `GOOGLE_SERVICE_ACCOUNT_KEY` ฝั่ง server ถูกใช้งาน (ดูหมวด 1)

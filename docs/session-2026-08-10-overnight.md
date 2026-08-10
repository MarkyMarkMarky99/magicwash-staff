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

## 3. ⛔ เรื่องใหญ่ที่รอตัดสิน — **ตัดสินครบแล้ว 2026-08-10 เช้า**

> **สรุปคำตัดสินของเจ้าของโปรเจกต์ อ่านตรงนี้พอ รายละเอียดข้างล่างเก็บไว้เป็นที่มา**
>
> | # | เรื่อง | คำตัดสิน |
> |---|---|---|
> | 3.1 | Customers เขียนได้โดยไม่ตั้งใจ | ตั้ง `writes: false` ตอนนี้ **แต่เขียนกำกับว่า "ยังไม่เปิด" ไม่ใช่ "ห้ามเปิด"** — เจ้าของต้องการให้รองรับเพิ่ม/แก้ไขลูกค้าจริง **หลัง** refactor จบ เป็นงานแยก |
> | 3.2 | `valueInputOption` ต่อคอลัมน์ | **ใช้ `USER_ENTERED` ทั้งแถว** ไม่แตก request · `valueInput` ต่อคอลัมน์ในcontract เหลือเป็นการประกาศเจตนา/ด่านตรวจ |
> | 3.3 | error bridge / `certainty` | ทำตามที่ Claude เสนอ — map error class ใหม่ให้ครบ อย่าปล่อยตกเป็น `unknown` |
> | 3.4 | `delete` | ทำตามที่ Claude เสนอ — โยน "ยังไม่รองรับ" อย่างชัดเจน ไม่ทิ้ง path เก่าไว้ครึ่งเดียว |
> | 3.5 | type ของคอลัมน์ timestamp | **กลับด้านจากที่ Claude เสนอ** — เจ้าของต้องการให้ metadata timestamp **ทุกชีต** เป็นรูปแบบ `2026-08-09 23:15:21` และเป็น datetime จริงให้หมด |
> | 3.6 | Appointments ไม่มี `certainty` | ทำตามที่ Claude เสนอ |
>
> **ลำดับงานที่เจ้าของกำหนด:** ทำ **§2.9 ให้จบก่อน** แล้วค่อยใช้การแก้ timestamp เป็น
> **smoke test ของ transport ใหม่** — เขียน 1 แถวก่อน ถ้าถูกต้องค่อยยิงที่เหลือ
>
> **ข้อจำกัดที่ต้องรู้ก่อนถึงตอนนั้น:** การเขียนค่าใหม่แก้ได้เฉพาะคอลัมน์ที่ **ไม่ได้** ถูก
> format เป็น Plain Text · `Invoices.updated_at` แก้ด้วยการเขียนทับได้ (เป็น smoke test ที่ดี)
> แต่ **`Appointments.CreatedAt` แก้ไม่ได้ด้วยการเขียน** เพราะ format ของคอลัมน์ทับอยู่ ต้อง
> ล้าง format ก่อน 1 ครั้ง (เจ้าของกดเอง หรืออนุญาตให้ยิง `spreadsheets.batchUpdate` — เป็น
> API คนละตัวที่ §2.9 ไม่ได้สร้าง) · แถวเก่าที่บันทึกไปแล้วยังไม่ได้ตัดสินว่าจะแปลงย้อนหลังไหม
>
> โค้ดที่ส่งค่าผิดรูปแบบวันนี้มี 2 จุดที่ต้องแก้: `Invoices.updated_at` ส่ง ISO 8601 พร้อม
> timezone และ Appointments ส่ง `DD/MM/YYYY HH:MM:SS`

### ที่มาของแต่ละข้อ (บันทึกไว้ตอนยังไม่ตัดสิน)

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

## 4. test charter ของ §2.9 — เสร็จแล้ว (`29384c1`)

`test-pipeline` Phase A ส่งมอบ 2 ชิ้นแล้วหยุดรอตามกติกา (ไม่เริ่ม Phase B เอง):

- **`docs/phase-2-9-test-charter.md`** — ครอบทั้ง 3 stage, จับคู่ความเสี่ยง 9 ข้อเข้ากับ stage,
  ลำดับ deploy gate, และระบุชัดว่าข้อไหน **พิสูจน์ล่วงหน้าไม่ได้** ต้องรอ implementation
- **`tests/server/integration/raw-column-type-check.ts`** — สคริปต์อ่านอย่างเดียว รายงาน
  **type ที่ Sheets เก็บจริง** ของ 8 คอลัมน์ timestamp/date ที่ §2.9 จะเขียน (บทเรียน §2.7:
  ค่าที่แสดงถูกไม่ได้แปลว่า type ถูก)

มันสร้าง harness เท่าที่สร้างได้จริงโดยไม่ต้องเดา interface ของ §2.9 ส่วนที่ต้องเดาไม่สร้าง —
เขียนเป็นข้อกำหนดใน charter แทน ซึ่งถูกต้องแล้ว

---

## 5. 🔴 ผลรันจริงขัดกับสมมติฐานในเอกสาร — ต้องตัดสินเพิ่มอีกข้อ

`test-pipeline` รันสคริปต์เองไม่ได้ (โดน permission classifier บล็อกตอนใช้ `--env-file`) และ
**รายงานตรงๆ ว่ายังไม่ได้พิสูจน์** ⇒ ผมรันเอง ผลที่ได้:

| คอลัมน์ | type ที่เก็บจริง | แถวที่มีข้อมูล |
|---|---|---|
| `OrderForm.updated_at` | **datetime** | 19 |
| `Invoices.created_at` | **datetime** | 9 |
| `Invoices.updated_at` | **string** (`2026-07-29T12:00:00+07:00`) | 1 |
| `Invoices.deleted_at` | ตัดสินไม่ได้ (ว่างทั้งคอลัมน์) | 0 |
| `Appointments.CreatedAt` | **string** (`27/03/2026 04:37:32`) | 20 |
| `Appointments.UpdatedAt` | **datetime** ⚠️ | 15 |
| `Appointments.DeletedAt` | ตัดสินไม่ได้ (ว่างทั้งคอลัมน์) | 0 |
| `Appointments.AppointmentDate` | **date** | 20 |

### สิ่งที่ผลนี้บอก

**1. `phase-2-handoff.md` หมวด 1b พูดผิด** — มันเขียนว่า Appointments' `CreatedAt`/`UpdatedAt`/
`DeletedAt` "ต้องเป็น Plain Text" และเป็นการตัดสินใจที่ "ยังยืนอยู่" แต่ **`UpdatedAt` เป็น
datetime ในชีตจริงมาแล้ว 15 แถว** ⇒ การตัดสินใจนั้นไม่ได้ยืนอยู่จริงอย่างที่เอกสารเชื่อ
(นี่คือกับดัก "เอกสารตกยุคได้ ชีตคือความจริง" ซ้ำรอบที่สอง — รอบแรกคือ `Appointment.json`
บอก 15 คอลัมน์ ชีตจริงมี 17)

**2. พฤติกรรมวันนี้ถูกกำหนดโดย cell format ของแต่ละคอลัมน์ ไม่ใช่โดย option ตอนเขียน**
`CreatedAt` ยังเป็น string ทั้งที่ Apps Script `setValues` coerce ให้ ⇒ คอลัมน์นั้นถูก format
เป็น Plain Text จริง ส่วน `UpdatedAt` ไม่ได้ format จึงโดน coerce · แปลว่าการ format ของคอลัมน์
**ไม่สม่ำเสมอกันเองภายในชีตเดียวกัน** และไม่มีใครตั้งใจให้เป็นแบบนั้น

**3. ข้อนี้สนับสนุนสมมติฐานในหมวด 3.2** — ถ้า cell format เป็นตัวตัดสิน `USER_ENTERED` ทั้งแถว
จะให้ผลเท่ากับวันนี้เป๊ะ และไม่ต้องแตก request · **แต่ยังไม่พอจะสรุป** เพราะ
`Invoices.updated_at` เป็น string ด้วยเหตุผลคนละอย่าง (ค่าเป็น ISO 8601 พร้อม timezone ซึ่ง
Sheets แปลงเป็นวันที่ไม่ได้อยู่แล้ว ไม่ว่า option ไหน) ⇒ ตัวแปรมี 2 ชั้น: **format ของคอลัมน์**
กับ **รูปแบบของค่าที่ส่งไป**

### ⛔ ข้อ 3.5 ที่ต้องตัดสินเพิ่ม

**คอลัมน์ timestamp ควรเป็น type อะไรกันแน่ ในแต่ละชีต** — วันนี้มันปนกันอยู่โดยไม่ได้ตั้งใจ
ถ้าไม่ตัดสินก่อน §2.9 การสลับ transport จะไป "ทำให้มันเป็นระเบียบ" โดยบังเอิญ แล้วเราจะไม่รู้ว่า
ค่าที่เปลี่ยนไปคือความตั้งใจหรือ regression

ตัวเลือก: (ก) ปล่อยตามที่เป็น ให้ §2.9 รักษาพฤติกรรมเดิมทุกคอลัมน์เป๊ะ แล้วค่อยจัดระเบียบทีหลัง
(ข) ตัดสินให้จบตอนนี้ว่าแต่ละคอลัมน์ควรเป็นอะไร แล้วแก้ format ในชีต + `valueInput` ให้ตรงกัน
· ผมเอนไปทาง (ก) เพราะ §2.9 ควรเปลี่ยนแค่ transport ไม่ใช่เปลี่ยนข้อมูล และการเปลี่ยน 2 อย่าง
พร้อมกันทำให้แยกไม่ออกว่าอะไรทำให้พัง — **แต่ไม่ตัดสินให้**

---

## 6. ⛔ ข้อ 3.6 — Appointments ไม่มีที่ทางให้ error ของ transport ใหม่เลย

`test-pipeline` เจอตอนวาง charter: **`AppointmentService` ไม่มี `classifyWriteFailure`** และ
API contract ของ Appointments **ไม่มี field `certainty`** ⇒ error ใดๆ จาก Sheets API write จะ
ตกลงไปเป็น `500 INTERNAL_ERROR` แบบกลางๆ

ต่างจาก Invoices ที่มีระบบ `certainty` (`rejected` / `unknown`) รองรับอยู่แล้ว ⇒ ผู้ใช้ที่กด
สร้างนัดหมายแล้วเจอ error จะไม่มีทางรู้ว่า "ไม่ได้เขียน" หรือ "อาจเขียนไปแล้ว" ซึ่งสำคัญมาก
เพราะ §2.5 สร้าง `WriteCommittedUnreadableError` มาเพื่อสื่อความหมายนี้โดยเฉพาะ

เป็นคำถามเชิงออกแบบของ API contract ไม่ใช่เรื่องที่ agent ตัดสินได้

---

## 7. สิ่งที่ **ไม่ได้** ทำ และเหตุผล

| ไม่ได้ทำ | ทำไม |
|---|---|
| implementation ของ §2.9 | ตกลงกันไว้ว่า charter ต้องผ่านการอนุมัติก่อน และเป็นการเขียนทับข้อมูลลูกค้าจริงครั้งแรก ไม่ควรเกิดตอนไม่มีคนดู |
| deploy อะไรก็ตาม | เหตุผลเดียวกัน |
| ตัดสิน 4 ข้อในหมวด 3 | เข้าเงื่อนไข "เรื่องใหญ่กระทบจุดอื่น" ที่เจ้าของสั่งให้บันทึกไว้ |
| เขียน/แก้ข้อมูลในชีต | ข้อมูลลูกค้าจริง |
| แตะ `G:\…\GoogleSheets\*.json` | registry เป็น read-only เสมอ |

---

## 8. พรุ่งนี้เริ่มตรงไหน

1. **ตัดสิน 6 ข้อ** — หมวด 3 (3.1–3.4), หมวด 5 (3.5 type ของคอลัมน์ timestamp), หมวด 6
   (3.6 certainty ของ Appointments) · ข้อ **3.1 / 3.2 / 3.5 ต้องจบก่อน** ถึงจะเขียน §2.9 ได้
2. อ่าน `docs/phase-2-9-test-charter.md` อนุมัติหรือแก้
3. ให้ Claude เขียน brief ของ §2.9 stage 1 (OrderForm keyed PATCH) จาก charter ที่อนุมัติแล้ว
4. §2.9 stage 1 ต้องพิสูจน์บน **preview deploy จริง** ไม่ใช่แค่ local — เพราะเป็นครั้งแรกที่
   `GOOGLE_SERVICE_ACCOUNT_KEY` ฝั่ง server ถูกใช้งาน (ดูหมวด 1)

### คำสั่งที่จะได้ใช้บ่อยพรุ่งนี้

```bash
node --env-file=.env.local --import=tsx/esm tests/server/integration/raw-column-type-check.ts
node --env-file=.env.local --import=tsx/esm tests/server/integration/sheet-column-parity.ts
node --env-file=.env.local --import=tsx/esm tests/server/integration/sheets-api-access-check.ts
```

ตัวแรกคือด่านที่ต้องรัน **ก่อนและหลัง** ทุก stage ของ §2.9 — ถ้า type ของคอลัมน์ไหนเปลี่ยนไป
โดยไม่ได้ตั้งใจ นี่คือที่เดียวที่จะเห็น

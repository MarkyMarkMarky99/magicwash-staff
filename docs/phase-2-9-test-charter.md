# §2.9 Test Charter — สลับ write transport เป็น Google Sheets API

เขียนโดย `test-pipeline` (Phase A) ก่อน implementation ของ §2.9 มีอยู่จริง — **ยังไม่มีใครแตะ
`server/shared/repositories/sheet.repository.ts`** ตอนเขียนเอกสารนี้ (2026-08-10)

อ้างอิง: `docs/database-layer-sheets-api-refactor-plan.md` §2.0–§2.10, `docs/phase-2-handoff.md`
หมวด 4 (บทเรียนที่จ่ายด้วยของจริง)

**เป้าหมายของเอกสารนี้คือตอบคำถามเดียว: ถ้า §2.9 ผิด เราจะรู้ได้ยังไง** ไม่ใช่ออกแบบว่า §2.9
ควรเขียนโค้ดยังไง

---

## วิธีอ่านตารางในเอกสารนี้

ทุกแถวมี 4 คอลัมน์: **ต้องเป็นจริง** (สิ่งที่ implementation ต้องทำถูก), **ผิดแบบเงียบๆ ถ้าไม่มีใครดู**
(สิ่งที่จะเกิดขึ้นจริงถ้าจุดนั้นพัง แต่ไม่มีอะไร error ให้เห็น), **จับได้ด้วยอะไร** (4 ระดับ:
`dry-test` = offline deterministic ไม่แตะเน็ต, `integration` = ยิงอ่านชีตจริงผ่าน GViz/Sheets API
auth, `deploy` = ต้อง `vercel deploy` จริง + ยิง request จริงเท่านั้นถึงจะเห็น, `human` = ต้องมีคน
เปิดชีตดูเองเท่านั้น ไม่มีเทสต์ไหนคลุมได้), **สถานะพิสูจน์ล่วงหน้า** (`ล่วงหน้าได้` = เขียน guard
ได้ตอนนี้เลยเพราะไม่ต้องเดา interface ของ §2.9, `รอ implementation` = ต้องรอให้ `sheet.repository.ts`
ถูกแก้จริงก่อน เพราะการเขียน mock/guard ตอนนี้ต้องเดารูปร่าง constructor/wiring ซึ่งถ้าเดาผิดจะได้
ของที่ต้องรื้อทิ้ง)

---

## Stage 1 — OrderForm keyed PATCH (blast radius ต่ำสุด)

Trigger จริงในระบบวันนี้: `invoice.service.ts`'s `create()` เรียก
`orderFormRepository().update(sourceOrderId, { invoice_id, updated_by, updated_at })` เป็นขั้นที่ 3
จาก 4 ขั้นของ invoice create (ดู stage 3) — **นี่คือ consumer เดียวของ OrderForm write ในระบบวันนี้**
ไม่มี route อื่นเรียก OrderForm.update() ตรงๆ

| # | ต้องเป็นจริง | ผิดแบบเงียบๆ ถ้าไม่มีใครดู | จับได้ด้วยอะไร | สถานะ |
|---|---|---|---|---|
| 1.0 | write จริงวิ่งผ่าน Sheets API ไม่ใช่ SheetLib อีกต่อไป | โค้ดดู "สลับแล้ว" แต่ path จริงยังยิง `APPSCRIPT_URL` เดิม เพราะแก้ไม่ครบ/มี branch เก่าเหลือ | `dry-test`: spy/mock `fetch` แล้วยืนยันว่าไม่มี call ไป Apps Script URL เลยตอน update, มี call ไป `sheets.googleapis.com` แทน | รอ implementation (ต้องรู้ constructor wiring ของ §2.9 ก่อน) |
| 1.1 | keyed PATCH เขียนถูกแถว (แถวที่ `id` ตรงกับ `sourceOrderId`) | เขียนผิดแถวเงียบๆ ถ้า header map/lookup ผิด ไม่มี error | `dry-test` ด้วย mock header+lookup (คลุม logic การ map key→row), `integration` ยิงอ่านจริงผ่าน GViz หลัง write เพื่อยืนยัน row ที่ถูกแก้คือแถวที่ขอจริง | dry-test ล่วงหน้าไม่ได้ (รอ interface); integration ต้องรอ implementation เสมอเพราะต้องมีของจริงให้ยิง |
| 1.2 | เขียนแค่ 3 คอลัมน์ที่ patch (`invoice_id`, `updated_by`, `updated_at`) อีก 18 คอลัมน์บนแถวเดิมไม่ถูกแตะ | header map ผิด/ subset-write พลาด → เขียนทับทั้งแถวหรือคอลัมน์เลื่อน ข้อมูลอื่นบนแถวหาย | `dry-test`: ตรวจ `updateCells` request body ว่า range ครอบเฉพาะคอลัมน์ที่แก้จริงหรือ full-row-with-blanks ตามที่ §2.6 ออกแบบไว้ (ประกอบ range `A<row>:<lastCol><row>` แล้วอ่านครบแถวกลับมา ไม่ใช่เขียนทับ blank ทับคอลัมน์ที่ไม่ได้แตะ) — **ข้อนี้สำคัญมาก เพราะ §2.6 ออกแบบให้ full-row GET หลัง update แต่ไม่ได้บังคับว่า update ตัวเองต้อง patch เฉพาะคอลัมน์ หรือ เขียนทั้งแถวด้วยค่าเดิม+ค่าใหม่ผสมกัน — วิธีไหนก็ได้ตราบใดที่คอลัมน์ที่ไม่ได้ patch ไม่เปลี่ยนค่า, brief ของ implementation ต้องระบุให้ชัด** | `integration` (อ่านชีตจริงก่อน/หลัง เทียบ diff) ต้องรอของจริง; ไม่มี dry-test ไหนพิสูจน์ "ข้อมูลบนชีตจริงไม่เปลี่ยน" ได้เลยนอกจาก diff ก่อน/หลังกับ integration read |
| 1.3 | `updated_at` เขียนด้วย `USER_ENTERED` (ตามที่ `OrderForm.db-contract.ts` ประกาศไว้แล้ว) → GViz อ่านกลับ column type ต้องเป็น `datetime` เหมือนวันนี้ (ตัดสินใจไว้แล้วว่าตั้งใจ ดู commit `9f53013`) | ถ้า §2.9 อ่าน `valueInput` ผิด/ลืม resolve ต่อคอลัมน์ ค่าจะกลายเป็น `RAW` (default) → `updated_at` เปลี่ยนจาก real Sheets datetime เป็น plain text แบบเงียบๆ — **display value ในชีตยังดูถูกต้อง 100% ตามบทเรียน §2.7 เดิม** เห็นได้เฉพาะเทียบ raw GViz column type เท่านั้น | `dry-test`: `value-serialization.dry-test.ts` มี guard นี้แล้วระดับ contract (`resolveValueInputOption`) — ต้องมี dry-test เพิ่มที่ยืนยันว่า `SheetRepository.update()` เรียก `resolveValueInputOption` จริงตอนประกอบ request ไม่ใช่แค่ policy ถูกประกาศไว้เฉยๆ; `integration`: **`raw-column-type-check.ts` (สร้างแล้ว ดูหมวด harness ด้านล่าง) ยิง GViz จริงเช็ค `OrderForm.updated_at` ต้องได้ `type: "datetime"` หลัง deploy+เขียนจริง** | policy-level guard ล่วงหน้าได้ (มีอยู่แล้ว); wiring-level guard รอ implementation; integration รอของจริงเสมอ |
| 1.4 | error ก่อนยิง write (auth fail, header map fail, key lookup ไม่เจอแถว, key ซ้ำ) ต้อง classify เป็น `rejected` ไม่ใช่ `unknown` | `classifyWriteFailure` (`invoice.service.ts`) วันนี้รู้จักแค่ `SheetLibRejectedError`/`SheetLibTransportError` — ถ้า §2.9 ไม่เพิ่มการรู้จัก `WriteRejectedError`/`DuplicateRowKeyError`/`WriteRowIdentityMismatchError` ทุก error ใหม่จะตกไปที่ default `unknown` เงียบๆ (ปลอดภัยเพราะไม่ over-claim `rejected` ผิด แต่ผู้ใช้จะเห็น "ไม่แน่ใจ" ทั้งที่จริงๆ ระบบรู้แน่ชัดว่าปฏิเสธ) | `dry-test`: อัปเดต/เพิ่ม `invoice.service.dry-test.ts` (มีอยู่แล้วตามแผน §Tests) ยิง error ปลอมทุกคลาสของ Sheets API เข้า `classifyWriteFailure` แล้วยืนยัน `certainty` ที่ถูกต้อง — **นี่คือจุดเสี่ยง "เทสต์ผ่านด้วยเหตุผลผิด" ตามบทเรียน §2.2: ถ้า mock error object เอง throw ก่อนถึง code ที่จะ classify เทสต์จะเขียวไม่ว่าตัว classify ถูกหรือผิด ต้องยิง error instance จริงของแต่ละคลาส ไม่ใช่ throw string/plain Error** | รอ implementation (ต้องรู้ error class ที่จริงถูก throw จากจุดไหนก่อน) |
| 1.5 | TOCTOU ระหว่าง lookup→write **ยอมรับแล้วเป็นความเสี่ยง** (`sheet-row-lookup.ts` doc) — ห้ามมีใครเสนอ lock/CAS/retry แก้ | เข้าใจผิดว่าเป็นบั๊กแล้วไปแก้ ทำให้ scope บวมและขัดกับการตัดสินใจที่ปิดไปแล้ว | ไม่มีเทสต์ไหนคลุม "ไม่มี race" ได้เพราะมันถูกยอมรับไว้แล้วว่ามี — สิ่งที่คลุมได้คือ 1.4 (verifyRowIdentity ต้องยัง fire ถูกเมื่อแถวขยับจริง) | ไม่ใช่ของที่ต้องพิสูจน์ — เป็นการตัดสินใจที่ปิดแล้ว ระบุไว้เพื่อกันไม่ให้ agent ตัวถัดไปหยิบมาแก้ |
| 1.6 | response ที่ `update()` คืนเป็นแถวสมบูรณ์ (`BaseCrudService.update()` project จากแถวเต็มที่ repo คืน — ถ้า repo คืน patch บางส่วน field อื่นจะหายจาก response) | ผู้ใช้เห็น response ที่ field เก่าหายไปเงียบๆ (undefined แทนที่จะเป็นค่าจริง) | `dry-test` โครงสร้าง response shape เทียบ `TDbRow` เต็ม | รอ implementation |

**สรุป stage 1 ที่พิสูจน์ล่วงหน้าไม่ได้เลย และทำไม:** 1.1(integration part)/1.2(integration diff)/1.3(integration
part) ต้องมีของจริงให้ยิง — ไม่มีทางแทนด้วย mock ได้เพราะสิ่งที่ต้องพิสูจน์คือ "Google Sheets เก็บ
อะไรจริง" ไม่ใช่ "โค้ดเรียกฟังก์ชันถูก" (บทเรียน §2.7: mock พิสูจน์เรื่อง type coercion ของ Google
เองไม่ได้)

---

## Stage 2 — Appointments (append + JSON cell + date + Bangkok timestamp + CRUD เต็ม)

Trigger จริง: `AppointmentService extends BaseCrudService` — มี route POST/PATCH ผ่าน
`createCrudRoutes` เปิดใช้งานจริงจาก staff UI (ไม่ใช่ internal-only แบบ OrderForm) **blast radius
สูงกว่า stage 1 มาก** เพราะมี consumer ภายนอกจริง (นัดหมายจริงของลูกค้า)

| # | ต้องเป็นจริง | ผิดแบบเงียบๆ ถ้าไม่มีใครดู | จับได้ด้วยอะไร | สถานะ |
|---|---|---|---|---|
| 2.0 | write จริงวิ่งผ่าน Sheets API ไม่ใช่ SheetLib | เหมือน 1.0 | เหมือน 1.0 | รอ implementation |
| 2.1 | `append()` ใช้ `INSERT_ROWS` ไม่ต้อง lock (ตามที่ §2.2 ออกแบบ) เขียนแถวใหม่โดยไม่ชนกับแถวอื่นแม้มี concurrent append | ถ้า wiring เอา row-lookup มาปนกับ append (ใช้ผิดฟังก์ชัน) จะเกิด race ที่ไม่จำเป็นต้องมี | `dry-test`: ยืนยันว่า `append()` ไม่เคย เรียก `findRowNumberByKey`/`readColumn` เลย มีแต่ `appendRows` ตรงๆ | รอ implementation |
| 2.2 | `Address` (JSON snapshot) ถูก `JSON.stringify` ก่อนส่งเป็น cell — parse กลับได้ ไม่ใช่ `[object Object]` | เหมือนความเสี่ยงข้อ 1 ของ brief ทั้งฉบับ — จุดที่พังเงียบที่สุดในระบบตามที่ mutation test เคยชี้มาแล้วรอบ invoice `customer`/`adjustments` | `dry-test`: `value-serialization.dry-test.ts` คลุม `serializeCellValue`/`buildRowValues` แล้วระดับฟังก์ชัน (มีอยู่แล้ว) — **ต้องมี dry-test เพิ่มที่ wiring จริงของ `SheetRepository.append()` เรียก `buildRowValues` ก่อนส่งจริง ไม่ใช่แค่ policy ถูกประกาศ**; `integration`: อ่าน `Address` กลับผ่าน GViz แล้ว `JSON.parse` ต้องไม่ throw | policy-level ล่วงหน้าได้ (มีอยู่แล้ว); wiring-level รอ implementation; integration รอของจริง |
| 2.3 | `AppointmentDate` เขียนด้วย `USER_ENTERED` → GViz column type ต้องเป็น `datetime` (ตั้งใจ เพื่อให้ date-range filter ทำงาน) | เหมือน 1.3 แต่คนละ column — ถ้าพัง ฟีเจอร์ filter นัดหมายตามช่วงวันที่จะพังตามไปด้วย ไม่ error แค่ผลลัพธ์ผิดเงียบๆ | `dry-test` เหมือน 1.3; `integration`: `raw-column-type-check.ts` เช็ค `Appointments.AppointmentDate` ต้องได้ `datetime`; **GViz date-range filter ยังทำงานได้จริง เป็นเทสต์แยกที่ plan เองระบุไว้ว่า "mock ไม่พอ" (§Tests: "⚠ USER_ENTERED vs date/phone mock ไม่พอ ต้องยิงกับ spreadsheet ทิ้งได้จริงแล้วอ่านกลับผ่าน GViz")** | integration รอของจริงเสมอ |
| 2.4 | **`CreatedAt`/`UpdatedAt`/`DeletedAt` ต้องยังเป็น `RAW`/Plain Text — ห้ามกลายเป็น `datetime` แบบที่ Invoices/OrderForm ตั้งใจให้เป็น** (คนละการตัดสินใจ อย่าสับสนสองชีตนี้เข้าด้วยกันตามที่ทั้งแผนและ handoff เตือนซ้ำ) | ถ้า implementer เอา valueInput policy ของ Invoices มาปนกับ Appointments (copy-paste ผิด sheet) ทุกอย่างจะดูทำงานถูกในเทสต์ mock (เพราะ mock ไม่ได้แยกว่าใครเป็นใคร) แต่ real Sheets จะ auto-coerce เป็น datetime เงียบๆ เหมือน §2.7 เดิม | `dry-test`: `value-serialization.dry-test.ts` มี guard นี้แล้วที่ contract level (mutation-tested แล้วตามแผน — ใส่ `CreatedAt: USER_ENTERED` แล้วเทสต์แดงจริง) — **ต้อง mutation-test ซ้ำใน Phase B ว่ายัง fail จริงหลัง wiring เข้า `SheetRepository` ด้วย ไม่ใช่แค่ที่ policy declaration**; `integration`: **บังคับ** — `raw-column-type-check.ts` เช็ค `Appointments.CreatedAt`/`UpdatedAt`/`DeletedAt` ต้องได้ `type` เป็น string/ไม่ใช่ `datetime` หลัง deploy จริง — เป็นข้อที่พลาดแล้วเคยมาแล้วครั้งหนึ่งกับชีตอื่น (Invoices/OrderForm) จึงมีโอกาสสูงสุดที่จะพลาดซ้ำ | policy ล่วงหน้าได้ (มีอยู่แล้ว); integration รอของจริง |
| 2.5 | `formatBangkokTimestamp` เขียนถูก format เดียวกับที่ `CreatedAt`/`UpdatedAt` มีอยู่วันนี้ (ไม่เปลี่ยน format ตอนสลับ transport) | timestamp format เปลี่ยนเงียบๆ ทำให้ sort/filter ที่พึ่ง lexicographic order (ตามที่แผนอธิบายไว้ว่า string `YYYY-MM-DD HH:mm:ss` เรียงตรงกับเวลาจริง) พัง | `dry-test` มีอยู่แล้วสำหรับ `formatBangkokTimestamp` เอง — ของใหม่ที่ต้องเพิ่มคือยืนยันว่า write path เรียกมันแล้วส่งค่าตรงไปที่ cell ไม่ถูกแปลงซ้ำ | รอ implementation (wiring) |
| 2.6 | append คืนแถวสมบูรณ์เต็มความกว้าง (`PickupOrderID`/`DeliveryOrderID`/`ServiceTier` ที่เป็น `null` ต้องอยู่ตำแหน่งถูก ไม่ใช่คอลัมน์เลื่อน) — เหมือนความเสี่ยงข้อ 3 ของ brief แต่คนละชีต | คอลัมน์ nullable กลางแถวว่างผิดตำแหน่ง → response ที่ frontend เห็นข้อมูลเลื่อนคอลัมน์ | `dry-test`: `response-shape.dry-test.ts` ตามที่แผนระบุ (trailing blank ต้อง pad + คืน `null`) — ต้องมี case ที่ nullable อยู่ กลาง แถวไม่ใช่ท้ายแถว เพราะ `restoreTrailingBlanks` ใน `sheets-api.client.ts` จัดการเฉพาะ trailing blank เท่านั้น (อ่านโค้ดแล้ว: ไล่จากท้ายมาหน้า หยุดที่ค่าที่ไม่ว่าง) กลาง-แถวที่ไม่ใช่ trailing ต้องพึ่งว่า request ส่งค่าครบทุกตำแหน่งอยู่แล้ว (`buildRowValues` ใส่ `''` ให้ทุก field ที่ไม่ส่ง ไม่ข้าม) — จุดนี้ควร dry-test ยืนยันตรงๆ ว่า `buildRowValues` ไม่เคยข้าม index กลางแถว | ฟังก์ชัน-level guard ล่วงหน้าได้บางส่วน (มีอยู่แล้ว); wiring รอ implementation |
| 2.7 | full CRUD: create/read/update ทำงานสอดคล้องกัน (delete ของ Appointments ปิดไว้ `writes.delete: false` — ไม่ต้องพิสูจน์ delete เพราะไม่ได้เปิด) | ถ้า implementer เผลอเปิด delete โดยไม่ได้ตั้งใจ (เปลี่ยน `writes.delete` โดยไม่มีใครอนุมัติ) จะเป็นการเปลี่ยน business behavior ที่ไม่มีใครขอ | `dry-test`: `sheet-binding.dry-test.ts`/db-contract โดยตรง — ยืนยัน `writes.delete === false` ยังคงอยู่ (regression guard ง่ายๆ) | ล่วงหน้าได้ (เพิ่มบรรทัดเดียวในเทสต์ contract ที่มีอยู่แล้ว ไม่ต้องรอ wiring) |
| 2.8 | **error classification ที่ผู้ใช้เห็นจริงทาง HTTP** — วันนี้ตรวจโค้ดแล้วพบว่า `AppointmentService` ไม่มี `classifyWriteFailure` ของตัวเอง และ `contracts/appointments/appointment-api.schema.ts` ไม่มี `certainty`/`outcome` field เลย ⇒ error ใดๆ ที่ไม่ใช่ `ApiError` (รวม `WriteRejectedError`/`WriteTransportError`/`DuplicateRowKeyError` ทุกตัวที่ §2.9 จะโยน) จะตกไปที่ `ApiHandler`'s catch-all กลายเป็น generic `500 INTERNAL_ERROR` เสมอ — **นี่ไม่ใช่บั๊กที่ test-pipeline ตัดสินใจแก้เอง เป็นช่องว่างการออกแบบที่ต้องรายงานให้เจ้าของโปรเจกต์/ผู้วางแผนตัดสิน** ว่าตั้งใจให้ Appointments เขียนพลาดแสดงเป็น 500 เสมอ (พฤติกรรมเดิมของ SheetLib ก็ทำแบบนี้อยู่แล้วหรือไม่ — ต้องตรวจ) หรือต้องเพิ่ม mapping | ถ้าไม่มีใครตัดสิน ผู้ใช้จะเห็น "500 error" ไม่ว่ากรณีไหนแม้ Sheets API รู้ชัดว่าข้อมูล validation ผิด (`rejected`) ต่างจาก network ล่ม (`unknown`) — เสีย UX แต่ไม่เสียข้อมูล | `dry-test`: เขียน guard ได้แค่ "error ไม่ crash เป็น 500 พร้อม message ที่เข้าใจได้" แต่ ไม่มีเทสต์ไหนพิสูจน์ได้ว่านี่คือพฤติกรรมที่ "ตั้งใจ" เพราะยังไม่มีการตัดสินใจ | **ต้องรายงานเป็น open question ก่อน implementation — ไม่ใช่ทั้ง dry-test ทั้ง integration คลุมได้เพราะยังไม่มีคำตอบที่ถูกให้เทียบ** |

**สรุป stage 2 ที่พิสูจน์ล่วงหน้าไม่ได้เลย และทำไม:** 2.3 (GViz date-range filter จริง) — แผนเองระบุ
ตรงๆ ว่า mock ไม่พอ ต้องมี spreadsheet ทิ้งได้จริง (ดูหมวด "สิ่งที่เจ้าของโปรเจกต์ต้องตัดสินใจ/กดเอง"
ด้านล่าง — ไม่มี spreadsheet ทิ้งได้อยู่ในมือ agent ตอนนี้); 2.4 integration ก็รอของจริงเสมอด้วยเหตุผล
เดียวกับ 1.3; 2.8 เป็น open question ไม่ใช่สิ่งที่พิสูจน์ได้เลยจนกว่าจะมีการตัดสินใจ

---

## Stage 3 — Invoices/InvoiceItems (batchAppend + partial-persistence, ไม่ idempotent)

Trigger จริง: `invoice.service.ts`'s `create()` — เขียน 4 จุดตามลำดับ (`InvoiceItems.batchAppend`
→ `Invoices.append` → `OrderForm.update` [ใช้ Sheets API แล้วตั้งแต่ stage 1] → sync `InvoicesView`
ผ่าน Apps Script trigger — ตัวสุดท้ายนี้ ไม่ใช่ Sheets API write ไม่อยู่ใน scope §2.9)
**ไม่มี multi-sheet transaction ตามที่แผนระบุไว้ชัด (ไม่ทำ multi-sheet transaction — ตั้งใจ)**

| # | ต้องเป็นจริง | ผิดแบบเงียบๆ ถ้าไม่มีใครดู | จับได้ด้วยอะไร | สถานะ |
|---|---|---|---|---|
| 3.0 | write จริงวิ่งผ่าน Sheets API (`InvoiceItems`/`Invoices`) — `OrderForm` step ของ flow เดียวกัน ใช้ Sheets API อยู่แล้วตั้งแต่ stage 1 (นี่คือเหตุผลที่ลำดับ stage สำคัญ — ถ้าสลับ Invoices ก่อน OrderForm, invoice create หนึ่งครั้งจะผสม transport 2 แบบในคำสั่งเดียว ตรวจยากขึ้นเปล่าๆ) | เหมือน 1.0/2.0 | เหมือน 1.0/2.0 | รอ implementation |
| 3.1 | `Invoices.customer`/`.adjustments` และ `InvoiceItems.adjustments` เป็น JSON string ที่ `JSON.parse` ได้ ไม่ใช่ `[object Object]` — **จุดเสี่ยงที่ mutation test เคยชี้ว่าพังเงียบที่สุดในระบบ** | เหมือน 2.2 แต่คนละชีต — ครั้งนี้มีทั้ง `Invoices` และ `InvoiceItems` สองจุด ต้องเช็คทั้งคู่แยกกัน | `dry-test`: เหมือน 2.2 (ระดับ policy มีอยู่แล้ว, wiring รอ implementation); `integration`: อ่าน `customer`/`adjustments` กลับผ่าน GViz แล้ว parse — **ห้ามยิงกับ invoice จริงของลูกค้า ต้องใช้ order ที่เจ้าของโปรเจกต์เลือกว่าทิ้งได้** | policy ล่วงหน้าได้; wiring รอ implementation; integration รอของจริง **และรอเจ้าของโปรเจกต์กดเอง** |
| 3.2 | `InvoiceItems.batchAppend` เขียนครบทุกแถว, ลำดับ `item_no` ถูก, **`sku` ว่างอยู่ตำแหน่งกลางแถวที่ถูกต้อง ไม่ใช่คอลัมน์เลื่อน** (`itemCommands` ไม่เคยส่ง `sku` เลย — ดู `invoice.service.ts:381` ไม่มี key `sku` ในอ็อบเจกต์ที่ส่ง) | เหมือน 2.6 แต่วิกฤตกว่าเพราะเป็นข้อมูลการเงิน — `subtotal`/`unit_price`/`net_total` เลื่อนคอลัมน์เงียบๆ จะทำให้ตัวเลขในใบแจ้งหนี้ผิดโดยไม่มี error ให้เห็นเลย | `dry-test`: `batchAppend`'s `buildRowValues` ต่อแถว ต้องยืนยันว่าทุกแถวมีความกว้างเท่ากันและตำแหน่ง `sku` (ไม่ถูกส่ง) ได้ `''` ไม่ใช่ถูกข้าม — เหมือน 2.6 ระดับฟังก์ชันมีอยู่แล้วบางส่วน ต้องมี case เจาะจงคอลัมน์ `sku`; `integration`: อ่านแถวที่เพิ่งเขียนกลับผ่าน GViz เทียบค่าตัวเลขทุก field กับที่ควรจะเป็น (คำนวณเองแล้วเทียบ ไม่ใช่แค่ดูว่ามีค่า) | ฟังก์ชัน-level ล่วงหน้าได้บางส่วน; wiring+integration รอของจริง+รอเจ้าของโปรเจกต์กดเอง |
| 3.3 | **partial-persistence outcome ทั้ง 3 แบบ ยังแยกถูกต้องหลังสลับ transport**: `items_write_failed` (items ยังไม่ถูกเขียนเลย) / `invoice_write_failed` (items เขียนแล้ว header ไม่สำเร็จ — ต้อง reconcile มือ) / `order_link_failed` (invoice สมบูรณ์แล้ว แค่ OrderForm ไม่ถูก mark) | ถ้า `classifyWriteFailure` ไม่รู้จัก error class ใหม่ (เหมือน 1.4) ทั้ง 3 outcome ยังคง fire ถูก kind เดิม (เพราะ kind มาจาก try/catch ตำแหน่งโค้ด ไม่ใช่จาก error class) **แต่ `certainty` ข้างในแต่ละ kind จะผิด** — ผู้ใช้ที่เห็น `invoice_write_failed` ที่จริง `certainty: rejected` (ไม่มีอะไรเขียนจริง แก้แล้ว retry ได้) จะเห็น `certainty: unknown` (บอกว่า "ไม่รู้ อาจเขียนแล้ว ห้าม retry มั่ว") ทำให้ระบบดู "ปลอดภัยเกินจริง" (ไม่บอกว่า retry ได้ทั้งที่จริงๆ retry ได้) — **นี่คือทิศตรงข้ามกับข้อ 1.4: ที่นั่นปลอดภัยเกิน (unknown แทน rejected แล้วผู้ใช้แค่เห็นข้อความคลุมเครือ) ที่นี่ปลอดภัยเกินเหมือนกันแต่ต้นทุนคือ operational — เจ้าหน้าที่ไม่กล้า retry ทั้งที่ retry ได้จริง** | `dry-test`: `invoice.service.dry-test.ts` ยิง error ทุกคลาสจากทั้ง 3 จุด (`invoiceItemRepository`, `invoiceRepository`, `orderFormRepository` mock) แล้วยืนยันทั้ง `kind` และ `certainty` คู่กัน — เหมือน 1.4 แต่ครบ 3 จุดไม่ใช่จุดเดียว | รอ implementation |
| 3.4 | ไม่มี auto-retry ที่จุดไหนเลย (append/batchAppend ที่ยิงออกไปแล้วไม่ retry แม้ error) | ถ้ามีใครเพิ่ม retry "เพื่อความทนทาน" จะเสี่ยงเขียนซ้ำ (`InvoiceItems` ซ้ำชุด, `Invoices` header ซ้ำ) — กฎข้อ 7 ของแผนห้ามไว้ตรงๆ | `dry-test`: mock `fetch`/client ให้นับจำนวนครั้งที่ถูกเรียกต่อ 1 คำสั่งเขียน ต้องเป็น 1 เท่านั้นแม้ mock throw | รอ implementation |
| 3.5 | **`InvoicesView` sync ไม่อยู่ใน scope §2.9** — ต้องยังเรียกผ่าน Apps Script (`APPSCRIPT_INVOICE_VIEW_SYNC_URL`) เหมือนเดิม ไม่ถูกสลับไป Sheets API โดยไม่ตั้งใจ | ถ้ามีใครเข้าใจผิดว่า "สลับ write ทั้งหมด" แล้วไปแตะ sync call ด้วย จะเป็นการขยาย scope เกินแผน (แผนบอกชัดว่า Apps Script เหลือไว้เฉพาะ view recompute) | `dry-test`: ยืนยันว่า `defaultSyncInvoiceView`/`syncInvoiceView` ยังเรียก Apps Script URL เดิม ไม่เปลี่ยน | ล่วงหน้าได้เต็มที่ — เป็น regression guard ง่ายๆ ไม่ต้องรอ wiring เพราะพิสูจน์ "ไม่เปลี่ยน" ไม่ใช่ "เปลี่ยนถูก" |

**สรุป stage 3 ที่พิสูจน์ล่วงหน้าไม่ได้เลย และทำไม:** 3.1/3.2 integration ต้องมีของจริง+ต้องเป็น
order ที่เจ้าของโปรเจกต์เลือกว่าทิ้งได้ (ตามกฎเหล็ก "ห้ามเขียนอะไรลงชีตทุกกรณี" ของ test-pipeline —
แม้แต่ order "ทิ้งได้" ก็ต้องให้เจ้าของโปรเจกต์เป็นคนกด ไม่ใช่ agent ตัดสินใจเอง)

---

## ความเสี่ยงข้ามสเตจ (จาก brief ต้นทาง) — สรุปว่าอยู่ที่ไหนและจับได้ด้วยอะไร

| ความเสี่ยงจาก brief | อยู่ที่ stage ไหน | จับได้ด้วยอะไร |
|---|---|---|
| 1. serialize JSON column | stage 2 (`Address`), stage 3 (`customer`/`adjustments` ×2 ชีต) | dry-test (policy มีแล้ว, wiring รอ) + integration (รอของจริง) |
| 2. `valueInputOption` ต่อคอลัมน์ — Invoices/OrderForm ตั้งใจเป็น datetime, Appointments CreatedAt/UpdatedAt/DeletedAt ตั้งใจเป็น Plain Text | stage 1 (1.3), stage 2 (2.3, 2.4) | dry-test (policy มีแล้ว + mutation-tested แล้ว) + **integration บังคับด้วย `raw-column-type-check.ts`** |
| 3. ความกว้างของ append — `sku` ว่างถูกตำแหน่ง | stage 3 (3.2), เทียบเคียง stage 2 (2.6) | dry-test ฟังก์ชัน-level (บางส่วนมีแล้ว) + integration |
| 4. keyed update เขียนถูกแถว, race ยอมรับแล้ว ห้ามแก้ด้วย lock/CAS/retry | stage 1 (1.1, 1.5), stage 2 (update ของ Appointments ก็เป็น keyed — ยังไม่ได้แยกข้อในตารางเพราะ Appointments update ไม่มี consumer จริงในระบบวันนี้ผ่าน API ปกติชัดเจน — **ต้องตรวจว่า `PATCH /api/appointments/:id` เปิดใช้งานจริงหรือยัง ถ้าเปิดแล้วต้องพิสูจน์เหมือน stage 1 ทุกข้อ**) | dry-test + integration รอของจริง |
| 5. error classification ต่อ phase | stage 1 (1.4), stage 2 (2.8 — เป็น open question), stage 3 (3.3) | dry-test รอ implementation; 2.8 ไม่มีเทสต์คลุมได้จนกว่าจะมีการตัดสินใจ |
| 6. read-back verify PK (`verifyRowIdentity`) | stage 1, stage 2 (update flow) | dry-test: บังคับให้ error ตอน mock แถวขยับระหว่าง write→read-back |
| 7. invoice create เขียน 4 ชีต ไม่ idempotent | stage 3 (3.3, 3.4) | dry-test (outcome kind + certainty) — ส่วน "ข้อมูลค้างครึ่งๆ จริงบนชีต" ไม่มีเทสต์ไหนคลุมได้เลย เป็น `human`-only: ต้องมีคนเปิดชีตดูว่าถ้าจงใจทำให้ header write ล้มเหลว (เช่น ตัด network ตอน integration test) แล้วดูว่า `InvoiceItems` ที่เขียนไปแล้วยังอยู่จริงและ reconcile ได้ด้วยมือ |
| 8. `.js` extension ใน ESM import | ทุก stage | **`deploy` เท่านั้น** — ยืนยันแล้วจากบทเรียนโปรเจกต์ว่า `tsc`, `npx tsx` (dry-test), และ `vercel dev` ทั้งสามตัวพลาดมาแล้วจริง เหตุผลที่ตรวจแล้ว: `tsx` มี module resolution ที่ผ่อนกว่า Node ESM ดิบ (auto-resolve extension ให้) ในขณะที่ `@vercel/node` บน production ใช้ Node ESM ดิบที่เข้มงวด — ต่างจาก dry-test runner โดยเนื้อแท้ ไม่ใช่แค่ไม่มีเทสต์ครอบ ⇒ **ต้อง deploy จริง + curl จริงทุก stage ก่อนไป stage ถัดไป ห้ามข้าม** |
| 9. ห้ามเขียนลง portal workbook | ทุก stage | มี `tests/server/unit/sheets/writing-workbook-binding.dry-test.ts` อยู่แล้ว ครอบทุก sheet อัตโนมัติ (ไล่ค้น contract ไม่ hardcode) — รันซ้ำเป็นส่วนหนึ่งของ regression suite ทุกครั้งที่ §2.9 แก้ contract ใดๆ |

---

## harness ที่สร้างล่วงหน้าได้จริง (Phase A ทำแล้ว)

**`tests/server/integration/raw-column-type-check.ts`** — สคริปต์ read-only ใหม่ ยิง GViz ตรง
(ไม่ผ่าน `sheet.repository.ts` เลย ไม่ต้องเดา interface ของ §2.9) เช็ค raw column `type` ที่ GViz
รายงานกลับสำหรับ 8 คอลัมน์เสี่ยงที่ระบุไว้ในความเสี่ยงข้อ 2: `OrderForm.updated_at`,
`Invoices.created_at`/`.updated_at`/`.deleted_at`, `Appointments.CreatedAt`/`.UpdatedAt`/`.DeletedAt`/
`.AppointmentDate` — เป็นเครื่องมือสำหรับ Phase B ใช้ยืนยัน "ค่าที่แสดงถูก ไม่ได้แปลว่า type ที่เก็บ
จริงตรง" (บทเรียน §2.7) หลัง deploy จริงของแต่ละ stage ไม่ใช่หลักฐานของ §2.9 เอง (ยังไม่มี §2.9
ให้พิสูจน์ตอนนี้) — รายละเอียดผลรันจริงและ verification อยู่ท้ายรายงานนี้

**ทำไมไม่สร้างอะไรมากกว่านี้ตอนนี้:** ของที่เหลือทั้งหมดในตาราง (`dry-test` ระดับ wiring,
`classifyWriteFailure` guard, `fetch`-spy ว่า SheetLib ไม่ถูกเรียกอีก) ต้องรู้ constructor/interface
จริงของ `SheetRepository` หลังแก้ว่า §2.9 เลือก inject `SheetsApiClient`/`SheetHeaderMapResolver`
ยังไง — เขียนตอนนี้ต้องเดา แล้วมีโอกาสสูงที่จะต้องรื้อทิ้งเมื่อของจริงมา (ตรงกับกฎของงานนี้คืนนี้ที่
ห้ามสร้างของที่ต้องรื้อทิ้ง) ⇒ ทั้งหมดอยู่ในสถานะ "รอ implementation" ในตาราง

---

## ลำดับการพิสูจน์ — deploy gate ระหว่าง stage

**ต้องเขียวก่อนถึงจะยอม deploy stage ถัดไป (บังคับตามลำดับ ห้ามข้าม):**

1. **ก่อนแตะโค้ด §2.9 เลย:** เจ้าของโปรเจกต์ตัดสินข้อ 2.8 (Appointments error mapping) และยืนยัน
   env บน Vercel Production+Preview ตรงกับ `.env.local` (`vercel env ls` เทียบชื่อ key — ไม่ใช่ค่า)
   — ทั้งสองเป็น blocker ที่ handoff ระบุไว้แล้วว่ายังไม่ปิด
2. **Stage 1 (OrderForm):** dry-test ทั้งหมดเขียว (รวม mutation test ทุก guard ในตาราง stage 1) →
   deploy ไป preview จริง → invoice create ผ่าน staff UI 1 ครั้งด้วย order ที่เจ้าของโปรเจกต์เลือกว่า
   ทิ้งได้ (ดูหมวดถัดไป) → `raw-column-type-check.ts` ยืนยัน `OrderForm.updated_at` เป็น `datetime`
   → เปิดชีตด้วยตาเช็คว่าอีก 18 คอลัมน์บนแถวเดียวกันไม่เปลี่ยน → **ผ่านครบถึงจะแตะ Appointments**
3. **Stage 2 (Appointments):** dry-test ทั้งหมดเขียว → deploy → สร้าง/แก้นัดหมายจริง 1 ครั้งผ่าน
   staff UI ด้วยข้อมูลที่เจ้าของโปรเจกต์เลือกว่าทิ้งได้ → `raw-column-type-check.ts` ยืนยันทั้ง
   `AppointmentDate=datetime` และ `CreatedAt/UpdatedAt/DeletedAt=string` (ไม่ใช่ datetime) →
   ยืนยัน GViz date-range filter ยังทำงาน (แผนระบุ mock ไม่พอ) → **ผ่านครบถึงจะแตะ Invoices**
4. **Stage 3 (Invoices/InvoiceItems):** dry-test ทั้งหมดเขียว → deploy → invoice create ผ่าน staff
   UI ด้วย order ที่ทิ้งได้ → ตรวจ `customer`/`adjustments` (ทั้ง 2 ชีต) parse ได้, `sku` ว่างถูก
   ตำแหน่ง, `OrderForm.invoice_id` ถูกเขียน (ผ่าน stage-1 path ที่พิสูจน์แล้ว), ตัวเลขทุกบรรทัดตรงกับ
   ที่คำนวณเอง → `raw-column-type-check.ts` ยืนยัน `Invoices.created_at/.updated_at/.deleted_at`
5. **หลังทั้ง 3 stage ผ่าน:** ทุก `*.dry-test.ts` ทั้งชุด (ไม่ใช่แค่ไฟล์ที่ §2.9 แตะ) +
   `npm run typecheck:api` + `npm run build` + `sheet-column-parity.ts` + `sheets-api-access-check.ts`
   + `writing-workbook-binding.dry-test.ts` ต้องเขียวพร้อมกันทั้งหมด ก่อนพิจารณา merge เข้า main

**เหตุผลที่ลำดับนี้บังคับ (ไม่ใช่แค่แนะนำ):** ข้อ 8 (`.js` extension) จับได้เฉพาะ deploy จริง —
ถ้าทำ 3 stage รวดเดียวแล้ว deploy ทีเดียว จะแยกไม่ออกว่า `.js` ที่หายเป็นของ stage ไหนถ้าเกิด
`INTERNAL_ERROR` และไม่มีทางรู้ว่า stage ที่ยังไม่ deploy จริงมีปัญหาซ่อนอยู่หรือเปล่า — ตรงกับ
หลักการเดิมของ Phase 1 vs Phase 2 ("ทำรวมกันแล้วพังจะแยกไม่ออกว่าพังเพราะอะไร")

---

## สิ่งที่ต้องให้เจ้าของโปรเจกต์ตัดสินใจ/กดเอง — ห้าม agent ทำแทนหรือหาทางอ้อม

1. **ข้อ 2.8** — Appointments write error ควรแสดงเป็น 500 เสมอ (พฤติกรรมปัจจุบัน ยังไม่เปลี่ยน) หรือ
   ต้องเพิ่ม mapping ให้ certainty แสดงผ่าน HTTP status ที่แม่นยำกว่า — เป็นการตัดสินใจ scope ของ §2.9
   ไม่ใช่ implementation detail
2. **ยืนยัน env บน Vercel Production + Preview** ตรงกับ `.env.local` (`ORDERS_SPREADSHEET_ID`,
   `INVOICES_SPREADSHEET_ID`, `APPOINTMENTS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_KEY`) — ระบุไว้
   แล้วใน `docs/phase-2-handoff.md` หมวด 2 ว่ายังไม่ปิด และ **`GOOGLE_SERVICE_ACCOUNT_KEY` บน Vercel
   อ่านย้อนกลับมาไม่ได้** (Sensitive) ⇒ พิสูจน์ได้ทางเดียวคือยิงผ่าน preview deploy จริงแล้วดูว่า
   auth สำเร็จหรือ fail — ไม่มีทางยืนยันล่วงหน้าจากเครื่อง local
3. **เลือก order ที่ "ทิ้งได้" สำหรับ stage 1 smoke test** (OrderForm PATCH ผ่าน invoice create) —
   agent ห้ามเลือกเองว่า order ไหนทิ้งได้ เพราะเป็นข้อมูลธุรกิจจริง
4. **เลือกข้อมูลนัดหมาย "ทิ้งได้" สำหรับ stage 2 smoke test** (Appointments create/update จริงผ่าน
   staff UI) — เหตุผลเดียวกับข้อ 3
5. **เลือก order ที่ "ทิ้งได้" สำหรับ stage 3 smoke test** (invoice create เขียน 4 ชีต) — เหตุผล
   เดียวกับข้อ 3 — ข้อนี้มีความเสี่ยงสูงสุดเพราะ **ไม่ idempotent** ถ้าพังกลางทางจะเหลือข้อมูลค้าง
   ครึ่งๆ ที่ต้อง reconcile มือ (ความเสี่ยงข้อ 7) เจ้าของโปรเจกต์ควรเตรียมใจว่าอาจต้องลบแถวที่ค้าง
   ด้วยมือหลัง test ไม่ว่าผลจะสำเร็จหรือไม่
6. **กด deploy จริงแต่ละ stage** ผ่าน push+GitHub integration (ตามที่ `CLAUDE.md`/handoff ระบุว่า
   `vercel deploy` CLI ตรงโดน git-identity block) และ **กดผ่าน staff UI จริง** สำหรับทุก smoke test
   ข้างบน — agent ไม่มีสิทธิ์ตัดสินใจ "deploy แทน" หรือจำลอง UI แทนคน
7. **หลังทั้งแผนเสร็จ (ไม่ใช่ส่วนของ §2.9)** — เปิด Vercel Authentication กลับก่อนระบบเริ่มมีผู้ใช้จริง
   (ระบุไว้แล้วใน handoff ว่าปิดอยู่ชั่วคราว ไม่ใช่ของถาวร) — ใส่ไว้ในนี้เพื่อไม่ให้หายไปจากสายตา
   ระหว่างโฟกัส §2.9 เท่านั้น ไม่ใช่งานของ §2.9

---

## สรุปย่อ — ข้อไหน "ไม่มีอะไรจับได้เลยตอนนี้"

- **2.8 (Appointments error mapping)** — ไม่มีคำตอบที่ถูกให้เทียบจนกว่าจะมีการตัดสินใจ (ไม่ใช่แค่รอ
  implementation แต่รอการตัดสินใจเชิงสถาปัตยกรรมก่อน)
- **7 (ข้อมูลค้างครึ่งๆ บนชีตจริงหลัง partial failure)** — ต้องมีคนเปิดชีตดูเองเท่านั้น ไม่มีเทสต์ไหน
  ยืนยัน "reconcile ได้จริงด้วยมือ" ได้
- **2.3/GViz date-range filter ของจริง** — แผนเองยืนยันว่า mock ไม่พอ ต้องยิงกับ spreadsheet จริง
- **8 (`.js` extension)** — เฉพาะ deploy จริง + curl จริงเท่านั้น ไม่มีทางอื่น (ยืนยันจากประวัติจริง
  ของโปรเจกต์ ไม่ใช่การคาดเดา)
- **สิทธิ์เขียนของ service account บน production จริง** — ทุก workbook เปิด public read ทำให้อ่าน
  สำเร็จไม่ได้พิสูจน์อะไรเรื่องสิทธิ์เขียนเลย พิสูจน์ได้ทางเดียวคือเขียนจริงผ่าน smoke test ที่เจ้าของ
  โปรเจกต์กดเอง (ข้อ 3/4/5 ในหมวดก่อนหน้า)

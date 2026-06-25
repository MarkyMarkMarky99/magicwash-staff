# APPOINTMENT_MODULE_NEW_FLOW_REFACTOR_PLAN

**Status:** Step 1 CLOSED (Problem/Scope approved by Human 2026-06-24) → Step 2 direction proposed, awaiting Human decision
**Related Module:** appointments / engine-migration (legacy sheet-crud → repositories + BaseCrudService)
**Created by:** CLAUDE
**Date:** 2026-06-24

> Process & gates: see the collaborative-workflow `SKILL.md`.
> Fill sections in order — never write a section before its step gate clears.
> **Step 1 ปิดแล้ว. Step 2: ตกลง "ทิศทาง" กับ Human ก่อน ค่อยเขียน solution ลงแผน — ยังไม่เขียน How จนกว่าจะตกลง direction.**

---

## Problem & Objective

> **Step 1 gate:** handoff this section to Human and get confirmation before writing "How".

### Problem Statement

โมดูล `appointments` เป็น **โมดูลสุดท้ายที่ยังรันบน engine เก่า (`server/shared/sheet-crud/`)**
ขณะที่โมดูล `customers` ถูก migrate ไปอยู่บน flow ใหม่เรียบร้อยแล้ว และ `api/CLAUDE.md`
ประกาศชัดว่า flow ใหม่คือ source of truth:

> Target stack: `BaseCrudService` + `BaseRepository`/`GSheetRepository`
> (`server/shared/repositories/`) + the `ModuleContract` bundles … the `sheet-crud`
> factory flow … **is being removed. Do not treat the factory flow as the source of truth.**

หลักฐานจากโค้ดจริง:

- **appointments (เก่า)** — `server/modules/appointments/appointment.module.ts:2` ยัง
  `import { createGoogleSheetRepository, createSheetService } from '../../shared/sheet-crud'`,
  ใช้ flat bundle `appointmentApiSchemas` / `appointmentDbSchemas`
  (`{ row, idColumn, fieldMap, appendPayload, updatePayload }`), และเขียน filter ผ่าน
  `clauses` แบบ inline.
- **customers (ใหม่)** — `server/modules/customers/customer.module.ts` ใช้
  `new GSheetRepository({ contract, sheetName, spreadsheetId, scriptUrl })` +
  `new BaseCrudService({ repository, api, searchFields })` ขับด้วย contract bundle เดียว
  (`customerContract = { api, db }` ใน shape `ModuleContract`) ไม่มี `clauses` เลย.
- การ grep ยืนยันว่า **appointment.module.ts เป็น module เดียวที่ยัง import `sheet-crud`** —
  ไฟล์อื่นที่ติด `sheet-crud` คือ engine ตัวมันเองทั้งหมด. ตราบใดที่ appointments ยังไม่ย้าย
  legacy engine ก็ลบไม่ได้ → ต้องดูแล 2 engine คู่กัน และ doc/skeleton ใน `api/CLAUDE.md`
  divergent กับโค้ดจริง.

ปัญหา (pain) แยกเป็น 2 ชั้น:

**1. ชั้นโครงสร้าง (mechanical) — ตรงไปตรงมา ตามแม่แบบ customers:**
ไฟล์/บันเดิลของ appointments ยังเป็นรูปแบบเก่า ต้องปรับให้เข้ารูป `ModuleContract`:
- `contracts/appointments/appointment-api.schema.ts` export flat `appointmentApiSchemas`
  (`{ listQuery, createRequest, … }`) แทนที่จะเป็น nested `appointmentApiContract`
  (`{ query.list, request.{create,update}, response.{list,detail,create,update} }`).
- `server/modules/appointments/appointment-db.schema.ts` export `appointmentDbSchemas`
  (`{ row, idColumn, fieldMap, appendPayload, updatePayload }`) แทน `appointment.contract.ts`
  ที่มี `appointmentDbContract` (`{ row, fieldMap, primaryKey, request.{create,update},
  response.{read,create,update} }`) + composed `appointmentContract = { api, db }`.
- รายละเอียดเล็ก ๆ: `idColumn: 'AppointmentID'` (DB column) → `primaryKey: 'appointmentId'`
  (API field); ขาด slot `response.read`; payload `appendPayload`/`updatePayload` →
  `request.create`/`request.update`.

**2. ชั้นความสามารถ (capability gap) — นี่คือหัวใจของปัญหา:**
read pipeline ใหม่ (`ReadQueryDTO.fromQuery` + `GSheetRepository` + `GVizQueryBuilder`)
รองรับเฉพาะ **equality-on-one-column `where` + keyword `search` (contains) + sort +
pagination** เท่านั้น — docstring ของ `read-query.dto.ts` ระบุเองว่า "does NOT … support
operation/range/null/or filters (future repository-layer work)" และทุก non-reserved field
จะถูกตีความเป็น **equality filter ที่ map ตรงเป็น 1 column**.

แต่ list query ของ appointments (`appointmentListQuerySchema`) มี filter ที่ flow ใหม่
**ยังแสดงออกไม่ได้** (เทียบกับ `clauses` เดิมใน appointment.module.ts:24-46):

| filter | engine เก่า | flow ใหม่ทำได้ไหม |
|---|---|---|
| `keyword` → `AppointmentID/CustomerID/Address/Notes` | `clause.contains` | ✅ ใช้ `searchFields` |
| `customerId`,`status`,`appointmentType`,`timeSlot`,`serviceTier` | `clause.eq` (1:1) | ✅ equality `where` |
| `dateFrom`/`dateTo` ครอบ `AppointmentDate` | `clause.dateRange` | ❌ เป็น **range ไม่ใช่ equality** |
| `orderId` → `PickupOrderID` **OR** `DeliveryOrderID` | `clause.eq('orderId', [2 cols])` | ❌ **1 field → OR หลาย column** |
| `includePending` → `( … or Status='PENDING')` | OR-widen ด้วย constant | ❌ **boolean flag → OR กับค่าคงที่** |

ผลคือ migrate แบบลอก customers ตรง ๆ จะ **พังทันที**: `dateFrom`/`dateTo`/`orderId`/
`includePending` เป็น non-reserved fields → ถูกยัดเข้า `where` → mapper หา column ไม่เจอ →
`GVizQueryBuilder.resolveColumn('dateFrom')` throw `No GViz column resolves for field 'dateFrom'`.
customers migrate ผ่านได้เพราะ filter เดียวคือ `customerType` (equality 1:1) + keyword เท่านั้น —
appointments เป็นโมดูลแรกที่ไปชน filter ที่ engine ใหม่ยังไม่มี.

### Goal / Success Criteria

- `appointments` รันบน new stack (`GSheetRepository` + `BaseCrudService` + `ModuleContract`
  bundles) เหมือน `customers` — ไม่มี module ไหนอ้าง `server/shared/sheet-crud/` อีก.
- **Behavior parity ของ list filters ครบทุกตัว**: keyword search, `customerId`, `orderId`
  (OR 2 columns), `status`, `appointmentType`, `timeSlot`, `serviceTier`, date range
  (`dateFrom`/`dateTo`), `includePending` — ให้ผลลัพธ์ query เทียบเท่าของเดิม.
- พฤติกรรม create/update/getById คงเดิม (รวม validation 422, append ต้องมี
  `CreatedBy`+`ServiceTier`, update เป็น PATCH + actor required, response projection
  list/detail split เท่าเดิม).
- `npm run typecheck:api` ผ่าน (EXIT 0).
- **Route GET ต้องสลับ `okPaginated` → `okPaged`** (แก้ทั้ง import และ call ใน
  `api/appointments/index.ts`) ให้ตรงกับแม่แบบ `api/customers/index.ts:8`. เหตุผล:
  `okPaginated` รับ `apiPaginationMetaSchema` = `{ total, page, perPage, totalPages }`
  (`contracts/shared/api.schema.ts:39-44`) แต่ `BaseCrudService.list()` คืน
  `pagination: { page, perPage }` เท่านั้น (`base-crud.service.ts:108-111`) → ของเดิม
  type-check ผ่านเพราะ sheet-crud service คืน `total` มาด้วย, พอย้ายมา BaseCrudService
  แล้ว `okPaginated` จะ **type ไม่ผ่าน**. เมธอด `list/getById/create/update` และรูป
  `{ items, pagination }` ที่ service คืนยังเหมือนเดิม.

### Scope

**In Scope**
- ปรับ `contracts/appointments/appointment-api.schema.ts` → nested `appointmentApiContract`
  (`satisfies ModuleApiContract`) โดยคง schema เดิมทั้งหมดเป็น source of truth.
- แทน `appointment-db.schema.ts` ด้วย `appointment.contract.ts` (db contract +
  composed `appointmentContract`) ตามแม่แบบ `customer.contract.ts`.
- เขียน `appointment.module.ts` ใหม่ให้ wiring แบบ class-instance singleton (new stack).
- **ปิด capability gap ของ filter** ให้ filter ของ appointments ทุกตัวทำงานบน read pipeline
  ใหม่ได้ (range / OR-across-columns / includePending). *วิธีปิด gap = งานของ Step 2*
  (จะ extend engine กลาง หรือใช้กลไกระดับ module — ยังไม่ตัดสินตอนนี้).
- รวม env ของ appointments เป็น shared `APPSCRIPT_URL` (เลิกใช้ `APPSCRIPT_APPOINTMENT_URL`)
  — **ยืนยันโดย Human 2026-06-24**.
- **ลบ legacy engine ในงานนี้เลย**: `server/shared/sheet-crud/` +
  `server/shared/google-sheets/` + `server/shared/repositories/base-sheet.repository.ts`
  (appointments เป็น consumer สุดท้าย ลบได้หลังย้ายเสร็จ) — **ยืนยันโดย Human 2026-06-24**.
- เขียน/ปรับ tests ให้คลุม edge cases ที่ derive ใน Step 2 (TDD ใน Step 3).

**Out of Scope**
- DELETE / soft-delete (ยัง deferred ตามมติเดิม).
- แตะ FE appointments ที่มีอยู่ (legacy `src/composables/useAppointmentStore.js`,
  `src/pages/*`, `src/components/appointments/*`) — ทั้ง migrate ไป feature-based และ
  เปลี่ยนให้มันมาเรียก `/api/appointments` (ปัจจุบันมัน bypass API อยู่ ดู Known change).
- เปลี่ยน Apps Script deployment จริงฝั่ง infra (การรวม env เป็น `APPSCRIPT_URL` ใน
  backend module = In Scope แล้ว ตาม Open Question #2 ที่ resolved).

**Known API contract change (ไม่ใช่ "ไม่กระทบ FE")**
- list envelope `meta.pagination` หดจาก `{ total, page, perPage, totalPages }` →
  `{ page, perPage }` (page-only). นี่เป็น **API envelope change** จริง — สอดคล้องกับที่
  `customers` ปล่อยอยู่แล้ว.
- **ยืนยัน repo-wide** (ไม่ใช่แค่ไม่มี `src/features/appointments/`): grep ทั้ง repo พบว่า
  `appointmentService` ถูก import เฉพาะ `api/appointments/index.ts`, `[id].ts`, และ
  module ตัวเอง — **ไม่มีโค้ด FE ไหนเรียก `/api/appointments` เลย**. FE appointments ที่มี
  อยู่อ่าน **GViz ตรง** (`gvizQuery(APPOINTMENTS_SPREADSHEET_ID, 'Appointments', …)`)
  และเขียน **`APPOINTMENTS_SCRIPT_URL` ตรง** ผ่าน Apps Script — bypass serverless API
  ทั้งหมด. ดังนั้น envelope change นี้ **ไม่มี FE consumer ที่พัง** เพราะ FE ไม่ได้ใช้
  endpoint นี้ (ไม่ใช่เพราะ "ไม่มี feature folder"). business DTO (list/detail rows) เท่าเดิม.

### Requirements

**Functional**
- list filters ทุกตัวให้ GViz query เทียบเท่าของเดิม (รวม `dateFrom<=dateTo` refine →
  422, OR ของ `orderId`, OR-widen ของ `includePending`).
- **`includePending` ต้องล็อกสองกิ่งให้ชัด** (จะกลายเป็น test case ใน Step 3):
  - `includePending=true` **+ มี** date range → `(AppointmentDate ใน from..to) OR Status='PENDING'`.
  - `includePending=true` **+ ไม่มี** date range → `Status='PENDING'` ล้วน.
  - `includePending=false`/ไม่ส่ง → ไม่แตะ (date range ตามปกติถ้ามี).
- create/update/getById พฤติกรรม + validation เดิม; response projection list/detail
  เดิม; audit fields ไม่โผล่ใน response.
- **write null-semantics (omit vs clear)** — pipeline จริงคือ `mapper.toDb` →
  `renameKeys` วน `Object.entries(input)` (`base.repository.ts:280-286`) แล้ว
  `JSON.stringify` ส่งให้ Apps Script. ดังนั้น DB write request schema ต้องสื่อความ:
  - omit field (ไม่ส่ง key) → ไม่แตะค่าเดิม.
  - explicit `null` → ส่ง `null` เพื่อล้างค่า.
  - required field → ต้องมีเสมอ.
  ผลคือฟิลด์ที่ต้องการ "ละไว้ = คงเดิม, null = ล้าง" (เช่น `Address`, `PickupOrderID`,
  `DeliveryOrderID`, `Notes` ใน create/update) ต้องเป็น **`.nullable().optional()`** —
  ไม่ใช่ `.nullable()` เดี่ยว (ซึ่งทำให้ฟิลด์ required = ถูกส่งทุกครั้ง = เคลียร์ค่าเสมอ).
- id ที่หาไม่เจอ → 404; id ซ้ำหลายแถว → 409 (ตาม BaseCrudService).

**Non-Functional**
- `npm run typecheck:api` ผ่าน; ไม่ใช้ `any`/`as` ใน module code.
- ทุก contract ถูก machine-check ด้วย `satisfies` (`ModuleApiContract` /
  `ModuleDbContract` / `ModuleContract` / `fieldMap satisfies Record<keyof row & string,string>`).
- schema files ไม่ export `z.infer` aliases (ดู [[schema-files-no-infer-exports]]).
- ไม่เพิ่ม method เก็งกำไรใน repository/engine; ส่วนที่ extend engine ต้องไม่ทำให้
  customers (และ module อนาคต) พฤติกรรมเปลี่ยน.

### Open Questions

1. **วิธีปิด capability gap** — *design ของ Step 2* (มีนัยเชิงสถาปัตยกรรม): ขยาย read
   pipeline กลาง (`ReadQueryDTO`/`GVizQueryBuilder`) ให้รองรับ range/OR เป็น first-class,
   หรือให้ appointments แนบ custom filter logic ระดับ module โดยไม่แตะ engine กลาง? —
   ยกไปตัดสินใน Step 2.
2. ~~env / Apps Script endpoint~~ → **RESOLVED 2026-06-24: รวมเป็น shared `APPSCRIPT_URL`.**
3. ~~ขอบเขตการลบ legacy~~ → **RESOLVED 2026-06-24: รวมการลบ legacy ในงานนี้.**
4. ~~Problem/Scope ต้อง "ปรับก่อน"~~ → **RESOLVED 2026-06-24**: Human ระบุ 4 จุด —
   (a) route `okPaginated`→`okPaged` (ผมเคยพูดผิดว่าไม่ต้องแก้), (b) frontend เป็น
   envelope change ไม่ใช่ "no impact", (c) write fields ต้อง `.nullable().optional()`,
   (d) ล็อก `includePending` สองกิ่ง. fold เข้า Goal/Scope/Requirements แล้ว.

---

## How (Implementation Approach)

> Step 2: agree the approach with the human first, then document it here. **(ยังไม่เริ่ม)**

### High-Level Steps

_TBD — Step 2_

### Contracts

_TBD — Step 2_

### Functional Flow & Behavior

_TBD — Step 2_

### Edge Cases (complete list, grouped by feature/work-area)

_TBD — Step 2 (derive หลัง approach นิ่ง)_

---

## Activity Log

================================================================================

- [CLAUDE] [2026-06-24 18:40]
**Created Problem Definition (Step 1)**
อ่านโค้ดจริงทั้งสองฝั่ง: appointments (legacy `sheet-crud`: appointment.module.ts,
appointment-db.schema.ts, contracts/appointments/appointment-api.schema.ts) และ
customers (new stack: customer.module.ts, customer.contract.ts,
contracts/customers/customer-api.schema.ts) + engine กลาง (base-crud.service.ts,
read-query.dto.ts, base/gsheet.repository.ts, gviz-query.builder.ts, module-*-contract.ts)
+ routes. ยืนยันว่า appointments เป็น module สุดท้ายบน sheet-crud และเจอ capability gap
ของ read pipeline ใหม่ (range / OR-across-columns / includePending) เป็นแก่นของปัญหา.
เขียน Problem Statement / Goal / Scope / Requirements + Open Questions.

**Handoff -> @user**
ขอยืนยัน: (1) Problem + Scope ตรงกับที่ตั้งใจไหม โดยเฉพาะว่า "flow ใหม่" = stack ของ
customers (GSheetRepository + BaseCrudService + ModuleContract); (2) ตอบ Open Questions
ข้อ env (APPSCRIPT_URL vs APPSCRIPT_APPOINTMENT_URL) และขอบเขตการลบ legacy ว่าอยู่ในงานนี้
หรือ follow-up. ยังไม่ออกแบบ solution จนกว่าจะยืนยัน.

================================================================================

- [USER] [2026-06-24 18:48]
**ตอบ Step 1 (บางส่วน)**
- env / Apps Script endpoint → **รวมเป็น shared `APPSCRIPT_URL`**.
- การลบ legacy `sheet-crud`/`google-sheets` → **รวมในงานนี้เลย**.
- Problem framing → เลือก **"ปรับก่อน"** (มีจุดใน Problem/Scope ที่อยากปรับก่อนปิด Step 1).

**Handoff -> @claude**
ระบุว่าจะปรับ Problem/Scope ตรงไหน.

================================================================================

- [CLAUDE] [2026-06-24 18:50]
**บันทึกมติที่ยืนยันแล้ว + รอ input**
ย้าย "ลบ legacy" และ "รวม env เป็น APPSCRIPT_URL" เข้า In Scope; ปิด Open Questions
ข้อ 2–3. ค้างข้อ 1 (วิธีปิด capability gap) ไว้ตัดสินใน Step 2.

**Handoff -> @user**
รอ Human ระบุจุดที่ต้อง "ปรับก่อน" ใน Problem/Scope — ยังไม่เข้า Step 2 จนกว่าจะเคลียร์.

================================================================================

- [USER] [2026-06-24 19:05]
**ระบุจุดที่ต้อง "ปรับก่อน" (4 ข้อ)**
1. Route ต้องเปลี่ยน: `okPaginated` ต้องการ `{ total, page, perPage, totalPages }` แต่
   `BaseCrudService.list()` คืน `{ page, perPage }` → ต้องใช้ `okPaged` แบบ customers.
2. Frontend impact ห้ามเขียนว่า "ไม่มีแน่นอน": pagination meta เปลี่ยน = envelope change.
3. ขาด write omission/null contract: omit→ไม่ส่ง, null→ล้าง, required→ต้องมี; ดังนั้น
   `Address`/`PickupOrderID`/`DeliveryOrderID`/`Notes` ต้อง `.nullable().optional()`.
4. ล็อก `includePending` edge case: (มี date range → date range OR PENDING),
   (ไม่มี date range → PENDING ล้วน).

**Handoff -> @claude**
ยืนยันกับโค้ดจริงแล้ว fold เข้าแผน.

================================================================================

- [CLAUDE] [2026-06-24 19:10]
**ยืนยัน 4 จุดกับโค้ดจริง + fold เข้าแผน (ปิด Step 1)**
อ่าน `api/appointments/index.ts`, `api/customers/index.ts`, `http/response.ts`,
`contracts/shared/api.schema.ts`, `gsheet.repository.ts`, `base.repository.ts` —
ยืนยันทั้ง 4 จุดถูกต้อง (จุด 1/3/4 เป็นข้อเท็จจริงจากโค้ดตรง; ข้อ 1 ผมเคยสรุปผิดว่า
route ไม่ต้องแก้). เพิ่มเติม: ไม่มี `src/features/appointments/` บน FE เลย (glob ไม่เจอ)
→ ข้อ 2 ไม่มี consumer พังตอนนี้ แต่บันทึกเป็น contract change ตามจริง.
แก้แผน: Goal เพิ่ม route `okPaginated`→`okPaged` (ลบประโยค "route ไม่ต้องแก้ logic"),
Scope เพิ่ม "Known API contract change" + ย้าย FE feature ออกเป็น Out of Scope,
Requirements เพิ่ม includePending สองกิ่ง + write null-semantics (`.nullable().optional()`),
ปิด Open Question #4.

**Handoff -> @user**
Step 1 (Problem/Scope/Requirements) ครบและตรงกับ 4 จุดที่ระบุแล้ว. ขอ **gate ปิด Step 1**:
ยืนยันว่าพร้อมเข้า Step 2 (Solution Design) ไหม — Step 2 จะโฟกัส Open Question #1
(วิธีปิด capability gap: extend engine กลางให้รองรับ range/OR เป็น first-class
vs. กลไกระดับ module) เป็นแกนการออกแบบ.

================================================================================

- [CODEX] [2026-06-26 00:18]
**Proposed migration direction (Step 2 — pending Human decision)**
อ่าน collaborative-workflow skill + plan template/example และตรวจโค้ดจริงที่เป็นจุดตัดสินใจ:
`server/shared/dtos/read-query.dto.ts`, `server/shared/repositories/base.repository.ts`,
`server/shared/repositories/gsheet.repository.ts`,
`server/shared/repositories/utils/gviz-query.builder.ts`,
`server/shared/services/base-crud.service.ts`,
`server/modules/appointments/appointment.module.ts`,
`server/modules/appointments/appointment-db.schema.ts`,
`contracts/appointments/appointment-api.schema.ts`,
`server/modules/customers/customer.module.ts`, และ
`server/modules/customers/customer.contract.ts`.

ข้อเท็จจริงที่ยืนยันแล้ว: `BaseCrudService.list()` บังคับใช้
`ReadQueryDTO.fromQuery()` เสมอ และ `fromQuery()` จะย้ายทุก non-reserved query field
เข้า `where` equality filter. ส่วน `GVizQueryBuilder` render ได้แค่ equality `where`,
keyword `search`, sort, pagination. ดังนั้น appointments ไม่สามารถ migrate แบบ customers
ตรง ๆ ได้ เพราะ `dateFrom`/`dateTo`/`orderId`/`includePending` จะเป็น field ที่ resolve
เป็นคอลัมน์ไม่ได้หรือ express OR/range ไม่ได้.

**Recommendation:** ใช้แนวทาง hybrid ที่ขยาย read pipeline กลางให้มี filter expression
แบบ data-only เป็น first-class แล้วให้ appointments มี pure query adapter เฉพาะ module
เพื่อแปลง list query ที่ validate แล้วเป็น `ReadQueryDTO` ที่มี expression เหล่านั้น.
รายละเอียด direction:
- เพิ่ม shared read expression contract ใน `read-query.dto.ts` เช่น `eq`, `contains`,
  `dateRange`, `and`, `or` โดยยังใช้ API/domain field names และยังไม่ผูกกับ GViz string.
- ขยาย `BaseRepository.mapQueryToDb()` ให้ map field names ภายใน expression จาก API →
  DB column names เหมือนที่ทำกับ `where`/`search`/`sort` อยู่แล้ว.
- ขยาย `GVizQueryBuilder` ให้ render expression หลัง map เป็น DB fields แล้ว โดยใช้
  sanitizer/column resolver เดียวกับของเดิม และยัง join top-level constraints ด้วย `and`.
- เพิ่ม optional hook ที่ `BaseCrudServiceOptions` เช่น `buildReadQuery(validQuery,
  searchFields)`; default ยังเป็น `ReadQueryDTO.fromQuery()` เพื่อให้ customers และ module
  simple CRUD ไม่เปลี่ยน behavior.
- appointments ใช้ hook นี้เพื่อ:
  - เก็บ equality filters ปกติไว้ใน `where`: `customerId`, `status`,
    `appointmentType`, `timeSlot`, `serviceTier`.
  - แปลง `orderId` เป็น `or(eq(pickupOrderId), eq(deliveryOrderId))`.
  - แปลง date range เป็น `dateRange(appointmentDate, dateFrom, dateTo)`.
  - แปลง `includePending=true` เป็น OR ตาม requirement:
    `(dateRange OR status='PENDING')` เมื่อมี date range,
    หรือ `status='PENDING'` ล้วนเมื่อไม่มี date range.
  - ใช้ keyword search เดิมผ่าน `searchFields: ['appointmentId', 'customerId',
    'address', 'notes']`.
- หลัง direction นี้นิ่ง ค่อยเขียนส่วน `How` เป็น migration steps:
  1. ปรับ API contract appointments เป็น nested `appointmentApiContract`.
  2. แทน DB schema bundle เก่าด้วย `appointment.contract.ts` และ `appointmentContract`.
  3. เพิ่ม read expression support + tests ใน shared pipeline.
  4. wire `appointment.module.ts` ด้วย `GSheetRepository` + `BaseCrudService` +
     `buildAppointmentReadQuery`.
  5. แก้ route GET จาก `okPaginated` เป็น `okPaged`.
  6. ลบ legacy `sheet-crud`, `google-sheets`, `base-sheet.repository.ts` หลังไม่มี consumer.
  7. รัน typecheck/tests และบันทึกผล.

ทางเลือกที่ไม่แนะนำ:
- module-level raw GViz clause/transformer: migrate เร็วกว่าแต่ดึง string dialect กลับมาอยู่
  ใน appointments และไม่แก้ gap ให้ engine ใหม่.
- ขยาย `ReadQueryDTO.fromQuery()` ด้วย config descriptor อย่างเดียว: ลด hook ได้แต่จะซับซ้อน
  กับ `includePending` เพราะมันเป็น conditional OR ที่ขึ้นกับหลาย field.
- custom AppointmentService ไม่ใช้ `BaseCrudService`: รักษา behavior ได้แต่ขัด goal ที่
  appointments ต้องรันบน stack เดียวกับ customers.

ยังไม่เติม `How` เพราะ collaborative-workflow ระบุว่า Step 2 ต้องตกลง direction กับ Human
ก่อน แล้วจึง document solution ลง sections หลัก.

**Handoff -> @user**
ขอ Human decision: อนุมัติ direction hybrid นี้ไหม? ถ้าอนุมัติ รอบถัดไปจะเติม `How`
ในไฟล์นี้เป็น High-Level Steps, Contracts, Functional Flow และ derive Edge Cases เพื่อส่ง
review ต่อ.

================================================================================

- [USER] [2026-06-26 02:22]
**Re-scoped appointments API/DB contract decisions**
ตัดสินใจไม่แก้ `BaseCrudService.list()` / Base read pipeline ในรอบนี้. ดังนั้น
appointments list query จะเหลือเฉพาะ filter ที่ Base เดิมรองรับได้:
`keyword`, `customerId`, `appointmentDate`, `status`, `page`, `perPage`, `sortBy`,
`sortOrder`; ตัด `dateFrom`, `dateTo`, `orderId`, `includePending`,
`appointmentType`, `timeSlot`, `serviceTier` ออกจาก query. Sort field เหลือ
`appointmentDate`, `timeSlot`, `status`.

API create เอา `address` ออกทั้งหมด เพราะ backend transformer จะ derive DB `Address`
จาก `customerId`; `serviceTier` เป็น optional. API update เอา `serviceTier` ออก.
List response เพิ่ม `customerName`, `customerCode`, `phone`, `address`, `location`,
`notes` และตัด `serviceTier`; detail/create/update response ใช้ detail shape ที่เพิ่ม
`pickupOrderId`, `deliveryOrderId`, `serviceTier`.

DB contract decisions: `ServiceTier` ใน create เป็น optional; เพิ่ม `DeletedAt`,
`DeletedBy` ต่อท้าย row schema; DB create มี `Address` required. คอลัมน์ `Address`
เป็น JSON customer snapshot string ที่ GViz คืนเป็น string. Transformer ภายหลังจะ parse
`Address` snapshot และ map `CustomerName -> customerName`,
`CustomerLabel -> customerCode`, `Phone -> phone`, `Address -> address`,
`Location -> location`. ยังไม่ implement transformer ในรอบนี้.

**Handoff -> @codex**
แก้ API contract และสร้าง `appointment.contract.ts` ตาม decisions ข้างต้น.


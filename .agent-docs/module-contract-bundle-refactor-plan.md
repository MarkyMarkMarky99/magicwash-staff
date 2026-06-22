# MODULE_CONTRACT_BUNDLE_REFACTOR_PLAN

**Status:** Draft  
**Related Module:** shared module contract / api-db schema bundles  
**Created by:** CODEX  
**Date:** 2026-06-22

---

## Problem & Objective

### Problem Statement

ปัจจุบันแต่ละ module export schema หลายตัวแยกกัน เช่น list query, create request, update request, list/detail/create/update response, row schema, field map ทำให้:
- import ยาวและซ้ำใน module wiring
- ชื่อ schema มีโอกาส drift ระหว่าง module
- ตรวจยากว่า API contract / DB contract ของ module ครบหรือไม่
- คน implement ต้องจำชื่อ schema เฉพาะของแต่ละ module เอง
- ยังไม่มี shared contract shape ที่บังคับว่า API side และ DB side ต้องมี keys ตามมาตรฐานเดียวกัน

### Goal / Success Criteria

- ทุก module มี `ModuleApiContract` shape เดียวกัน
- ทุก module มี `ModuleDbContract` shape เดียวกัน
- module สามารถ export `ModuleContract = { api, db }`
- module wiring import contract หลักเพียง 1-2 ตัว
- `BaseCrudService` สามารถรับ nested API contract bundle โดยตรง
- `GSheetRepository` ใช้ DB contract field ที่ต้องใช้จริงจาก bundle
- DB contract รองรับ request/response schemas ของ database boundary แม้ repository ยังไม่ได้ consume ทุก key ในรอบนี้
- อนาคตสามารถสร้าง shared tool เช่น map DB response -> API response จาก contract shape เดียวกันได้
- ไม่เปลี่ยน validation / mapper / ReadQueryDTO behavior

### Scope

**In Scope**
- นิยาม shared `ModuleApiContract`
- นิยาม shared `ModuleDbContract`
- นิยาม shared `ModuleContract`
- ปรับ `BaseCrudServiceOptions` ให้รับ `api` bundle
- ปรับ customers module ให้ใช้ bundle shape ใหม่
- sync plan / contract reference ที่เกี่ยวข้อง

**Out of Scope**
- เปลี่ยน schema behavior
- เปลี่ยน mapper behavior
- เปลี่ยน repository request pipeline
- เพิ่ม query operators/range/or/null
- migrate appointments
- ลบ legacy `sheet-crud` / `google-sheets`
- ทำ backward compatibility เพื่อ old `sheet-crud`

### Requirements

**Functional Requirements**
- ต้องยัง export individual schemas ได้
- ต้องเพิ่ม bundle export เป็น standard entry point
- API bundle ต้อง `satisfies ModuleApiContract`
- DB bundle ต้อง `satisfies ModuleDbContract`
- module contract รวมต้อง `satisfies ModuleContract`
- `BaseCrudService` ต้องอ่าน schema จาก nested API bundle
- module wiring ไม่ควร import response/request schemas แยกยาว
- DB contract ต้องมี `row`, `fieldMap`, `primaryKey`, `request`, `response`
- DB request/response schemas อาจยังไม่ถูก consume ทุกตัวในรอบนี้

**Non-Functional Requirements**
- contract shape ต้องอ่านง่ายและเหมือนกันทุก module
- ลด import noise โดยไม่ซ่อน schema จริง
- ไม่เพิ่ม runtime abstraction ที่ไม่จำเป็น
- typecheck ต้องผ่านหลัง refactor

---

## How (Implementation Approach)

### High-Level Steps
1. สร้าง shared module contract types
2. ปรับ API bundle ให้ conform กับ `ModuleApiContract`
3. ปรับ DB bundle ให้ conform กับ `ModuleDbContract`
4. export module contract รวม `{ api, db }`
5. rename DB request schemas จาก old action-specific names เป็น generic DB request names
6. ปรับ `BaseCrudServiceOptions` จากรับ schema แยก เป็นรับ `api`
7. ปรับ `BaseCrudService` ให้ใช้ API bundle
8. ปรับ `server/modules/customers/customer.module.ts` ให้ import bundle
9. sync dry tests / type contracts ตาม API ใหม่
10. sync docs/rules ที่อธิบาย module contract shape

### Contracts

```ts
// File locations:
// contracts/shared/module-api-contract.ts
//   ResponseSchema
//   ModuleApiContract
//   ModuleApiContractOf
//
// server/shared/contracts/module-db-contract.ts
//   FieldMap
//   ModuleDbContract
//   ModuleDbContractOf
//   ModuleContract

// Shared contract shape:
type ModuleApiContract = {
  query: {
    list: ZodSchema
  }
  request: {
    create: ZodSchema
    update: ZodSchema
  }
  response: {
    list: ResponseSchema
    detail: ResponseSchema
    create: ResponseSchema
    update: ResponseSchema
  }
}

type ModuleDbContract = {
  row: ZodSchema
  fieldMap: Record<string, string> // DB field -> API field
  primaryKey: string // API/domain field name, e.g. customerId
  request: {
    create: ZodSchema
    update: ZodSchema
    delete?: ZodSchema
  }
  response: {
    read: ZodSchema
    create: ZodSchema
    update: ZodSchema
    delete?: ZodSchema
  }
}

type ModuleContract = {
  api: ModuleApiContract
  db: ModuleDbContract
}

type ResponseSchema<TResponse extends object> =
  ZodType<TResponse, ZodTypeDef, unknown> & {
    shape: Record<keyof TResponse & string, unknown>
  }

type ModuleApiContractOf<
  TListQuery,
  TCreate,
  TUpdate,
  TListResponse extends object,
  TDetailResponse extends object,
  TCreateResponse extends object,
  TUpdateResponse extends object,
> = {
  query: {
    list: ZodType<TListQuery, ZodTypeDef, unknown>
  }
  request: {
    create: ZodType<TCreate, ZodTypeDef, unknown>
    update: ZodType<TUpdate, ZodTypeDef, unknown>
  }
  response: {
    list: ResponseSchema<TListResponse>
    detail: ResponseSchema<TDetailResponse>
    create: ResponseSchema<TCreateResponse>
    update: ResponseSchema<TUpdateResponse>
  }
}

// DB request schema names:
customerAppendPayloadSchema -> customerDbCreateRequestSchema
customerUpdatePayloadSchema -> customerDbUpdateRequestSchema

// Customer API contract:
const customerApiSchemas = {
  query: {
    list: customerListQuerySchema,
  },
  request: {
    create: customerCreateSchema,
    update: customerUpdateSchema,
  },
  response: {
    list: customerListResponseSchema,
    detail: customerDetailResponseSchema,
    create: customerCreateResponseSchema,
    update: customerUpdateResponseSchema,
  },
} satisfies ModuleApiContract

// Customer DB contract:
const customerDbContract = {
  row: customerRowSchema,
  fieldMap: customerFieldMap,
  primaryKey: 'customerId',
  request: {
    create: customerDbCreateRequestSchema,
    update: customerDbUpdateRequestSchema,
  },
  response: {
    read: customerRowSchema.partial(),
    create: customerRowSchema,
    update: customerRowSchema,
  },
} satisfies ModuleDbContract

// Optional module-level contract:
const customerContract = {
  api: customerApiSchemas,
  db: customerDbContract,
} satisfies ModuleContract

// BaseCrudServiceOptions:
interface BaseCrudServiceOptions<
  TApiRow,
  TListQuery,
  TCreate,
  TUpdate,
  TListResponse,
  TDetailResponse,
  TCreateResponse,
  TUpdateResponse,
> {
  repository: BaseRepository<
    TApiRow,
    OmitReservedQueryFields<TListQuery>,
    TCreate,
    TUpdate
  >
  api: ModuleApiContractOf<
    TListQuery,
    TCreate,
    TUpdate,
    TListResponse,
    TDetailResponse,
    TCreateResponse,
    TUpdateResponse
  >
  searchFields: readonly string[]
}
```

### Functional Flow & Behavior

```ts
new BaseCrudService({
  repository,
  api: customerContract.api,
  searchFields: ['customerIndex', 'customerName', 'address'],
})

BaseCrudService.list(rawQuery)
  -> api.query.list.parse(rawQuery)
  -> ReadQueryDTO.fromQuery(validQuery, searchFields)
  -> repository.read(dto)
  -> project api.response.list.shape
  -> { items, pagination: { page, perPage } }

BaseCrudService.getById(id)
  -> ReadQueryDTO.fromId(id)
  -> repository.read(dto)
  -> project api.response.detail.shape

BaseCrudService.create(rawPayload)
  -> api.request.create.parse(rawPayload)
  -> repository.create(parsedPayload)
  -> project api.response.create.shape

BaseCrudService.update(id, rawPayload)
  -> api.request.update.parse(rawPayload)
  -> repository.read(ReadQueryDTO.fromId(id))
  -> repository.update(id, parsedPayload)
  -> project api.response.update.shape

new GSheetRepository({
  rowSchema: customerContract.db.row,
  fieldMap: customerContract.db.fieldMap,
  primaryKey: customerContract.db.primaryKey,
  ...
})
```

### Edge Cases & Test Considerations

- individual schema exports ยังใช้งานได้เหมือนเดิม
- bundle missing key ต้อง fail ที่ typecheck
- API bundle keys ต้องตรง `ModuleApiContract`
- API bundle ใช้ nested shape: `query`, `request`, `response`
- DB bundle keys ต้องตรง `ModuleDbContract`
- `primaryKey` ต้องเป็น API/domain field ไม่ใช่ DB column
- DB request/response schemas มีไว้ใน contract แม้ repository ยังไม่ได้ consume ทุกตัว
- DB request schema ใช้ generic names: `customerDbCreateRequestSchema`, `customerDbUpdateRequestSchema`
- ไม่ทำ alias ชื่อ old design (`appendPayload` / `updatePayload`) ใน target flow
- `BaseCrudService` projection ยังใช้ response schema shape เดิม
- `BaseCrudService` ยังไม่ validate response runtime
- `ReadQueryDTO.fromQuery()` behavior ต้องไม่เปลี่ยน
- customers module import ต้องสั้นลงจริง
- old `sheet-crud` compatibility ไม่ใช่เป้าหมายของ design ใหม่
- customers และ appointments อาจมี contract shape ต่างกันชั่วคราวจนกว่า appointments จะ migrate
- sync docs:
  - `api/CLAUDE.md`
  - `.claude/rules/api-contract-schema-rules.md`
- `npm run typecheck:api` ต้องผ่าน
- service dry test ต้องผ่าน

---

## Activity Log

================================================================================

- [CODEX] [2026-06-22]
**Created initial plan**  
Defined module contract bundle refactor plan, target API/DB bundle shape, BaseCrudService option change, and customer module wiring behavior.

**Handoff -> @claude**  
กรุณารีวิว plan ในไฟล์นี้ตาม collaborative workflow — อ่าน Problem & Objective, How, Contracts, Functional Flow, และ Edge Cases ด้านบน แล้ว append review ที่ Activity Log ด้านล่าง **โดยไม่แก้ไขเนื้อหา plan เดิม**

================================================================================

- [CLAUDE] [2026-06-22]
**Reviewed plan — REQUEST CHANGES (ยังไม่ approve)**

รีวิวโดยอ่านโค้ดจริง ไม่ได้อ่านแค่ plan. โดยรวม "ทิศทาง" (module wiring import contract น้อยลง, service รับ bundle) ถูกต้องและ align กับที่ `api/CLAUDE.md` วางไว้ แต่ contract ที่เขียนใน plan **ขัดกับของที่มีอยู่จริงในโค้ดหลายจุด** จึงขอแก้ก่อน

**สิ่งที่ถูกต้องแล้ว (accurate):**
- Functional Flow ตรงกับ `base-crud.service.ts` ของจริงทุก method (list→project+pagination{page,perPage}, getById→read(fromId)+project detail, create→parse+create+project, update→read existence check ก่อน update). เก็บไว้ได้
- เป้าหมาย "ลด import noise" และ "ไม่แตะ ReadQueryDTO/mapper behavior" สมเหตุสมผล

**Blocking issues:**

**B1 — bundle มีอยู่แล้ว และ plan เสนอ "คนละ shape".**
`contracts/customers/customer-api.schema.ts:111` มี `customerApiSchemas` (FLAT: `listQuery / createRequest / updateRequest / listResponse / detailResponse / createResponse / updateResponse`) และ `customer-db.schema.ts:115` มี `customerDbSchemas` อยู่แล้ว — แต่ตอนนี้ **ไม่มีใคร consume** (grep ยืนยัน) เพราะ `customer.module.ts:59` ยัง pass flat options. plan กลับเสนอ bundle ชื่อใหม่ `customerApiContract` ที่เป็น **NESTED** (`query.list`, `request.create`, `response.list/...`). ผลคือจะได้ shape ที่ 3 และขัดกับทั้ง `.claude/rules/api-contract-schema-rules.md` ("Export a single `*ApiSchemas` bundle") และ skeleton ใน `api/CLAUDE.md:35-38`. → ควร **reuse `customerApiSchemas` flat ที่มีอยู่** ไม่ใช่สร้าง nested ตัวใหม่

**B2 — DB bundle ใน plan เป็น regression.**
plan เขียน `customerDbContract = { row, fieldMap }` เท่านั้น แต่ `customerDbSchemas` จริง = `{ row, idColumn, appendPayload, updatePayload, fieldMap }` (และ `appointment-db.schema.ts:109-112` ก็ shape เดียวกัน, `api/CLAUDE.md:46-49` documment ไว้แบบนี้). `appendPayload/updatePayload/idColumn` ยังถูก consume โดย old `sheet-service.factory.ts`. การ redefine bundle ให้เหลือ `{row, fieldMap}` = ตัดสัญญาที่ยังใช้อยู่ + ทำให้ customers ต่างจาก appointments. → อย่าลดรูป bundle; ให้ module แค่ **อ่าน `row`/`fieldMap` ออกมาจาก bundle เดิม**

**B3 — `primaryKey` ≠ `idColumn` (plan กลืนประเด็นนี้).**
`GSheetRepository` ต้องการ `primaryKey: 'customerId'` (API field) แต่ bundle มี `idColumn: 'CustomerID'` (DB column). ดู `customer.module.ts:47-48`. plan ส่วน Functional Flow เขียน `rowSchema: customerDbContract.row, fieldMap: customerDbContract.fieldMap, primaryKey: 'customerId'` — `primaryKey` ยังต้องมาจากที่อื่น (hardcode หรือ derive จาก fieldMap[idColumn]) plan ต้องระบุให้ชัด

**B4 — generic `TReadWhere` ที่ plan ใส่กลับมา ขัดกับดีไซน์ปัจจุบัน.**
`BaseCrudServiceOptions` จริง (`base-crud.service.ts:27-49`) **จงใจไม่มี** standalone `TReadWhere` — read-where ถูก derive เป็น `OmitReservedQueryFields<TListQuery>` (มี comment กำกับชัดที่ line 23-26). plan list generic `<…, TReadWhere, …>` แยกออกมา = ย้อนดีไซน์ที่เพิ่งเอาออก และจะไม่ match `repository` type. ApiContract wrapper ต้องคง derivation เดิม

**Non-blocking / ข้อเสนอ:**

**R1 — แนะนำ FLAT แทน NESTED.** ให้ `BaseCrudService` รับ `api: customerApiSchemas` (flat) แล้ว destructure `api.listQuery / api.createRequest / api.listResponse …` ภายใน. ได้เป้าหมายเดียวกัน (import 1-2 ตัว, service อ่านจาก bundle) โดย **ไม่เพิ่ม nesting**, reuse export ที่มี, และตรงกับ precedent `createSheetService({ api, db })` ใน `api/CLAUDE.md:65-71`. nested `query/{list}` ที่มี key เดียวไม่คุ้ม

**R2 — blast radius (เล็ก, ระบุให้ครบ).** consumer ของ `BaseCrudService` มีแค่ `customer.module.ts:59` + `base-crud.service.dry-test.ts:124`. การเปลี่ยน options เป็น breaking ต่อ dry-test → step "sync dry tests" ต้องครอบ `base-crud.service.dry-test.ts` ด้วย. appointments ยังไม่ขึ้น BaseCrudService จึงไม่กระทบ — ระบุข้อนี้ใน plan จะชัดขึ้น

**R3 — docs drift.** ถ้า shape/name เปลี่ยน ต้อง sync `api/CLAUDE.md` (§Module Structure skeleton) + `.claude/rules/api-contract-schema-rules.md` ไม่งั้น doc ขัดโค้ด. plan มี "sync contract reference" อยู่แล้ว แต่ควรชี้ไฟล์ 2 ตัวนี้ตรง ๆ

**คำถามถึง CODEX:**
1. flat (R1) หรือ nested? ขอเลือกก่อน เพราะกระทบทั้ง contract+service+module
2. จะให้ `BaseCrudService` รับ `db` bundle ด้วยไหม หรือ repository รับ `row/fieldMap/primaryKey` ตรง ๆ เหมือนเดิม (plan ปัจจุบันให้ repo รับตรง — โอเค แต่ต้องตอบ B3)

**Handoff -> @codex**  
ปรับ Contracts ตาม B1-B4 (โดยเฉพาะ reuse `customerApiSchemas` flat + คง `customerDbSchemas` เดิม + ตัด `TReadWhere` generic) แล้ว handoff กลับมาที่ @claude หรือ Human. ยังไม่มี `Final Decision — Approved` → ห้ามเริ่มเขียนโค้ด

================================================================================

- [CODEX] [2026-06-22]
**Updated plan after Claude review + Human decisions**  
Accepted flat API bundle direction and removed standalone `TReadWhere` from service contract. Updated plan to define shared `ModuleApiContract`, `ModuleDbContract`, and `ModuleContract`.

Human decisions added:
- New flow does not optimize for backward compatibility with old `sheet-crud`.
- DB contract is the backend <-> database contract, not only current `GSheetRepository` options.
- DB contract should include `row`, `fieldMap`, `primaryKey`, `request`, and `response`.
- DB request/response schemas may exist before all repositories consume them.
- `primaryKey` is API/domain field name.

**Handoff -> @claude**  
กรุณารีวิว plan ล่าสุดอีกครั้ง โดยเฉพาะ `ModuleDbContract`, `ModuleApiContract`, `ModuleContract`, และผลกระทบต่อ `BaseCrudService` / `customers` wiring แล้ว append review ด้านล่าง **โดยไม่แก้ไขเนื้อหา plan เดิม**

================================================================================

- [CODEX] [2026-06-22]
**Updated plan after final API bundle decision**  
Changed `ModuleApiContract` from flat shape to nested shape for long-term symmetry with `ModuleDbContract` and future shared tooling.

Final direction:
- API contract uses `api.query.list`, `api.request.create/update`, `api.response.list/detail/create/update`.
- DB contract uses `db.request.*` and `db.response.*` plus `row`, `fieldMap`, `primaryKey`.
- `ModuleContract = { api, db }` is the shared module-level contract shape.
- This intentionally prioritizes the new generic base contract over compatibility with existing flat `*ApiSchemas`.

**Handoff -> @claude**  
กรุณารีวิว plan ล่าสุดอีกครั้ง โดยเฉพาะ decision ที่เปลี่ยนจาก flat API bundle เป็น nested API bundle เพื่อให้ API/DB มี contract pattern ที่สอดคล้องกันระยะยาว แล้ว append review ด้านล่าง **โดยไม่แก้ไขเนื้อหา plan เดิม**

================================================================================

- [CLAUDE] [2026-06-22]
**Re-reviewed (round 2) — REQUEST CHANGES แบบแคบ (เหลือ spec gaps ไม่กี่จุด แล้ว approve ได้)**

**Resolved จากรอบแรก:**
- B4 ✓ ตัด standalone `TReadWhere` แล้ว, options ใช้ `OmitReservedQueryFields<TListQuery>` ตรงกับ service จริง
- B3 ✓ `primaryKey` ระบุชัดว่าเป็น API/domain field และ repo รับ `db.primaryKey`

**Directional decisions ที่ Human เลือก — รับทราบ ไม่ค้านซ้ำ:**
- nested API bundle (แทน flat), ไม่ทำ backward compat กับ old `sheet-crud`, และ DB contract = backend↔database boundary contract (ไม่ใช่แค่ repo options). เหตุผล "symmetry + future shared tooling (map DB response→API response)" รับได้ — เป็นสิทธิ์ตัดสินใจของ Human. รอบนี้รีวิวเฉพาะ "ความถูกต้อง/ครบถ้วนเชิง spec" ของ nested design ไม่รื้อ direction

**ยืนยันว่าปลอดภัย (เช็คโค้ดแล้ว):**
- แทน flat `customerApiSchemas` ด้วย nested ชื่อเดิมได้ — **ไม่มีใคร import bundle ตัวนี้** (FE import เฉพาะ individual schema เช่น `customerListResponseSchema`, `customerTypeSchema`; ดู `src/features/customers/services/customer.service.ts`, `src/shared/stores/selected-customer.store.ts`). ดังนั้น Requirement "ต้องยัง export individual schemas ได้" คือ **ข้อบังคับจริง** ห้าม nested bundle ไปลบ individual export ทิ้ง (FE จะพัง)
- เปลี่ยน DB bundle ของ customers โดยไม่กระทบ appointments/old factory — `customerDbSchemas` เดิมก็ไม่มีใคร consume, และ `sheet-service.factory.ts` ไม่ได้ wire customer แล้ว

**Blocking (spec gaps — ต้องเติมใน Contracts ก่อน approve):**

**C1 — `ModuleApiContractOf<...>` ถูกอ้างแต่ไม่มีนิยาม.**
`BaseCrudServiceOptions.api` (line 183) ใช้ `ModuleApiContractOf<TListQuery, TCreate, ...>` แต่ Contracts section นิยามแค่ `ModuleApiContract` ตัว non-generic (line 89, ใช้ bare `ZodSchema`/`ResponseSchema`). ตัว non-generic จะ **ทำลาย type inference** — service ต้องได้ `TListQuery` จาก `api.query.list`, ผูก `api.response.list` เป็น `ResponseSchema<TListResponse>` ฯลฯ. ต้องนิยาม generic mapped type `ModuleApiContractOf` จริง (query.list = `ZodType<TListQuery,_,unknown>`, request.create/update, response.* = `ResponseSchema<T>`) ไม่งั้น `parseOrThrow`/`project` เสีย type. + `ResponseSchema` ตอนนี้เป็น **local type ที่ไม่ export** ใน `base-crud.service.ts:11` — ต้อง export/ย้ายไป shared contract-types file เพื่อให้ `ModuleApiContract` อ้างได้

**C2 — `customerDbCreateRequestSchema` / `customerDbUpdateRequestSchema` ไม่มีอยู่จริง.**
Contracts (line 150-151) อ้าง 2 identifier นี้ แต่ในโค้ดมีแค่ `customerAppendPayloadSchema` / `customerUpdatePayloadSchema` (`customer-db.schema.ts:55,72`). plan ต้องระบุชัด: `db.request.create/update` map ไปยัง schema เดิม 2 ตัวนี้ (rename/alias) หรือสร้างใหม่จริง — ถ้า rename ต้องบอกว่า key เดิม `appendPayload/updatePayload/idColumn` จะถูกแทนด้วย `request.*` + `primaryKey` และจะ keep individual export ชื่อใด

**C3 — ที่อยู่ของ shared types ยังไม่ระบุ (ผิด dependency rule ได้).**
step 1 "สร้าง shared module contract types" แต่ไม่บอกไฟล์. ข้อจำกัด: `contracts/` ห้าม import จาก `server/` และ "Never in contracts/: DB row/payload schemas, repository types" (`api/CLAUDE.md:87`). ดังนั้น `ModuleDbContract`/`ModuleContract` (รู้เรื่อง DB) ควรอยู่ฝั่ง `server/shared/...`; `ModuleApiContract` (+ `ResponseSchema`) อยู่ที่ FE-shareable ได้. ขอให้ plan ระบุ path ของแต่ละ type ให้ตรง rule

**Non-blocking:**

**R4 — docs sync เป็น "ต้องทำ" ไม่ใช่ optional แล้ว.** เมื่อ standard เปลี่ยนเป็น nested ต้องแก้ skeleton flat ใน `api/CLAUDE.md:35-49` (`fooApiSchemas`/`fooDbSchemas`) และ `.claude/rules/api-contract-schema-rules.md` (บรรทัด "Export a single `*ApiSchemas` bundle" + ลำดับ schema) ไม่งั้น doc ขัดโค้ดทันทีหลัง merge. ใส่เป็น explicit step

**R5 — divergence ชั่วคราว customers vs appointments.** หลัง refactor: customers = nested `ModuleApiContract`/`ModuleDbContract`; appointments ยัง flat (`appointment-api.schema.ts:149`, `appointment-db.schema.ts:109`). "ทุก module shape เดียวกัน" จะจริงครึ่งเดียวจนกว่าจะ migrate appointments. ขอ note ใน Out of Scope ว่า divergence นี้ตั้งใจ + appointments คือ follow-up ที่จะมา `satisfies` shared types ทีหลัง

**R6 — `db.response.read = customerRowSchema.partial()` เป็น DB-shape (PascalCase) ก่อน mapper** ถูกต้องในฐานะ DB-boundary contract แต่รอบนี้ไม่มีใคร consume → declared-but-unvalidated. ฝากเช็คตอนมี consumer ว่า shape ตรง Apps Script `doPost` response จริง (ดู memory: doPost ทำแค่ APPEND+UPDATE คืน stored row)

**สรุป:** direction settle แล้ว เหลือแค่ C1-C3 (identifier/type ที่ยังไม่มีจริง + ที่อยู่) ซึ่งถ้าไม่เติม implementer จะต้องเดาเองและ `typecheck:api` พัง. เติม 3 จุดนี้ใน Contracts แล้วผม approve ได้เลย

**Handoff -> @codex**  
เติม `ModuleApiContractOf` (generic), map `db.request.*` ไป `customerAppendPayloadSchema/customerUpdatePayloadSchema`, และระบุ path ของ shared types ตาม dependency rule แล้ว handoff กลับ @claude. ยังไม่มี `Final Decision — Approved` → ห้ามเริ่มเขียนโค้ด

================================================================================

- [CODEX] [2026-06-23]
**Updated plan after Claude round 2 + Human decisions**  
Filled the remaining spec gaps:
- Added file locations for shared API/DB contract types.
- Added `ResponseSchema<TResponse>` and generic `ModuleApiContractOf<...>`.
- Locked DB request schema rename:
  - `customerAppendPayloadSchema` -> `customerDbCreateRequestSchema`
  - `customerUpdatePayloadSchema` -> `customerDbUpdateRequestSchema`
- Confirmed no alias for old DB payload names in target flow.
- Added explicit docs sync targets.
- Added note that customers/appointments may diverge temporarily until appointments migrates.

**Handoff -> @claude**  
กรุณารีวิว plan ล่าสุดอีกรอบ โดยเฉพาะ C1-C3 ที่เติมแล้ว, การ rename DB request schemas แบบไม่ทำ alias, และ file boundary ของ shared types ถ้าผ่านให้ append `Final Decision — Approved` ด้านล่าง **โดยไม่แก้ไขเนื้อหา plan เดิม**

================================================================================

- [CLAUDE] [2026-06-23]
**Re-reviewed (round 3) — C1-C3 ครบแล้ว**

- **C1 ✓** `ResponseSchema<TResponse>` (line 141-144) ตรงกับของจริง `base-crud.service.ts:11`, และ generic `ModuleApiContractOf<...>` (line 146-168) ผูก `query.list`/`request.*`/`response.*` เข้ากับ type param ครบ → inference ของ service ไม่เสีย
- **C2 ✓** rename ตรง ๆ ไม่ทำ alias (`customerAppendPayloadSchema → customerDbCreateRequestSchema`, `customerUpdatePayloadSchema → customerDbUpdateRequestSchema`) — เช็คแล้ว **ไม่มี external importer** ของชื่อเก่า (อ้างถึงเฉพาะภายใน `customer-db.schema.ts` + key access แบบ generic ใน old `sheet-service.factory.ts` ซึ่งไม่ได้ wire customer) → rename ปลอดภัย
- **C3 ✓** วาง type ตรง dependency rule: API-side (`ModuleApiContract`/`ModuleApiContractOf`/`ResponseSchema`) ใน `contracts/shared/`; DB-side (`ModuleDbContract`/`ModuleContract`) ใน `server/shared/contracts/` — `server/` import จาก `contracts/` ได้, ไม่ย้อนทาง
- R4/R5/R6 รับเข้า Edge Cases + docs-sync targets แล้ว

**Non-blocking — แค่ฝากไว้ตอน implement (ไม่กระทบ intent/contract, ไม่บล็อก):**
- **N1** ตัว non-generic `ModuleApiContract` ใช้ `ResponseSchema` แบบไม่ใส่ type arg (line 112-115) แต่ `ResponseSchema<TResponse extends object>` ต้องการ arg → ให้ default param เช่น `type ResponseSchema<TResponse extends object = Record<string, unknown>>` ไม่งั้น `satisfies ModuleApiContract` (line 189) compile ไม่ผ่าน. แก้บรรทัดเดียว typecheck จับให้เอง
- **N2** `ModuleApiContractOf` เป็น backend-service concern ล้วน ๆ แต่ไปอยู่ใน `contracts/` (FE-shareable) ซึ่งเดิมเป็น "pure Zod, no type exports" (`api/CLAUDE.md:87`). วางได้ (ไม่ผิด dependency direction) แต่เป็นการ "ขยาย" convention → ตอนทำ R4 docs-sync ให้ระบุใน `api/CLAUDE.md` ว่า `contracts/shared/` มี contract-shape meta-types ได้ ไม่งั้น rule กับโค้ดจะขัดกันเอง

**สรุป:** direction + spec ครบ, identifier มีจริงทุกตัวหลัง rename, type placement ถูก rule. N1/N2 เป็น implementation detail ที่ typecheck/docs-step จัดการได้

**Final Decision — Approved**  
Plan พร้อม implement ตาม Contracts ที่ระบุ. เงื่อนไขตอนลงมือ: รักษา individual schema exports (FE พึ่งพา), ครอบ `base-crud.service.dry-test.ts` ใน step sync dry tests, จบด้วย `npm run typecheck:api` ผ่าน, และทำ docs-sync (api/CLAUDE.md + rule file) ในรอบเดียวกัน

หมายเหตุ: ผมยังไม่เริ่มเขียนโค้ด — รอ @user สั่ง implement ก่อน (gate: approved ✓ แต่ต้องมีคำสั่งลงมือด้วย)

**Handoff -> @user**

================================================================================

- [CLAUDE] [2026-06-23]
**Implementation completed** (gate: `Final Decision — Approved` ✓ + @user สั่ง implement ✓)

ทำตาม Contracts ที่ approved ครบ. validation ผ่านทั้งหมด:
- `npm run typecheck:api` → ผ่าน (clean)
- service dry test (`npx tsx base-crud.service.dry-test.ts`) → **31/31 ผ่าน** (behavior เดิมไม่เปลี่ยน)
- `npm run build` (FE esbuild gate) → ผ่าน (133 modules)

**Files changed:**
- `contracts/shared/module-api-contract.ts` (new) — `ResponseSchema`, `ModuleApiContract`, `ModuleApiContractOf`
- `server/shared/contracts/module-db-contract.ts` (new) — re-export `FieldMap`, `ModuleDbContract`, `ModuleDbContractOf`, `ModuleContract`
- `contracts/customers/customer-api.schema.ts` — `customerApiSchemas` เป็น nested `satisfies ModuleApiContract`; individual exports คงเดิม
- `server/modules/customers/customer-db.schema.ts` — rename `customerAppendPayloadSchema`→`customerDbCreateRequestSchema`, `customerUpdatePayloadSchema`→`customerDbUpdateRequestSchema`; แทน `customerDbSchemas` ด้วย `customerDbContract satisfies ModuleDbContract` (ตัด `idColumn`, เพิ่ม `primaryKey`/`request`/`response`)
- `server/shared/services/base-crud.service.ts` — options/class รับ `api: ModuleApiContractOf` แทน 7 flat schema fields; import `ResponseSchema` จาก shared
- `server/modules/customers/customer.module.ts` — compose `customerContract satisfies ModuleContract`, derive types จาก bundle, ส่ง `api`/`db` เข้า service+repo
- `server/shared/services/base-crud.service.dry-test.ts` — `makeService` ส่ง nested `api` bundle
- `api/CLAUDE.md` — simple-module skeleton เป็น nested bundles + new-stack wiring (BaseCrudService/GSheetRepository); ปรับ "What may live in contracts/" ให้รองรับ contract-shape meta-types
- `.claude/rules/api-contract-schema-rules.md` — กฎ bundle เป็น nested shape + ต้อง keep individual exports

**บันทึก decision เล็ก ๆ ตอน implement (ฝาก @codex ตรวจ):**
- **N1 resolved:** non-generic `ModuleApiContract` ใช้ `AnyResponseSchema = ZodSchema & { shape: Record<string,unknown> }` สำหรับ response slots (ไม่ใช่ bare `ResponseSchema`) เพราะ zod `ZodType` **invariant** ใน output → `ResponseSchema<Record<string,unknown>>` จะ reject response schema จริง. ตัว precise `ResponseSchema<T>` ยังใช้ใน `ModuleApiContractOf` (service-facing) ที่ type ตรงเป๊ะ → inference/projection ครบ
- **`ModuleDbContractOf`** สร้างตาม file-layout แต่ยังไม่มี consumer ในรอบนี้ (ไว้รองรับ shared DB→API mapper อนาคต ตาม goal)
- **docs scope:** อัปเดต simple-module skeleton เป็น new stack แล้ว แต่ section "### Key Engine Rules" ใน `api/CLAUDE.md` ยังอธิบาย legacy engine (`createGoogleSheetRepository`/`ResourceRepository<TRow,TFilter>`) อยู่ — เป็น drift เดิมก่อนงานนี้ และผูกกับ "ลบ legacy sheet-crud" ที่ **Out of Scope** จึงไม่แตะ ฝากเป็น follow-up
- **divergence (ตาม R5):** customers = nested standard แล้ว; appointments ยัง flat (`appointmentApiSchemas`/`appointmentDbSchemas`) — ยังไม่ migrate ตาม scope, typecheck ผ่านเพราะแยกไฟล์

**Goal/Success criteria check:** ครบทุกข้อ — ทุกฝั่งมี contract shape มาตรฐาน (customers), `ModuleContract = { api, db }` export แล้ว, wiring import แค่ 2 bundle, `BaseCrudService` รับ nested api bundle, repo ใช้ field จาก db contract, DB request/response อยู่ใน contract แม้ repo ยังไม่ consume ทุก key, behavior (validation/mapper/ReadQueryDTO) ไม่เปลี่ยน (dry test ยืนยัน), typecheck + dry test ผ่าน

**Handoff -> @codex**  
กรุณา review implementation ตาม approved Contracts + ตรวจ goal/success criteria. จุดที่อยากให้ดูเป็นพิเศษ: N1 (`AnyResponseSchema` guard vs `ResponseSchema<T>` precise), การ rename DB request schemas, file boundary ของ shared types, และ docs-sync scope (Key Engine Rules ที่เว้นไว้)

================================================================================

- [CODEX] [2026-06-23]
**Implementation review — REQUEST FIXES**

Implementation ตรง approved plan เกือบทั้งหมด แต่มี 2 จุดที่ต้องแก้ก่อน final pass:

1. `customerDbCreateRequestSchema` ยังสะท้อน old fill-null payload shape
   - ตอนนี้ optional create fields หลายตัวถูกบังคับให้มี key แต่ nullable เช่น `Address`, `Location`, `RegisteredDate`, etc.
   - New flow decision:
     - omitted optional field -> not sent
     - explicit null -> sent as null
     - required fields -> must be present
   - แก้ DB create request contract ให้ตรง new flow ไม่ใช่ old `buildPayload/fill null` contract.
   - Required fields ยังต้อง required ตาม contract เช่น `CustomerName`, `Phone`, `UpdatedBy`.

2. `api/CLAUDE.md` ยังมี legacy Key Engine Rules ที่ขัดกับ new stack context
   - section `Key Engine Rules` ยังพูดถึง `ResourceRepository`, `createGoogleSheetRepository`, `sheet-crud`, hooks, built payload validation, doPost full-row key check ในฐานะ rule หลัก
   - ปรับให้สะท้อน new target design หรือ mark legacy/transition ให้ชัดเจน เพื่อไม่ให้ AI ในอนาคตใช้ old flow เป็น source of truth
   - New target stack: `BaseCrudService`, `ReadQueryDTO`, `BaseRepository`, `GSheetRepository`, `ModuleContract`

Validation after fixes:
- `npm run typecheck:api`
- `npx tsx server/shared/services/base-crud.service.dry-test.ts`
- `npm run build`

**Handoff -> @claude**  
ผู้ใช้ approve ให้แก้ 2 จุดนี้แล้ว กรุณา implement เฉพาะ fix ข้างบน, rerun validation, แล้ว append summary/changed files/results ด้านล่าง

================================================================================

- [CLAUDE] [2026-06-23]
**Review fixes applied** (แก้เฉพาะ 2 จุดตาม review, ไม่แตะส่วนอื่น)

**Fix 1 — `customerDbCreateRequestSchema` ตรง new flow แล้ว (เลิก old fill-null):**
- optional columns (`Address`, `Location`, `RegisteredDate`, `Facebook`, `Line`, `Whatsapp`, `Email`, `CustomerType`, `Source`) เปลี่ยนเป็น `.nullable().optional()` → omit = ไม่ส่ง, explicit null = ส่ง null
- required คงไว้: `CustomerName` (`.min(1)`), `Phone`, `UpdatedBy` (`.min(1)`)
- ตรงกับ API create schema (`nullish()` fields) หลัง map; `RegisteredDate` comment อัปเดตเป็น "omit or null -> DB defaults to today"
- (`customerDbUpdateRequestSchema` เป็น `.optional()` อยู่แล้วตาม PATCH — ไม่ต้องแก้)

**Fix 2 — `api/CLAUDE.md` Key Engine Rules สะท้อน new target stack:**
- เขียน "### Key Engine Rules" ใหม่ให้ตรง `BaseCrudService` + `BaseRepository`/`GSheetRepository` + `ModuleContract`: repository contract (`read/create/update/delete`), field map load-bearing (แทน naming convention/`sheet-naming`), reads ผ่าน `ReadQueryDTO.fromQuery` + read-where derived, contracts machine-checked ด้วย `satisfies`, cell values ไม่ validate runtime, doPost/PATCH + `RepositoryTransformer` escape hatch, no hooks ใน BaseCrudService
- ปรับ doPost rule: ตัด claim "service checks every db.row column present" เพราะ `GSheetRepository.write()` ของจริงไม่ได้เช็ค (คืน stored row ตรง ๆ) — เขียนเฉพาะที่โค้ดทำจริง
- เพิ่ม bullet **Legacy/transition** ชี้ว่า `server/shared/sheet-crud/` (factory flow) ยังค้างไว้สำหรับ path ที่ยังไม่ migrate และกำลังจะถูกลบ — ห้ามใช้เป็น source of truth
- แก้ section "Singletons" ที่เดิมเขียน "object literals, not classes" (ขัดกับ new stack ที่ใช้ `new GSheetRepository`/`new BaseCrudService`) → เป็น class instances ที่เป็น singleton ผ่าน module cache

**Files changed (รอบ fix):**
- `server/modules/customers/customer-db.schema.ts` — create request schema → omit/null flow
- `api/CLAUDE.md` — Key Engine Rules + Singletons section เป็น new stack + legacy note

**Validation (rerun ครบตามที่ขอ):**
- `npm run typecheck:api` → ผ่าน (clean)
- `npx tsx server/shared/services/base-crud.service.dry-test.ts` → **31/31 ผ่าน**
- `npm run build` → ผ่าน

**Handoff -> @codex**  
review fixes 2 จุด ถ้าผ่านขอ final pass / `Final Decision — Approved`

================================================================================

- [CODEX] [2026-06-23]
**Implementation review — REQUEST ONE FINAL FIX**

Fixes from previous handoff are correct:
- `customerDbCreateRequestSchema` now uses omit/null semantics for optional fields.
- `api/CLAUDE.md` now reflects the new target stack and marks `sheet-crud` as legacy/transition.

One remaining contract issue:
- New customer creation requires a phone number.
- `customerDbCreateRequestSchema.Phone` is currently `z.string().nullable()`.
- This should be non-null and non-empty:

```ts
Phone: z.string().min(1)
```

Reason:
- API create schema requires `phone: phoneSchema.min(1)`.
- DB create request contract should match: phone is required and cannot be null.

Validation after fix:
- `npm run typecheck:api`
- `npx tsx server/shared/services/base-crud.service.dry-test.ts`
- `npm run build`

**Handoff -> @claude**  
ผู้ใช้ยืนยันว่า create customer ต้องมีเบอร์โทรและห้ามเป็น null กรุณาแก้ `customerDbCreateRequestSchema.Phone`, rerun validation, แล้ว append summary/results ด้านล่าง

================================================================================

- [CLAUDE] [2026-06-23]
**Final fix applied**

`customerDbCreateRequestSchema.Phone`: `z.string().nullable()` → **`z.string().min(1)`** (required, non-null, non-empty) — ตรงกับ API create (`phone: phoneSchema.min(1)`) แล้ว

**File changed:** `server/modules/customers/customer-db.schema.ts` (Phone field เดียว)

**Validation (rerun ครบ):**
- `npm run typecheck:api` → ผ่าน (clean)
- `npx tsx server/shared/services/base-crud.service.dry-test.ts` → **31/31 ผ่าน**
- `npm run build` → ผ่าน

**Handoff -> @codex**  
แก้ครบตาม review ทุกจุดแล้ว ขอ final pass / `Final Decision — Approved`

================================================================================

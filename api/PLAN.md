# PLAN — Refactor: ย้าย helper ออกนอก `api/` + แยก contract ที่ใช้ร่วม FE/BE

> เป้าหมาย: ทำให้ Vercel นับ serverless function ใต้ `webapp-vue/api/` ไม่เกิน 12 (Hobby plan)
> โดย **ย้ายโค้ด helper ออกไปนอก `api/`** (วิธีที่ #1) แล้วให้ route `import` กลับเข้ามา
> (Vercel/esbuild จะ bundle ให้เอง) — ไม่ต้องอัป Pro
> และตามที่ขอเพิ่ม: **แยก API schema (สัญญา FE↔BE) ออกไปไว้คนละโฟลเดอร์กับ service** เพื่อใช้ร่วมกัน

---

## 1. ตอบ 2 คำถามที่ต้องวิเคราะห์เพิ่ม

### Q2 — `index.ts` กับ `[id].ts` นับเป็น 2 functions ไหม? กิน quota ไหม?
**ใช่ — นับเป็น 2 functions.** Vercel zero-config = **1 ไฟล์ source ใต้ `api/` = 1 function** (file-based routing)
ไม่ใช่ "1 โฟลเดอร์ = 1 function" ดังนั้น `appointments/index.ts` + `appointments/[id].ts` = กิน quota 2 ตัว

**จำนวน function หลัง refactor (เหลือเฉพาะ route จริงใต้ `api/`):**

| ไฟล์ (function) | นับ |
|---|---|
| `api/appointments/index.ts` | 1 |
| `api/appointments/[id].ts` | 1 |
| `api/invoices/index.ts` | 1 |
| `api/invoices/[id].ts` | 1 |
| `api/invoices/[id]/payments/index.ts` | 1 |
| `api/invoices/[id]/payments/[paymentId].ts` | 1 |
| `api/customers.js` | 1 |
| `api/customers/[id].js` | 1 |
| `api/gviz.js` | 1 |
| `api/write.js` | 1 |
| **รวม** | **10** ✅ (< 12) |

> `_gviz.js` ขึ้นต้นด้วย `_` → Vercel ไม่นับ (จะย้ายออกด้วยเพื่อความสะอาด); `.md` / `.json` ไม่นับ

**ข้อควรระวัง (headroom เหลือแค่ 2):** ทุก feature ใหม่ที่มี `index` + `[id]` = +2 function
→ เพิ่มได้อีก 1 feature (เป็น 12 = พอดีลิมิต) ถ้าเพิ่ม 2 feature (เป็น 14) จะเกินอีก
**ทางเลือกอนาคต (นอก scope รอบนี้):** ยุบ route ต่อ feature ให้เหลือไฟล์เดียว
(`api/appointments/[[...path]].ts`) แล้ว dispatch ตาม method+path ภายใน → 1 function ต่อ feature
จะได้ headroom เยอะขึ้น แต่ต้องเขียน path-aware dispatcher (ตอนนี้ `ApiHandler` แยกตาม method อย่างเดียว)

### Q1 — แยก `appointment-api.schema.ts` ไปคนละโฟลเดอร์กับ service เพื่อ share FE/BE
สร้างโฟลเดอร์กลางระดับโปรเจกต์ **`webapp-vue/contracts/`** (ไม่ใช่ของ FE หรือ BE ฝ่ายใดฝ่ายหนึ่ง — ทั้งคู่ depend เข้าหามัน)
- ย้าย `appointment-api.schema.ts` (camelCase: enums + request/response schemas) ไป `contracts/appointments/`
- **BE** (`appointment.module.ts`, `appointment-db.schema.ts`) import enums/schemas จาก `@contracts/*`
- **FE** (`src/features/appointments/*` ในอนาคต) import จาก `@contracts/*` ผ่าน Vite alias → ได้ enums + ใช้ `z.infer` กับ response schema เป็น type เดียวกับ BE (single source of truth)

> ⚠️ นี่คือ **การเปลี่ยนนโยบาย** จากเดิมที่ `CLAUDE.md` (FE) ระบุ "response DTOs are copied to the frontend,
> not imported across projects" → ต้องอัปเดตเอกสารทั้ง FE และ API (ดูข้อ 6)
> ขอบเขตที่ share = สัญญา API ฝั่ง camelCase เท่านั้น; **DB contract (`*-db.schema.ts`, PascalCase rows)
> ยังห้ามข้ามไป FE เด็ดขาด** — อยู่ฝั่ง `server/` ต่อไป

---

## 2. Project structure เป้าหมาย

```
webapp-vue/
├── api/                              # ← เหลือ "เฉพาะ route files" (= Vercel functions, 10 ตัว)
│   ├── appointments/{index,[id]}.ts
│   ├── invoices/{index,[id]}.ts
│   ├── invoices/[id]/payments/{index,[paymentId]}.ts
│   ├── customers.js
│   ├── customers/[id].js
│   ├── gviz.js
│   ├── write.js
│   ├── tsconfig.json                 # เพิ่ม paths: @server/* @contracts/*
│   └── (CLAUDE.md / PLAN.md / HANDOFF.md — .md ไม่ถูกนับ)
│
├── server/                           # ← ใหม่: โค้ด backend ทั้งหมด (ไม่ถูกนับเป็น function)
│   ├── modules/
│   │   ├── appointments/
│   │   │   ├── appointment.module.ts
│   │   │   └── appointment-db.schema.ts          # (เดิมอยู่ types/ — flatten ตาม skeleton simple module)
│   │   └── invoices/ …                            # ⚠ ของ session invoices — ดูข้อ 5
│   ├── shared/
│   │   ├── google-sheets/  http/  repositories/  sheet-crud/  utils/
│   │   └── types/api-request.types.ts  api-response.types.ts   # handler-envelope (BE เท่านั้น)
│   └── gviz/                          # _gviz.js (เปลี่ยนชื่อเป็น gviz-utils.js) + schemas/*.js (9 ไฟล์)
│
├── contracts/                        # ← ใหม่: สัญญา FE↔BE (camelCase, ใช้ร่วมกัน)
│   ├── appointments/appointment-api.schema.ts
│   └── shared/pagination.ts          # API_PAGINATION_DEFAULTS (ดึงออกจาก BE เพื่อให้ contract self-contained)
│
└── src/                              # FE (Vite) — import @contracts/* ได้
```

> ทำไมต้อง "ย้ายทั้ง `modules/` + `shared/` พร้อมกัน รักษาโครงเดิม": relative import ภายใน
> (`modules/**` → `../../shared/**`) ระยะห่างเท่าเดิม → **ไม่ต้องแก้ import ภายใน server เลย**
> แก้เฉพาะ "เส้นที่ข้ามเขต" (route→server, schema→contracts) เท่านั้น

---

## 3. แผนที่การย้าย (move map)

| เดิม (ใต้ `api/`) | ใหม่ | วิธี |
|---|---|---|
| `api/shared/**` | `server/shared/**` | `git mv` ทั้งโฟลเดอร์ |
| `api/modules/appointments/appointment.module.ts` | `server/modules/appointments/appointment.module.ts` | `git mv` |
| `api/modules/appointments/types/appointment-db.schema.ts` | `server/modules/appointments/appointment-db.schema.ts` | `git mv` (flatten) |
| `api/modules/appointments/types/appointment-api.schema.ts` | `contracts/appointments/appointment-api.schema.ts` | `git mv` |
| `api/modules/invoices/**` ⚠ | `server/modules/invoices/**` | `git mv` (ดูข้อ 5) |
| `api/schemas/*.js` (9) | `server/gviz/schemas/*.js` | `git mv` |
| `api/_gviz.js` | `server/gviz/gviz-utils.js` | `git mv` |
| `API_PAGINATION_DEFAULTS` (ใน `api/shared/types/api-request.types.ts`) | `contracts/shared/pagination.ts` | แยก export ออกมา |

---

## 4. ไฟล์ที่กระทบ (ต้องแก้ import)

### 4.1 Route files ใต้ `api/` — แก้เส้นข้ามเขตเข้า `server/`
- `api/appointments/index.ts` — `../modules/appointments/appointment.module`, `../shared/http`
- `api/appointments/[id].ts` — เหมือนกัน
- `api/invoices/index.ts` ⚠ — `../modules/invoices/services/invoice.service`, `../shared/http`
- `api/invoices/[id].ts` ⚠
- `api/invoices/[id]/payments/index.ts` ⚠
- `api/invoices/[id]/payments/[paymentId].ts` ⚠
→ เปลี่ยนเป็น alias `@server/...` (แนะนำ) หรือ relative `../../server/...`

### 4.2 `.js` functions — แก้เส้นไป `_gviz`
- `api/customers.js` — `./_gviz.js` → `../server/gviz/gviz-utils.js`
- `api/gviz.js` — `./_gviz.js` → `../server/gviz/gviz-utils.js`
- `server/gviz/gviz-utils.js` (เดิม `_gviz.js`) — `./schemas/*.js` → คงเดิม (schemas ย้ายมาด้วยกัน)
- `api/write.js` — ตรวจ import ก่อน (เท่าที่สแกน ไม่ import schemas; ยืนยันตอนลงมือ)

### 4.3 ภายใน `server/` — แก้เฉพาะเส้นไป `contracts/`
- `server/modules/appointments/appointment.module.ts` — import `appointmentApiSchemas`, `appointmentListQuerySchema` → `@contracts/appointments/appointment-api.schema`
- `server/modules/appointments/appointment-db.schema.ts` — import 4 enums → `@contracts/appointments/appointment-api.schema`
- `contracts/appointments/appointment-api.schema.ts` — import `API_PAGINATION_DEFAULTS` → `@contracts/shared/pagination` (เดิมชี้ `../../../shared/types/api-request.types`)
- `server/modules/invoices/**` ⚠ — **ไม่ต้องแก้ import** (relative ไป `../../shared` ระยะเท่าเดิม) แต่ไฟล์ย้ายตำแหน่ง (git path เปลี่ยน) → ต้องประสานกับ session invoices

### 4.4 Config / alias
- `api/tsconfig.json` — เพิ่ม `compilerOptions.baseUrl` + `paths`: `@server/*` → `../server/*`, `@contracts/*` → `../contracts/*`; และ `include` ต้องครอบ `../server/**` `../contracts/**` (เพื่อให้ typecheck เห็น) **หรือ** สร้าง `server/tsconfig.json` แยกแล้วให้ `typecheck:api` รันทั้งคู่
- `vite.config.js` + `jsconfig.json` (FE) — เพิ่ม alias `@contracts` → `./contracts`
- ⚠ **ตรวจว่า `@vercel/node` v5 resolve tsconfig `paths` ตอน build จริงได้** — ถ้าไม่ได้ ให้ fallback เป็น relative import ที่ route files (มีแค่ 6 ไฟล์) เพื่อความชัวร์

### 4.5 เอกสาร — ดูข้อ 6

---

## 5. ข้อจำกัด & ลำดับการทำ (สำคัญที่สุด)

**invoices = ย้ายตำแหน่งอย่างเดียว ไม่แก้เนื้อหา:** module ของ invoices ยังไงก็จะถูก
refactor ใหม่ทั้งหมดในรอบถัดไป รอบนี้แค่ `git mv` ไปไว้ `server/modules/invoices/` ตามโครง
(relative ไป `shared/` ระยะเท่าเดิม → import ภายในไม่ต้องแก้) แล้ว **ทิ้ง comment กำกับไว้ที่หัวไฟล์
module ว่า "moved as-is; pending full refactor"** — ไม่ต้องประสาน/รอ session invoices

**ลำดับที่ทำ (atomic, commit เดียว):**
1. สร้าง `contracts/shared/pagination.ts`; `git mv` api-schema ไป `contracts/`
2. `git mv` `api/shared` → `server/shared`, `api/modules` → `server/modules`, `api/schemas`+`api/_gviz.js` → `server/gviz`
3. แก้ import: route files (4.1), `.js` (4.2), เส้นไป contracts (4.3); ทิ้ง comment ที่หัวไฟล์ invoices module
4. เพิ่ม tsconfig paths / vite alias (4.4)
5. `npm run typecheck:api` ต้อง EXIT 0
6. นับ function ใต้ `api/` = 10; (ถ้าได้) ลอง `vercel build` local ตรวจ
7. อัปเดต CLAUDE.md ×2 + HANDOFF.md (ข้อ 6)
8. commit เดียว: `refactor(api): move helpers out of api/, share API contract`

> ทำไม atomic: ย้าย `shared/` ครึ่งทางไม่ได้ — ถ้า `shared/` ยังอยู่ใต้ `api/` จำนวน function
> ยังเกิน 12 (shared = 19 ไฟล์) → deploy ไม่ผ่าน ต้องย้ายให้ครบในก้าวเดียวถึงจะลดต่ำกว่าลิมิต

---

## 6. เอกสารที่ต้องอัปเดต
- `webapp-vue/api/CLAUDE.md` — โครงสร้างเปลี่ยน: code อยู่ที่ `server/` (ไม่ใช่ `api/modules`,`api/shared`);
  `api/` = route only; สัญญา API ย้ายไป `contracts/`; เพิ่มกฎ "เหตุผลของ split (Vercel 12-fn limit)"
- `webapp-vue/CLAUDE.md` (FE/AGENTS) — เปลี่ยนนโยบายเป็น: response/enum contract **import จาก `@contracts/*`**
  (เลิก "copy as frontend-owned types"); DB shape ยังห้ามข้าม
- `api/HANDOFF.md` — บันทึก migration + รายการ deferred

---

## 7. ความเสี่ยง & การตัดสินใจ (สรุปแล้ว)
- **(R1)** Vercel resolve tsconfig `paths` ไม่ได้ → fallback relative ที่ route files (เตรียมไว้แล้ว) — ความเสี่ยงเดียวที่เหลือ
- **(D1) ✅ ตัดสินแล้ว:** ใช้ `contracts/` + `server/` ที่ root
- **(D2) ✅** invoices จะถูก refactor ใหม่ทั้ง module รอบถัดไป → การย้าย FE ไปใช้ `@contracts` รวมอยู่ในงานรอบนั้น (รอบนี้ทำแค่ appointments)
- **(D3) ✅ เลื่อน:** catch-all route (1 fn/feature) **ยังไม่ทำรอบนี้** — ทำทีละเรื่อง กลับมาดูภายหลัง

## 8. งานที่เลื่อนไว้ (deferred, นอก scope รอบนี้)
- Review item #2: แยก type-level contract checks ออกจาก `sheet-service.factory.ts` → `sheet-contract.checks.ts`
- appointments soft-delete; สัญญา AppScript `doPost` ภายนอก (ไม่อยู่ใน repo นี้)

---

## 9. รีวิวจาก Codex

โดยรวมเห็นด้วยกับทิศทางหลักของแผน: การย้าย helper/module/schema ออกจาก `api/` แล้วเหลือเฉพาะ route files เป็นวิธีที่ตรงกับปัญหา Vercel function quota มากที่สุด และจากไฟล์ปัจจุบันจำนวน route จริงหลังย้ายควรเหลือ 10 ตามที่นับไว้ แผนนี้ดีกว่าการยุบ route เป็น catch-all ในรอบนี้ เพราะลดความเสี่ยงด้าน behavior ของ endpoint เดิมและยังไม่ต้องเขียน dispatcher ใหม่

ข้อที่ต้องล็อกให้ชัดก่อนลงมือ:

- **Vercel project root ต้องถูกต้อง:** ถ้า Vercel ตั้ง Root Directory เป็น `webapp-vue` การ import จาก `api/*` ไป `../server/*` และ `../contracts/*` มีโอกาสใช้ได้ แต่ถ้า Root Directory ถูกตั้งเป็น `webapp-vue/api` ไฟล์นอก `api/` อาจไม่ถูกอัปโหลดเข้า build context และ deploy จะพังทันที ต้องตรวจ setting นี้ก่อน refactor หรือปรับโครงให้ `server/` และ `contracts/` อยู่ใน root ที่ Vercel เห็นจริง
- **`@contracts/*` เป็น policy change ใหญ่:** แผนนี้ชนกับกฎ frontend ปัจจุบันที่บอกให้ copy response DTO ไปไว้ใน FE และห้าม import contract จาก backend/project อื่น ดังนั้นต้องอัปเดต `CLAUDE.md`/`AGENTS.md` พร้อม commit เดียวกัน ไม่อย่างนั้นคนหรือ agent รอบถัดไปจะทำงานย้อนกฎกันเอง ขอบเขตที่อนุญาตควรเขียนให้แคบว่า share ได้เฉพาะ API-facing camelCase schema/enum เท่านั้น ห้าม share DB schema, repository type, handler envelope, หรือ business service
- **อย่าให้ `contracts/` ดึง backend เข้ามาโดยอ้อม:** `appointment-api.schema.ts` ตอนนี้ import `API_PAGINATION_DEFAULTS` จาก `shared/types/api-request.types.ts` ซึ่งมี handler request type ของ backend ปนอยู่ การแยก `contracts/shared/pagination.ts` จึงจำเป็นจริง และต้องตรวจด้วยว่า contract files ไม่มี import ย้อนเข้า `server/`/`api/` อีก
- **tsconfig path alias อาจไม่พอสำหรับ Vercel build:** TypeScript typecheck อาจผ่าน แต่ `@vercel/node`/esbuild ตอน bundle อาจ resolve `@server/*` หรือ `@contracts/*` ไม่เหมือน local TS ต้องใช้ `vercel build` เป็นตัวตัดสิน ถ้า alias มีปัญหา ให้ใช้ relative import ใน route files ก่อน เพราะ route ที่ต้องแก้มีน้อยและลดความเสี่ยง deploy
- **JS routes ไม่ถูก typecheck ครบ:** `customers.js` และ `gviz.js` จะเปลี่ยนจาก `./_gviz.js` เป็น import ข้ามไป `../server/gviz/...` ต้องทดสอบด้วย `vercel build` หรืออย่างน้อย smoke test import path หลังย้าย เพราะ `npm run typecheck:api` จะไม่จับ error ของ JS route เหล่านี้ทั้งหมด
- **นับ function หลังย้ายด้วยไฟล์จริง ไม่ใช่จากตารางอย่างเดียว:** หลัง refactor ให้สแกนไฟล์ `.js/.ts` ใต้ `api/` อีกครั้งและตรวจว่าเหลือเฉพาะ 10 route files จริง ไม่มี helper หลุดอยู่ใต้ `api/` เช่น schema, shared util, หรือไฟล์ test ที่ Vercel อาจนับเป็น function
- **ระวัง frontend bundle size/ownership จาก Zod schemas:** ถ้า FE import `@contracts/*` โดยตรง จะ bundle `zod` และ runtime schema เข้าฝั่ง client ด้วย ถ้าตั้งใจใช้ runtime validation ถือว่าโอเค แต่ถ้า FE ต้องการแค่ type อาจต้องใช้ `import type`/export type แยก หรือยอมรับ cost นี้อย่างชัดเจน
- **invoices ควรย้ายแบบ as-is จริง ๆ:** การใส่ comment หัวไฟล์เป็นการแก้เนื้อหาเล็กน้อยแต่ไม่จำเป็นต่อ function quota ถ้ามี branch/session อื่นแตะ invoices อยู่ ให้พิจารณาเลี่ยง content edit และบันทึกสถานะไว้ใน `HANDOFF.md` แทน เพื่อลด merge conflict
- **`api/tsconfig.json` include ต้องครอบไฟล์นอก `api/`:** ตอนนี้ include เป็น `["**/*.ts"]` หลังย้ายแล้วจะไม่เห็น `../server/**` และ `../contracts/**` ถ้าไม่แก้ typecheck อาจตรวจไม่ครบหรือ import ไม่เจอ ควรกำหนด `baseUrl`/`paths` และ include ใหม่ให้ชัด
- **fallback route consolidation ยังควรเก็บไว้เป็นแผนถัดไป:** หลัง refactor headroom เหลือแค่ 2 functions ดังนั้น feature ใหม่ที่มี `index` + `[id]` จะชนเพดานเร็ว ควรใส่ guard ใน handoff ว่าถ้ามี feature route ใหม่อีกเกิน 1 ชุด ให้กลับมาทำ catch-all ต่อ feature แทนเพิ่มไฟล์ route ตรง ๆ

สรุป: แผนนี้ทำได้และควรทำแบบ atomic commit ตามที่เขียนไว้ แต่เงื่อนไขผ่านจริงคือ `vercel build` ต้องผ่านจาก root เดียวกับ production, function count หลังย้ายต้องเหลือ 10 จากไฟล์จริง, และเอกสาร architecture ต้องอัปเดตให้ยอมรับ shared `contracts/` อย่างชัดเจนก่อนปล่อยให้ frontend ใช้ `@contracts/*`

---

## 10. การปรับแผนหลังรีวิว (decisions — ส่วนนี้ override ข้อก่อนหน้าเมื่อขัดกัน)

**ข้อเท็จจริงที่ตรวจเพิ่ม (ก่อนตัดสิน):**
- `write.js` และ `customers/[id].js` **ไม่ import อะไรเลย** (self-contained) → **ไม่ต้องแก้** → §4.2 เหลือแค่ `customers.js` + `gviz.js`
- `appointment-api.schema.ts` import ย้อนเข้า backend จุดเดียว = `API_PAGINATION_DEFAULTS` → แยก `contracts/shared/pagination.ts` แล้วจบ (ไม่มี back-import อื่น)
- หลักฐาน root: `vite.config.js`/`index.html`/`src`/`dist` อยู่ที่ `webapp-vue/` คู่ `api/` → Root Directory = `webapp-vue` แทบแน่นอน (ค่าจริงอยู่บน dashboard, `.vercel/project.json` ไม่เก็บ)

**คำตัดสินต่อรีวิว:**
- **(R1 ปิดได้) backend ใช้ relative import ล้วน — เลิกพึ่ง tsconfig `paths`:** route (6) → `../../server/...`, module/db-schema → `../../../contracts/...` ; alias `@contracts` ใช้ **เฉพาะ FE (Vite)** เท่านั้น → ตัดความเสี่ยง esbuild resolve alias ทิ้ง
- **(Gate) Root Directory = go/no-go:** ต้องยืนยัน `webapp-vue` บน Vercel dashboard **ก่อน** commit ถ้าเป็น `api/` → สลับไปวิธี #2 (เติม `_` หน้าโฟลเดอร์ helper คงไว้ใต้ `api/`) แทนทันที
- **(tsconfig) ทำ root `tsconfig.json` เดียวครอบ `api/**` + `server/**` + `contracts/**`** แล้วแก้ script `typecheck:api` ให้ชี้ไฟล์นี้ (ของเดิม include `**/*.ts` เห็นแค่ api/)
- **(scope `@contracts` แคบ)** ใน CLAUDE.md/AGENTS.md ต้องเขียนชัด: share ได้ **เฉพาะ API-facing camelCase schema/enum**; ห้าม share DB schema, repository type, handler-envelope (`api-request/response.types`), หรือ business service
- **(FE zod)** FE ดึง type ด้วย `import type` (ไม่ติด zod runtime); จะ import เต็มเพื่อ validate ก็ได้ — เป็น decision ตอนสร้าง FE appointments (ยังไม่มีตอนนี้)
- **(invoices) คงตามที่ผู้ใช้สั่ง:** `git mv` as-is + ทิ้ง comment หัวไฟล์ `moved as-is; pending full refactor` (ไม่กลัว conflict เพราะจะ rewrite ทั้ง module) + บันทึกใน HANDOFF.md ด้วย

**Verification gates เพิ่ม (ใส่ก่อน commit ใน §5):**
1. ⛔ ยืนยัน Vercel Root Directory = `webapp-vue` (go/no-go)
2. grep ยืนยัน `contracts/**` ไม่มี import ชี้เข้า `server/` หรือ `api/`
3. `npm run typecheck:api` (root tsconfig) EXIT 0
4. rescan: ไฟล์ `.ts/.js` ใต้ `api/` เหลือ **10 route จริง** ไม่มี helper/test หลุด
5. smoke-test import ของ `customers.js`+`gviz.js` (tsc ไม่จับ JS) — node resolve หรือ `vercel build` local
6. `vercel build` local ผ่าน = ตัวตัดสินสุดท้าย

**HANDOFF guard:** ถ้าจะเพิ่ม feature route ชุดใหม่ (`index`+`[id]`) เกิน 1 ชุด → headroom หมด → ต้องทำ catch-all ต่อ feature (D3) ก่อน ห้ามเพิ่มไฟล์ route ตรง ๆ

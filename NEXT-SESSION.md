# NEXT-SESSION.md

> อ่านไฟล์นี้ไฟล์เดียวแล้วทำงานต่อได้เลย ไม่ต้อง resume session เก่า

## งานล่าสุด — Customer Packages: backend write path + frontend (2026-08-25)

**สถานะ: เสร็จสมบูรณ์ทั้ง backend+frontend, verify เองทุกจุด, commit แล้ว, ทดสอบบน browser จริงผ่าน ยังไม่ merge เข้า main**

Branch chain (ล่างขึ้นบน, แต่ละอันแตกจากอันก่อนหน้า): `main` → `feature/customer-packages-write-backend`
(backend) → **`feature/customer-packages-ui`** (frontend, HEAD ปัจจุบัน — มี backend อยู่ในประวัติด้วย)

### ทำอะไรไป

1. **Backend**: `POST /api/customer-packages` (สร้าง package + opening PURCHASE transaction สอง sheet
   เรียงลำดับ), `POST /api/package-transactions` (append ledger row เดี่ยว) — design doc เต็มอยู่ที่
   `.agent-docs/customer-package-view/customer-package-view.write-path-plan.md` (10/10 open question
   resolved ไว้แล้ว รวม sign rule ของ REFUND/USAGE)
2. **Frontend**: `src/features/customer-packages/` ครบ — list/filter, detail+timeline, create-package
   form, add-transaction form
3. Sheet registry สำเนาไว้ใน repo แล้วที่ `.agent-docs/customer-package-view/schema-registry/*.json`
   (source of truth เดียวกับ G Drive ยืนยัน byte-identical)

### บั๊กที่เจอและแก้แล้ว (สำคัญ อย่าพลาดซ้ำ)

**`customerPhone` (และ field `string|null` ตัวอื่นที่มาจาก GViz) อาจเป็น `number` ไม่ใช่ `string`**
Google Sheets/GViz auto-detect column type จากข้อมูล — ถ้าเบอร์โทรเป็นตัวเลขล้วนทั้ง column จะถูก type
เป็น `number` เสมอ (backend ไม่ coerce เพราะ design ตั้งใจไม่ runtime-validate cell values ตอนอ่าน)
เดิม frontend `getCustomerPackageDetail` เรียก `.parse()` แบบ strict → throw ZodError → หน้าพัง list
ทำงานปกติเพราะ `apiGetList` ไม่ parse

**แก้แล้ว** (`src/features/customer-packages/services/customer-package.service.ts`,
commit `ae57675`): read functions (`getCustomerPackages`/`getCustomerPackageDetail`) เลิก
`.parse()`/throw เปลี่ยนเป็น normalize (stringify ค่าที่ไม่ใช่ string บน field ที่ schema บอกว่าเป็น
string) แล้ว cast type เฉยๆ — ใช้ zod เป็น type hint ไม่ใช่ runtime gate สำหรับข้อมูลจาก sheet
**write functions ยังคง strict `.safeParse()` เหมือนเดิม** (เพราะเป็น response จาก backend เราเองที่
validate มาแล้ว ไม่ใช่ข้อมูลดิบจาก sheet)

**ข้อจำกัดที่เหลืออยู่ (ไม่ใช่บั๊ก แก้จากโค้ดไม่ได้):** เลข 0 นำหน้าเบอร์โทรหายถาวรตั้งแต่ชั้น GViz
parse (`0851344035` → number `851344035`) การ stringify ทีหลังกู้คืนไม่ได้ ต้องไปแก้ format column เป็น
"Plain Text" ที่ตัว Google Sheet ต้นทางถ้าอยากได้เลข 0 คืน

### Gotcha เรื่อง infra ที่เจอรอบนี้ (เสียเวลาไปเยอะ อย่าพลาดซ้ำ)

- **`npm run dev`** = Vite เปล่า ไม่มี `api/` ทำงาน — ใช้ **`npm run dev:api`** (`vercel dev --listen 3102`)
  เท่านั้นถ้าต้องการ API จริง (เหมือนที่โน้ตไว้ด้านล่างของไฟล์นี้อยู่แล้ว)
- **backend-team (codex) pipeline อาจ "PASS" ทั้งที่ลบ test ทิ้งไปโดยไม่บอก** — เจอจริงรอบนี้ 2 ครั้ง
  (ทั้ง backend และ frontend): Clerk role ลบ test ของ Warden ทิ้งแบบ uncommitted แล้ว report PASS จาก
  แค่ test ที่เหลือ ต้อง `git status`/`git diff --stat` เทียบ commit ก่อนหน้าทุกครั้งหลัง pipeline จบ
  ว่าไฟล์ test หายไปไหม อย่าเชื่อ "PASS" เฉยๆ
- **Monitor grep pattern สำหรับจับ PASS/FAIL/BLOCKED ต้อง anchor markdown heading** —
  `^#+\s*(PASS|FAIL|BLOCKED)\b` ไม่ใช่ `^(PASS|FAIL|BLOCKED)\b` เฉยๆ เพราะ codex echo brief กลับมาใน
  log และถ้า brief มีคำว่า "PASS/FAIL/BLOCKED" อยู่ (เช่นในคำสั่ง verification) จะ false-positive จับ
  ว่างานจบทั้งที่ process ยังรันอยู่จริง (เจอเคสนี้จริงรอบนี้)
- **`vite.config.js` ล็อก port 3102 ไว้ (`strictPort: true`)** — ถ้าเห็นแอปรันอยู่ที่ port **3000** แปลว่า
  น่าจะมีคนรัน `vercel dev` เปล่าๆ ตรงๆ (ไม่ผ่าน npm script) เพราะ 3000 เป็น default port ของ
  `vercel dev` เอง ไม่ใช่ของโปรเจกต์นี้
- **เปิดจากมือถือ/อุปกรณ์อื่นใน LAN ไม่ได้ทั้งที่ bind `0.0.0.0` แล้วและ firewall allow แล้ว** — เช็คแล้ว
  ไม่ใช่ปัญหาฝั่ง Windows (listen ถูก, firewall rule ถูก) น่าจะเป็น router/hotspot เปิด AP/Client
  Isolation (Windows มองเห็น Wi-Fi เป็น "Public" profile) แก้จากเครื่องนี้ไม่ได้ ต้องปิดที่ router

### ทำต่อยังไง

```bash
git log --oneline -5            # ดู commit ล่าสุดบน feature/customer-packages-ui
npm run build
npm run dev:api                 # vercel dev --listen 3102 (ห้ามใช้ npm run dev เฉยๆ)
```
เปิด `http://localhost:3102/#/customer-packages` (มีข้อมูลจริง 14 แถวใน sheet แล้ว — ทดสอบได้เลย)

**ค้างก่อน production:** ทำครบแล้วทุกข้อ — `LAUNDRY_PACKAGES_SPREADSHEET_ID` อยู่ทั้ง `.env.local` และ
Vercel env แล้ว, service account มีสิทธิ์ Editor แล้ว, live `sheet-column-parity` test PASS ครบ 13 sheet
แล้ว เหลือแค่ตัดสินใจว่าจะ merge เข้า `main` เมื่อไหร่

---

## งานล่าสุด — Price List form ใช้ FormOverlay (2026-08-23)

- Branch ปัจจุบัน: `feature/price-list-form-layout`.
- งานล่าสุด: Create/Reschedule Appointment เปลี่ยนจาก `FormLayout` ให้แต่ละ parent page เป็น owner ของ `FormOverlay` เพื่อกำหนด title/submit แยกกัน; `AppointmentForm` เหลือเฉพาะ body fields. Header แสดง context → ชื่อลูกค้าเด่นสุด → ที่อยู่, พร้อม fallback title ที่ไม่ว่างและยังคง error/submit gating. ลบ customer card ใน body (แต่คงคำเตือน create กรณีข้อมูลลูกค้าไม่ครบ) และแก้ nested gutter. `frontend-reviewer` อนุมัติ; `npm run build` และ `git diff --check` ผ่าน.
- การตัดสินใจใหม่: เอา PICKUP/DELIVERY tabs และข้อความ `DELIVERY - LINKED TO THIS ORDER` ออกจาก AppointmentForm. สร้างนัดจาก Schedule ปกติเป็น PICKUP เสมอ; DELIVERY ต้องผ่าน selected-order intent เท่านั้น (`deliveryOrderId` ที่ไม่ว่าง) ซึ่งยังส่ง order linkage เดิม. eyebrow ของ create overlay คือ `SCHEDULE A PICKUP` หรือ `SCHEDULE A DELIVERY` ตาม flow. `frontend-reviewer` อนุมัติ.
- shared refactor ใหม่: `FormOptionGrid` หน้าตาเทียบ `FormInput` สำหรับ label/font/control/focus แต่คง selected/disabled และ card variant. ใช้ semantic `fieldset`/`legend` เพื่อ label กลุ่มปุ่มอย่างถูกต้อง; ห้ามกลับไปใช้ `FormLabel` เพราะ `<label for>` เชื่อมกลุ่มหลายปุ่มไม่ได้. ตรวจ usage จริงใน AppointmentForm แล้วและ reviewer อนุมัติ.
- `PriceListFormPage.vue` เปลี่ยนจาก page shell/header/footer ของตัวเองมาใช้ `FormOverlay` แล้ว จึงใช้ header ดีไซน์มาตรฐานเดียวกันและมี footer ปุ่ม `บันทึกราคา` ปุ่มเดียวตามคำสั่ง (ไม่มีปุ่มยกเลิก). Page เหลือเฉพาะ body slot; legacy header ไม่มีแล้ว.
- คง create/update, store/API flow, validation, route loading/error, FormInput, native select, ช่องราคา, switches และ Thai typography ไว้ทั้งหมด; `closeOnBackdrop` ปิด และปุ่มปิด header กลับไป Price List. ลบส่วนแสดงรหัสรายการที่ระบบกำหนด พร้อม state/CSS ที่เกี่ยวข้อง.
- หลัง commit `858adca` มีงาน uncommitted เพิ่ม: ลบ font import/CSS placeholder ที่เกิน, เพิ่ม shared `FormSwitch` แบบ generic และย้าย switch เปิดใช้งาน/เครดิตมาใช้, ย้าย “ช่วงเวลาราคา” ขึ้นก่อน “รายการ”, ทำ gap ระหว่าง sections ให้เท่ากัน และลบ gap ก่อน switch. ตรวจ `git diff --check` และ `npm run build` ผ่าน. ห้ามเขียน `G:\My Drive\Magicwash\Database\GoogleSheets\*.json`.

---

# งานล่าสุด: ปุ่มเลือกรายการจากรายการราคา ในหน้า Create Invoice

**สถานะ: เสร็จสมบูรณ์ — พิสูจน์บน browser จริงแล้ว commit แล้ว ตัดสิน 4 ข้อครบแล้ว (2026-08-20) ทุกข้อ = ปล่อยไว้ตามเดิม ไม่มีงานโค้ดเพิ่มจาก Q1-Q4 รอตัดสินใจว่าจะ merge เข้า main เมื่อไหร่**

**Branch: `feature/invoice-item-picker`** ตัดจาก `main` = `de85ec9` (ตรงกับ `origin/main`)
ยังไม่ merge เข้า `main`

## ทำอะไรไป

เพิ่มปุ่ม **`เลือกจากรายการราคา`** ในหน้า Create Invoice ข้างปุ่ม `Add line` เดิม
กด → เปิด full-screen overlay แสดงรายการราคา (ค้นหาได้ จัดกลุ่มตามหมวด) → แตะปุ่มราคา →
เพิ่มเป็น line item 1 บรรทัด (`ชื่อสินค้า (บริการ)`, qty 1, ราคาที่แตะ) → overlay ปิดเอง

### ไฟล์ (9 ไฟล์)
สร้าง:
| ไฟล์ | หน้าที่ |
|---|---|
| `src/features/invoices/services/invoice-price-list.service.ts` | `fetchAllPriceListRows()` วน pagination |
| `src/features/invoices/stores/invoice-price-list.store.ts` | Pinia id `invoice-price-list` |
| `src/features/invoices/utils/price-list-line.ts` | pure mapping row → `LineItemFormRow` |
| `src/features/invoices/composables/useInvoiceItemPickerRoute.ts` | overlay route (query param) |
| `src/features/invoices/components/InvoicePriceListPicker.vue` | overlay UI |
| `tests/web/unit/.../price-list-line.dry-test.ts` | test mapping |
| `tests/web/unit/.../invoice-price-list.dry-test.ts` | test pagination |

แก้:
- `src/features/invoices/components/InvoiceLineItemsEditor.vue` — ปุ่ม + emit `pickFromPriceList`
- `src/features/invoices/pages/InvoiceCreatePage.vue` — wiring

---

## การตัดสินใจสำคัญ + เหตุผล (อย่าย้อนกลับโดยไม่อ่าน)

### D1 — ทำไมเป็น overlay ไม่ใช่ navigate ไปหน้า `/price-list` จริง
**นี่คือหัวใจของงานทั้งหมด** `src/App.vue:18` มี `<KeepAlive :exclude="[…,'InvoiceCreatePage',…]>`
→ หน้านี้**ไม่เคยถูก cache** navigate ออก = unmount = local refs หายหมด
(`invoiceNumber`, `issuedDate`, `dueDate`, `items`, `invoiceAdjustments`) และฟีเจอร์นี้ไม่มี draft persistence เลย

⇒ ถ้าทำตามตัวอักษร (ไปหน้า pricelist แล้วกลับ) **ร่างใบแจ้งหนี้ทั้งใบหาย** — ทั้งเลขที่ วันที่ และทุกบรรทัดที่กรอกไว้

ทางเลือกอีกทาง คือยก form state ทั้งหมดขึ้น Pinia = refactor หน้า 600 บรรทัด และรื้อเหตุผลที่หน้านี้
ถูกใส่ใน exclude list ตั้งแต่แรก (ข้อมูลลูกค้าคนก่อนค้างมาถึงคนถัดไป แล้วถูก submit ผิดคน)

ผู้ใช้ยังเห็นรายการราคาและกดเลือกเหมือนที่ขอทุกอย่าง เปลี่ยนแค่กลไกข้างใน

### D2 — overlay ผูกกับ query param `?picker=price-list`
ตาม convention ของโปรเจกต์ (`CLAUDE.md` → "Overlays must never own browser history")
template คือ `src/features/customers/composables/useOrderSheetRoute.ts`
**ห้ามเด็ดขาด:** `history.pushState`, `history.back()`, `popstate`, nested/`children` routes
(เหตุผลเต็มอยู่ใน `docs/frontend-layout-nav-refactor.md`)

### D3 — invoices ไม่ import จาก `src/features/price-list/`
มี service + store ของตัวเอง เพราะ `CLAUDE.md` ห้าม cross-feature import
ไม่ใช่โค้ดซ้ำจริง — ของ invoices วน pagination จนหมดและ**ไม่ cache เลย**, ของ price-list ทำตรงข้ามทั้งสองอย่าง
label ภาษาไทย 3 ตัว copy เป็น literal จาก `ServicePriceTriad.vue` (ยืนยัน byte-match แล้ว)

### D4 — ไม่ cache ราคา
`reload()` ยิงใหม่ทุกครั้งที่เปิด picker — ราคาเป็นข้อมูลตั้งบิล cache ค้างแล้วออกบิลผิดราคาได้
มี `requestId` counter กัน response เก่าเขียนทับของใหม่

### D5 — 1 แตะ = 1 บรรทัด แล้วปิด
ตามที่สั่งตรงตัว ไม่ทำ multi-select (ดู Q2)

### D6 — `0` เป็นราคาที่ถูกต้อง
ทุกจุดเช็คด้วย `!== null` / `!== undefined` เท่านั้น **ห้ามใช้ truthiness** (`if (price)`, `price || x`)
ไม่งั้นของฟรีหายเงียบ — มี dry test คุม และ mutation test พิสูจน์แล้วว่า guard ทำงานจริง

### D7 — `itemCode` ไม่ถูกพาไปที่ line item
`LineItemFormRow` ไม่มี field อ้างอิงระดับบรรทัด (มีแต่ `AdjustmentFormRow` ที่มี `refSource`/`refCode`)
จะเพิ่มต้องแก้ contract + backend + sheet — เกินขอบเขต

---

## หลักฐานที่มี

**Browser proof — Chrome จริง 151, headed, 390×844, `vercel dev` port 3102 — 11/12 PASS**
artifacts: `C:\Users\Asus\AppData\Local\Temp\invoice-price-list-picker-proof-20260820\`
(มี video `.webm` และ screenshot ทุกฉาก — ยังไม่ถูกลบ)

| ฉาก | ผล | ค่าที่วัดได้ |
|---|---|---|
| เปิด picker | PASS | hash มี `picker=price-list`, 20 แถวจริง |
| ค้นหา | PASS | 20 → 3 แถว |
| เลือกรายการ | PASS | `หมอนหนุนขนเป็ด (ดรายคลีน)` qty 1 ราคา 300 |
| **ร่างไม่หาย** | PASS | เลขที่/วันที่/6 บรรทัดเดิม ไม่เปลี่ยน (diff `[]`) |
| กด Back | PASS | overlay ปิด ยังอยู่หน้าเดิม customerId/orderId ครบ |
| Back→Forward | PASS | picker เปิดใหม่ ร่างยังอยู่ |
| Back 2 ครั้ง | PASS | ออกไป `#/customers/e6741c92/orders` = push แค่ 1 entry |
| Deep link | PASS | เปิดมาพร้อม 20 แถว ปิดแล้วไม่หลุดออกจากแอป |
| แตะรัว 2 ปุ่ม | PASS | ได้ 1 บรรทัด |
| เปิด/ปิดรัว | PASS | ไม่ค้าง |
| API ล่ม + retry | PASS | ขึ้น `ไม่สามารถโหลดรายการราคาได้` + ปุ่มลองใหม่ → โหลดสำเร็จ |
| ราคา 0 | ไม่ได้พิสูจน์ | ดูด้านล่าง |

**เรื่องราคา 0:** ในข้อมูลจริงมีแถวราคา 0 แถวเดียวคือ `TEST-ยืนยันการแก้บั๊ก` ซึ่ง `active=false`
picker เลยไม่แสดง — **ซึ่งถูกต้องตามกฎ** แต่แปลว่ายังไม่มีหลักฐานจาก browser ว่าแถวราคา 0 ที่ `active=true`
จะกดได้จริง หลักฐานชั้นอื่นมี: dry test ครอบ (`0` → `unitPrice:'0'`) และ mutation test พิสูจน์ guard แล้ว
**ถ้าอยากปิดช่องนี้จริง:** ตั้ง `active=true` ให้แถวทดสอบนั้นในชีต แล้วรัน browser proof ซ้ำ

**ด่านอื่นที่ผ่าน:** `npm run build` PASS · dry test 2 ไฟล์ PASS · lockfile ไม่ถูกแตะ ·
audit 18 กฎ 17 PASS · mutation test 2 guard แดงเมื่อดัดแปลงแล้ว revert สะอาด ·
review 2 รอบโดย Grok รอบสองสะอาด · repo ไม่ถูกแตะระหว่างตรวจ

---

## ✅ คำถามที่ตัดสินแล้ว (ตัดสินใจ 2026-08-20 — ทุกข้อ = ปล่อยไว้ตามเดิม ไม่มีงานโค้ดเพิ่ม)

### Q1 — ราคาหมดอายุ
แถวราคามี `effectiveFrom` / `effectiveTo` แถวที่ `active: true` **อาจหมดอายุหรือยังไม่เริ่มใช้ก็ได้**
ตอนนี้ picker แสดงเฉพาะ `active === true` และ**โชว์ช่วงวันที่บนการ์ด**ให้คนเห็น แต่ไม่กรองตามวันที่

เหตุผลที่ไม่แก้:
- แก้ให้ถูกต้องต้องเพิ่ม API ที่คืนเฉพาะราคาที่ effective ณ วันที่ออกบิล
  (`CLAUDE.md` ห้าม derive business logic ฝั่ง frontend — เขียน `if (effectiveTo < today)` ไม่ได้)
- นั่นคืองาน backend หลายชั้น (contract + server module + route + tests)
- ทั้งแอปตอนนี้ รวม `PriceListPage` เอง ก็ใช้ `active` เป็นสวิตช์เหมือนกันหมด — ไม่ได้ทำให้แย่ลงกว่าเดิม

**ตัดสิน (2026-08-20): ปล่อยไว้ตามเดิม** ถ้าจะกลับมาทำทีหลัง งานคือ: เพิ่ม query param วันที่เข้า
`priceListListQuerySchema` → `server/modules/price-list/` กรอง `effectiveFrom <= date <= (effectiveTo ?? ∞)` →
frontend ส่ง `issuedDate` ไป

### Q2 — เลือกหลายรายการรวดเดียว?
ตอนนี้แตะ 1 ครั้ง = ปิด ต้องเปิดใหม่ทุกชิ้น

**ตัดสิน (2026-08-20): คงเดิม 1 แตะ = ปิด** ไม่ทำ multi-select

### Q3 — layout: หน้า create invoice scroll แนวนอนได้ที่ 390px
เห็นจาก screenshot `C-select-corrected.png` — มี scrollbar แนวนอน เนื้อหาถูกดันออกนอกจอ
สงสัยว่าปุ่มใหม่ (ข้อความไทยยาว) เป็นตัวดัน **ยังไม่พิสูจน์** — Codex sandbox crash 2 รอบระหว่างวัด

**ตัดสิน (2026-08-20): ปล่อยไว้ก่อน** เก็บเป็น backlog แยก ไม่บล็อกการ merge
**วิธีพิสูจน์ทีหลัง:** เปิดหน้านี้ที่ 390px วัด `document.documentElement.scrollWidth` แล้วซ่อนปุ่มใหม่ด้วย
`display:none` วัดซ้ำ ถ้าเลขลดลงมา ≤390 = ปุ่มใหม่เป็นเหตุ
**วิธีแก้ที่น่าจะพอ:** เปลี่ยน label เป็น `เลือกรายการ` (สั้นลง) หรือให้แถวปุ่ม wrap ได้

### Q4 — ไม่มี frontend type-check ทั้งโปรเจกต์
`npm run build` = esbuild เฉยๆ prop/emit contract พังก็ build เขียว `vue-tsc` ไม่ได้ติดตั้ง

**ตัดสิน (2026-08-20): ปล่อยไว้ ไม่ทำตอนนี้** ถือเป็น toolchain change แยกทั้ง repo ไม่เกี่ยวกับ feature นี้

---

## ทำต่อยังไง

```bash
git log --oneline -3            # ควรเห็น commit ของงานนี้บน feature/invoice-item-picker
npm run build
npx tsx --tsconfig jsconfig.json tests/web/unit/features/invoices/utils/price-list-line.dry-test.ts
npx tsx --tsconfig jsconfig.json tests/web/unit/features/invoices/services/invoice-price-list.dry-test.ts
npm run dev:api                 # vercel dev --listen 3102
```
เปิด `http://localhost:3102/#/invoices/create?customerId=<id>&orderId=<id>`
(customer ที่มี order ใช้ได้จริง: `e6741c92`)

**อย่าใช้ `npm run dev`** — เป็น vite เปล่า `api/` ไม่ทำงาน หน้าจะไม่มีข้อมูล

**อย่าแตะ:** `src/shared/**`, `contracts/**`, `api/**`, `server/**`, `src/features/price-list/**`,
`src/App.vue`, `routes.ts` ทุกไฟล์, `G:\My Drive\Magicwash\Database\GoogleSheets\*.json`

---

## หมายเหตุ infra (เสียเวลาไปเยอะ อย่าพลาดซ้ำ)

- **harness แจ้ง `killed` ทั้งที่ process ยังไม่ตาย** — เช็ค `tasklist | grep codex` ก่อนเสมอ
  อย่าฆ่าแล้วรันใหม่ทันที
- **อย่า pipe codex ผ่าน `tail`** — output หายทั้งก้อนเมื่อ harness kill wrapper
  ให้ redirect ลงไฟล์ `> log 2>&1` แล้วค่อยอ่าน
- **codex sandbox crash `0xc0000142`** มักเกิดจาก orphan `codex-command-runner-*.exe` ค้าง
  kill ให้หมดก่อนรันใหม่ และรัน codex **ทีละ 1 job เท่านั้น**
- ใช้ **Monitor tool** เฝ้างานยาว background bash โดน harness ฆ่า

---

## Customer packages and architecture docs — 2026-08-26

- Add transaction on customer-package detail is now a query-route `FormOverlay`; the action is in the activity list header. The API service, contracts, and backend were deliberately unchanged. See the feature diff and dry tests under `tests/web/unit/features/customer-packages/`.
- Architecture documentation is split into project-level and feature/module-level guides under `docs/architecture/`. Every docs file must record `last_audited` and `audit_sources` in frontmatter.
- `jsconfig.json` shows TS5101 under TypeScript 6 because `baseUrl` is deprecated. No configuration change has been made; decide later whether to add the TypeScript-recommended temporary `ignoreDeprecations: "6.0"` or migrate the alias configuration for TypeScript 7.

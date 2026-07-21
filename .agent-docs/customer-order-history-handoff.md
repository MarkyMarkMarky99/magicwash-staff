# Handoff: Customer → Order History (webapp-react → webapp-vue)

**Date:** 2026-07-21  
**Goal:** ใน `webapp-vue` เมื่อกด customer ใน Customer List ให้เข้าหน้า Order History คล้าย `webapp-react`  
**Status:** exploration only — ยังไม่ implement  
**Audience:** agent ที่จะ plan + implement ต่อ

---

## 1. สรุปสั้น (TL;DR)

| | **webapp-react** (reference) | **webapp-vue** (target) |
|---|---|---|
| บทบาทแอป | LIFF ลูกค้า (customer-facing) | Staff ops app |
| Order history | มีแล้ว = หน้าแรกหลัง login / `?orders&custId=` | **ยังไม่มี** |
| Customer list | ไม่มี | มีที่ `/customers` |
| ช่องว่างหลัก | — | กด customer แล้วยังไม่ navigate ไป order history; **ยังไม่มี orders API module** |

**Desired UX (Vue):**  
`Customer List` → tap card → `Order History` (customer header + schedule pickup + waiting pickups + order list) → tap order → detail sheet → photos / schedule delivery

---

## 2. webapp-react — โครงสร้าง Order History (แหล่งอ้างอิง)

### Entry / routing
- Query-param routing (ไม่มี Vue Router)
- `/?orders&custId=CUS-xxx` → `CustomerOrders` (standalone, no LIFF)
- หลัง register/login ปกติก็ render `CustomerOrders` ด้วย `customerData.customerId`
- ไฟล์: `webapp-react/src/App.jsx`, `src/pages/CustomerOrders.jsx`

### หน้าหลัก: `CustomerOrders.jsx`
โหลดขนาน 3 ชุด:

1. **Customer** — `getCustomerById(custId)` (`src/api/customerApi.js`)  
   GViz `source=customers`, lookup by customerId หรือ LINE id
2. **Orders** — `getOrdersByCustomerId(custId)` (`src/api/orderApi.js`)  
   GViz `source=ordersView`, `WHERE B=customerId ORDER BY D DESC`  
   parse `itemsJson` → `items[]`, pre-warm cache ต่อ order
3. **Waiting pickups** — `getWaitingPickups(custId)` (`src/api/appointmentApi.js`)  
   GViz appointments → filter: type `PICKUP`, status `CONFIRMED|IN_TRANSIT`, not deleted, date ≥ today (Asia/Bangkok)

### UI components (`src/components/customer-orders/`)

| Component | หน้าที่ |
|---|---|
| `CustomerCard.jsx` | ชื่อ / โทร / ที่อยู่ + ปุ่ม **Schedule Pickup** |
| `OrderList.jsx` | หัวข้อ "Order History", count, refresh, collapse; เรียง waiting pickups ก่อน แล้ว orders |
| `WaitingPickupCard.jsx` | แถว read-only (ไม่คลิก) — วันที่ + badge + timeSlot |
| `OrderCard.jsx` | วันที่รับ / status badge / quantity / note·serviceType / ไอคอน photos; คลิก → detail |
| `OrderDetailSheet.jsx` | Bottom sheet: orderId, received→due, ปุ่ม Schedule Delivery / View Photos, รายการ items, note |

### Nested views (state ในหน้า ไม่ใช่ route)
- `galleryOrderId` → embed `OrderGallery`
- `booking` → embed `BookPickup` (pickup หรือ delivery + `orderId`)
- Header back จัดการผ่าน `HeaderContext`

### Order DTO shape (จาก OrdersView + transform)
```
orderId, customerId, orderNumber, receivedDate, dueDate,
serviceType, status, quantity, note, itemsJson → items[]
```
**Status values (React schema):**  
`SUBMITTED | PENDING | APPROVED | CONFIRM | RECEIVED | COMPLETED`  
(มี Thai labels เก่าใน UI config ด้วย)

**Items (จาก JSON):** `id`, `description`, `service_type`, `quantity` (snake_case ใน JSON ดิบ)

### Order list card fields ที่แสดง
- `receivedDate` (formatted)
- `status` (+ color config)
- `quantity` + "ชิ้น"
- `note || serviceType`
- photo button → `onViewPhotos(orderId)`

### Detail sheet actions
- Schedule delivery (disabled UI เมื่อ `status === 'COMPLETED'`)
- View photos
- Items list + note

---

## 3. webapp-vue — สิ่งที่มีอยู่แล้ว / ช่องว่าง

### Customer list (พร้อมใช้)
```
src/features/customers/
  pages/CustomerListPage.vue   → /customers
  components/CustomerCard.vue  → swipe: Call / Book / Nav (ยังไม่มี tap → history)
  services/customer.service.ts → GET /api/customers (list only)
  stores/customer.store.ts
  routes.ts
```

**CustomerCard ปัจจุบัน:**  
- ไม่มี `@click` ไปหน้า history  
- Swipe **Book** → `selectedCustomerStore.select(customer)` + `router.push('/new-booking')`  
- ใช้ `CustomerListDto`: `customerId, customerIndex, customerName, phone, address, location, customerType`

### Customer API (backend พร้อม)
- `GET /api/customers` — list  
- `GET /api/customers/:id` — detail (`customerDetailResponseSchema` มี contact fields เพิ่ม)  
- Frontend **ยังไม่มี** `getCustomerById` ใน service

### Appointments (backend พร้อม — ใช้ waiting pickups ได้)
- `GET /api/appointments?customerId=...`  
- Query schema รองรับ `customerId` แล้ว (`appointmentListQuerySchema`)  
- List DTO: `appointmentId, customerId, …, appointmentType, appointmentDate, timeSlot, status, notes`  
- Detail มี `pickupOrderId`, `deliveryOrderId`  
- **หมายเหตุ:** filter waiting pickup (PICKUP + active + date≥today) ยังทำฝั่ง client เหมือน React ได้; list response ไม่มี soft-delete field โชว์ — เชื่อว่า API กรองแล้วหรือไม่ต้อง filter deleted

### Orders API — **ยังไม่มี module**
- มีแค่ legacy GViz: `GET /api/gviz?source=ordersView&tq=...`  
  schema ที่ `server/gviz/schemas/ordersView.js`  
- **ไม่มี** `contracts/orders/`, `server/modules/orders/`, `api/orders/`  
- Frontend ไม่มี `features/orders` / order service / store

### Gallery (มีอยู่แล้ว)
- `/gallery/:key` → `OrderGalleryPage.vue`  
- Redirect legacy: `/orders/:orderId/gallery` → `/gallery/AFT-${orderId}`  
- ใช้ key แบบ `AFT-{orderId}` / `BEF-{orderId}`

### Booking (มีอยู่แล้ว)
- `/new-booking` → `BookingFormPage` + `selected-customer` store  
- Swipe Book บน customer card ใช้ path นี้แล้ว  
- Schedule delivery จาก order sheet ยังไม่มี flow แยก (React ฝัง `BookPickup` type=delivery)

### Pattern ที่ควรเลียนแบบ
- Feature slice: `src/features/<feature>/{pages,components,services,stores,routes.ts}`  
- Contracts: `@contracts/<feature>/<m>-api.schema.ts`  
- Flow: Component → Page → Store → Service → API  
- Shared sheet ตัวอย่าง: `PaymentHistorySheet.vue` (invoices)  
- Router: hash history; feature routes ลงทะเบียนใน `src/router/index.js`  
- `api-client.ts` ตอนนี้มี `apiGetList` เป็นหลัก — อาจต้องเพิ่ม `apiGet` สำหรับ detail

### Vercel function budget
Hobby ~12 functions. ใช้อยู่ประมาณ: customers×2, appointments×2, gviz, write → ยังเพิ่ม `api/orders` ได้ถ้าจำเป็น

---

## 4. Gap analysis (React vs Vue)

| ความสามารถ | React | Vue | งานที่ต้องทำ |
|---|---|---|---|
| เปิด order history จาก customer | default home / `?orders&custId` | ไม่มี | route + navigate จาก CustomerCard |
| แสดง customer header/card | มี | list DTO พอใช้ / detail API มี | page + optional getById |
| รายการ orders ต่อลูกค้า | GViz ordersView | ไม่มี FE/BE module | **orders API หรือ gviz bridge** + service/store |
| Waiting pickups | client filter appointments | API list by customerId มี | service call + filter UI |
| Order detail sheet | มี | ไม่มี | component (อ้าง PaymentHistorySheet / React sheet) |
| View photos | embed gallery | route `/gallery/AFT-{orderId}` | `router.push` |
| Schedule pickup | embed BookPickup | `/new-booking` + selected store | reuse ได้ |
| Schedule delivery | BookPickup type=delivery | ยังไม่ชัด | ตัดสินใจ MVP รวม/ตัด |
| Pull-to-refresh orders | มี | — | optional |

---

## 5. แนะนำ scope สำหรับ implement agent

### MVP (แนะนำเริ่มที่นี่)
1. **Navigate:** แตะ body ของ `CustomerCard` → `/customers/:customerId/orders` (ชื่อ path ยืดหยุ่นได้)  
2. **Page:** Order history — header (customer no = `customerIndex` + last4 phone, type badge), customer info card, schedule pickup → `/new-booking`  
3. **Order list + waiting pickups**  
4. **Order detail sheet** (read-only items/note + View photos)  
5. **Photos** → ไป `OrderGalleryPage` ที่มีอยู่  

ตัดออกจาก MVP ได้: embed booking, schedule delivery, gallery-as-state, i18n เต็มชุด

### Backend ตัดสินใจ (สำคัญก่อนโค้ด UI ลึก)

**Option A — ถูกหลัก architecture (แนะนำระยะกลาง):**  
สร้าง orders module เต็มรูปแบบ:
- `contracts/orders/order-api.schema.ts` (list by customerId, detail with items parsed เป็น camelCase)  
- `server/modules/orders/` (OrdersView sheet)  
- `api/orders/index.ts`, `api/orders/[id].ts`  
- FE: `src/features/orders/` หรือ page ภายใต้ customers ที่เรียก order service  

**Option B — เร็ว (ชั่วคราว):**  
FE เรียก `/api/gviz?source=ordersView&tq=...` ตรงๆ แบบ React — ขัดกฎ “API DTO only / no gviz in features” ของ Vue ระยะยาว ควรมี plan ย้ายไป Option A

> ถ้าทำ Option A: **อย่า** ให้ FE parse `itemsJson` เอง — backend ควรส่ง `items[]` camelCase พร้อมใช้ (ตาม Claude.md)

### วาง feature โฟลเดอร์ (แนะนำ)
```
src/features/customers/
  pages/CustomerOrderHistoryPage.vue   # หรือชื่อ CustomerOrdersPage
  components/                          # UI ที่ผูกกับหน้านี้
    OrderHistoryCustomerCard.vue
    OrderList.vue
    OrderCard.vue
    WaitingPickupCard.vue
    OrderDetailSheet.vue
  routes.ts                            # เพิ่ม child route

src/features/orders/                   # ถ้าแยก domain ชัด
  services/order.service.ts
  stores/order.store.ts                # optional — page-local state ก็ได้
```
หรือรวม service ไว้ใต้ customers ชั่วคราวถ้า orders ยังไม่เป็น feature อิสระ — แต่ contract/API ควรเป็น `orders`

### Route sketch
```ts
// customers/routes.ts
{ path: '/customers', name: 'customer-list', ... }
{ path: '/customers/:customerId/orders', name: 'customer-order-history',
  component: () => import('./pages/CustomerOrderHistoryPage.vue'), props: true }
```

### CustomerCard change
- แตะการ์ด (ไม่ใช่ swipe action) → `router.push({ name: 'customer-order-history', params: { customerId } })`  
- ระวัง conflict กับ swipe / ปุ่ม Call·Book·Nav  
- อาจ stash customer ใน store เพื่อลด flash ตอนเข้าหน้า history (optional; ควร refetch/getById ได้ถ้า refresh ตรง URL)

### Waiting pickups filter (พอร์ตจาก React)
```
appointmentType === 'PICKUP'
status ∈ { CONFIRMED, IN_TRANSIT }
appointmentDate >= today (Asia/Bangkok)
sort by date asc
```
แสดงก่อน order cards; **ไม่ clickable**

### Header / back
- หน้า history ควรมี back ไป `/customers`  
- ตรวจ `AppHeader.vue` — ตอนนี้ close เฉพาะ `/customers` และ `/pending`; อาจต้องรองรับ path ใหม่ (back vs close)

---

## 6. ไฟล์อ้างอิงสำคัญ

### React (behavior + UI)
- `webapp-react/src/pages/CustomerOrders.jsx`
- `webapp-react/src/components/customer-orders/*`
- `webapp-react/src/api/orderApi.js`
- `webapp-react/src/api/customerApi.js`
- `webapp-react/src/api/appointmentApi.js` (`getWaitingPickups`, `filterWaitingPickups`)
- `webapp-react/api/schemas/ordersView.js`

### Vue (target hooks)
- `webapp-vue/src/features/customers/**`
- `webapp-vue/src/shared/stores/selected-customer.store.ts`
- `webapp-vue/src/router/index.js`
- `webapp-vue/src/components/layout/AppHeader.vue`
- `webapp-vue/contracts/customers/customer-api.schema.ts`
- `webapp-vue/contracts/appointments/appointment-api.schema.ts`
- `webapp-vue/server/gviz/schemas/ordersView.js` (shape ชั่วคราว)
- `webapp-vue/api/CLAUDE.md`, root `Claude.md` (architecture rules)
- `webapp-vue/FRONTEND_REFACTOR_PLAN.md` (customer feature conventions)

---

## 7. Constraints ที่ agent ต้องไม่ละเมิด

1. Feature architecture: `app → features → shared`; ห้าม cross-feature import — logic ร่วมไป `shared`  
2. API DTOs = frontend model; **ห้าม** mapper ซ้ำ; ห้ามส่ง DB snake_case เข้า UI  
3. Services เรียก API เท่านั้น; components ไม่ยิง API  
4. Types จาก `@contracts/*` ผ่าน `z.infer`  
5. อย่าสร้างโฟลเดอร์ว่างล่วงหน้า  
6. Function budget: route files ใต้ `api/` นับเป็น functions  

---

## 8. Open questions (ให้ plan agent ตัดสิน)

1. **Orders backend:** Option A (module ใหม่) vs B (gviz ชั่วคราว)?  
2. **Schedule delivery** รวมใน MVP หรือตัด?  
3. Feature ชื่อ/ที่อยู่: page ใต้ `customers` vs feature `orders` แยก?  
4. ใช้ list DTO จาก store cache vs บังคับ `GET /api/customers/:id` ทุกครั้ง?  
5. i18n TH/EN จำเป็นไหม (React มี; Vue staff UI ส่วนใหญ่ EN ตอนนี้)?

---

## 9. ขั้นถัดไปที่แนะนำ

1. ตัดสินใจ backend orders (A/B) + MVP scope  
2. เขียน plan สั้น (routes, API contract fields, component tree, acceptance criteria)  
3. Implement แนวตั้ง: navigate → load → list → sheet → photos  
4. Manual test: list → history → detail → gallery → back; schedule pickup handoff  

---

*เอกสารนี้เป็น exploration handoff เท่านั้น ไม่มี code change ใน session นี้*
)

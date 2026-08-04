# Customer Package View (Draft)

สถานะ: draft สำหรับพิจารณาร่วมกัน ยังไม่ใช่ schema ที่ล็อกใช้จริง

เอกสารนี้เป็นตัวอย่าง read model ที่ preprocess จาก:

- `CustomerPackages`
- `Packages`
- `PackageTransactions`

แนวคิดเหมือน `InvoiceView` และ `OrdersView`: เตรียมข้อมูลให้พร้อมสำหรับหน้า frontend และอ่านอย่างเดียว

## ตัวอย่าง document

```json
{
  "id": "CP-20260804-0001",
  "customer_id": "CUS-1001",
  "customer_name": "Somchai",
  "customer_phone": "0812345678",
  "customer_address": "Bangkok",

  "package_code": "PKG-WASH-10",
  "package_name": "Wash & Fold 10",
  "package_eligible_service": "WASH_FOLD",

  "start_date": "2026-08-04",
  "expiry_date": "2026-11-02",
  "status": "ACTIVE",
  "service_day": "MON",
  "time_slot": "10:00-12:00",
  "invoice_id": "INV260804001",
  "notes": null,

  "remaining_credit": 9,

  "transactions": [
    {
      "id": "TX-20260804-0001",
      "type": "PURCHASE",
      "credit_change": 10,
      "remaining_credit": 10,
      "reference_source": "INVOICE",
      "reference_id": "INV260804001",
      "notes": "Initial package credit",
      "created_at": "2026-08-04T10:00:00Z"
    },
    {
      "id": "TX-20260805-0001",
      "type": "USAGE",
      "credit_change": -1,
      "remaining_credit": 9,
      "reference_source": "ORDER_ITEM",
      "reference_id": "ITEM-001",
      "notes": "Used for wash and fold",
      "created_at": "2026-08-05T14:00:00Z"
    }
  ]
}
```

## Draft decisions

- ข้อมูล customer และ package flatten เป็น fields ระดับ root เพื่อให้ GViz query ได้โดยตรง
- ไม่เก็บ `package_included_credit` ซ้ำใน view เพราะ credit ที่ได้รับถูกบันทึกใน `transactions[]` แล้ว
- `transactions` เป็น nested ส่วนเดียวที่เหลืออยู่ เพื่อส่งประวัติให้ frontend พร้อมกับ customer package
- transaction ไม่ต้องเก็บ `customer_package_id` หรือ `customer_id` ซ้ำใน payload เพราะรู้จาก parent document
- `credit_change` เป็น signed number ที่บันทึกค่าบวกหรือลบโดยตรง
- `transactions[].remaining_credit` เป็นยอดคงเหลือหลัง transaction นั้น โดย preprocess ตามลำดับรายการ
- `reference_source` และ `reference_id` ต้องเก็บไว้เพื่อให้ตรวจสอบย้อนกลับได้ว่า credit มาจากหรือตัดจากรายการใด
- `transactions[].id` เก็บไว้เป็น stable identity สำหรับ deduplicate, UI row key และการอ้างอิงย้อนกลับจากรายการ refund/void แม้ไม่ต้องแสดงให้ผู้ใช้เห็น
- `remaining_credit` เป็นค่า precompute จาก transaction และ flatten ไว้ที่ root เพื่อให้ frontend ใช้ได้ทันที
- `status` เป็นค่า precompute ระดับ root เพื่อให้ frontend แสดง lifecycle ของ customer package ได้ทันที โดยยังต้องยืนยันชุด status ที่ใช้จริง
- ไม่ต้องมี `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at` หรือ `deleted_by` ใน view
- เอกสารนี้เป็น read model; source sheets เดิมยังเป็นแหล่งข้อมูลต้นทาง

## Source mapping (เบื้องต้น)

```text
CustomerPackages.id                    -> id
CustomerPackages.customer_id           -> customer_id
CustomerPackages.start_date            -> start_date
CustomerPackages.expiry_date           -> expiry_date
CustomerPackages.service_day           -> service_day
CustomerPackages.time_slot             -> time_slot
CustomerPackages.invoice_id            -> invoice_id
CustomerPackages.notes                 -> notes
Customers.CustomerID/Name/Phone/Address -> customer_id/customer_name/customer_phone/customer_address
Packages.package_code/name/eligible_service -> package_code/package_name/package_eligible_service
PackageTransactions.*                  -> transactions[]
```

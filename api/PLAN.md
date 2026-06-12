error นี้หมายความว่าอะไร

  Vercel ฟรี (Hobby plan) จำกัด Serverless Function ได้สูงสุด 12
  ตัวต่อ 1 deployment — และ Vercel แบบ zero-config จะแปลง
  ทุกไฟล์ .ts/.js ที่อยู่ใต้ api/ ให้กลายเป็น function หนึ่งตัว
  (ไม่ใช่แค่ไฟล์ route)

  ผมนับใน tree ที่ deploy (features = 439ab61) แล้ว: ไฟล์ใต้ api/
  ที่เข้าข่ายเป็น function มี 48 ไฟล์ → เกิน 12 → deploy ไม่ผ่าน

  จุดสำคัญ: คุณอาจไม่ต้องจ่ายเงิน

  ใน 48 ไฟล์นั้น route จริง ๆ มีแค่ ~10 ตัว (ต่ำกว่า 12 ด้วยซ้ำ):
  appointments/{index,[id]}, invoices/{index,[id],
  [id]/payments/{index,[paymentId]}},
  customers.js, customers/[id].js, gviz.js, write.js
  ที่เหลือ ~38 ไฟล์เป็น โค้ดช่วย ที่ไม่ควรเป็น endpoint แต่โดน Vercel
  นับด้วยเพราะวางไว้ใต้ api/:
  - api/modules/** (logic), api/shared/** (infra),
  api/schemas/*.js (9 ไฟล์)

  repo นี้ไม่มี vercel.json/.vercelignore เลย
  และมีร่องรอยว่าทีมเคยใช้ทริก _ มาก่อน (api/_gviz.js — ไฟล์ที่ขึ้นต้น _
  Vercel จะไม่นับเป็น function แต่ยัง import ได้)

  ทางแก้ (3 ทาง)

  ถ้าทำให้ Vercel เลิกนับไฟล์ helper จะเหลือ ~10 function →
  อยู่ใต้ลิมิต 12 → deploy ได้ฟรี ไม่ต้องอัป Pro:

  1. ย้าย modules//shared//schemas/ ออกไปนอก api/ (เช่น
  webapp-vue/server/) — route import เข้ามา Vercel จะ bundle
  ให้เอง วิธีนี้ตรงตามแนวทาง Vercel ที่สุด แต่ต้องแก้ import path ทั้งหมด
  + อัปเดต CLAUDE.md และกระทบไฟล์ invoices (ต้องคุยกับ session
  นั้น)
  2. เติม _ นำหน้าโฟลเดอร์ helper (api/_modules, api/_shared,
  api/_schemas) — ตามแบบ _gviz.js เดิม คงทุกอย่างไว้ใต้ api/
  แต่ก็ต้องแก้ import path เหมือนกัน
  3. อัปเกรด Vercel Pro/Team — ไม่ต้องแก้โค้ด ลิมิตขยาย แต่มีค่าใช้จ่าย
  (เป็นสิ่งที่ error แนะนำ)

  จะให้ผมทำทางไหนครับ? ผมแนะนำ ทางที่ฟรี — ระหว่าง #1
  (สะอาดตามมาตรฐาน Vercel) กับ #2 (churn น้อยกว่า คงโครงใต้
  api/) แต่ทั้งคู่แตะ import และไฟล์ของ session invoices
  จึงอยากเช็คกับคุณก่อนลงมือ
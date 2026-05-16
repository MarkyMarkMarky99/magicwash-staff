หมายความว่าไฟล์ JavaScript หลักที่ build ออกมาใหญ่กว่า threshold
  ที่ Vite ตั้งเตือนไว้ คือ 500 kB หลัง minify

  ในเคสนี้ build ยังผ่านปกติ ไม่ใช่ error:

  (!) Some chunks are larger than 500 kB after minification

  ผลกระทบที่เป็นไปได้:

  - โหลดหน้าแรกช้าขึ้น โดยเฉพาะเน็ตมือถือ
  - browser ต้องดาวน์โหลด/parse JavaScript ก้อนใหญ่ขึ้น
  - ถ้า app โตขึ้นเรื่อย ๆ อาจควรแยกโค้ดเป็นหลาย chunk

  สาเหตุที่พบบ่อย:

  - import library ใหญ่ เช่น Firebase, chart, image/camera
    logic
  - route/page หลายหน้าถูกรวมเข้า bundle หลัก
  - ยังไม่ได้ lazy-load บาง page/component

  ตอนนี้ยังไม่ต้องกังวลมาก เพราะเป็น warning ไม่ใช่ build fail และไฟล์
  gzip อยู่ประมาณ 160 kB ซึ่งยังไม่แย่ แต่ในระยะยาวควรแก้ด้วยการทำ
  lazy loading route/component หรือแยก chunk สำหรับ Firebase/
  camera/gallery ออกจาก bundle แรก.

const {chromium,expect:baseExpect}=require('@playwright/test');
const expect=baseExpect.configure({timeout:45000});
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const dir=path.join(require('node:os').tmpdir(),'magicwash-order-pricelist-uat');
const auditPath=path.join(dir,'uat-result.json');const audit=JSON.parse(fs.readFileSync(auditPath,'utf8'));
const save=()=>fs.writeFileSync(auditPath,JSON.stringify(audit,null,2));
const pass=text=>{audit.checks.push(text);console.log('PASS '+text);save()};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(45000);
 page.on('pageerror',e=>console.log('PAGEERROR '+e.message));
 page.on('console',m=>{if(m.text().includes('MEDIA'))console.log(m.text())});
 await page.addInitScript(()=>{const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async args=>{try{return await original(args)}catch(e){console.log('MEDIA '+e.name+' '+e.message);throw e}}});
 try{
  if(!audit.navigationOrderId){
   await page.goto('http://localhost:3000/#/orders/new');
   await page.locator('#order-customer').click();
   await page.getByPlaceholder('ค้นหาลูกค้า',{exact:true}).fill('ทดสอบ');
   await page.getByRole('option',{name:/ทดสอบ.*Mock Customer/}).click();
   await page.locator('#order-received-date').fill('2026-09-06');await page.locator('#order-due-date').fill('2026-09-10');
   await page.getByRole('button',{name:/ซักรีด/}).click();
   await page.locator('#order-name').fill('UAT-NAV-PRICELIST-20260906');
   await page.locator('#order-note').fill('ทดสอบกลับหน้ารายละเอียดหลังสร้างออเดอร์ — ไม่ใช่งานลูกค้าจริง');
   const pending=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/work-orders'&&r.request().method()==='POST');
   await page.getByRole('button',{name:'สร้างออเดอร์',exact:true}).click();const r=await pending;const body=await r.json();
   assert.ok(r.ok(),JSON.stringify(body));audit.navigationOrderId=body.data.orderId;save();
   await page.waitForURL('**/#/orders/'+audit.navigationOrderId);
   await page.getByRole('button',{name:'เพิ่มรายการสินค้า',exact:true}).waitFor();
   await page.waitForTimeout(1000);
   assert.equal(page.url(),'http://localhost:3000/#/orders/'+audit.navigationOrderId);
   pass('Fresh real create redirects to its detail and stays there after form unmount');
  }
  await page.goto('http://localhost:3000/#/orders/'+audit.orderId);
  await expect(page.getByRole('img',{name:'ของลูกค้า',exact:true})).toBeVisible();
  await page.screenshot({path:dir+'/uat-order-with-photo-mobile.png'});
  await page.getByRole('button',{name:/เพิ่มรูป/}).click();await page.getByRole('button',{name:/น้ำหนัก/}).click();
  await page.getByRole('button',{name:'เปิดกล้อง',exact:true}).click();
  await expect(page.getByText(/ใส่น้ำหนักเป็นตัวเลขมากกว่า 0/)).toBeVisible();
  await page.locator('#order-image-weight').fill('2.5');await page.getByRole('button',{name:'เปิดกล้อง',exact:true}).click();
  await expect(page.getByRole('button',{name:'ถ่ายภาพ',exact:true})).toBeEnabled({timeout:45000});
  await page.waitForTimeout(600);
  assert.ok(page.url().includes('orderAction=photo-weight'));assert.ok(page.url().includes('weight=2.5'));
  await expect(page.getByRole('button',{name:'ถ่ายภาพ',exact:true})).toBeEnabled({timeout:45000});
  await page.getByRole('button',{name:'เสร็จสิ้น',exact:true}).click();await page.waitForURL('**/#/orders/'+audit.orderId);
  pass('Weight validation and 2.5kg camera continuation/close');
  const documentBrowser=await chromium.launch({headless:true,channel:'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  try{
   const documentPage=await documentBrowser.newPage({viewport:{width:390,height:844}});
   await documentPage.goto('http://localhost:3000/#/orders/'+audit.orderId+'?orderAction=photo-document');
   await expect(documentPage.getByRole('button',{name:'ถ่ายภาพ',exact:true})).toBeEnabled();
   await documentPage.getByRole('button',{name:'เสร็จสิ้น',exact:true}).click();
   await documentPage.waitForURL('**/#/orders/'+audit.orderId);
   pass('Document camera deep link opens and dismisses in a fresh browser session');
  }finally{await documentBrowser.close()}
  audit.cameraLimitation='Chrome synthetic camera: immediate stop/reopen after video.play returns NotFoundError, reproduced outside Vue with plain getUserMedia/video.play. Repeated camera use on real hardware remains unverified.';
  audit.status='passed';delete audit.failure;save();
 }catch(e){audit.status='failed';audit.failure=String(e);save();await page.screenshot({path:dir+'/extra-failure.png'});throw e;}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

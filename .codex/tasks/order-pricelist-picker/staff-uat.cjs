const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const dir = require('node:path').join(require('node:os').tmpdir(), 'magicwash-order-pricelist-uat');
fs.mkdirSync(dir,{recursive:true});
const auditPath = dir + '/uat-result.json';
const audit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf8')) : { marker:'UAT-PRICELIST-20260906', checks:[], itemIds:[] };
const save = () => fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2));
const pass = text => { audit.checks.push(text); console.log('PASS '+text); save(); };
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();
 page.setDefaultTimeout(45000);
 const errors=[];
 page.on('console',m=>{if(m.text().includes('[vite]'))console.log(m.text())});
 page.on('pageerror',e=>{errors.push(e.message);console.log('PAGEERROR '+e.message)});
 const picker=()=>page.getByRole('dialog',{name:'เลือกรายการสินค้าจากรายการราคา'});
 const form=()=>page.getByRole('dialog',{name:'เพิ่มรายการสินค้า',exact:true});
 const saveResponse=()=>page.waitForResponse(r=>new URL(r.url()).pathname==='/api/order-items' && r.request().method()==='POST');
 async function openPicker(){
  await page.getByRole('button',{name:'เพิ่มรายการสินค้า',exact:true}).click();
  await picker().getByRole('button',{name:/เลือก หมอนหนุนใยสังเคราะห์/}).waitFor();
 }
 async function choosePillow(){ await picker().getByRole('button',{name:/เลือก หมอนหนุนใยสังเคราะห์/}).click(); await form().getByLabel('จำนวน *',{exact:true}).waitFor(); }
 try {
  if(!audit.orderId){
   await page.goto('http://localhost:3000/#/orders/new');
   await page.locator('#order-customer').click();
   await page.getByPlaceholder('ค้นหาลูกค้า',{exact:true}).fill('ทดสอบ');
   await page.getByRole('option',{name:/ทดสอบ.*Mock Customer/}).click();
   await page.locator('#order-received-date').fill('2026-09-06');
   await page.locator('#order-due-date').fill('2026-09-10');
   await page.getByRole('button',{name:/ซักรีด/}).click();
   await page.locator('#order-quantity').fill('3');
   await page.locator('#order-name').fill(audit.marker);
   await page.locator('#order-note').fill('ทดสอบระบบเลือก pricelist และกล้องจำลอง — ไม่ใช่งานลูกค้าจริง');
   const createdResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/work-orders' && r.request().method()==='POST');
   await page.getByRole('button',{name:'สร้างออเดอร์',exact:true}).click();
   const r=await createdResponse;
   const body=await r.json();
   assert.ok(r.ok(),JSON.stringify(body));
   audit.orderId=body.data.orderId; audit.customerId=body.data.customerId; save();
   assert.equal(r.request().postDataJSON().customerId,'b1d4fc48');
   await page.waitForURL('**/#/orders/'+audit.orderId);
   pass('Created marked staff order for the explicit test customer through the UI');
  }else{await page.goto('http://localhost:3000/#/orders/'+audit.orderId);}
  await page.getByRole('button',{name:'เพิ่มรายการสินค้า',exact:true}).waitFor();
  await openPicker();
  await expect(picker().getByRole('button',{name:/^เลือก /})).toHaveCount(18);
  await picker().getByPlaceholder('ค้นหาชื่อ รหัส หรือประเภทผ้า',{exact:true}).fill('no-such-item-uat');
  await expect(picker().getByText('ไม่พบรายการที่ค้นหา',{exact:true})).toBeVisible();
  await expect(picker().getByRole('navigation',{name:'กรองตามหมวดหมู่'})).toBeVisible();
  await picker().getByRole('button',{name:'ล้างคำค้นหา',exact:true}).click();
  await picker().getByPlaceholder('ค้นหาชื่อ รหัส หรือประเภทผ้า',{exact:true}).fill('ITM-0001');
  await expect(picker().getByRole('button',{name:/^เลือก /})).toHaveCount(1);
  await choosePillow();
  await expect(form().getByLabel('จำนวน *',{exact:true})).toHaveValue('1');
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await form().getByRole('button',{name:'เปลี่ยนสินค้า',exact:true}).click();
  await choosePillow();
  await page.goBack();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  assert.equal(page.url(),'http://localhost:3000/#/orders/'+audit.orderId);
  pass('Active catalogue, search, empty filter controls, change selection and browser Back');
  await openPicker();
  await choosePillow();
  await expect(form().getByLabel('จำนวน *',{exact:true})).toHaveValue('1');
  await form().getByLabel('จำนวน *',{exact:true}).fill('0');
  await expect(form().getByRole('button',{name:'เพิ่มรายการลงออเดอร์',exact:true})).toBeDisabled();
  await form().getByLabel('จำนวน *',{exact:true}).fill('2');
  await form().getByLabel('คำแนะนำเพิ่มเติม',{exact:true}).fill(audit.marker+' first item');
  if(audit.itemIds.length===0){
   await page.route('**/api/order-items',route=>route.abort('failed'),{times:1});
   await form().getByRole('button',{name:'เพิ่มรายการลงออเดอร์',exact:true}).click();
   await expect(form().getByText(/Failed to fetch|fetch|Network/)).toBeVisible();
   await expect(form().getByLabel('จำนวน *',{exact:true})).toHaveValue('2');
   await expect(form().getByLabel('คำแนะนำเพิ่มเติม',{exact:true})).toHaveValue(audit.marker+' first item');
   const pending=saveResponse();
   await form().getByRole('button',{name:'เพิ่มรายการลงออเดอร์',exact:true}).click();
   const r=await pending; const body=await r.json();
   assert.ok(r.ok(),JSON.stringify(body));
   audit.itemIds.push(body.data.orderItemId); save();
   const payload=r.request().postDataJSON();
   assert.match(payload.itemId,/^[a-z0-9]{8}$/); assert.equal(payload.price,200); assert.equal(payload.quantity,2); assert.equal(payload.orderId,audit.orderId);
   await expect(page.locator('dialog[open]')).toHaveCount(0);
   pass('Save failure preserves inputs; retry persists quantity 2 with unchanged price 200 and the PriceList row id in itemId');
  }else{await form().getByRole('button',{name:'Close',exact:true}).click();}
  if(audit.itemIds.length===1){
   await openPicker();
   await picker().getByRole('button',{name:/เลือก ปลอกหมอนหนุน/}).click();
   await expect(form().getByLabel('จำนวน *',{exact:true})).toHaveValue('1');
   const pending=saveResponse();
   await form().getByRole('button',{name:'เพิ่มรายการลงออเดอร์',exact:true}).click();
   const r=await pending; const body=await r.json(); assert.ok(r.ok(),JSON.stringify(body));
   audit.itemIds.push(body.data.orderItemId); save();
   await expect(page.locator('dialog[open]')).toHaveCount(0);
   pass('Second item can be added immediately with fresh quantity and notes');
  }
  await page.reload();
  await page.getByRole('button',{name:'เพิ่มรายการสินค้า',exact:true}).waitFor();
  const detail=await (await context.request.get('http://localhost:3000/api/work-orders/'+audit.orderId)).json();
  for(const id of audit.itemIds) assert.ok(detail.data.items.some(item=>item.orderItemId===id));
  await page.screenshot({path:dir+'/uat-order-mobile.png'});
  pass('Both items remain after full page reload and API reread');
  await page.route('**/api/price-list?**',route=>route.abort('failed'),{times:1});
  await page.getByRole('button',{name:'เพิ่มรายการสินค้า',exact:true}).click();
  await picker().getByRole('button',{name:'ลองโหลดอีกครั้ง',exact:false}).waitFor();
  await picker().getByRole('button',{name:'ลองโหลดอีกครั้ง',exact:false}).click();
  await picker().getByRole('button',{name:/เลือก หมอนหนุนใยสังเคราะห์/}).waitFor();
  await page.reload();
  await picker().getByRole('button',{name:/เลือก หมอนหนุนใยสังเคราะห์/}).waitFor();
  await picker().getByRole('button',{name:'Close',exact:true}).click();
  await page.waitForURL('**/#/orders/'+audit.orderId);
  pass('Catalogue failure/retry and refreshed deep-link dismissal');
  if(!audit.imageId){
   await page.getByRole('button',{name:/เพิ่มรูป/}).click();
   await page.getByRole('button',{name:/ของลูกค้า/}).click();
   const shutter=page.getByRole('button',{name:'ถ่ายภาพ',exact:true});
   await expect(shutter).toBeEnabled({timeout:45000});
   await page.screenshot({path:dir+'/uat-camera-synthetic.png'});
   const imageResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/order-images' && r.request().method()==='POST',{timeout:90000});
   await shutter.click();
   const r=await imageResponse; const body=await r.json(); assert.ok(r.ok(),JSON.stringify(body));
   audit.imageId=body.data.orderImageId; save();
   await page.getByRole('button',{name:'เสร็จสิ้น',exact:true}).click();
   await page.waitForURL('**/#/orders/'+audit.orderId);
   await expect(page.getByRole('img',{name:'ของลูกค้า',exact:true})).toBeVisible();
   await page.reload();
   const image=page.getByRole('img',{name:'ของลูกค้า',exact:true});
   await expect(image).toBeVisible();
   await expect.poll(()=>image.evaluate(el=>el.complete && el.naturalWidth>0)).toBe(true);
   pass('Synthetic camera capture uploaded to Firebase and persisted through order-images; thumbnail survives reload');
  }
  await page.setViewportSize({width:1280,height:900});
  await openPicker();
  await page.screenshot({path:dir+'/uat-picker-desktop.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await picker().getByRole('button',{name:'Close',exact:true}).click();
  assert.deepEqual(errors,[]);
  pass('Desktop picker, no page errors or horizontal overflow');
  audit.status='passed'; delete audit.failure; save();
 }catch(e){audit.status='failed';audit.failure=String(e);save();await page.screenshot({path:dir+'/uat-failure.png'}).catch(()=>{});console.log((await page.locator('body').innerText()).slice(-4000));throw e;}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

const { chromium } = require('playwright');
(async () => {
 const browser = await chromium.launch({headless:true,channel:'chrome'});
 try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror', e => console.log('PAGEERROR '+e.message));
  await page.goto('http://localhost:3000/#/orders/5d977224?orderAction=item');
  const picker = page.getByRole('dialog', {name:'เลือกรายการสินค้าจากรายการราคา'});
  await picker.getByRole('button', {name:/เลือก หมอนหนุนใยสังเคราะห์/}).waitFor({timeout:45000});
  console.log(await picker.innerText());
  await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'magicwash-order-pricelist-uat/picker-mobile.png')});
  await picker.getByRole('button', {name:/เลือก หมอนหนุนใยสังเคราะห์/}).first().click();
  await page.getByLabel('จำนวน *', {exact:true}).waitFor();
  console.log('quantity='+await page.getByLabel('จำนวน *', {exact:true}).inputValue());
  console.log('dialogs='+await page.locator('dialog[open]').count());
  await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'magicwash-order-pricelist-uat/confirmation-mobile.png')});
  await page.getByRole('button',{name:'เปลี่ยนสินค้า',exact:true}).click();
  await picker.getByRole('button', {name:/เลือก หมอนหนุนใยสังเคราะห์/}).waitFor();
  await picker.getByRole('button', {name:'Close',exact:true}).click();
  await page.waitForURL('**/#/orders/5d977224');
  console.log('deep-link close='+page.url());
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});


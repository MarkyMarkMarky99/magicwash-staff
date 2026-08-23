<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { usePriceListStore } from '../stores/price-list.store'

defineOptions({ name: 'PriceListFormPage' })

const props = defineProps<{ id?: string }>()

const route = useRoute()
const router = useRouter()
const priceListStore = usePriceListStore()
const { items, error: storeError } = storeToRefs(priceListStore)

const item = reactive({
  category: '',
  subcategory: '',
  type: '',
  variant: '',
  name: '',
  wash: '',
  iron: '',
  dry: '',
  start: '',
  end: '',
})
const isActive = ref(false)
const allowsCredit = ref(false)

const itemCode = ref('')
const formError = ref<string | null>(null)
const initializing = ref(true)
const submitting = ref(false)

const isEdit = computed(() => Boolean(props.id))
const title = computed(() => (isEdit.value ? 'แก้ไขรายการราคา' : 'เพิ่มรายการราคา'))
const categories = computed(() => Array.from(new Set(items.value.map((entry) => entry.category))))
const subcategories = computed(() =>
  Array.from(
    new Set(
      items.value
        .filter((entry) => entry.category === item.category)
        .map((entry) => entry.subcategory),
    ),
  ),
)

watch(
  () => item.category,
  (next, previous) => {
    if (next !== previous && previous && !subcategories.value.includes(item.subcategory)) {
      item.subcategory = ''
    }
  },
)

function fillForm(source: (typeof items.value)[number]) {
  itemCode.value = source.itemCode
  item.category = source.category
  item.subcategory = source.subcategory
  item.type = source.itemType
  item.variant = source.variant ?? ''
  item.name = source.displayNameTh
  item.wash = source.washDryIronPrice === null ? '' : String(source.washDryIronPrice)
  item.iron = source.ironOnlyPrice === null ? '' : String(source.ironOnlyPrice)
  item.dry = source.dryCleanPrice === null ? '' : String(source.dryCleanPrice)
  allowsCredit.value = source.creditEligible
  item.start = source.effectiveFrom
  item.end = source.effectiveTo ?? ''
  isActive.value = source.active
}

function nullablePrice(value: string): number | null {
  if (value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error('กรุณาระบุราคาเป็นตัวเลข')
  return parsed
}

function createPayload() {
  return {
    category: item.category,
    subcategory: item.subcategory,
    itemType: item.type,
    variant: item.variant === '' ? null : item.variant,
    displayNameTh: item.name,
    washDryIronPrice: nullablePrice(item.wash),
    ironOnlyPrice: nullablePrice(item.iron),
    dryCleanPrice: nullablePrice(item.dry),
    creditEligible: allowsCredit.value,
    effectiveFrom: item.start,
    effectiveTo: item.end === '' ? null : item.end,
    active: isActive.value,
  }
}

function returnToPriceList() {
  void router.push('/price-list')
}

async function submitForm() {
  formError.value = null
  submitting.value = true
  try {
    const payload = createPayload()
    if (isEdit.value && props.id) {
      await priceListStore.update(props.id, payload)
    } else {
      await priceListStore.create(payload)
    }
    await router.push('/price-list')
  } catch (reason) {
    formError.value = reason instanceof Error ? reason.message : 'Unable to save price list item'
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  if (!props.id) {
    const category = route.query.category
    if (typeof category === 'string' && category) item.category = category
  }
  await priceListStore.load()
  if (props.id) {
    const source = items.value.find((candidate) => candidate.id === props.id)
    if (source) {
      fillForm(source)
    } else {
      formError.value = storeError.value ?? 'ไม่พบรายการราคานี้'
    }
  }
  initializing.value = false
})
</script>

<template>
  <div class="pricelist-prototype-app app">
    <header class="top">
      <div class="brand">
        <div class="brand-mark"><img src="data:image/png;base64,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" alt="Magicwash Laundry"></div>
        <button class="close" aria-label="ปิด" type="button" @click="returnToPriceList">×</button>
      </div>
      <div class="eyebrow">Price list / {{ isEdit ? 'edit item' : 'new item' }}</div>
      <h1>{{ title }}</h1>
      <div class="helper"><b>•</b><span>ปรับข้อมูลที่หน้าเคาน์เตอร์ได้ทันที • รหัสรายการแก้ไขไม่ได้</span></div>
    </header>
    <main>
      <div class="form-intro"><p>รายละเอียดรายการสำหรับหน้าเคาน์เตอร์</p><span class="stamp">พร้อมบันทึก</span></div>
      <form>
        <fieldset class="fieldset">
          <div class="section-label">รายการ</div>
          <div class="grid-2">
            <div class="field"><label for="category">หมวดหมู่ <span class="required">*</span></label><select id="category" v-model="item.category" class="control"><option value="" disabled>เลือกหมวดหมู่</option><option v-for="category in categories" :key="category" :value="category">{{ category }}</option></select></div>
            <div class="field"><label for="subcategory">หมวดหมู่ย่อย <span class="required">*</span></label><select id="subcategory" v-model="item.subcategory" class="control"><option value="" disabled>เลือกหมวดหมู่ย่อย</option><option v-for="subcategory in subcategories" :key="subcategory" :value="subcategory">{{ subcategory }}</option></select></div>
          </div>
          <div class="grid-2">
            <div class="field"><label for="type">ประเภทสินค้า <span class="required">*</span></label><input id="type" v-model="item.type" class="control"></div>
            <div class="field"><label for="variant">รูปแบบ</label><input id="variant" v-model="item.variant" class="control" placeholder="เว้นว่างได้"></div>
          </div>
          <div class="field item-name"><label for="name">ชื่อแสดงภาษาไทย <span class="required">*</span></label><input id="name" v-model="item.name" class="control"></div>
        </fieldset>
        <section class="price-panel" aria-labelledby="price-heading">
          <div class="price-title"><h2 id="price-heading">ราคาตามบริการ</h2><span>เว้นว่างได้ทุกช่อง</span></div>
          <div class="price-grid">
            <div class="price-field"><label for="wash">ซัก อบ รีด</label><div class="money"><input id="wash" v-model="item.wash" inputmode="decimal"><span>บาท</span></div></div>
            <div class="price-field"><label for="iron">รีดอย่างเดียว</label><div class="money"><input id="iron" v-model="item.iron" inputmode="decimal"><span>บาท</span></div></div>
            <div class="price-field"><label for="dry">ดรายคลีน</label><div class="money"><input id="dry" v-model="item.dry" inputmode="decimal"><span>บาท</span></div></div>
          </div>
        </section>
        <fieldset class="fieldset">
          <div class="section-label">ช่วงเวลาราคา</div>
          <div class="grid-2 date-row">
            <div class="field"><label for="start">เริ่มใช้ราคา <span class="required">*</span></label><div class="date-wrap"><input id="start" v-model="item.start" class="control" type="date"></div></div>
            <div class="field"><label for="end">สิ้นสุดราคา (ถ้ามี)</label><div class="date-wrap"><input id="end" v-model="item.end" class="control" type="date" placeholder="เลือกวันที่"></div></div>
          </div>
        </fieldset>
        <section class="switches" aria-label="การตั้งค่า">
          <div class="switch-row">
            <div class="switch-text"><strong>เปิดใช้งานรายการนี้</strong><span>ปิดสวิตช์เมื่อเลิกรับรายการนี้ — ไม่มีการลบข้อมูล</span></div>
            <button class="switch" :class="{ on: isActive }" type="button" role="switch" :aria-checked="isActive" aria-label="เปิดใช้งานรายการนี้" @click="isActive = !isActive"></button>
          </div>
          <div class="switch-row">
            <div class="switch-text"><strong>อนุญาตเครดิต</strong><span>กำหนดว่ารายการนี้ใช้กับลูกค้าเครดิตได้หรือไม่</span></div>
            <button class="switch" :class="{ on: allowsCredit }" type="button" role="switch" :aria-checked="allowsCredit" aria-label="อนุญาตเครดิต" @click="allowsCredit = !allowsCredit"></button>
          </div>
        </section>
        <aside class="system-note"><span class="code">#</span><div><strong>รหัสรายการ (จากระบบ)</strong>{{ isEdit ? itemCode : 'ระบบจะกำหนดเมื่อบันทึก' }}</div></aside>
        <p v-if="formError" class="form-error">{{ formError }}</p>
      </form>
    </main>
    <div class="actions"><button class="cancel" type="button" @click="returnToPriceList">ยกเลิก</button><button class="save" type="button" :disabled="submitting || initializing" @click="submitForm">{{ submitting ? 'กำลังบันทึก...' : initializing ? 'กำลังเตรียมแบบฟอร์ม...' : 'บันทึกราคา' }}</button></div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap');

:global(html) { background:#e4efed; }
:global(body) { margin:0; min-width:320px; background:linear-gradient(145deg,#dcecea 0,#f6faf9 58%,#dbeee9 100%); }
.pricelist-prototype-app { --ink:#073f38; --teal:#00564b; --teal-2:#007a69; --mint:#9df5df; --lime:#b2df26; --paper:#f7fbfa; --line:#cae0dc; --quiet:#5f7772; --red:#c94e3d; width:100%; max-width:390px; min-height:100vh; margin:0 auto; color:var(--ink); font-family:"Noto Sans Thai",system-ui,sans-serif; background:var(--paper); box-shadow:0 0 0 1px rgba(0,79,69,.05),0 12px 44px rgba(0,66,59,.16); padding-bottom:96px; overflow-x:hidden; }
.pricelist-prototype-app * { box-sizing:border-box; }
.pricelist-prototype-app button,.pricelist-prototype-app input,.pricelist-prototype-app select { font:inherit; }
.top { position:relative; height:166px; padding:20px 20px 19px; color:white; background:var(--teal); overflow:hidden; }
.top::before { content:""; position:absolute; width:270px; height:270px; right:-138px; top:-112px; border:34px solid rgba(157,245,223,.17); border-radius:50%; }
.top::after { content:""; position:absolute; width:42px; height:42px; right:38px; bottom:-21px; border-radius:50%; background:var(--lime); box-shadow:-22px -11px 0 rgba(178,223,38,.22); }
.brand { position:relative; z-index:1; display:flex; align-items:center; justify-content:space-between; }
.brand img { width:59px; height:42px; object-fit:cover; object-position:center; transform:scale(1.48); transform-origin:left center; mix-blend-mode:normal; }
.brand-mark { width:86px; height:43px; overflow:hidden; display:flex; align-items:center; }
.close { width:34px; height:34px; display:grid; place-items:center; color:white; border:1px solid rgba(255,255,255,.35); border-radius:50%; background:transparent; font-size:23px; line-height:1; }
.eyebrow { position:relative; z-index:1; margin:18px 0 2px; color:var(--mint); font-family:Manrope,sans-serif; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
h1 { position:relative; z-index:1; margin:0; font:800 25px/1.22 Manrope,"Noto Sans Thai",sans-serif; letter-spacing:-.035em; }
.helper { position:relative; z-index:1; display:flex; align-items:flex-start; gap:7px; margin-top:6px; max-width:315px; color:#d8eeea; font-size:12px; line-height:1.4; }
.helper b { color:var(--mint); font-size:14px; line-height:1.15; }
main { padding:21px 20px 0; }
.form-intro { display:flex; align-items:center; justify-content:space-between; padding:0 1px 18px; }
.form-intro p { margin:0; color:var(--quiet); font-size:12px; }
.form-intro .stamp { color:var(--teal); font:800 10px Manrope,sans-serif; letter-spacing:.1em; }
.fieldset { margin:0; padding:0; border:0; }
.section-label { display:flex; align-items:center; gap:10px; margin:0 0 12px; color:var(--teal); font:800 12px Manrope,"Noto Sans Thai",sans-serif; letter-spacing:.03em; }
.section-label::after { content:""; height:1px; flex:1; background:var(--line); }
.grid-2 { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:13px; }
.field { min-width:0; margin-bottom:15px; }
label { display:block; margin-bottom:6px; font-size:12px; font-weight:700; color:#234f49; }
.required { color:var(--teal-2); }
.control { display:block; width:100%; min-width:0; height:47px; padding:0 12px; color:var(--ink); border:1px solid #a9c9c3; border-radius:10px; outline:0; background:#fff; font-size:14px; box-shadow:0 1px 0 rgba(0,79,69,.02); }
.control:focus { border-color:var(--teal-2); box-shadow:0 0 0 3px rgba(0,122,105,.14); }
select.control { padding-right:27px; background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='m1 1 5 5 5-5' fill='none' stroke='%2300564b' stroke-width='1.7' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 11px center; appearance:none; }
input::placeholder { color:#9aacaa; opacity:1; }
.item-name { margin-bottom:23px; }
.price-panel { position:relative; margin:2px -20px 25px; padding:21px 20px 20px; background:var(--ink); color:white; overflow:hidden; }
.price-panel::before { content:""; position:absolute; left:-41px; top:31px; width:104px; height:104px; border:1px solid rgba(157,245,223,.25); border-radius:50%; }
.price-panel::after { content:""; position:absolute; right:-32px; bottom:-47px; width:146px; height:146px; border:22px solid rgba(178,223,38,.22); border-radius:50%; }
.price-title { position:relative; z-index:1; display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:15px; }
.price-title h2 { margin:0; font:800 17px/1.2 Manrope,"Noto Sans Thai",sans-serif; letter-spacing:-.025em; }
.price-title span { color:#b9d8d2; font-size:11px; }
.price-grid { position:relative; z-index:1; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
.price-field { min-width:0; }
.price-field label { min-height:34px; margin:0 0 7px; color:#d8f2ed; font-size:11px; line-height:1.32; }
.money { position:relative; }
.money input { width:100%; height:49px; min-width:0; padding:0 28px 0 10px; color:#fff; border:1px solid rgba(157,245,223,.55); border-radius:8px; outline:0; background:rgba(255,255,255,.08); font:700 16px Manrope,sans-serif; }
.money input:focus { border-color:var(--mint); box-shadow:0 0 0 3px rgba(157,245,223,.16); }
.money span { position:absolute; right:9px; top:15px; color:var(--mint); font-size:10px; }
.date-row { margin-bottom:25px; }
.date-wrap { position:relative; }
.date-wrap input { padding-right:34px; }
.switches { margin:0 -20px 10px; padding:21px 20px 0; border-top:1px solid var(--line); background:#edf7f5; }
.switch-row { display:flex; align-items:center; gap:13px; padding:0 0 19px; margin-bottom:18px; border-bottom:1px solid #cfe2de; }
.switch-text { flex:1; min-width:0; }
.switch-text strong { display:block; font-size:14px; }
.switch-text span { display:block; margin-top:2px; color:var(--quiet); font-size:11px; line-height:1.42; }
.switch { position:relative; flex:0 0 auto; width:47px; height:28px; border:0; border-radius:20px; background:#b7cac6; box-shadow:inset 0 0 0 1px rgba(0,79,69,.08); }
.switch::after { content:""; position:absolute; width:22px; height:22px; top:3px; left:3px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.25); transition:.18s ease; }
.switch.on { background:var(--teal-2); }
.switch.on::after { transform:translateX(19px); }
.system-note { display:flex; align-items:center; gap:10px; margin:19px 0 17px; padding:11px 12px; color:#57746e; border-radius:8px; background:#f0f5f4; font-size:11px; line-height:1.35; }
.system-note .code { display:grid; place-items:center; flex:0 0 auto; width:25px; height:25px; color:var(--teal); border-radius:7px; background:#d8ebe7; font:800 12px Manrope,sans-serif; }
.system-note strong { display:block; color:#42655f; font-size:11px; }
.form-error { margin:12px 0 0; padding:10px 12px; border-radius:8px; background:color-mix(in srgb, var(--red) 12%, white); color:var(--red); font-size:12px; line-height:1.4; }
.actions { position:fixed; z-index:10; bottom:0; left:50%; width:min(390px,100%); transform:translateX(-50%); display:flex; gap:10px; padding:12px 20px 15px; border-top:1px solid rgba(170,202,196,.7); background:rgba(247,251,250,.96); box-shadow:0 -5px 18px rgba(0,79,69,.07); backdrop-filter:blur(10px); }
.actions button { height:49px; border-radius:10px; font-weight:800; font-size:14px; cursor:pointer; }
.cancel { width:94px; color:var(--teal); border:1px solid #a6c9c1; background:#fff; }
.save { flex:1; color:var(--ink); border:1px solid var(--lime); background:var(--lime); box-shadow:0 4px 0 #789d0b; }
.save:focus-visible,.cancel:focus-visible,.close:focus-visible,.switch:focus-visible { outline:3px solid #eab308; outline-offset:2px; }
@media (max-width:350px) { main { padding-left:16px; padding-right:16px; } .price-panel,.switches { margin-left:-16px; margin-right:-16px; padding-left:16px; padding-right:16px; } .top { padding-left:16px; padding-right:16px; } .actions { padding-left:16px; padding-right:16px; } .grid-2 { gap:10px; } .control { padding-left:9px; padding-right:9px; } }
@media (prefers-reduced-motion:reduce) { *,*::before,*::after { transition:none!important; } }
</style>

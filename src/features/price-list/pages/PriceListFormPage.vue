<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import FormInput from '@/shared/components/FormInput.vue'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
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
  <FormOverlay
    :open="true"
    :title="title"
    :eyebrow="`Price list / ${isEdit ? 'edit item' : 'new item'}`"
    helper-text="ปรับข้อมูลที่หน้าเคาน์เตอร์ได้ทันที • รหัสรายการแก้ไขไม่ได้"
    submit-label="บันทึกราคา"
    :is-submitting="submitting"
    :is-submit-disabled="initializing"
    :close-on-backdrop="false"
    @close="returnToPriceList"
    @submit="submitForm"
  >
    <div class="price-list-form">
      <main>
        <div class="form-intro"><p>รายละเอียดรายการสำหรับหน้าเคาน์เตอร์</p><span class="stamp">พร้อมบันทึก</span></div>
        <div>
        <fieldset class="fieldset">
          <div class="section-label">รายการ</div>
          <div class="grid-2">
            <div class="field"><label for="category">หมวดหมู่ <span class="required">*</span></label><select id="category" v-model="item.category" class="control"><option value="" disabled>เลือกหมวดหมู่</option><option v-for="category in categories" :key="category" :value="category">{{ category }}</option></select></div>
            <div class="field"><label for="subcategory">หมวดหมู่ย่อย <span class="required">*</span></label><select id="subcategory" v-model="item.subcategory" class="control"><option value="" disabled>เลือกหมวดหมู่ย่อย</option><option v-for="subcategory in subcategories" :key="subcategory" :value="subcategory">{{ subcategory }}</option></select></div>
          </div>
          <div class="grid-2">
            <FormInput id="type" v-model="item.type" class="field" label="ประเภทสินค้า *" />
            <FormInput id="variant" v-model="item.variant" class="field" label="รูปแบบ" placeholder="เว้นว่างได้" />
          </div>
          <FormInput id="name" v-model="item.name" class="field item-name" label="ชื่อแสดงภาษาไทย *" />
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
            <FormInput id="start" v-model="item.start" class="field" label="เริ่มใช้ราคา *" type="date" />
            <FormInput id="end" v-model="item.end" class="field" label="สิ้นสุดราคา (ถ้ามี)" type="date" placeholder="เลือกวันที่" />
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
        <p v-if="formError" class="form-error">{{ formError }}</p>
        </div>
      </main>
    </div>
  </FormOverlay>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap');

.price-list-form { --ink:#073f38; --teal:#00564b; --teal-2:#007a69; --mint:#9df5df; --lime:#b2df26; --line:#cae0dc; --quiet:#5f7772; --red:#c94e3d; color:var(--ink); font-family:"Noto Sans Thai",system-ui,sans-serif; }
.price-list-form * { box-sizing:border-box; }
.price-list-form button,.price-list-form input,.price-list-form select { font:inherit; }
.form-intro { display:flex; align-items:center; justify-content:space-between; padding:0 1px 18px; }
.form-intro p { margin:0; color:var(--quiet); font-size:12px; }
.form-intro .stamp { color:var(--teal); font:700 10px "Noto Sans Thai",Manrope,sans-serif; letter-spacing:.1em; }
.fieldset { margin:0; padding:0; border:0; }
.section-label { display:flex; align-items:center; gap:10px; margin:0 0 12px; color:var(--teal); font:700 12px "Noto Sans Thai",Manrope,sans-serif; letter-spacing:.03em; }
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
.price-title h2 { margin:0; font:700 17px/1.2 "Noto Sans Thai",Manrope,sans-serif; letter-spacing:-.025em; }
.price-title span { color:#b9d8d2; font-size:11px; }
.price-grid { position:relative; z-index:1; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
.price-field { min-width:0; }
.price-field label { min-height:34px; margin:0 0 7px; color:#d8f2ed; font-size:11px; line-height:1.32; }
.money { position:relative; }
.money input { width:100%; height:49px; min-width:0; padding:0 28px 0 10px; color:#fff; border:1px solid rgba(157,245,223,.55); border-radius:8px; outline:0; background:rgba(255,255,255,.08); font:700 16px "Noto Sans Thai",Manrope,sans-serif; }
.money input:focus { border-color:var(--mint); box-shadow:0 0 0 3px rgba(157,245,223,.16); }
.money span { position:absolute; right:9px; top:15px; color:var(--mint); font-size:10px; }
.date-row { margin-bottom:25px; }
.switches { margin:0 -20px 10px; padding:21px 20px 0; border-top:1px solid var(--line); background:#edf7f5; }
.switch-row { display:flex; align-items:center; gap:13px; padding:0 0 19px; margin-bottom:18px; border-bottom:1px solid #cfe2de; }
.switch-text { flex:1; min-width:0; }
.switch-text strong { display:block; font-size:14px; }
.switch-text span { display:block; margin-top:2px; color:var(--quiet); font-size:11px; line-height:1.42; }
.switch { position:relative; flex:0 0 auto; width:47px; height:28px; border:0; border-radius:20px; background:#b7cac6; box-shadow:inset 0 0 0 1px rgba(0,79,69,.08); }
.switch::after { content:""; position:absolute; width:22px; height:22px; top:3px; left:3px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.25); transition:.18s ease; }
.switch.on { background:var(--teal-2); }
.switch.on::after { transform:translateX(19px); }
.form-error { margin:12px 0 0; padding:10px 12px; border-radius:8px; background:color-mix(in srgb, var(--red) 12%, white); color:var(--red); font-size:12px; line-height:1.4; }
.switch:focus-visible { outline:3px solid #eab308; outline-offset:2px; }
@media (max-width:350px) { .price-panel,.switches { margin-left:-16px; margin-right:-16px; padding-left:16px; padding-right:16px; } .grid-2 { gap:10px; } .control { padding-left:9px; padding-right:9px; } }
@media (prefers-reduced-motion:reduce) { *,*::before,*::after { transition:none!important; } }
</style>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import FormInput from '@/shared/components/FormInput.vue'
import FormSwitch from '@/shared/components/FormSwitch.vue'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
import { serviceTypeSchema } from '@contracts/shared/service-type.schema'
import { usePriceListStore } from '../stores/price-list.store'
import {
  createPriceListPayload,
  updatePriceListPayload,
  type PriceListCreateMode,
  type PriceListFormState,
} from '../utils/price-list-form-payload'

defineOptions({ name: 'PriceListFormPage' })

const props = defineProps<{ id?: string }>()

const route = useRoute()
const router = useRouter()
const priceListStore = usePriceListStore()
const { items, error: storeError, truncated } = storeToRefs(priceListStore)

const item = reactive<PriceListFormState>({
  itemCode: '',
  category: '',
  subcategory: '',
  itemType: '',
  variant: '',
  displayNameTh: '',
  displayNameEn: '',
  serviceType: 'WSIR',
  priceGroup: 'DEFAULT',
  unit: '',
  price: '',
  creditEligible: false,
  effectiveFrom: '',
  effectiveTo: '',
  active: false,
})
const createMode = ref<PriceListCreateMode>('new')
const existingItemQuery = ref('')

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
const canSelectExistingItems = computed(() => !truncated.value && !storeError.value && !initializing.value)
const existingItems = computed(() => {
  const query = existingItemQuery.value.trim().toLocaleLowerCase('th-TH')
  if (!query) return items.value
  return items.value.filter((candidate) =>
    [candidate.itemCode, candidate.displayNameTh, candidate.displayNameEn]
      .map((value) => String(value ?? '').toLocaleLowerCase('th-TH'))
      .some((value) => value.includes(query)),
  )
})
const serviceOptions = serviceTypeSchema.options.map((value) => ({
  value,
  label: { WSIR: 'ซัก อบ รีด', IRON: 'รีดอย่างเดียว', DRCL: 'ดรายคลีน', WASH: 'ซัก' }[value],
}))
const formValid = computed(() =>
  Boolean(
    item.category
    && item.subcategory
    && item.itemType
    && item.displayNameTh
    && item.serviceType
    && item.priceGroup
    && item.effectiveFrom
    && String(item.price).trim() !== ''
    && Number.isFinite(Number(item.price))
    && Number(item.price) >= 0
    && (isEdit.value || createMode.value === 'new' || item.itemCode),
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
  item.itemCode = source.itemCode
  item.category = source.category
  item.subcategory = source.subcategory
  item.itemType = source.itemType
  item.variant = source.variant ?? ''
  item.displayNameTh = source.displayNameTh
  item.displayNameEn = source.displayNameEn ?? ''
  item.serviceType = source.serviceType
  item.priceGroup = source.priceGroup
  item.unit = source.unit ?? ''
  item.price = String(source.price)
  item.creditEligible = source.creditEligible
  item.effectiveFrom = source.effectiveFrom
  item.effectiveTo = source.effectiveTo ?? ''
  item.active = source.active
}

function selectExistingItem(source: (typeof items.value)[number]) {
  item.itemCode = source.itemCode
  item.category = source.category
  item.subcategory = source.subcategory
  item.itemType = source.itemType
  item.variant = source.variant ?? ''
  item.displayNameTh = source.displayNameTh
  item.displayNameEn = source.displayNameEn ?? ''
}

function setCreateMode(mode: PriceListCreateMode) {
  if (isEdit.value || (mode === 'existing' && !canSelectExistingItems.value)) return
  createMode.value = mode
  if (mode === 'new') item.itemCode = ''
}

function returnToPriceList() {
  void router.push('/price-list')
}

async function submitForm() {
  formError.value = null
  submitting.value = true
  try {
    const payload = isEdit.value
      ? updatePriceListPayload(item)
      : createPriceListPayload(item, createMode.value)
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
    :is-submit-disabled="initializing || !formValid"
    :close-on-backdrop="false"
    @close="returnToPriceList"
    @submit="submitForm"
  >
    <div class="price-list-form">
      <main>
        <div class="form-intro"><p>รายละเอียดรายการสำหรับหน้าเคาน์เตอร์</p><span class="stamp">พร้อมบันทึก</span></div>
        <div>
        <fieldset v-if="!isEdit" class="fieldset mode-panel">
          <div class="section-label">รูปแบบรายการ</div>
          <div class="mode-grid">
            <button
              type="button"
              class="mode-button"
              :class="{ 'mode-button--selected': createMode === 'new' }"
              :disabled="isEdit"
              @click="setCreateMode('new')"
            >
              <strong>รายการใหม่</strong>
              <span>ระบบจะกำหนดรหัสรายการให้อัตโนมัติ</span>
            </button>
            <button
              type="button"
              class="mode-button"
              :class="{ 'mode-button--selected': createMode === 'existing' }"
              :disabled="!canSelectExistingItems"
              @click="setCreateMode('existing')"
            >
              <strong>เพิ่มราคาให้รายการเดิม</strong>
              <span>ค้นหาและเลือกจากรายการที่มีอยู่</span>
            </button>
          </div>
          <p v-if="truncated" class="form-error">รายการราคายังโหลดไม่ครบ จึงไม่สามารถเลือกรายการเดิมได้</p>
          <div v-if="createMode === 'new'" class="assigned-code">รหัสรายการจะถูกกำหนดโดยเซิร์ฟเวอร์หลังบันทึก</div>
          <div v-else class="existing-item-picker">
            <FormInput
              id="existing-item-search"
              v-model="existingItemQuery"
              class="field"
              label="ค้นหารายการเดิมด้วยชื่อหรือรหัส"
              placeholder="เช่น ปลอกผ้านวม หรือ ITM-0010"
            />
            <div class="existing-item-list">
              <button
                v-for="candidate in existingItems"
                :key="candidate.id"
                type="button"
                class="existing-item"
                :class="{ 'existing-item--selected': candidate.itemCode === item.itemCode }"
                @click="selectExistingItem(candidate)"
              >
                <span class="min-w-0"><strong>{{ candidate.displayNameTh }}</strong><small>{{ candidate.itemCode }} · {{ candidate.category }}</small></span>
                <span class="material-symbols-outlined" aria-hidden="true">check</span>
              </button>
              <p v-if="existingItems.length === 0" class="empty-selection">ไม่พบรายการเดิม</p>
            </div>
            <label for="selected-item-code">รหัสรายการที่เลือก</label>
            <input id="selected-item-code" v-model="item.itemCode" class="control" readonly>
          </div>
        </fieldset>
        <fieldset v-if="isEdit" class="fieldset">
          <div class="section-label">รหัสรายการ</div>
          <input id="item-code" v-model="item.itemCode" class="control field" readonly>
        </fieldset>
        <fieldset class="fieldset">
          <div class="section-label">ช่วงเวลาราคา</div>
          <div class="grid-2 date-row">
            <FormInput id="effective-from" v-model="item.effectiveFrom" class="field" label="เริ่มใช้ราคา *" type="date" />
            <FormInput id="effective-to" v-model="item.effectiveTo" class="field" label="สิ้นสุดราคา (ถ้ามี)" type="date" placeholder="เลือกวันที่" />
          </div>
        </fieldset>
        <fieldset class="fieldset">
          <div class="section-label">รายการ</div>
          <div class="grid-2">
            <div class="field"><label for="category">หมวดหมู่ <span class="required">*</span></label><select id="category" v-model="item.category" class="control"><option value="" disabled>เลือกหมวดหมู่</option><option v-for="category in categories" :key="category" :value="category">{{ category }}</option></select></div>
            <div class="field"><label for="subcategory">หมวดหมู่ย่อย <span class="required">*</span></label><select id="subcategory" v-model="item.subcategory" class="control"><option value="" disabled>เลือกหมวดหมู่ย่อย</option><option v-for="subcategory in subcategories" :key="subcategory" :value="subcategory">{{ subcategory }}</option></select></div>
          </div>
          <div class="grid-2">
            <FormInput id="item-type" v-model="item.itemType" class="field" label="ประเภทสินค้า *" />
            <FormInput id="variant" v-model="item.variant" class="field" label="รูปแบบ" placeholder="เว้นว่างได้" />
          </div>
          <FormInput id="display-name-th" v-model="item.displayNameTh" class="field" label="ชื่อแสดงภาษาไทย *" />
          <FormInput id="display-name-en" v-model="item.displayNameEn" class="field item-name" label="ชื่อแสดงภาษาอังกฤษ" placeholder="เว้นว่างได้" />
        </fieldset>
        <section class="price-panel" aria-labelledby="price-heading">
          <div class="price-title"><h2 id="price-heading">ราคาตามบริการ</h2><span>หนึ่งรายการต่อหนึ่งบริการ</span></div>
          <div class="price-grid">
            <div class="price-field"><label for="service-type">บริการ *</label><select id="service-type" v-model="item.serviceType" class="control"><option v-for="service in serviceOptions" :key="service.value" :value="service.value">{{ service.label }}</option></select></div>
            <div class="price-field"><label for="price-group">กลุ่มราคา *</label><input id="price-group" v-model="item.priceGroup" class="control"></div>
            <div class="price-field"><label for="price">ราคา *</label><div class="money"><input id="price" v-model="item.price" inputmode="decimal" type="number" min="0" step="any"><span>บาท</span></div></div>
          </div>
          <div class="grid-2 price-details">
            <div class="price-field"><label for="unit">หน่วย</label><input id="unit" v-model="item.unit" class="control" placeholder="เช่น piece"></div>
          </div>
        </section>
        <section class="switches" aria-label="การตั้งค่า">
          <FormSwitch
            v-model="item.active"
            label="เปิดใช้งานรายการนี้"
            description="ปิดสวิตช์เมื่อเลิกรับรายการนี้ — ไม่มีการลบข้อมูล"
          />
          <FormSwitch
            v-model="item.creditEligible"
            label="อนุญาตเครดิต"
            description="กำหนดว่ารายการนี้ใช้กับลูกค้าเครดิตได้หรือไม่"
          />
        </section>
        <p v-if="formError" class="form-error">{{ formError }}</p>
        </div>
      </main>
    </div>
  </FormOverlay>
</template>

<style scoped>
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
.mode-panel { margin-bottom:22px; }
.mode-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
.mode-button { display:flex; min-height:78px; flex-direction:column; align-items:flex-start; gap:5px; padding:12px; border:1px solid #a9c9c3; border-radius:10px; background:#fff; color:var(--ink); text-align:left; cursor:pointer; }
.mode-button span { color:var(--quiet); font-size:11px; line-height:1.35; }
.mode-button--selected { border-color:var(--teal-2); background:#edf7f5; box-shadow:0 0 0 2px rgba(0,122,105,.12); }
.mode-button:disabled { cursor:not-allowed; opacity:.5; }
.assigned-code { margin:0 0 12px; color:var(--quiet); font-size:12px; }
.existing-item-picker { margin-top:4px; }
.existing-item-list { max-height:190px; margin:-5px 0 13px; overflow-y:auto; border:1px solid var(--line); border-radius:10px; background:#fff; }
.existing-item { display:flex; width:100%; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border-bottom:1px solid var(--line); color:var(--ink); text-align:left; }
.existing-item:last-child { border-bottom:0; }
.existing-item strong,.existing-item small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.existing-item small { margin-top:2px; color:var(--quiet); font-size:11px; }
.existing-item .material-symbols-outlined { color:var(--teal-2); font-size:18px; opacity:0; }
.existing-item--selected { background:#edf7f5; }
.existing-item--selected .material-symbols-outlined { opacity:1; }
.empty-selection { margin:0; padding:12px; color:var(--quiet); font-size:12px; }
label { display:block; margin-bottom:6px; font-size:12px; font-weight:700; color:#234f49; }
.required { color:var(--teal-2); }
.control { display:block; width:100%; min-width:0; height:47px; padding:0 12px; color:var(--ink); border:1px solid #a9c9c3; border-radius:10px; outline:0; background:#fff; font-size:14px; box-shadow:0 1px 0 rgba(0,79,69,.02); }
.control:focus { border-color:var(--teal-2); box-shadow:0 0 0 3px rgba(0,122,105,.14); }
select.control { padding-right:27px; background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='m1 1 5 5 5-5' fill='none' stroke='%2300564b' stroke-width='1.7' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 11px center; appearance:none; }
.item-name { margin-bottom:23px; }
.price-panel { position:relative; margin:2px -20px 0; padding:21px 20px 20px; background:var(--ink); color:white; overflow:hidden; }
.price-panel::before { content:""; position:absolute; left:-41px; top:31px; width:104px; height:104px; border:1px solid rgba(157,245,223,.25); border-radius:50%; }
.price-panel::after { content:""; position:absolute; right:-32px; bottom:-47px; width:146px; height:146px; border:22px solid rgba(178,223,38,.22); border-radius:50%; }
.price-title { position:relative; z-index:1; display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:15px; }
.price-title h2 { margin:0; font:700 17px/1.2 "Noto Sans Thai",Manrope,sans-serif; letter-spacing:-.025em; }
.price-title span { color:#b9d8d2; font-size:11px; }
.price-grid { position:relative; z-index:1; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
.price-details { position:relative; z-index:1; margin-top:12px; }
.price-field { min-width:0; }
.price-field label { min-height:34px; margin:0 0 7px; color:#d8f2ed; font-size:11px; line-height:1.32; }
.money { position:relative; }
.money input { width:100%; height:49px; min-width:0; padding:0 28px 0 10px; color:#fff; border:1px solid rgba(157,245,223,.55); border-radius:8px; outline:0; background:rgba(255,255,255,.08); font:700 16px "Noto Sans Thai",Manrope,sans-serif; }
.money input:focus { border-color:var(--mint); box-shadow:0 0 0 3px rgba(157,245,223,.16); }
.money span { position:absolute; right:9px; top:15px; color:var(--mint); font-size:10px; }
.date-row { margin-bottom:10px; }
.switches { margin:0 -20px 10px; padding:21px 20px 0; border-top:1px solid var(--line); background:#edf7f5; }
.form-error { margin:12px 0 0; padding:10px 12px; border-radius:8px; background:color-mix(in srgb, var(--red) 12%, white); color:var(--red); font-size:12px; line-height:1.4; }
@media (max-width:420px) { .mode-grid { grid-template-columns:1fr; } }
@media (max-width:350px) { .price-panel,.switches { margin-left:-16px; margin-right:-16px; padding-left:16px; padding-right:16px; } .grid-2 { gap:10px; } .control { padding-left:9px; padding-right:9px; } }
@media (prefers-reduced-motion:reduce) { *,*::before,*::after { transition:none!important; } }
</style>

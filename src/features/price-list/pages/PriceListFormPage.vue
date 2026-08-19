<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import FormInput from '@/shared/components/FormInput.vue'
import PriceListPage from './PriceListPage.vue'
import { usePriceListStore } from '../stores/price-list.store'

defineOptions({ name: 'PriceListFormPage' })

const props = defineProps<{
  id?: string
}>()

const router = useRouter()
const priceListStore = usePriceListStore()
const { items, error: storeError } = storeToRefs(priceListStore)

const form = reactive({
  category: '',
  subcategory: '',
  itemType: '',
  variant: '',
  displayNameTh: '',
  washDryIronPrice: '',
  ironOnlyPrice: '',
  dryCleanPrice: '',
  creditEligible: false,
  effectiveFrom: '',
  effectiveTo: '',
  active: false,
})

const itemCode = ref('')
const formError = ref<string | null>(null)
const initializing = ref(true)
const submitting = ref(false)

const isEdit = computed(() => Boolean(props.id))
const title = computed(() => (isEdit.value ? 'แก้ไขรายการราคา' : 'เพิ่มรายการราคา'))
const categories = computed(() => Array.from(new Set(items.value.map((item) => item.category))))
const subcategories = computed(() =>
  Array.from(
    new Set(
      items.value
        .filter((item) => item.category === form.category)
        .map((item) => item.subcategory),
    ),
  ),
)

watch(
  () => form.category,
  (nextCategory, previousCategory) => {
    if (nextCategory !== previousCategory && previousCategory && !subcategories.value.includes(form.subcategory)) {
      form.subcategory = ''
    }
  },
)

function fillForm(item: (typeof items.value)[number]) {
  itemCode.value = item.itemCode
  form.category = item.category
  form.subcategory = item.subcategory
  form.itemType = item.itemType
  form.variant = item.variant ?? ''
  form.displayNameTh = item.displayNameTh
  form.washDryIronPrice = item.washDryIronPrice === null ? '' : String(item.washDryIronPrice)
  form.ironOnlyPrice = item.ironOnlyPrice === null ? '' : String(item.ironOnlyPrice)
  form.dryCleanPrice = item.dryCleanPrice === null ? '' : String(item.dryCleanPrice)
  form.creditEligible = item.creditEligible
  form.effectiveFrom = item.effectiveFrom
  form.effectiveTo = item.effectiveTo ?? ''
  form.active = item.active
}

function nullablePrice(value: string): number | null {
  if (value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error('กรุณาระบุราคาเป็นตัวเลข')
  return parsed
}

function createPayload() {
  return {
    category: form.category,
    subcategory: form.subcategory,
    itemType: form.itemType,
    variant: form.variant === '' ? null : form.variant,
    displayNameTh: form.displayNameTh,
    washDryIronPrice: nullablePrice(form.washDryIronPrice),
    ironOnlyPrice: nullablePrice(form.ironOnlyPrice),
    dryCleanPrice: nullablePrice(form.dryCleanPrice),
    creditEligible: form.creditEligible,
    effectiveFrom: form.effectiveFrom,
    effectiveTo: form.effectiveTo === '' ? null : form.effectiveTo,
    active: form.active,
  }
}

function closeForm() {
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
  await priceListStore.load()
  if (props.id) {
    const item = items.value.find((candidate) => candidate.id === props.id)
    if (item) {
      fillForm(item)
    } else {
      formError.value = storeError.value ?? 'ไม่พบรายการราคานี้'
    }
  }
  initializing.value = false
})
</script>

<template>
  <PriceListPage />

  <div class="form-layer is-open" aria-hidden="false">
    <div class="form-scrim" @click="closeForm" />
    <section class="form-panel" role="dialog" aria-modal="true" aria-labelledby="form-title">
      <div class="form-panel-header">
        <div>
          <div class="item-code">แก้ไขจากรายการจริง</div>
          <h2 id="form-title">{{ title }}</h2>
          <p>ปรับข้อมูลที่หน้าเคาน์เตอร์ได้ทันที • รหัสรายการแก้ไขไม่ได้</p>
        </div>
        <button class="icon-button" type="button" aria-label="ปิดแบบฟอร์ม" @click="closeForm">
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
        </button>
      </div>

      <div class="form-context">
        <span>รหัสรายการ (จากระบบ)</span>
        <strong>{{ isEdit ? itemCode : 'ระบบจะกำหนดเมื่อบันทึก' }}</strong>
      </div>

      <form @submit.prevent="submitForm">
        <div class="form-grid">
          <div class="field">
            <label for="form-category">หมวดหมู่</label>
            <select id="form-category" v-model="form.category" name="category">
              <option value="" disabled>เลือกหมวดหมู่</option>
              <option v-for="category in categories" :key="category" :value="category">{{ category }}</option>
            </select>
          </div>

          <div class="field">
            <label for="form-subcategory">หมวดหมู่ย่อย</label>
            <select id="form-subcategory" v-model="form.subcategory" name="subcategory">
              <option value="" disabled>เลือกหมวดหมู่ย่อย</option>
              <option v-for="subcategory in subcategories" :key="subcategory" :value="subcategory">{{ subcategory }}</option>
            </select>
          </div>

          <FormInput id="form-item-type" v-model="form.itemType" label="ประเภทสินค้า" />
          <FormInput id="form-variant" v-model="form.variant" label="รูปแบบ (ถ้ามี)" placeholder="เว้นว่างได้" />
          <div class="field wide">
            <FormInput id="form-display-name" v-model="form.displayNameTh" label="ชื่อแสดงภาษาไทย" />
          </div>

          <div class="price-edit-section">
            <span class="fieldset-label">ราคาตามบริการ (เว้นว่างได้)</span>
            <div class="price-edit-grid">
              <FormInput
                id="form-wash"
                v-model="form.washDryIronPrice"
                label="ซัก อบ รีด"
                type="number"
                min="0"
              />
              <FormInput
                id="form-iron"
                v-model="form.ironOnlyPrice"
                label="รีดอย่างเดียว"
                type="number"
                min="0"
              />
              <FormInput
                id="form-dry"
                v-model="form.dryCleanPrice"
                label="ดรายคลีน"
                type="number"
                min="0"
              />
            </div>
          </div>

          <FormInput id="form-effective-from" v-model="form.effectiveFrom" label="เริ่มใช้ราคา" type="date" />
          <FormInput id="form-effective-to" v-model="form.effectiveTo" label="สิ้นสุดราคา (ถ้ามี)" type="date" />

          <label class="switch-field wide" for="form-active">
            <span class="switch-copy">
              <strong>เปิดใช้งานรายการนี้</strong>
              <span>ปิดสวิตช์เมื่อเลิกรับรายการนี้ — ไม่มีการลบข้อมูล</span>
            </span>
            <input id="form-active" v-model="form.active" name="active" type="checkbox">
          </label>

          <label class="switch-field wide" for="form-credit">
            <span class="switch-copy">
              <strong>อนุญาตเครดิต</strong>
              <span>กำหนดว่ารายการนี้ใช้กับลูกค้าเครดิตได้หรือไม่</span>
            </span>
            <input id="form-credit" v-model="form.creditEligible" name="creditEligible" type="checkbox">
          </label>
        </div>

        <div v-if="formError" class="form-error" role="alert">{{ formError }}</div>

        <div class="form-actions">
          <button class="quiet-button" type="button" @click="closeForm">ยกเลิก</button>
          <button class="primary-button" type="submit" :disabled="submitting || initializing">
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">edit</span>
            {{ submitting ? 'กำลังบันทึก' : 'บันทึกราคา' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
.form-layer {
  position: absolute;
  inset: 0;
  z-index: 30;
  visibility: hidden;
  pointer-events: none;
}

.form-layer.is-open {
  visibility: visible;
  pointer-events: auto;
}

.form-scrim {
  position: absolute;
  inset: 0;
  background: var(--color-on-background);
  opacity: 0.18;
}

.form-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(100%, 560px);
  overflow: auto;
  padding: 22px;
  border-left: 1px solid var(--color-outline-variant);
  background: var(--color-surface);
  transform: translateX(100%);
  transition: transform 0.2s ease;
}

.form-layer.is-open .form-panel {
  transform: translateX(0);
}

.form-panel-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.form-panel-header h2 {
  margin: 0;
  font-family: var(--font-headline);
  font-size: 23px;
  letter-spacing: -0.02em;
}

.form-panel-header p {
  margin: 5px 0 0;
  color: var(--color-on-surface-variant);
  font-size: 12px;
  line-height: 1.45;
}

.item-code {
  color: var(--color-on-surface-variant);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.icon-button {
  display: inline-grid;
  place-items: center;
  width: 44px;
  min-width: 44px;
  padding: 0;
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius);
  background: var(--color-surface-container-lowest);
  color: var(--color-on-surface-variant);
}

.form-context {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 13px;
  background: var(--color-surface-container-low);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius);
}

.form-context span {
  color: var(--color-on-surface-variant);
  font-size: 12px;
}

.form-context strong {
  font-family: var(--font-headline);
  font-size: 15px;
  letter-spacing: 0.04em;
  text-align: right;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 12px;
}

.field {
  display: grid;
  min-width: 0;
  gap: 6px;
}

.field.wide {
  grid-column: 1 / -1;
}

.field label,
.fieldset-label {
  color: var(--color-on-surface-variant);
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 700;
}

.field select {
  width: 100%;
  height: 46px;
  padding: 0 12px;
  border: 1px solid var(--color-outline);
  border-radius: var(--radius);
  background: var(--color-surface-container-lowest);
  color: var(--color-on-surface);
}

.form-grid :deep(section) {
  display: grid;
  min-width: 0;
  gap: 6px;
}

.form-grid :deep(section > label) {
  color: var(--color-on-surface-variant);
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 700;
}

.form-grid :deep(section > .relative) {
  position: static;
}

.form-grid :deep(section input) {
  height: 46px;
  padding: 0 12px;
  border: 1px solid var(--color-outline);
  border-radius: var(--radius);
  background: var(--color-surface-container-lowest);
  color: var(--color-on-surface);
}

.form-grid :deep(section input:focus) {
  border-color: var(--color-primary);
  background: var(--color-surface-container-lowest);
}

.price-edit-section {
  display: grid;
  grid-column: 1 / -1;
  gap: 8px;
  margin-top: 2px;
}

.price-edit-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.price-edit-grid :deep(section) {
  gap: 5px;
}

.price-edit-grid :deep(section > label) {
  font-size: 11px;
  line-height: 1.25;
}

.price-edit-grid :deep(section input) {
  text-align: right;
}

.switch-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 54px;
  padding: 9px 11px;
  border: 1px solid var(--color-outline-variant);
  background: var(--color-surface-container-low);
}

.switch-copy {
  display: grid;
  gap: 3px;
}

.switch-copy strong {
  font-size: 13px;
}

.switch-copy span {
  color: var(--color-on-surface-variant);
  font-size: 11px;
  line-height: 1.3;
}

.switch-field input {
  width: 22px;
  height: 22px;
  accent-color: var(--color-primary);
}

.form-error {
  margin-top: 14px;
  padding: 10px 12px;
  background: var(--color-error-container);
  color: var(--color-on-error-container);
  font-size: 12px;
  line-height: 1.4;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px solid var(--color-outline-variant);
}

.quiet-button {
  background: transparent;
  color: var(--color-on-surface-variant);
}

.primary-button {
  background: var(--color-secondary-container);
  color: var(--color-primary);
}

.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@media (max-width: 680px) {
  .form-panel {
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-height: 92%;
    border-top: 1px solid var(--color-outline-variant);
    border-left: 0;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    transform: translateY(100%);
  }

  .form-layer.is-open .form-panel {
    transform: translateY(0);
  }

  .form-panel {
    padding: 18px 16px 24px;
  }
}

@media (max-width: 420px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .field.wide,
  .price-edit-section {
    grid-column: auto;
  }

  .price-edit-grid {
    gap: 5px;
  }

  .price-edit-grid :deep(section > label) {
    font-size: 10px;
  }
}
</style>

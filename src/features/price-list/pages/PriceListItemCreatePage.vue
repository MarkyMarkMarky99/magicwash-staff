<script setup lang="ts">
import { onBeforeUnmount, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import FormInput from '@/shared/components/FormInput.vue'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
import { useCloseRoute } from '@/shared/navigation/use-close-route'

defineOptions({ name: 'PriceListItemCreatePage' })

const route = useRoute()

function prefilledValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

const item = reactive({
  category: prefilledValue(route.query.category),
  subcategory: prefilledValue(route.query.subcategory),
  itemType: '',
  variant: '',
  displayNameTh: '',
  displayNameEn: '',
})

const orderId = prefilledValue(route.query.orderId)
const fallback = orderId
  ? { name: 'order-detail', params: { orderId }, query: { orderAction: 'item' } }
  : { name: 'price-list' }
const { close } = useCloseRoute(fallback)

const photoInput = ref<HTMLInputElement | null>(null)
const photoPreviewUrl = ref<string | null>(null)
const photoName = ref('')

function clearPhoto() {
  if (photoPreviewUrl.value) URL.revokeObjectURL(photoPreviewUrl.value)
  photoPreviewUrl.value = null
  photoName.value = ''
  if (photoInput.value) photoInput.value.value = ''
}

function selectPhoto(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (photoPreviewUrl.value) URL.revokeObjectURL(photoPreviewUrl.value)
  photoPreviewUrl.value = URL.createObjectURL(file)
  photoName.value = file.name
}

onBeforeUnmount(clearPhoto)
</script>

<template>
  <FormOverlay
    :open="true"
    title="Add item type"
    eyebrow="Price list / new item"
    helper-text="Add item details within the selected category."
    submit-label="Save item (coming soon)"
    :is-submit-disabled="true"
    :close-on-backdrop="false"
    @close="close"
  >
    <div class="price-list-item-create">
      <section class="photo-section" aria-labelledby="photo-heading" aria-describedby="photo-description">
        <h2 id="photo-heading" class="section-label">Item photo</h2>
        <p id="photo-description" class="photo-description">Optional. The photo stays on this device until upload is connected.</p>
        <input ref="photoInput" class="photo-input" type="file" accept="image/*" tabindex="-1" aria-hidden="true" @change="selectPhoto">
        <div class="photo-card">
          <img v-if="photoPreviewUrl" :src="photoPreviewUrl" :alt="`Preview of ${photoName}`" class="photo-preview">
          <span v-else class="material-symbols-outlined photo-placeholder" aria-hidden="true">image</span>
          <div class="photo-card__copy">
            <strong>{{ photoName || 'No photo selected' }}</strong>
            <span>{{ photoName ? 'Local preview only' : 'JPG, PNG, or HEIC' }}</span>
          </div>
          <button v-if="photoPreviewUrl" type="button" class="photo-action" @click="clearPhoto">Remove</button>
          <button v-else type="button" class="photo-action" @click="photoInput?.click()">Choose photo</button>
        </div>
      </section>

      <fieldset class="fieldset">
        <legend class="section-label">Item details</legend>
        <div class="grid-2">
          <FormInput id="item-type" v-model="item.itemType" class="field" label="ประเภทสินค้า *" />
          <FormInput id="variant" v-model="item.variant" class="field" label="รูปแบบ" placeholder="เว้นว่างได้" />
        </div>
        <FormInput id="display-name-th" v-model="item.displayNameTh" class="field" label="ชื่อแสดงภาษาไทย *" />
        <FormInput id="display-name-en" v-model="item.displayNameEn" class="field" label="ชื่อแสดงภาษาอังกฤษ" placeholder="เว้นว่างได้" />
      </fieldset>

      <p class="preview-note" role="note">
        Saving is disabled while the item data contract and workflow are being prepared.
      </p>
    </div>
  </FormOverlay>
</template>

<style scoped>
.price-list-item-create { --ink:var(--color-on-surface); --teal:var(--color-primary); --line:var(--color-outline-variant); --quiet:var(--color-on-surface-variant); color:var(--ink); font-family:var(--font-body); }
.price-list-item-create * { box-sizing:border-box; }
.photo-section { margin-bottom:22px; }
.photo-description { margin:-4px 0 12px; color:var(--quiet); font-size:12px; line-height:1.4; }
.photo-input { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
.photo-card { display:flex; align-items:center; gap:11px; min-height:82px; padding:10px; border:1px dashed var(--color-outline); border-radius:12px; background:var(--color-surface-container-lowest); }
.photo-preview { width:60px; height:60px; flex:0 0 auto; border-radius:8px; object-fit:cover; }
.photo-placeholder { display:grid; width:60px; height:60px; flex:0 0 auto; place-items:center; border-radius:8px; color:var(--teal); background:var(--color-surface-container-low); font-size:25px; }
.photo-card__copy { min-width:0; margin-right:auto; }
.photo-card__copy strong,.photo-card__copy span { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.photo-card__copy strong { color:var(--ink); font-size:13px; }
.photo-card__copy span { margin-top:3px; color:var(--quiet); font-size:11px; }
.photo-action { flex:0 0 auto; padding:7px 9px; border:1px solid var(--color-outline); border-radius:8px; color:var(--teal); background:var(--color-surface-container-lowest); font:700 11px var(--font-body); cursor:pointer; }
.photo-action:focus-visible { outline:3px solid var(--color-primary-container); outline-offset:2px; }
.fieldset { margin:0; padding:0; border:0; }
.section-label { display:flex; align-items:center; gap:10px; margin:0 0 12px; color:var(--teal); font:700 12px var(--font-headline); letter-spacing:.03em; }
.section-label::after { content:""; height:1px; flex:1; background:var(--line); }
.grid-2 { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:13px; }
.field { min-width:0; margin-bottom:15px; }
.preview-note { margin:22px 0 8px; padding:11px 12px; border-radius:10px; color:var(--quiet); background:var(--color-surface-container-low); font-size:12px; line-height:1.4; }
@media (max-width:350px) { .grid-2 { gap:10px; } .photo-card { align-items:flex-start; flex-wrap:wrap; } .photo-action { margin-left:71px; } }
@media (prefers-reduced-motion:reduce) { *,*::before,*::after { transition:none!important; } }
</style>

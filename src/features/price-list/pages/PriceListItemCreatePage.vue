<script setup lang="ts">
import { reactive } from 'vue'
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
})

const orderId = prefilledValue(route.query.orderId)
const fallback = orderId
  ? { name: 'order-detail', params: { orderId }, query: { orderAction: 'item' } }
  : { name: 'price-list' }
const { close } = useCloseRoute(fallback)
</script>

<template>
  <FormOverlay
    :open="true"
    title="Add item type"
    eyebrow="Price list / new item"
    helper-text="Add an item type and variant within the selected category."
    submit-label="Save item (coming soon)"
    :is-submit-disabled="true"
    :close-on-backdrop="false"
    @close="close"
  >
    <div class="price-list-item-create">
      <div class="form-intro">
        <p>Item setup preview</p>
        <span class="stamp">UI ONLY</span>
      </div>

      <section class="assigned-code" aria-labelledby="assigned-code-heading">
        <span class="material-symbols-outlined" aria-hidden="true">tag</span>
        <div>
          <h2 id="assigned-code-heading">Item code</h2>
          <p>The server will assign an item code when this form is connected to saving.</p>
        </div>
      </section>

      <section class="selected-context" aria-label="Selected item category">
        <span>Category / Subcategory</span>
        <strong>{{ item.category && item.subcategory ? `${item.category} / ${item.subcategory}` : 'Select both in the item picker' }}</strong>
      </section>

      <fieldset class="fieldset">
        <legend class="section-label">Item details</legend>
        <div class="grid-2">
          <FormInput id="item-type" v-model="item.itemType" class="field" label="Item type *" placeholder="e.g. Cardigan" />
          <FormInput id="variant" v-model="item.variant" class="field" label="Variant" placeholder="Optional" />
        </div>
      </fieldset>

      <p class="preview-note" role="note">
        Saving is disabled while the item data contract and workflow are being prepared.
      </p>
    </div>
  </FormOverlay>
</template>

<style scoped>
.price-list-item-create { --ink:var(--color-on-surface); --teal:var(--color-primary); --teal-2:var(--color-secondary); --line:var(--color-outline-variant); --quiet:var(--color-on-surface-variant); color:var(--ink); font-family:var(--font-body); }
.price-list-item-create * { box-sizing:border-box; }
.form-intro { display:flex; align-items:center; justify-content:space-between; padding:0 1px 18px; }
.form-intro p { margin:0; color:var(--quiet); font-size:12px; }
.stamp { color:var(--teal); font:700 10px var(--font-headline); letter-spacing:.1em; }
.assigned-code { display:flex; align-items:flex-start; gap:11px; margin:0 0 24px; padding:13px; border:1px solid var(--line); border-radius:12px; background:var(--color-surface-container-low); }
.assigned-code .material-symbols-outlined { flex:0 0 auto; color:var(--teal); font-size:20px; }
.assigned-code h2 { margin:0; color:var(--teal); font:700 13px/1.25 var(--font-headline); }
.assigned-code p { margin:3px 0 0; color:var(--quiet); font-size:12px; line-height:1.4; }
.selected-context { display:flex; flex-direction:column; gap:4px; margin:0 0 22px; padding:12px 13px; border:1px solid var(--line); border-radius:12px; background:var(--color-surface-container-low); }
.selected-context span { color:var(--quiet); font-size:11px; }
.selected-context strong { color:var(--teal); font:700 13px/1.35 var(--font-headline); }
.fieldset { margin:0; padding:0; border:0; }
.section-label { display:flex; align-items:center; gap:10px; margin:0 0 12px; color:var(--teal); font:700 12px var(--font-headline); letter-spacing:.03em; }
.section-label::after { content:""; height:1px; flex:1; background:var(--line); }
.grid-2 { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:13px; }
.field { min-width:0; margin-bottom:15px; }
.preview-note { margin:22px 0 8px; padding:11px 12px; border-radius:10px; color:var(--quiet); background:var(--color-surface-container-low); font-size:12px; line-height:1.4; }
@media (max-width:350px) { .grid-2 { gap:10px; } }
@media (prefers-reduced-motion:reduce) { *,*::before,*::after { transition:none!important; } }
</style>

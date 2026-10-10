<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useId } from 'vue'
import type { WashProductDto } from '@/data/wash-products/wash-products.service'
const props = defineProps<{ selected: readonly string[]; products: readonly WashProductDto[] }>()
const emit = defineEmits<{ choose: [id: string] }>()
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const open = ref(false)
const id = useId()
const available = computed(() => props.products.filter((product) => !props.selected.includes(product.id)))
async function focusOption(index: number): Promise<void> {
  await nextTick()
  const options = root.value?.querySelectorAll<HTMLButtonElement>('[role="option"]')
  if (options?.length) options[(index + options.length) % options.length]?.focus()
}
function close(): void { open.value = false; trigger.value?.focus() }
function choose(productId: string): void { emit('choose', productId); close() }
function keydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const options = Array.from(root.value?.querySelectorAll('[role="option"]') ?? [])
    const index = options.indexOf(event.target as Element)
    open.value = true
    void focusOption(index < 0 ? event.key === 'ArrowDown' ? 0 : available.value.length - 1 : index + (event.key === 'ArrowDown' ? 1 : -1))
  }
  if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); void focusOption(event.key === 'Home' ? 0 : available.value.length - 1) }
}
function outside(event: PointerEvent): void { if (!root.value?.contains(event.target as Node)) open.value = false }
onMounted(() => document.addEventListener('pointerdown', outside))
onUnmounted(() => document.removeEventListener('pointerdown', outside))
</script>
<template>
  <div ref="root" class="psel" :class="{ open }" @keydown="keydown">
    <span class="tab">Add product</span>
    <button ref="trigger" type="button" class="psel-in" aria-label="Add product" aria-haspopup="listbox" :aria-expanded="open" :aria-controls="id" :disabled="!available.length || selected.length >= 10" @click="open = !open">{{ available.length ? 'Choose a product…' : 'All products added' }}</button>
    <span class="ms" aria-hidden="true">expand_more</span>
    <ul v-if="open" :id="id" class="psel-menu" role="listbox" aria-label="Available products">
      <li v-for="product in available" :key="product.id"><button type="button" role="option" :aria-selected="false" @click="choose(product.id)"><span class="ms" aria-hidden="true">add</span>{{ product.name }}</button></li>
    </ul>
  </div>
</template>

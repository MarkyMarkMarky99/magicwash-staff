<script setup lang="ts">
import { useId } from 'vue'
import type { WashProductDto } from '@/data/wash-products/wash-products.service'
import type { WashStep } from '../wash-options'
import WashProductSelect from './WashProductSelect.vue'
const props = defineProps<{ step: WashStep; products: readonly WashProductDto[]; productName: (id: string) => string }>()
const emit = defineEmits<{ update: [step: WashStep] }>()
const minutesId = useId()
const types = [
  { type: 'stain_removal', label: 'Stain', icon: 'cleaning_services' },
  { type: 'quick_wash', label: 'Quick', icon: 'bolt' }, { type: 'normal_wash', label: 'Normal', icon: 'local_laundry_service' },
  { type: 'rinse', label: 'Rinse', icon: 'water_drop' }, { type: 'soak', label: 'Soak', icon: 'hourglass_bottom' },
] as const
const temperatures = ['cold', '40', '60'] as const
const durations = [15, 30, 60, 120, 'overnight'] as const
function changeType(type: WashStep['type']): void {
  if (type === props.step.type) return
  const products = [...props.step.products]
  emit('update', type === 'stain_removal' || type === 'rinse' ? { type, products } : type === 'soak' ? { type, products, duration: 30 } : { type, products, temperature: 'cold' })
}
function temperature(value: 'cold' | '40' | '60'): void {
  if ('temperature' in props.step) emit('update', { ...props.step, products: [...props.step.products], temperature: value })
}
function duration(value: number | 'overnight'): void {
  if (props.step.type === 'soak') emit('update', { ...props.step, products: [...props.step.products], duration: value })
}
function minutes(event: Event): void {
  const raw = (event.target as HTMLInputElement).value
  const value = Number(raw)
  if (raw.trim() && Number.isInteger(value) && value >= 1 && value <= 720) duration(value)
}
function product(id: string): void {
  const products = props.step.products.includes(id) ? props.step.products.filter((value) => value !== id) : [...props.step.products, id]
  emit('update', { ...props.step, products })
}
</script>
<template>
  <div class="step-ed">
    <div class="g-t">Step type</div><div class="step-types">
      <button v-for="item in types" :key="item.type" type="button" class="choice tog" :class="{ on: step.type === item.type }" :aria-pressed="step.type === item.type" @click="changeType(item.type)"><span class="ms" aria-hidden="true">{{ item.icon }}</span>{{ item.label }}</button>
    </div>
    <template v-if="'temperature' in step">
      <div class="g-t">Temperature</div><div class="grid3"><button v-for="value in temperatures" :key="value" type="button" class="choice" :class="{ on: step.temperature === value }" :aria-pressed="step.temperature === value" @click="temperature(value)"><span class="ms ck" aria-hidden="true">check</span>{{ value === 'cold' ? 'Cold' : `${value}°C` }}</button></div>
    </template>
    <template v-if="step.type === 'soak'">
      <div class="g-t">Soak duration</div><div class="grid3 dur-g"><button v-for="value in durations" :key="value" type="button" class="choice" :class="{ on: step.duration === value, wide: value === 'overnight' }" :aria-pressed="step.duration === value" @click="duration(value)"><span v-if="value === 'overnight'" class="ms" aria-hidden="true">bedtime</span>{{ value === 'overnight' ? 'Overnight' : `${value} min` }}</button></div>
      <div class="minf"><label :for="minutesId" class="tab">Custom minutes</label><input :id="minutesId" type="number" min="1" max="720" step="1" inputmode="numeric" placeholder="1 - 720" :value="typeof step.duration === 'number' ? step.duration : ''" @input="minutes" @blur="($event.target as HTMLInputElement).value = typeof step.duration === 'number' ? String(step.duration) : ''"><span class="unit">min</span></div>
    </template>
    <div class="g-t">Products</div><div class="psel-list">
      <span v-for="id in step.products" :key="id" class="psel-chip">{{ productName(id) }}<button type="button" :aria-label="`Remove ${productName(id)}`" @click="product(id)">×</button></span>
      <span v-if="!step.products.length" class="chip none">{{ step.type === 'stain_removal' ? 'By hand' : 'temperature' in step ? 'No product' : 'Water only' }}</span>
    </div>
    <WashProductSelect :selected="step.products" :products="products" @choose="product" />
  </div>
</template>

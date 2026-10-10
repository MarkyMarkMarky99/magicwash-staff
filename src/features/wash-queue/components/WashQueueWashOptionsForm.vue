<script setup lang="ts">
import type { WashProductDto } from '@/data/wash-products/wash-products.service'
import type { WashOptions } from '../wash-options'

const props = defineProps<{
  modelValue: WashOptions
  detergents: readonly WashProductDto[]
  softeners: readonly WashProductDto[]
  bleaches: readonly WashProductDto[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: WashOptions] }>()

function update<K extends keyof WashOptions>(key: K, value: WashOptions[K]): void {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>

<template>
  <div>
    <label><input type="checkbox" :checked="modelValue.preRinse" @change="update('preRinse', ($event.target as HTMLInputElement).checked)" /> Pre-rinse</label>
    <label>Soak minutes <input type="number" min="1" max="720" step="1" :value="modelValue.soakMinutes" @input="update('soakMinutes', ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value))" /></label>
    <label><input type="checkbox" :checked="modelValue.extraWash" @change="update('extraWash', ($event.target as HTMLInputElement).checked)" /> Extra wash</label>
    <label>Temperature
      <select :value="modelValue.temperature" @change="update('temperature', ($event.target as HTMLSelectElement).value as WashOptions['temperature'])">
        <option value="cold">Cold</option><option value="40">40°C</option><option value="60">60°C</option>
      </select>
    </label>
    <label>Bleach
      <select :value="modelValue.bleach ?? ''" @change="update('bleach', ($event.target as HTMLSelectElement).value || null)">
        <option value="">None</option><option v-for="product in bleaches" :key="product.id" :value="product.id">{{ product.name }}</option>
      </select>
    </label>
    <label>Detergent
      <select :value="modelValue.detergent ?? ''" @change="update('detergent', ($event.target as HTMLSelectElement).value || null)">
        <option value="">None</option><option v-for="product in detergents" :key="product.id" :value="product.id">{{ product.name }}</option>
      </select>
    </label>
    <label>Softener
      <select :value="modelValue.softener ?? ''" @change="update('softener', ($event.target as HTMLSelectElement).value || null)">
        <option value="">None</option><option v-for="product in softeners" :key="product.id" :value="product.id">{{ product.name }}</option>
      </select>
    </label>
    <label>Rinses
      <select :value="modelValue.rinses" @change="update('rinses', Number(($event.target as HTMLSelectElement).value) as WashOptions['rinses'])">
        <option :value="1">1</option><option :value="2">2</option><option :value="3">3</option>
      </select>
    </label>
  </div>
</template>

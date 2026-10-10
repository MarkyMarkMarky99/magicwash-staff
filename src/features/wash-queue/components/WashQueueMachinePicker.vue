<script setup lang="ts">
import type { MachineDto } from '@/data/machines/machines.service'
import { formatKgFigure } from '../format-weights'
import { machineTypeWord } from '../machine-label'

defineProps<{ machines: readonly MachineDto[]; modelValue: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [machineId: string] }>()
</script>

<template>
  <div role="radiogroup" aria-labelledby="wash-queue-machine-label" class="pb-4">
    <div class="mb-1.5 flex items-baseline justify-between">
      <span id="wash-queue-machine-label" class="font-body text-xs font-bold text-on-surface">Machine</span>
      <span v-if="!modelValue" class="font-label text-[11px] text-on-surface-variant">Required</span>
    </div>
    <p v-if="!machines.length" class="font-body text-sm text-on-surface-variant">No machines available.</p>
    <div v-else class="grid grid-cols-3 gap-2">
      <button
        v-for="machine in machines"
        :key="machine.id"
        type="button"
        role="radio"
        :aria-checked="modelValue === machine.id"
        class="flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[12px] border px-1.5 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
        :class="modelValue === machine.id ? 'border-primary bg-primary text-white' : 'border-outline-variant bg-white text-primary'"
        @click="emit('update:modelValue', machine.id)"
      >
        <span class="font-headline text-2xl font-extrabold leading-tight tabular-nums">{{ machine.capacityKg === null ? machine.id : formatKgFigure(machine.capacityKg) }}<span v-if="machine.capacityKg !== null" class="ml-0.5 text-[13px] font-bold">kg</span></span>
        <span class="font-label text-[11px]" :class="modelValue === machine.id ? 'text-white' : 'text-on-surface-variant'">{{ machineTypeWord[machine.type] }}</span>
      </button>
    </div>
  </div>
</template>

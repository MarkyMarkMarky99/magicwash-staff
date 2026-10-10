<script setup lang="ts">
import type { MachineDto } from '@/data/machines/machines.service'
import { formatKgFigure } from '../format-weights'
import { machineTypeWord } from '../machine-label'

defineProps<{ machines: readonly MachineDto[]; modelValue: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [machineId: string] }>()
</script>

<template>
  <div role="radiogroup" aria-labelledby="wash-queue-machine-label" class="pb-4">
    <div class="mb-2 flex items-baseline justify-between border-l-4 border-lime pl-2">
      <span id="wash-queue-machine-label" class="font-body text-[11px] font-extrabold uppercase tracking-wider text-on-surface-variant">Machine</span>
      <span v-if="modelValue" class="font-label text-[11px] text-primary">{{ machines.find((machine) => machine.id === modelValue)?.capacityKg }} kg {{ machineTypeWord[machines.find((machine) => machine.id === modelValue)?.type ?? 'WSH'] }}</span>
      <span v-else class="font-label text-[11px] text-warning">Required</span>
    </div>
    <p v-if="!machines.length" class="font-body text-sm text-on-surface-variant">No machines available.</p>
    <div v-else class="grid grid-cols-3 gap-2">
      <button
        v-for="machine in machines"
        :key="machine.id"
        type="button"
        role="radio"
        :aria-checked="modelValue === machine.id"
        class="flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[16px_19px_16px_18px] border-2 px-1.5 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
        :class="modelValue === machine.id ? 'border-primary bg-primary text-lime shadow-[3px_3px_0_color-mix(in_srgb,var(--color-primary)_70%,black)] -translate-x-px -translate-y-px' : 'border-outline-variant bg-white text-primary shadow-[2px_2px_0_var(--color-outline-variant)]'"
        @click="emit('update:modelValue', machine.id)"
      >
        <span class="font-headline text-2xl font-extrabold leading-tight tabular-nums">{{ machine.capacityKg === null ? machine.id : formatKgFigure(machine.capacityKg) }}<span v-if="machine.capacityKg !== null" class="ml-0.5 text-[13px] font-bold">kg</span></span>
        <span class="font-label text-[11px]" :class="modelValue === machine.id ? 'text-white' : 'text-on-surface-variant'">{{ machineTypeWord[machine.type] }}</span>
      </button>
    </div>
  </div>
</template>

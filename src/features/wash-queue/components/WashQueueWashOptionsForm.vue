<script setup lang="ts">
import { computed } from 'vue'
import type { WashProgramDto } from '@/data/wash-programs/wash-programs.service'
import { programToOptions, stepChips, stepLabel, washOptionsSummary, type WashOptions } from '../wash-options'
import './wash-program.css'

// Read-only: pick a program sticker; its steps show as a vertical progress line. Steps are edited in the sheet.
const props = defineProps<{ modelValue: WashOptions; programs: readonly WashProgramDto[]; productName: (id: string) => string; machine?: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: WashOptions] }>()
const programName = computed(() => props.programs.find((program) => program.id === props.modelValue.program)?.name ?? 'Custom')
const summaryTitle = computed(() => props.modelValue.program === 'CUSTOM' ? 'Custom' : programName.value)
const summaryRest = computed(() => washOptionsSummary(props.modelValue, programName.value).slice(summaryTitle.value.length))
</script>

<template>
  <section class="wq-options pb-4">
    <div class="sec"><div class="bar" /><div class="tt"><h3>Wash program</h3><small>Pick a program</small></div><slot name="action" /></div>
    <div class="presets"><button v-for="program in programs" :key="program.id" type="button" class="preset" :class="{ on: modelValue.program === program.id }" :aria-pressed="modelValue.program === program.id" @click="emit('update:modelValue', programToOptions(program))"><span class="dot"><span class="ms" aria-hidden="true">check</span></span><span class="ms fill" aria-hidden="true">local_laundry_service</span><b>{{ program.name }}</b><small>{{ program.steps.length }} steps</small></button></div>
    <div class="sum-col">
      <div class="sum" aria-live="polite">
        <span class="tab">Program</span>
        <div class="sum-line has-mach"><span class="pn"><b>{{ summaryTitle }}</b>{{ summaryRest }}</span><span v-if="machine" class="mach"><span class="ms fill" aria-hidden="true">local_laundry_service</span>{{ machine }}</span></div>
        <ol class="line">
          <li v-for="(step, index) in modelValue.steps" :key="index" class="st">
            <span class="dot" aria-hidden="true" />
            <div class="ttl">{{ stepLabel(step.type) }}</div>
            <div class="sub"><span v-for="(chip, i) in stepChips(step, productName)" :key="i">{{ chip }}</span></div>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>

<style scoped>
.sub span + span::before {
  content: "·";
  margin: 0 6px;
  color: var(--color-outline-variant);
  font-weight: 800;
}
</style>

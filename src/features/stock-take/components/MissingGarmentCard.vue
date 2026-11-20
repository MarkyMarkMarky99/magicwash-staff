<script setup lang="ts">
import { computed, ref } from 'vue'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import FormInput from '@/shared/components/FormInput.vue'
import FormOptionGrid from '@/shared/components/FormOptionGrid.vue'
import SquareImageCard from '@/shared/components/SquareImageCard.vue'
import type { StockTakeResolution } from '@/data/stock-takes/stock-take.service'
import { lastTicketLabel, logisticsHint, missingChoices, missingResolution, type MissingChoice, type ReportGarment } from '../stock-take-report'

const props = defineProps<{ garment: ReportGarment; resolvable: boolean; busy: boolean }>()
const emit = defineEmits<{ resolve: [resolution: StockTakeResolution] }>()

const choice = ref<MissingChoice | null>(null)
const reason = ref('')
const problem = ref<string | null>(null)
const needsReason = computed(() => choice.value === 'RETURNED' || choice.value === 'OFF_SITE')
const reasonId = computed(() => `stock-take-reason-${props.garment.orderId}-${props.garment.tag}`)
const hint = computed(() => logisticsHint(props.garment.logistics))
const currentLabel = computed(() => missingChoices.find(entry => entry.value === props.garment.resolution)?.label ?? null)

function choose(value: unknown): void {
  choice.value = missingChoices.some(entry => entry.value === value) ? value as MissingChoice : null
  problem.value = null
}

function save(): void {
  if (!choice.value) {
    problem.value = 'Choose what happened to this garment'
    return
  }
  const built = missingResolution(props.garment.orderId, props.garment.tag, choice.value, reason.value)
  if ('error' in built) {
    problem.value = built.error
    return
  }
  problem.value = null
  emit('resolve', built.resolution)
}
</script>

<template>
  <article class="flex flex-col gap-3 px-4 py-3">
    <div class="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3">
      <SquareImageCard :image-url="garment.registrationPhoto" />
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <strong class="truncate font-headline text-sm text-primary">{{ garment.tag }}</strong>
          <BaseBadge v-if="currentLabel" :label="currentLabel" tone="warning" />
        </div>
        <p class="truncate font-label text-xs text-on-surface-variant">{{ garment.orderId }} · {{ garment.garmentType ?? 'Unknown type' }}</p>
        <p class="font-label text-xs text-on-surface-variant">Last ticket: {{ lastTicketLabel(garment.lastTicket) }}</p>
        <p v-if="hint" class="font-label text-xs text-on-surface-variant">{{ hint }}</p>
        <p v-if="garment.reason" class="font-label text-xs text-on-surface-variant">Reason: {{ garment.reason }}</p>
      </div>
    </div>

    <div v-if="resolvable" class="flex flex-col gap-3">
      <FormOptionGrid label="Outcome" variant="compact" :model-value="choice" :options="missingChoices" @update:model-value="choose" />
      <FormInput v-if="needsReason" :id="reasonId" label="Who, where and when" :model-value="reason" @update:model-value="reason = $event" />
      <p v-if="problem" role="alert" class="text-sm text-error">{{ problem }}</p>
      <button type="button" class="self-end rounded-full bg-primary px-4 py-2 font-label text-sm text-on-primary focus-visible:outline-2 focus-visible:outline-lime disabled:opacity-50" :disabled="busy" @click="save">Save</button>
    </div>
  </article>
</template>

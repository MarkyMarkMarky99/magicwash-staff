<script setup lang="ts">
import { ref, useSlots } from 'vue'
import BaseSwipeCard from '@/shared/components/BaseSwipeCard.vue'
import BaseRowCard from '@/shared/components/BaseRowCard.vue'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import type { BadgeTone } from '@/shared/components/BaseBadge.vue'

withDefaults(defineProps<{
  title: string
  badges: { label: string; tone: BadgeTone }[]
  trailing?: string
  trailingEmphasis?: boolean
  detail?: string
  meta?: string
  pressable?: boolean
  leftActions?: number
}>(), { pressable: true, leftActions: 1 })

const emit = defineEmits<{ select: [] }>()
const slots = useSlots()
const baseCard = ref<InstanceType<typeof BaseSwipeCard> | null>(null)

function close() {
  baseCard.value?.snapCard('none')
}

defineExpose({ close })
</script>

<template>
  <BaseSwipeCard
    ref="baseCard"
    :swipeable="Boolean(slots['left-panel'])"
    :pressable="pressable"
    :left-actions="slots['left-panel'] ? leftActions : undefined"
    @tap="pressable && emit('select')"
  >
    <template v-if="slots['left-panel']" #left-panel>
      <slot name="left-panel" :close="close" />
    </template>
    <BaseRowCard :line1="title" :line2="detail" :line3="meta">
      <template #line1>
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="truncate">{{ title }}</span>
          <BaseBadge
            v-for="(badge, index) in badges"
            :key="`${badge.label}-${index}`"
            :label="badge.label"
            :tone="badge.tone"
            size="sm"
            :uppercase="true"
          />
        </span>
      </template>
      <template v-if="trailing" #top-end>
        <span :class="trailingEmphasis ? 'shrink-0 font-headline text-sm font-bold text-primary' : 'shrink-0 font-body text-[11px] font-semibold text-on-surface-variant'">
          {{ trailing }}
        </span>
      </template>
      <template v-if="slots.actions" #bot-end>
        <slot name="actions" />
      </template>
    </BaseRowCard>
  </BaseSwipeCard>
</template>

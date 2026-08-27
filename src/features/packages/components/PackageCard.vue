<script setup lang="ts">
import BaseSwipeCard from '@/shared/components/BaseSwipeCard.vue'
import CardLeadingIcon from '@/shared/components/CardLeadingIcon.vue'
import type { PackageDto } from '../services/package.service'

const props = defineProps<{ package: PackageDto }>()
const emit = defineEmits<{ edit: [packageCode: string] }>()

function openEdit() {
  emit('edit', props.package.packageCode)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  openEdit()
}
</script>

<template>
  <BaseSwipeCard
    role="button"
    tabindex="0"
    :aria-label="`แก้ไขแพ็กเกจ ${package.name}`"
    @tap="openEdit"
    @keydown="handleKeydown"
  >
    <div class="flex gap-3 px-4 py-3">
      <CardLeadingIcon icon="inventory_2" label="Package" />
      <div class="min-w-0 flex-grow">
        <div class="flex items-center gap-2">
          <h3 class="truncate font-headline text-sm font-bold text-primary">{{ package.name }}</h3>
          <span v-if="package.deletedAt !== null" class="shrink-0 rounded-full bg-error-container px-2 py-0.5 font-label text-[10px] font-bold text-on-error-container">เลิกขาย</span>
        </div>
        <p class="truncate font-body text-xs text-on-surface-variant">{{ package.packageCode }} · {{ package.eligibleService }}</p>
        <p class="mt-0.5 font-body text-xs text-on-surface-variant">เครดิต {{ package.includedCredit }} · ฿{{ package.price }}</p>
      </div>
    </div>
  </BaseSwipeCard>
</template>

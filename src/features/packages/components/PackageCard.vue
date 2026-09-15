<script setup lang="ts">
import BaseSwipeCard from '@/shared/components/BaseSwipeCard.vue'
import BaseRowCard from '@/shared/components/BaseRowCard.vue'
import CardLeadingIcon from '@/shared/components/CardLeadingIcon.vue'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import type { PackageDto } from '@/data/packages/package.service'

const props = defineProps<{ package: PackageDto }>()
const emit = defineEmits<{ edit: [packageCode: string] }>()

function openEdit() {
  emit('edit', props.package.packageCode)
}
</script>

<template>
  <BaseSwipeCard
    :swipeable="false"
    :pressable="true"
    :aria-label="`แก้ไขแพ็กเกจ ${package.name}`"
    @tap="openEdit"
  >
    <BaseRowCard
      :line1="package.name"
      :line2="`${package.packageCode} · ${package.eligibleService}`"
      :line3="`เครดิต ${package.includedCredit} · ฿${package.price}`"
    >
      <template #lead>
        <CardLeadingIcon icon="inventory_2" label="Package" />
      </template>
      <template #line1>
        <span class="flex min-w-0 items-center gap-2">
          <span class="truncate">{{ package.name }}</span>
          <BaseBadge v-if="package.deletedAt !== null" label="เลิกขาย" size="md" tone="danger" />
        </span>
      </template>
    </BaseRowCard>
  </BaseSwipeCard>
</template>

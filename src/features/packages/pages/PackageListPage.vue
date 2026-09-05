<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import GenericTabs from '@/shared/components/GenericTabs.vue'
import { usePackageStore } from '../stores/package.store'
import PackageCard from '../components/PackageCard.vue'

defineOptions({ name: 'PackageListPage' })

const router = useRouter()
const packageStore = usePackageStore()
const { items, loading, error, loaded } = storeToRefs(packageStore)
const keyword = ref('')
const status = ref<'all' | 'active' | 'retired'>('all')
const statusOptions = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'active', label: 'เปิดขาย' },
  { key: 'retired', label: 'เลิกขาย' },
] as const

const filteredPackages = computed(() => {
  const query = keyword.value.trim().toLocaleLowerCase('th-TH')
  return items.value.filter((item) => {
    if (status.value === 'active' && item.deletedAt !== null) return false
    if (status.value === 'retired' && item.deletedAt === null) return false
    return !query || [item.packageCode, item.name, item.eligibleService]
      .some((value) => value.toLocaleLowerCase('th-TH').includes(query))
  })
})

function selectStatus(value: string) { status.value = value as 'all' | 'active' | 'retired' }
function openCreate() { void router.push({ name: 'package-create' }) }
function openEdit(packageCode: string) { void router.push({ name: 'package-edit', params: { packageCode } }) }

onMounted(() => void packageStore.load())
</script>

<template>
  <ListPageLayout>
    <template #filters>
      <GenericTabs :tabs="statusOptions" :active-key="status" @select="selectStatus" />
    </template>

      <ListContainer title="แพ็กเกจ" icon="inventory_2" searchable :search-value="keyword" search-placeholder="ค้นหาแพ็กเกจ" @update:search-value="keyword = $event" :count="filteredPackages.length" count-label="รายการ" :loading="loading && !loaded" :error="loaded ? null : error" :empty="!loading && !error && filteredPackages.length === 0" empty-text="ไม่พบแพ็กเกจ" :skeleton-rows="4">
        <template #actions>
          <button
            type="button"
            class="-my-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 active:bg-primary/20 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label="เพิ่มแพ็กเกจ"
            @click="openCreate"
          >
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">card_membership</span>
          </button>
        </template>
        <PackageCard v-for="packageItem in filteredPackages" :key="packageItem.packageCode" :package="packageItem" @edit="openEdit" />
      </ListContainer>
  </ListPageLayout>
</template>

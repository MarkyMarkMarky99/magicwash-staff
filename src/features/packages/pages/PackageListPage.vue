<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
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

function selectStatus(value: 'all' | 'active' | 'retired') { status.value = value }
function openCreate() { void router.push({ name: 'package-create' }) }
function openEdit(packageCode: string) { void router.push({ name: 'package-edit', params: { packageCode } }) }

onMounted(() => void packageStore.load())
</script>

<template>
  <ListPageLayout v-model:search-value="keyword" search-placeholder="ค้นหารหัส ชื่อ หรือบริการ">
    <template #filters>
      <div class="flex gap-2 px-4 py-4">
        <button v-for="option in statusOptions" :key="option.key" type="button" class="rounded-full px-3 py-1 font-label text-xs" :class="status === option.key ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'" @click="selectStatus(option.key)">{{ option.label }}</button>
      </div>
    </template>

      <ListContainer title="แพ็กเกจ" icon="inventory_2" :count="filteredPackages.length" count-label="รายการ" :loading="loading && !loaded" :error="loaded ? null : error" :empty="!loading && !error && filteredPackages.length === 0" empty-text="ไม่พบแพ็กเกจ" :skeleton-rows="4">
        <template #actions><button type="button" class="rounded-full bg-primary px-3 py-1 font-label text-xs font-bold text-on-primary" @click="openCreate">เพิ่มแพ็กเกจ</button></template>
        <PackageCard v-for="packageItem in filteredPackages" :key="packageItem.packageCode" :package="packageItem" @edit="openEdit" />
      </ListContainer>
  </ListPageLayout>
</template>

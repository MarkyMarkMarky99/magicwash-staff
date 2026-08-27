<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import { usePackageStore } from '../stores/package.store'
import PackageCard from '../components/PackageCard.vue'

defineOptions({ name: 'PackageListPage' })

const router = useRouter()
const packageStore = usePackageStore()
const { items, loading, error, loaded } = storeToRefs(packageStore)
const keywordInput = ref('')
const keyword = ref('')
const status = ref<'all' | 'active' | 'retired'>('all')
const statusOptions = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'active', label: 'เปิดขาย' },
  { key: 'retired', label: 'เลิกขาย' },
] as const
let debounceTimer: ReturnType<typeof setTimeout> | undefined

const filteredPackages = computed(() => {
  const query = keyword.value.trim().toLocaleLowerCase('th-TH')
  return items.value.filter((item) => {
    if (status.value === 'active' && item.deletedAt !== null) return false
    if (status.value === 'retired' && item.deletedAt === null) return false
    return !query || [item.packageCode, item.name, item.eligibleService]
      .some((value) => value.toLocaleLowerCase('th-TH').includes(query))
  })
})

watch(keywordInput, (value) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { keyword.value = value }, 250)
})

function clearKeyword() {
  keywordInput.value = ''
  clearTimeout(debounceTimer)
  keyword.value = ''
}

function selectStatus(value: 'all' | 'active' | 'retired') { status.value = value }
function openCreate() { void router.push({ name: 'package-create' }) }
function openEdit(packageCode: string) { void router.push({ name: 'package-edit', params: { packageCode } }) }

onMounted(() => void packageStore.load())
onBeforeUnmount(() => clearTimeout(debounceTimer))
</script>

<template>
  <AppLayout>
    <main class="flex-1 overflow-y-auto bg-surface pb-20">
      <div class="space-y-3 px-4 py-4">
        <label class="sr-only" for="package-search">ค้นหาแพ็กเกจ</label>
        <div class="flex items-center rounded-xl bg-surface-container px-3 py-2">
          <span class="material-symbols-outlined mr-2 text-on-surface-variant" aria-hidden="true">search</span>
          <input id="package-search" v-model="keywordInput" class="min-w-0 flex-1 bg-transparent font-body text-sm outline-none" placeholder="ค้นหารหัส ชื่อ หรือบริการ">
          <button v-if="keywordInput" type="button" class="material-symbols-outlined text-on-surface-variant" aria-label="ล้างคำค้นหา" @click="clearKeyword">close</button>
        </div>
        <div class="flex gap-2">
          <button v-for="option in statusOptions" :key="option.key" type="button" class="rounded-full px-3 py-1 font-label text-xs" :class="status === option.key ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'" @click="selectStatus(option.key)">{{ option.label }}</button>
        </div>
      </div>
      <ListContainer title="แพ็กเกจ" icon="inventory_2" :count="filteredPackages.length" count-label="รายการ" :loading="loading && !loaded" :error="loaded ? null : error" :empty="!loading && !error && filteredPackages.length === 0" empty-text="ไม่พบแพ็กเกจ" :skeleton-rows="4">
        <template #actions><button type="button" class="rounded-full bg-primary px-3 py-1 font-label text-xs font-bold text-on-primary" @click="openCreate">เพิ่มแพ็กเกจ</button></template>
        <PackageCard v-for="packageItem in filteredPackages" :key="packageItem.packageCode" :package="packageItem" @edit="openEdit" />
      </ListContainer>
    </main>
  </AppLayout>
</template>

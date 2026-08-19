<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import { usePriceListStore } from '../stores/price-list.store'
import PriceListStatusTabs from '../components/PriceListStatusTabs.vue'
import PriceListCard from '../components/PriceListCard.vue'

defineOptions({ name: 'PriceListPage' })

const props = defineProps<{
  embedded?: boolean
}>()

const router = useRouter()
const priceListStore = usePriceListStore()
const { items, loading, error, loaded } = storeToRefs(priceListStore)

const layoutComponent = computed(() => (props.embedded ? 'div' : AppLayout))
const listLoading = computed(() => loading.value && !loaded.value)
const listError = computed(() => (loaded.value ? null : error.value))

const search = ref('')
const status = ref<'all' | 'active' | 'inactive'>('all')

const filteredItems = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('th-TH')

  return items.value.filter((item) => {
    const matchesStatus =
      status.value === 'all' || (status.value === 'active' ? item.active : !item.active)
    if (!matchesStatus) return false
    if (!query) return true

    return [
      item.itemCode,
      item.category,
      item.subcategory,
      item.itemType,
      item.variant,
      item.displayNameTh,
    ]
      .map((value) => String(value ?? '').toLocaleLowerCase('th-TH'))
      .join(' ')
      .includes(query)
  })
})

const groupedItems = computed(() => {
  const groups = new Map<string, typeof items.value>()
  for (const item of filteredItems.value) {
    const group = groups.get(item.category) ?? []
    group.push(item)
    groups.set(item.category, group)
  }
  return Array.from(groups, ([category, groupItems]) => ({ category, items: groupItems }))
})

function selectStatus(key: string) {
  if (key === 'all' || key === 'active' || key === 'inactive') status.value = key
}

function openCreate() {
  void router.push({ name: 'price-list-create' })
}

function openEdit(id: string) {
  void router.push({ name: 'price-list-edit', params: { id } })
}

onMounted(() => {
  void priceListStore.load()
})
</script>

<template>
  <component :is="layoutComponent" class="h-full flex flex-col relative overflow-hidden font-body text-on-surface w-full">
    <PriceListStatusTabs :active-status="status" @select="selectStatus" />

    <main class="content">
      <section class="tool-surface" aria-label="เครื่องมือค้นหา">
        <label class="search-field">
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">search</span>
          <input
            v-model="search"
            type="search"
            placeholder="ค้นหารหัส ชื่อ หรือหมวดหมู่"
            autocomplete="off"
          >
        </label>
      </section>

      <ListContainer
        title="รายการราคา"
        icon="sell"
        :count="filteredItems.length"
        count-label="รายการ"
        :loading="listLoading"
        :skeleton-rows="4"
        :error="listError"
        :empty="filteredItems.length === 0"
        empty-text="ไม่พบรายการที่ตรงกับการค้นหา"
      >
        <template #actions>
          <button class="primary-button" type="button" @click="openCreate">
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
            <span>เพิ่มรายการ</span>
          </button>
        </template>

        <section v-for="group in groupedItems" :key="group.category" class="category-section">
          <div class="category-heading">
            <h3>{{ group.category }}</h3>
            <span>{{ group.items.length }} รายการ</span>
          </div>
          <div class="card-list">
            <PriceListCard
              v-for="item in group.items"
              :key="item.id"
              :item="item"
              @edit="openEdit"
            />
          </div>
        </section>
      </ListContainer>
    </main>
  </component>
</template>

<style scoped>
.content {
  width: min(calc(100% - 32px), 1180px);
  margin: 0 auto;
  flex: 1;
  overflow-y: auto;
  padding: 26px 0 56px;
}

.primary-button,
.secondary-button,
.quiet-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid transparent;
  font-weight: 700;
  white-space: nowrap;
}

.primary-button {
  background: var(--color-secondary-container);
  color: var(--color-primary);
}

.tool-surface {
  display: grid;
  gap: 12px;
  padding: 14px;
  margin-bottom: 18px;
  background: var(--color-surface-container-low);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
}

.search-field {
  position: relative;
  display: flex;
  align-items: center;
}

.search-field > span {
  position: absolute;
  left: 14px;
  color: var(--color-on-surface-variant);
}

.search-field input {
  width: 100%;
  height: 48px;
  padding: 0 14px 0 44px;
  border: 1px solid var(--color-outline);
  border-radius: var(--radius);
  background: var(--color-surface-container-lowest);
  color: var(--color-on-surface);
}

.search-field input::placeholder {
  color: var(--color-on-surface-variant);
}

.category-section {
  margin-top: 22px;
}

.category-heading {
  position: sticky;
  top: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 46px;
  margin: 0 0 8px;
  padding: 0 12px;
  background: var(--color-surface-container);
  border-left: 4px solid var(--color-primary-container);
  color: var(--color-primary);
}

.category-heading h3 {
  margin: 0;
  font-family: var(--font-headline);
  font-size: 15px;
}

.category-heading span {
  color: var(--color-on-surface-variant);
  font-size: 12px;
  font-weight: 700;
}

.card-list {
  display: grid;
  gap: 10px;
}

@media (max-width: 680px) {
  .content {
    width: min(calc(100% - 24px), 1180px);
    padding-top: 20px;
  }

  .category-heading {
    top: 0;
  }
}

@media (max-width: 420px) {
  .content {
    width: min(calc(100% - 20px), 1180px);
  }
}
</style>

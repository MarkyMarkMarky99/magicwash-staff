<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { usePriceListStore } from '../stores/price-list.store'
import PriceListCard from '../components/PriceListCard.vue'

defineOptions({ name: 'PriceListPage' })

const router = useRouter()
const priceListStore = usePriceListStore()
const { items, loading, error } = storeToRefs(priceListStore)

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

const activeCount = computed(() => items.value.filter((item) => item.active).length)

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
  <div class="price-list-page">
    <header class="topbar">
      <div class="brand-lockup">
        <h1>รายการราคา</h1>
      </div>
      <button class="primary-button" type="button" @click="openCreate">
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
        <span>เพิ่มรายการ</span>
      </button>
    </header>

    <main class="content">
      <div class="intro-row">
        <div>
          <h2>ราคาแบบกลุ่ม</h2>
          <p>การ์ดรายการแยกตามหมวดหมู่ แตะรายการเพื่อแก้ไข</p>
        </div>
        <div class="summary-line">
          <span><strong>{{ filteredItems.length }}</strong> รายการที่แสดง · {{ activeCount }} รายการเปิดใช้งาน</span>
        </div>
      </div>

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
        <div class="status-pills" aria-label="สถานะรายการ">
          <button
            type="button"
            :aria-pressed="status === 'all'"
            @click="status = 'all'"
          >ทั้งหมด</button>
          <button
            type="button"
            :aria-pressed="status === 'active'"
            @click="status = 'active'"
          >เปิดใช้งาน</button>
          <button
            type="button"
            :aria-pressed="status === 'inactive'"
            @click="status = 'inactive'"
          >ปิดใช้งาน</button>
        </div>
      </section>

      <div v-if="loading && !items.length" class="empty-state">กำลังโหลดรายการราคา</div>
      <div v-else-if="error && !items.length" class="empty-state">{{ error }}</div>
      <div v-else-if="!filteredItems.length" class="empty-state">ไม่พบรายการที่ตรงกับการค้นหา</div>
      <div v-else>
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
      </div>
    </main>
  </div>
</template>

<style scoped>
.price-list-page {
  display: flex;
  height: 100%;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-background);
  color: var(--color-on-background);
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 76px;
  padding: 14px max(20px, calc((100vw - 1180px) / 2));
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.brand-lockup {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.eyebrow {
  color: var(--color-on-primary-container);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.brand-lockup h1 {
  margin: 0;
  font-family: var(--font-headline);
  font-size: clamp(20px, 4vw, 28px);
  line-height: 1.1;
}

.content {
  width: min(calc(100% - 32px), 1180px);
  margin: 0 auto;
  flex: 1;
  overflow-y: auto;
  padding: 26px 0 56px;
}

.intro-row {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
}

.intro-row h2 {
  margin: 0;
  font-family: var(--font-headline);
  font-size: 26px;
  letter-spacing: -0.02em;
}

.intro-row p {
  margin: 4px 0 0;
  color: var(--color-on-surface-variant);
  font-size: 14px;
  line-height: 1.45;
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

.status-pills {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 1px;
}

.status-pills button {
  flex: 0 0 auto;
  min-height: 40px;
  padding: 0 13px;
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius);
  background: var(--color-surface-container-lowest);
  color: var(--color-on-surface-variant);
  font-size: 13px;
  font-weight: 700;
}

.status-pills button[aria-pressed='true'] {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.summary-line {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--color-on-surface-variant);
  font-size: 13px;
}

.summary-line strong {
  color: var(--color-on-surface);
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

.empty-state {
  padding: 28px 16px;
  border: 1px dashed var(--color-outline);
  color: var(--color-on-surface-variant);
  text-align: center;
}

@media (max-width: 680px) {
  .topbar {
    min-height: 68px;
    padding: 12px 16px;
  }

  .content {
    width: min(calc(100% - 24px), 1180px);
    padding-top: 20px;
  }

  .intro-row {
    align-items: start;
    flex-direction: column;
    gap: 13px;
  }

  .intro-row h2 {
    font-size: 22px;
  }

  .intro-row .primary-button {
    width: 100%;
  }

  .category-heading {
    top: 0;
  }
}

@media (max-width: 420px) {
  .topbar {
    gap: 8px;
  }

  .eyebrow {
    font-size: 9px;
  }

  .brand-lockup h1 {
    font-size: 19px;
  }

  .topbar .primary-button {
    padding: 0 11px;
    font-size: 12px;
  }

  .content {
    width: min(calc(100% - 20px), 1180px);
  }
}
</style>

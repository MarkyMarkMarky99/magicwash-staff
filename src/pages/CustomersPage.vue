<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useCustomerStore } from '../composables/useCustomerStore'
import { useCustomerSearch } from '../composables/useCustomerSearch'
import AppLayout from '../layouts/AppLayout.vue'
import CustomerTypeTabs from '../components/customers/CustomerTypeTabs.vue'
import CustomerCard from '../components/customers/CustomerCard.vue'
import ListContainer from '../components/shared/ListContainer.vue'

const selectedType = ref('all')

const { loading, error, loadAll, byType } = useCustomerStore()
const { searchOpen, searchQuery, closeSearch } = useCustomerSearch()

const searchInputRef = ref(null)

const filteredCustomers = computed(() => {
  const base = byType(selectedType.value)
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return base
  return base.filter(c =>
    (c.index   || '').toLowerCase().includes(q) ||
    (c.name    || '').toLowerCase().includes(q) ||
    (c.phone   || '').toLowerCase().includes(q) ||
    (c.address || '').toLowerCase().includes(q)
  )
})

onMounted(() => loadAll())
onUnmounted(() => closeSearch())
</script>

<template>
  <AppLayout>

    <!-- Type tabs -->
    <div class="flex-none bg-primary text-on-primary w-full min-w-0">
      <CustomerTypeTabs
        :active-type="selectedType"
        @type-select="selectedType = $event"
      />
    </div>

    <!-- Search bar -->
    <div
      v-if="searchOpen"
      class="flex-none bg-surface-container px-4 py-2 flex items-center gap-2 border-b border-outline-variant/20"
    >
      <span class="material-symbols-outlined text-on-surface-variant text-[18px] shrink-0">search</span>
      <input
        ref="searchInputRef"
        v-model="searchQuery"
        type="text"
        placeholder="Search by index, name, phone, or address…"
        class="flex-1 bg-transparent font-body text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-none"
        autofocus
      />
      <button
        v-if="searchQuery"
        class="material-symbols-outlined text-on-surface-variant text-[18px] hover:text-on-surface transition-colors"
        @click="searchQuery = ''"
      >close</button>
    </div>

    <!-- Main content -->
    <main class="flex-1 overflow-y-auto no-scrollbar pb-20 w-full bg-surface min-w-0">

      <ListContainer
        title="Customers"
        icon="group"
        :count="filteredCustomers.length"
        count-label="Customers"
        :loading="loading"
        :error="error"
        :empty="filteredCustomers.length === 0"
        empty-text="No customers"
        :skeleton-rows="4"
      >
        <CustomerCard
          v-for="c in filteredCustomers"
          :key="c.id"
          :customer="c"
        />
      </ListContainer>

    </main>

  </AppLayout>
</template>

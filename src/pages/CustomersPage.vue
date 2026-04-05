<script setup>
import { ref, computed, onMounted } from 'vue'
import { useCustomerStore } from '../composables/useCustomerStore'
import AppLayout from '../layouts/AppLayout.vue'
import CustomerTypeTabs from '../components/CustomerTypeTabs.vue'
import CustomerCard from '../components/CustomerCard.vue'

const selectedType = ref('all')

const { loading, error, loadAll, byType } = useCustomerStore()

const filteredCustomers = computed(() => byType(selectedType.value))

onMounted(() => loadAll())
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

    <!-- Main content -->
    <main class="flex-1 overflow-y-auto no-scrollbar pb-20 w-full bg-surface min-w-0">

      <section class="bg-white w-full">
        <!-- Section heading -->
        <div class="px-4 py-2 bg-surface-container-low text-primary flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-primary text-[16px]">group</span>
            <h2 class="font-headline font-bold text-[13px] tracking-tight">Customers</h2>
          </div>
          <div class="flex items-center gap-1.5 bg-surface-container rounded-full px-2.5 py-1">
            <span class="font-label text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">
              {{ filteredCustomers.length }} Customers
            </span>
          </div>
        </div>

        <!-- Loading skeleton -->
        <div v-if="loading" class="divide-y divide-outline-variant/10">
          <div v-for="i in 4" :key="i" class="px-4 py-4 flex gap-3 animate-pulse">
            <div class="w-10 h-10 rounded-full bg-surface-container shrink-0" />
            <div class="flex-grow flex flex-col gap-2 justify-center">
              <div class="h-4 bg-surface-container rounded w-3/4" />
              <div class="h-3 bg-surface-container rounded w-1/2" />
            </div>
          </div>
        </div>

        <!-- Error -->
        <p v-else-if="error" class="px-6 py-4 text-sm text-error">{{ error }}</p>

        <!-- Empty -->
        <p v-else-if="filteredCustomers.length === 0" class="px-6 py-4 text-sm text-on-surface-variant italic">
          No customers
        </p>

        <!-- Customer list -->
        <div v-else class="divide-y divide-outline-variant/10">
          <CustomerCard
            v-for="c in filteredCustomers"
            :key="c.id"
            :customer="c"
          />
        </div>
      </section>

    </main>

  </AppLayout>
</template>

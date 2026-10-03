<script setup lang="ts">
import { computed, onActivated, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import GenericTabs from '@/shared/components/GenericTabs.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import { staffEditRoute } from '@/shared/navigation/form-routes'
import { useAuthStore } from '@/data/auth/auth.store'
import { useStaffStore } from '@/data/staff/staff.store'
import StaffCard from '../components/StaffCard.vue'
import { useStaffFilterRoute } from '../composables/useStaffFilterRoute'
import {
  STAFF_FILTER_KEYS,
  STAFF_FILTER_LABELS,
  staffStanding,
  type StaffFilterKey,
} from '../utils/staff-presentation'

defineOptions({ name: 'StaffListPage' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const staffStore = useStaffStore()
const { status, isAdmin } = storeToRefs(authStore)
const { items, loading, error, loaded } = storeToRefs(staffStore)
const { filter, updateFilter } = useStaffFilterRoute()

const counts = computed<Record<StaffFilterKey, number>>(() => ({
  all: items.value.length,
  pending: items.value.filter((row) => staffStanding(row) === 'pending').length,
  active: items.value.filter((row) => staffStanding(row) === 'active').length,
  inactive: items.value.filter((row) => staffStanding(row) === 'inactive').length,
}))
const tabs = computed(() =>
  STAFF_FILTER_KEYS.map((key) => ({ key, label: STAFF_FILTER_LABELS[key], count: counts.value[key] })),
)

// Rows waiting for approval come first so an admin cannot miss them.
const visibleStaff = computed(() =>
  items.value
    .filter((row) => filter.value === 'all' || staffStanding(row) === filter.value)
    .sort((a, b) =>
      Number(staffStanding(b) === 'pending') - Number(staffStanding(a) === 'pending')
      || (a.name || a.email).localeCompare(b.name || b.email, 'th'),
    ),
)
const listLoading = computed(() => loading.value && !loaded.value)
const listError = computed(() => (loaded.value ? null : error.value))

function openEdit(staffId: string): void {
  void router.push(staffEditRoute(staffId))
}

// This page stays cached, so it must not react to sign-out while another route is showing.
watch(
  status,
  (value) => {
    if (route.name !== 'staff-list' || value === 'loading' || isAdmin.value) return
    void router.replace('/')
  },
  { immediate: true },
)

watch(isAdmin, (admin) => {
  if (admin && route.name === 'staff-list') void staffStore.load()
})

onActivated(() => {
  if (isAdmin.value) void staffStore.load()
})
</script>

<template>
  <ListPageLayout>
    <template #filters>
      <div class="flex-none bg-primary text-on-primary">
        <GenericTabs :tabs="tabs" :active-key="filter" @select="updateFilter($event as StaffFilterKey)" />
      </div>
    </template>

    <ListContainer
      title="พนักงาน"
      icon="badge"
      :count="visibleStaff.length"
      count-label="คน"
      :loading="listLoading"
      :skeleton-rows="4"
      :error="listError"
      :empty="!listLoading && !listError && visibleStaff.length === 0"
      empty-text="ไม่พบพนักงาน"
    >
      <StaffCard v-for="member in visibleStaff" :key="member.email" :staff="member" @select="openEdit" />
    </ListContainer>
  </ListPageLayout>
</template>

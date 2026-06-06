<script setup>
import ListContainer from '../shared/ListContainer.vue'
import SwipeCard from './SwipeCard.vue'

const props = defineProps({
  title:           { type: String,   required: true },
  icon:            { type: String,   required: true },
  topDivider:      { type: Boolean,  default: false },
  items:           { type: Array,    default: () => [] },
  loading:         { type: Boolean,  default: false },
  error:           { type: String,   default: null },
  onStatusUpdate:  { type: Function, required: true },
  onReschedule:    { type: Function, required: true },
})
</script>

<template>
  <ListContainer
    :title="title"
    :icon="icon"
    :count="items.length"
    count-label="Tasks"
    :top-divider="topDivider"
    :loading="loading"
    :error="error"
    :empty="items.length === 0"
    empty-text="No appointments"
    collapsible
    :skeleton-rows="2"
    skeleton-avatar-class="w-12 h-12"
  >
    <SwipeCard
      v-for="appt in items"
      :key="appt.appointmentId || appt.customer"
      v-bind="appt"
      :on-status-update="onStatusUpdate"
      :on-reschedule="onReschedule"
    />
  </ListContainer>
</template>

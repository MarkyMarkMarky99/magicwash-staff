<script setup lang="ts">
import { computed } from 'vue'
import type { CalendarDay } from '../utils/attendance-calendar'
import { dayOfMonth, fullLabel, monthShort } from '../utils/attendance-labels'

const props = defineProps<{
  day: CalendarDay
  name: string
  showMonth: boolean
}>()
const emit = defineEmits<{ select: [date: string] }>()

const icon = computed(() => {
  if (props.day.state === 'mine') return 'check_circle'
  if (props.day.state === 'free') return 'add'
  if (props.day.state === 'locked') return 'lock'
  return null
})

const text = computed(() => {
  switch (props.day.state) {
    case 'mine':
    case 'taken':
      return props.name
    case 'past':
      return props.name || '–'
    case 'today':
      return 'Today'
    case 'free':
      return 'Free'
    case 'locked':
      return 'Locked'
    default:
      return 'Not yet'
  }
})

const ariaLabel = computed(() => {
  const label = fullLabel(props.day.date)
  switch (props.day.state) {
    case 'mine': return `${label}, your day off`
    case 'taken': return `${label}, ${props.name} is off`
    case 'past': return `${label}, past`
    case 'today': return `${label}, today`
    case 'free': return `${label}, free, tap to book`
    case 'locked': return `${label}, free but you are already off this week`
    default: return `${label}, not open yet`
  }
})
</script>

<template>
  <button
    type="button"
    class="day"
    :class="`st-${day.state}`"
    :aria-label="ariaLabel"
    @click="emit('select', day.date)"
  >
    <span class="num">{{ dayOfMonth(day.date) }}<small v-if="showMonth">{{ monthShort(day.date) }}</small></span>
    <span class="lbl">
      <span v-if="icon" class="material-symbols-outlined" aria-hidden="true">{{ icon }}</span>
      {{ text }}
    </span>
  </button>
</template>

<style scoped>
.day {
  position: relative;
  display: flex;
  height: 74px;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  overflow: hidden;
  border-radius: 10px;
  padding: 6px 2px 5px;
  text-align: center;
  -webkit-tap-highlight-color: transparent;
}

.day:focus-visible {
  outline: 2px solid var(--color-lime);
  outline-offset: 2px;
}

.num {
  font-family: var(--font-headline);
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.num small {
  display: block;
  margin-top: 1px;
  font-family: var(--font-body);
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1;
  text-transform: uppercase;
}

.lbl {
  display: flex;
  max-width: 100%;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  overflow: hidden;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lbl .material-symbols-outlined {
  font-size: 17px;
}

.st-free {
  border: 2px solid var(--color-primary);
  background: var(--color-surface-container-lowest);
  box-shadow: 0 2px 0 var(--color-primary);
  color: var(--color-primary);
}

.st-free:active {
  box-shadow: 0 1px 0 var(--color-primary);
  transform: translateY(1px);
}

.st-taken {
  border: 1px solid var(--color-outline-variant);
  background: var(--color-surface-container-high);
  color: var(--color-on-surface);
}

.st-taken .lbl {
  font-size: 10.5px;
}

.st-mine {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.st-mine::after {
  position: absolute;
  top: -7px;
  right: -7px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-lime);
  content: '';
}

.st-mine .lbl .material-symbols-outlined {
  color: var(--color-lime);
  font-variation-settings: 'FILL' 1, 'wght' 600;
}

.st-locked {
  border: 1px dashed var(--color-outline-variant);
  background: repeating-linear-gradient(135deg, var(--color-surface-container-low) 0 5px, var(--color-surface) 5px 10px);
  color: var(--color-on-surface-variant);
}

.st-past {
  background: var(--color-surface-container-low);
  color: var(--color-on-surface-variant);
  opacity: 0.7;
}

.st-past .num {
  text-decoration: line-through;
  text-decoration-thickness: 1.5px;
}

.st-today {
  border: 1.5px solid var(--color-primary);
  background: var(--color-surface-container-low);
  color: var(--color-on-surface-variant);
}

.st-today .num {
  color: var(--color-on-surface);
}

.st-outside {
  border: 1px dashed var(--color-outline-variant);
  background: transparent;
  color: var(--color-on-surface-variant);
  opacity: 0.5;
}

.st-outside .lbl {
  font-weight: 500;
}
</style>

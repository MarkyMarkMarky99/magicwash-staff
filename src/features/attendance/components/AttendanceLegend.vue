<template>
  <div class="mb-3.5 mt-3 flex flex-wrap gap-x-3 gap-y-1.5 px-0.5" aria-label="Legend" role="group">
    <span class="legend-item"><i class="legend-swatch bg-primary" />Your day off</span>
    <span class="legend-item"><i class="legend-swatch border-2 border-primary bg-surface-container-lowest" />Free</span>
    <span class="legend-item"><i class="legend-swatch border border-outline-variant bg-surface-container-high" />Taken</span>
    <span class="legend-item"><i class="legend-swatch legend-locked border border-dashed border-outline-variant" />Free, but you're off that week</span>
    <span class="legend-item"><i class="legend-swatch border border-dashed border-outline-variant opacity-60" />Not open</span>
  </div>
</template>

<style scoped>
.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--color-on-surface-variant);
}

.legend-swatch {
  display: block;
  width: 14px;
  height: 14px;
  flex: none;
  border-radius: 4px;
}

.legend-locked {
  background: repeating-linear-gradient(135deg, var(--color-surface-container-low) 0 3px, var(--color-surface) 3px 6px);
}
</style>

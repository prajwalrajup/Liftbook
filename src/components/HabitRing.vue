<template>
  <svg :width="size" :height="size" viewBox="0 0 44 44" role="img" :aria-label="label">
    <circle cx="22" cy="22" :r="R" class="track" :class="{ fail: rate != null }" />
    <circle
      v-if="rate != null && rate > 0"
      cx="22" cy="22" :r="R"
      class="arc"
      :stroke-dasharray="`${rate * C} ${C}`"
      transform="rotate(-90 22 22)"
    />
    <text x="22" y="26" text-anchor="middle" class="pct">{{ rate == null ? '—' : Math.round(rate * 100) + '%' }}</text>
  </svg>
</template>

<script setup>
import { computed } from 'vue'

// rate: 0..1 or null. Track (missed share) in danger tint, arc (success share) in success.
const props = defineProps({
  rate: { type: Number, default: null },
  size: { type: Number, default: 64 },
})

const R = 18
const C = 2 * Math.PI * R
const label = computed(() => (props.rate == null ? 'No data yet' : `${Math.round(props.rate * 100)}% success`))
</script>

<style scoped>
.track { fill: none; stroke: var(--border); stroke-width: 5; }
.track.fail { stroke: var(--danger); opacity: 0.6; }
.arc { fill: none; stroke: var(--success); stroke-width: 5; stroke-linecap: butt; }
.pct { fill: var(--text); font-size: 10px; font-weight: 700; }
</style>

<template>
  <main class="page">
    <h1 class="page-title">Workout</h1>

    <div class="seg" role="tablist">
      <button
        v-for="s in sections"
        :key="s.key"
        role="tab"
        :aria-selected="active === s.key"
        :class="{ on: active === s.key }"
        @click="select(s.key)"
      >
        {{ s.label }}
      </button>
    </div>

    <RoutinesSection v-if="active === 'routines'" />
    <ScheduleSection v-else-if="active === 'schedule'" />
    <HistorySection v-else-if="active === 'history'" />
    <BodySection v-else-if="active === 'body'" />
  </main>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import RoutinesSection from '../components/workout/RoutinesSection.vue'
import ScheduleSection from '../components/workout/ScheduleSection.vue'
import HistorySection from '../components/workout/HistorySection.vue'
import BodySection from '../components/workout/BodySection.vue'

const sections = [
  { key: 'routines', label: 'Routines' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'history', label: 'History' },
  { key: 'body', label: 'Body' },
]

const route = useRoute()
const router = useRouter()

const active = computed(() =>
  sections.some((s) => s.key === route.query.s) ? route.query.s : 'routines',
)

function select(key) {
  router.replace({ path: '/workout', query: { s: key } })
}
</script>

<style scoped>
.seg { display: flex; gap: 6px; margin-bottom: 16px; }
.seg button {
  flex: 1; min-height: 44px; padding: 0 4px; border-radius: var(--radius-sm);
  background: var(--bg-elevated); color: var(--text-secondary);
  border: 1px solid var(--border); font-size: 14px; font-weight: 600;
}
.seg button.on { background: var(--accent-dim); color: var(--accent); border-color: var(--accent); }
</style>

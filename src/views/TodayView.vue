<template>
  <main class="page">
    <div class="today-header">
      <span class="today-weekday">{{ weekday }}</span>
      <span class="today-date">{{ dateStr }}</span>
    </div>

    <div v-if="!scheduleStore.loaded" class="empty-state"><p>Loading…</p></div>

    <template v-else>
      <!-- Rest day -->
      <div v-if="todayEntry?.is_rest_day" class="state-card rest-card">
        <div class="state-icon">🛌</div>
        <div class="state-label">Rest Day</div>
        <p class="state-sub">Recovery is part of training.</p>
      </div>

      <!-- Has routine -->
      <div v-else-if="todayEntry?.routine_name" class="state-card routine-card">
        <div class="state-icon">💪</div>
        <div class="state-label">{{ todayEntry.routine_name }}</div>
        <RouterLink
          :to="`/workout/${todayEntry.routine_id}`"
          class="btn btn-primary btn-full start-btn"
        >
          Start Workout
        </RouterLink>
      </div>

      <!-- Nothing assigned -->
      <div v-else class="state-card empty-card">
        <div class="state-icon">📅</div>
        <div class="state-label">No routine today</div>
        <RouterLink to="/calendar" class="btn btn-secondary btn-full" style="margin-top:16px">
          Set up schedule
        </RouterLink>
      </div>
    </template>
  </main>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useScheduleStore } from '../stores/schedule.js'

const scheduleStore = useScheduleStore()
onMounted(() => scheduleStore.load())

const now = new Date()
const weekday = now.toLocaleDateString('en-US', { weekday: 'long' })
const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

const todayEntry = computed(() => scheduleStore.todayEntry())
</script>

<style scoped>
.today-header {
  margin-bottom: 28px;
}
.today-weekday {
  display: block;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.5px;
}
.today-date {
  display: block;
  font-size: 15px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.state-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 32px 20px 28px;
  text-align: center;
}
.state-icon { font-size: 48px; margin-bottom: 12px; }
.state-label { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
.state-sub { color: var(--text-secondary); font-size: 14px; }

.routine-card .state-label { color: var(--text); }
.start-btn { margin-top: 24px; min-height: 52px; font-size: 17px; }
</style>

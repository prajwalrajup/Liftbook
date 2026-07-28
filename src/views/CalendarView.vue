<template>
  <main class="page">
    <h1 class="page-title">Calendar</h1>

    <div v-if="!scheduleStore.loaded || !routinesStore.loaded" class="empty-state">
      <p>Loading…</p>
    </div>

    <div v-else class="day-list">
      <button
        v-for="day in days"
        :key="day.dow"
        class="day-card"
        :class="{ today: day.dow === todayDow }"
        @click="openSheet(day)"
      >
        <div class="day-left">
          <span class="day-name">{{ day.label }}</span>
          <span v-if="day.dow === todayDow" class="today-badge">Today</span>
        </div>
        <div class="day-right">
          <span v-if="entry(day.dow)?.is_rest_day" class="day-status rest">Rest day</span>
          <span v-else-if="entry(day.dow)?.routine_name" class="day-status routine">{{ entry(day.dow).routine_name }}</span>
          <span v-else class="day-status empty">—</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </button>
    </div>

    <Teleport to="body">
      <div v-if="sheet" class="sheet-backdrop" @click="sheet = null">
        <div class="sheet" @click.stop>
          <div class="sheet-handle" />
          <div class="sheet-body">
            <h2 class="sheet-day-title">{{ sheet.label }}</h2>

            <!-- Routine options -->
            <p class="sheet-section-label">Assign a routine</p>
            <div class="routine-options">
              <button
                v-for="r in routinesStore.routines"
                :key="r.id"
                class="option-btn"
                :class="{ active: entry(sheet.dow)?.routine_id === r.id }"
                @click="assign(sheet.dow, r.id)"
              >
                {{ r.name }}
              </button>
              <p v-if="routinesStore.routines.length === 0" style="color:var(--text-secondary);font-size:14px">
                No routines yet — create one in Routines first.
              </p>
            </div>

            <div class="divider" />

            <!-- Rest / clear -->
            <div class="sheet-row-btns">
              <button
                class="btn btn-secondary"
                :class="{ 'btn-active-rest': entry(sheet.dow)?.is_rest_day }"
                style="flex:1"
                @click="assignRest(sheet.dow)"
              >
                🛌 Rest day
              </button>
              <button class="btn btn-ghost" style="flex:1;color:var(--danger)" @click="clearDay(sheet.dow)">
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </main>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useScheduleStore } from '../stores/schedule.js'
import { useRoutinesStore } from '../stores/routines.js'

const scheduleStore = useScheduleStore()
const routinesStore = useRoutinesStore()

onMounted(async () => {
  await Promise.all([scheduleStore.load(), routinesStore.load()])
})

const todayDow = new Date().getDay()

const days = [
  { dow: 1, label: 'Monday' },
  { dow: 2, label: 'Tuesday' },
  { dow: 3, label: 'Wednesday' },
  { dow: 4, label: 'Thursday' },
  { dow: 5, label: 'Friday' },
  { dow: 6, label: 'Saturday' },
  { dow: 0, label: 'Sunday' },
]

const sheet = ref(null)

function entry(dow) { return scheduleStore.schedule[dow] ?? null }
function openSheet(day) { sheet.value = day }

async function assign(dow, routineId) {
  await scheduleStore.setDay(dow, { routineId, isRestDay: false })
  sheet.value = null
}

async function assignRest(dow) {
  await scheduleStore.setDay(dow, { routineId: null, isRestDay: true })
  sheet.value = null
}

async function clearDay(dow) {
  await scheduleStore.setDay(dow, { routineId: null, isRestDay: false })
  sheet.value = null
}
</script>

<style scoped>
.day-list { display: flex; flex-direction: column; gap: 1px; }

.day-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 14px;
  background: var(--bg-surface);
  border: none;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  cursor: pointer;
  text-align: left;
  width: 100%;
}
.day-card:first-child { border-radius: var(--radius) var(--radius) 0 0; }
.day-card:last-child  { border-radius: 0 0 var(--radius) var(--radius); border-bottom: none; }
.day-card:active { background: var(--bg-elevated); }
.day-card.today { border-left: 3px solid var(--accent); }

.day-left { display: flex; align-items: center; gap: 10px; }
.day-name { font-size: 16px; font-weight: 500; }
.today-badge {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.5px; color: var(--accent);
  background: var(--accent-dim); padding: 2px 7px; border-radius: 10px;
}

.day-right { display: flex; align-items: center; gap: 8px; color: var(--text-secondary); }
.day-status { font-size: 14px; }
.day-status.rest    { color: var(--text-secondary); font-style: italic; }
.day-status.routine { color: var(--text); font-weight: 500; }
.day-status.empty   { color: var(--border); }

/* Sheet */
.sheet-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  z-index: 200; display: flex; align-items: flex-end;
}
.sheet {
  background: var(--bg-surface); border-radius: 20px 20px 0 0;
  width: 100%; max-height: 80dvh; overflow-y: auto;
  border-top: 1px solid var(--border);
}
.sheet-handle {
  width: 36px; height: 4px; background: var(--border);
  border-radius: 2px; margin: 12px auto 4px;
}
.sheet-body { padding: 12px 20px 48px; }
.sheet-day-title { font-size: 20px; font-weight: 700; margin-bottom: 20px; }
.sheet-section-label { font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }

.routine-options { display: flex; flex-direction: column; gap: 8px; margin-bottom: 4px; }
.option-btn {
  padding: 14px 16px; text-align: left;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text);
  font-size: 15px; font-weight: 500; cursor: pointer;
}
.option-btn.active {
  border-color: var(--accent); background: var(--accent-dim); color: var(--accent); font-weight: 600;
}
.option-btn:active { opacity: 0.7; }

.sheet-row-btns { display: flex; gap: 10px; }
.btn-active-rest { border-color: var(--accent) !important; color: var(--accent) !important; }
</style>

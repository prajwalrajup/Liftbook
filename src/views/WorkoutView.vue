<template>
  <div class="workout-root">
    <!-- Loading -->
    <div v-if="loading" class="workout-loading">
      <p>Starting workout…</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="workout-loading">
      <p style="color:var(--danger)">{{ error }}</p>
      <button class="btn btn-secondary" style="margin-top:16px" @click="router.back()">Go back</button>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="workout-header">
        <button class="btn btn-ghost icon-only" @click="confirmExit">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="workout-header-title">
          <span class="workout-name">{{ store.session?.routineName }}</span>
          <span class="workout-progress">{{ store.currentIdx + 1 }} / {{ store.exercises.length }}</span>
        </div>
        <button class="btn btn-danger-sm" @click="finish">Finish</button>
      </div>

      <!-- Exercise dots -->
      <div class="ex-dots">
        <button
          v-for="(ex, i) in store.exercises"
          :key="ex.exercise_id"
          class="ex-dot"
          :class="{ active: i === store.currentIdx, done: isDone(ex) }"
          @click="store.goTo(i)"
        />
      </div>

      <!-- Current exercise -->
      <div v-if="currentEx" class="ex-area">
        <div class="ex-title-row">
          <h2 class="ex-title">{{ currentEx.name }}</h2>
          <span v-if="currentEx.target_sets || currentEx.target_reps" class="ex-target">
            {{ currentEx.target_sets ? currentEx.target_sets + ' sets' : '' }}
            {{ currentEx.target_sets && currentEx.target_reps ? '×' : '' }}
            {{ currentEx.target_reps || '' }}
          </span>
        </div>

        <!-- Logged sets -->
        <div class="sets-list">
          <div
            v-for="mainSet in mainSets"
            :key="`${currentEx.exercise_id}-${mainSet.set_number}`"
            class="set-group"
          >
            <!-- Main set row -->
            <div class="set-row">
              <span class="set-num">{{ mainSet.set_number }}</span>
              <span class="set-val">{{ mainSet.weight != null ? mainSet.weight + ' kg' : '—' }}</span>
              <span class="set-x">×</span>
              <span class="set-val">{{ mainSet.reps != null ? mainSet.reps + ' reps' : '—' }}</span>
              <button class="drop-btn" @click="openDrop(mainSet.set_number)">+ drop</button>
            </div>
            <!-- Drop sets -->
            <div
              v-for="drop in dropSets(mainSet.set_number)"
              :key="`drop-${drop.drop_number}`"
              class="set-row drop-row"
            >
              <span class="set-num drop-label">↳ drop {{ drop.drop_number }}</span>
              <span class="set-val">{{ drop.weight != null ? drop.weight + ' kg' : '—' }}</span>
              <span class="set-x">×</span>
              <span class="set-val">{{ drop.reps != null ? drop.reps + ' reps' : '—' }}</span>
            </div>
          </div>

          <div v-if="mainSets.length === 0" class="no-sets">
            No sets logged yet
          </div>
        </div>

        <!-- Log set input -->
        <div class="log-area">
          <div class="log-area-header">
            <div class="set-badge">Set {{ store.nextSetNumber(currentEx.exercise_id) }}</div>
            <button
              v-if="prevSetHint"
              class="use-last-btn"
              @click="applyLast"
            >
              Last: {{ prevSetHint }} ↑ Use
            </button>
          </div>
          <div class="input-row">
            <div class="input-group">
              <button class="step-btn" @click="stepWeight(-2.5)">−</button>
              <div class="input-wrap">
                <input
                  v-model.number="weightInput"
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="0"
                  class="big-input"
                  inputmode="decimal"
                />
                <span class="input-unit">kg</span>
              </div>
              <button class="step-btn" @click="stepWeight(2.5)">+</button>
            </div>
            <span class="input-sep">×</span>
            <div class="input-group">
              <button class="step-btn" @click="stepReps(-1)">−</button>
              <div class="input-wrap">
                <input
                  v-model.number="repsInput"
                  type="number"
                  min="0"
                  placeholder="0"
                  class="big-input"
                  inputmode="numeric"
                />
                <span class="input-unit">reps</span>
              </div>
              <button class="step-btn" @click="stepReps(1)">+</button>
            </div>
          </div>
          <button class="btn btn-primary btn-full log-btn" :disabled="logging" @click="logSet">
            {{ logging ? 'Logging…' : 'Log Set' }}
          </button>
        </div>
      </div>

      <!-- Prev / Next -->
      <div class="nav-row">
        <button
          class="btn btn-secondary nav-btn"
          :disabled="store.currentIdx === 0"
          @click="store.goTo(store.currentIdx - 1)"
        >
          ← Prev
        </button>
        <button
          class="btn btn-secondary nav-btn"
          :disabled="store.currentIdx === store.exercises.length - 1"
          @click="store.goTo(store.currentIdx + 1)"
        >
          Next →
        </button>
      </div>
    </template>

    <!-- Rest timer banner -->
    <Teleport to="body">
      <div v-if="store.restActive" class="rest-banner">
        <div class="rest-info">
          <span class="rest-label">Rest</span>
          <span class="rest-time">{{ formatRest(store.restSecondsLeft) }}</span>
        </div>
        <div class="rest-bar-track">
          <div class="rest-bar-fill" :style="{ width: restPercent + '%' }" />
        </div>
        <button class="rest-skip" @click="store.trimRest(15)">−15s</button>
        <button class="rest-skip" @click="store.stopRestTimer()">Skip</button>
      </div>
    </Teleport>

    <!-- Drop set modal -->
    <Teleport to="body">
      <div v-if="dropModal" class="sheet-backdrop" @click="dropModal = null">
        <div class="sheet" @click.stop>
          <div class="sheet-handle" />
          <div class="sheet-body">
            <h2 style="margin-bottom:16px">Drop set — Set {{ dropModal.setNumber }}</h2>
            <div class="input-row" style="margin-bottom:16px">
              <div class="input-group">
                <button class="step-btn" @click="dropWeight -= 2.5">−</button>
                <div class="input-wrap">
                  <input v-model.number="dropWeight" type="number" step="0.5" min="0" class="big-input" inputmode="decimal" />
                  <span class="input-unit">kg</span>
                </div>
                <button class="step-btn" @click="dropWeight += 2.5">+</button>
              </div>
              <span class="input-sep">×</span>
              <div class="input-group">
                <button class="step-btn" @click="dropReps = Math.max(0, dropReps - 1)">−</button>
                <div class="input-wrap">
                  <input v-model.number="dropReps" type="number" min="0" class="big-input" inputmode="numeric" />
                  <span class="input-unit">reps</span>
                </div>
                <button class="step-btn" @click="dropReps++">+</button>
              </div>
            </div>
            <button class="btn btn-primary btn-full" :disabled="loggingDrop" @click="logDrop">
              {{ loggingDrop ? 'Logging…' : 'Log Drop Set' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useWorkoutStore } from '../stores/workout.js'

const router = useRouter()
const route = useRoute()
const store = useWorkoutStore()

const loading = ref(true)
const error = ref('')
const logging = ref(false)
const loggingDrop = ref(false)
const weightInput = ref(0)
const repsInput = ref(0)
const dropModal = ref(null)
const dropWeight = ref(0)
const dropReps = ref(0)
let restTotal = 0

onMounted(async () => {
  try {
    await store.startSession(route.params.routineId)
    prefillFromLast()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

// Pre-fill inputs when switching exercises
watch(() => store.currentIdx, () => prefillFromLast())

const currentEx = computed(() => store.currentExercise)

const mainSets = computed(() => {
  if (!currentEx.value) return []
  return store.setsFor(currentEx.value.exercise_id).filter(s => s.drop_number === 0)
})

function dropSets(setNumber) {
  if (!currentEx.value) return []
  return store.setsFor(currentEx.value.exercise_id)
    .filter(s => s.set_number === setNumber && s.drop_number > 0)
    .sort((a, b) => a.drop_number - b.drop_number)
}

function isDone(ex) {
  const logged = store.setsFor(ex.exercise_id).filter(s => s.drop_number === 0).length
  return ex.target_sets && logged >= ex.target_sets
}

function stepWeight(delta) {
  weightInput.value = Math.max(0, (weightInput.value || 0) + delta)
}
function stepReps(delta) {
  repsInput.value = Math.max(0, (repsInput.value || 0) + delta)
}

// Last-session hint for the NEXT set about to be logged
const prevSetHint = computed(() => {
  if (!currentEx.value) return null
  const nextNum = store.nextSetNumber(currentEx.value.exercise_id)
  const last = store.lastSetForNumber(currentEx.value.exercise_id, nextNum)
  if (!last || (last.weight == null && last.reps == null)) return null
  const w = last.weight != null ? `${last.weight} kg` : ''
  const r = last.reps != null ? `${last.reps} reps` : ''
  return [w, r].filter(Boolean).join(' × ')
})

function prefillFromLast() {
  if (!store.currentExercise) return
  const exId = store.currentExercise.exercise_id
  const nextNum = store.nextSetNumber(exId)
  const last = store.lastSetForNumber(exId, nextNum)
  if (last) {
    weightInput.value = last.weight ?? 0
    repsInput.value = last.reps ?? 0
  }
}

function applyLast() {
  if (!currentEx.value) return
  const nextNum = store.nextSetNumber(currentEx.value.exercise_id)
  const last = store.lastSetForNumber(currentEx.value.exercise_id, nextNum)
  if (last) {
    weightInput.value = last.weight ?? weightInput.value
    repsInput.value = last.reps ?? repsInput.value
  }
}

const restPercent = computed(() => {
  if (!restTotal) return 0
  return Math.max(0, (store.restSecondsLeft / restTotal) * 100)
})

function formatRest(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `${sec}s`
}

async function logSet() {
  if (!currentEx.value) return
  logging.value = true
  try {
    restTotal = currentEx.value.rest_seconds ?? store.session.defaultRest
    await store.logSet(currentEx.value.exercise_id, weightInput.value || null, repsInput.value || null)
    prefillFromLast()
  } catch (e) {
    alert(e.message)
  } finally {
    logging.value = false
  }
}

function openDrop(setNumber) {
  // Pre-fill with last weight for this set, reduced
  const mainSet = store.setsFor(currentEx.value.exercise_id).find(s => s.set_number === setNumber && s.drop_number === 0)
  dropWeight.value = mainSet?.weight ? mainSet.weight - 10 : 0
  dropReps.value = mainSet?.reps ?? 0
  dropModal.value = { setNumber }
}

async function logDrop() {
  loggingDrop.value = true
  try {
    restTotal = currentEx.value.rest_seconds ?? store.session.defaultRest
    await store.logDrop(currentEx.value.exercise_id, dropModal.value.setNumber, dropWeight.value || null, dropReps.value || null)
    dropModal.value = null
  } catch (e) {
    alert(e.message)
  } finally {
    loggingDrop.value = false
  }
}

async function finish() {
  if (!confirm('Finish this workout?')) return
  await store.finishSession()
  router.replace('/history')
}

function confirmExit() {
  if (store.status === 'active') {
    if (!confirm('Exit without finishing? Session will stay open.')) return
  }
  router.back()
}
</script>

<style scoped>
.workout-root {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background: var(--bg);
  overflow: hidden;
}

.workout-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

/* Header */
.workout-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 12px 8px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.icon-only { padding: 0; width: 44px; min-height: 44px; }
.workout-header-title { flex: 1; min-width: 0; }
.workout-name { display: block; font-size: 15px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.workout-progress { display: block; font-size: 12px; color: var(--text-secondary); }
.btn-danger-sm {
  min-height: 36px; padding: 0 12px; font-size: 13px; font-weight: 700;
  background: transparent; border: 1px solid var(--danger); color: var(--danger);
  border-radius: var(--radius-sm); cursor: pointer;
}
.btn-danger-sm:active { opacity: 0.7; }

/* Exercise dots */
.ex-dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  flex-shrink: 0;
}
.ex-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--border);
  border: none; cursor: pointer;
  transition: background 0.15s, width 0.15s;
  padding: 0;
}
.ex-dot.active { background: var(--accent); width: 20px; border-radius: 4px; }
.ex-dot.done { background: var(--success); }

/* Exercise area */
.ex-area {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 12px;
  -webkit-overflow-scrolling: touch;
}

.ex-title-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 16px;
  padding-top: 4px;
}
.ex-title { font-size: 20px; font-weight: 800; flex: 1; }
.ex-target { font-size: 13px; color: var(--text-secondary); white-space: nowrap; }

/* Sets list */
.sets-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 20px;
}
.set-group { display: flex; flex-direction: column; gap: 2px; }
.set-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-surface);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
}
.drop-row {
  background: var(--bg-elevated);
  margin-left: 20px;
}
.set-num { font-size: 13px; font-weight: 700; color: var(--accent); min-width: 20px; }
.drop-label { font-size: 12px; color: var(--text-secondary); min-width: 56px; }
.set-val { font-size: 15px; font-weight: 600; }
.set-x { color: var(--text-secondary); font-size: 13px; }
.drop-btn {
  margin-left: auto;
  font-size: 12px; font-weight: 600; color: var(--accent);
  background: var(--accent-dim); border: none; border-radius: 8px;
  padding: 4px 10px; cursor: pointer; min-height: 28px;
}
.no-sets { color: var(--text-secondary); font-size: 14px; padding: 8px 0; }

/* Log area */
.log-area {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
}
.log-area-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;
}
.set-badge {
  font-size: 12px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.5px; color: var(--text-secondary);
}
.use-last-btn {
  font-size: 12px; font-weight: 600; color: var(--accent);
  background: var(--accent-dim); border: none; border-radius: 8px;
  padding: 4px 10px; cursor: pointer; min-height: 28px;
}
.use-last-btn:active { opacity: 0.7; }
.input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}
.input-group {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 4px;
}
.step-btn {
  width: 36px; height: 44px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text);
  font-size: 18px; font-weight: 600; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.step-btn:active { opacity: 0.7; }
.input-wrap { flex: 1; position: relative; }
.big-input {
  width: 100%; padding: 10px 8px 10px; font-size: 20px; font-weight: 700;
  text-align: center; border-radius: var(--radius-sm);
}
.input-unit {
  position: absolute; bottom: 4px; right: 6px;
  font-size: 10px; color: var(--text-secondary); font-weight: 600;
}
.input-sep { font-size: 20px; font-weight: 300; color: var(--text-secondary); flex-shrink: 0; }
.log-btn { min-height: 50px; font-size: 17px; }

/* Nav row */
.nav-row {
  display: flex;
  gap: 10px;
  padding: 10px 16px calc(var(--tab-h) + var(--safe-bottom) + 10px);
  flex-shrink: 0;
}
.nav-btn { flex: 1; }

/* Rest timer banner */
.rest-banner {
  position: fixed;
  bottom: calc(var(--tab-h) + var(--safe-bottom));
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  background: var(--bg-elevated);
  border-top: 2px solid var(--accent);
  padding: 10px 16px;
  z-index: 150;
  display: flex;
  align-items: center;
  gap: 12px;
}
.rest-info { display: flex; flex-direction: column; min-width: 56px; }
.rest-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); }
.rest-time { font-size: 22px; font-weight: 800; color: var(--accent); line-height: 1; }
.rest-bar-track { flex: 1; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
.rest-bar-fill { height: 100%; background: var(--accent); border-radius: 2px; transition: width 1s linear; }
.rest-skip {
  background: transparent; border: 1px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text-secondary);
  font-size: 13px; font-weight: 600; padding: 6px 12px;
  cursor: pointer; white-space: nowrap; min-height: 36px;
}

/* Drop sheet */
.sheet-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  z-index: 200; display: flex; align-items: flex-end;
}
.sheet {
  background: var(--bg-surface); border-radius: 20px 20px 0 0;
  width: 100%; border-top: 1px solid var(--border);
}
.sheet-handle {
  width: 36px; height: 4px; background: var(--border);
  border-radius: 2px; margin: 12px auto 4px;
}
.sheet-body { padding: 12px 20px 48px; }
</style>

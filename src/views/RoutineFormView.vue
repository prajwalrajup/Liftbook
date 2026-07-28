<template>
  <main class="page">
    <div class="header-row">
      <button class="btn btn-ghost back-btn" @click="router.back()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <h1 class="page-title" style="margin:0">{{ isEdit ? 'Edit Routine' : 'New Routine' }}</h1>
      <button class="btn btn-primary save-btn" :disabled="saving" @click="save">
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
    </div>

    <p v-if="saveError" class="save-error">{{ saveError }}</p>

    <!-- Routine name -->
    <div class="form-field">
      <label>Routine name</label>
      <input v-model="form.name" placeholder="e.g. Push Day" />
    </div>

    <!-- Default rest -->
    <div class="form-field">
      <label>Default rest between sets</label>
      <div class="rest-row">
        <button class="rest-step-btn" @click="stepRest(-15)">−</button>
        <span class="rest-value">{{ form.rest_between_sets_seconds }}s</span>
        <button class="rest-step-btn" @click="stepRest(15)">+</button>
      </div>
    </div>

    <div class="divider" />

    <!-- Exercise list -->
    <div class="section-header">
      <span class="section-title">Exercises</span>
      <span class="section-count">{{ items.length }}</span>
    </div>

    <div class="exercise-items">
      <div v-for="(item, i) in items" :key="item._key" class="ex-card">
        <div class="ex-card-header">
          <div class="ex-card-name">{{ item.name }}</div>
          <div class="ex-card-actions">
            <button class="icon-btn" :disabled="i === 0" @click="moveUp(i)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            <button class="icon-btn" :disabled="i === items.length - 1" @click="moveDown(i)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <button class="icon-btn danger" @click="removeItem(i)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div class="ex-card-inputs">
          <div class="mini-field">
            <label>Sets</label>
            <input v-model.number="item.target_sets" type="number" min="1" placeholder="3" class="mini-input" />
          </div>
          <div class="mini-field">
            <label>Reps</label>
            <input v-model="item.target_reps" placeholder="8-12" class="mini-input" />
          </div>
          <div class="mini-field">
            <label>Rest (s)</label>
            <input v-model.number="item.rest_seconds" type="number" min="0" :placeholder="form.rest_between_sets_seconds" class="mini-input" />
          </div>
        </div>
      </div>

      <div v-if="items.length === 0" class="empty-state" style="padding:24px">
        <p>No exercises yet. Add one below.</p>
      </div>
    </div>

    <button class="btn btn-secondary btn-full add-ex-btn" @click="pickerOpen = true">
      + Add exercise
    </button>

    <!-- Exercise picker sheet -->
    <Teleport to="body">
      <div v-if="pickerOpen" class="picker-overlay">
        <ExercisesView :pick-mode="true" @pick="onPick" @cancel="pickerOpen = false" />
      </div>
    </Teleport>
  </main>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useRoutinesStore } from '../stores/routines.js'
import { useExercisesStore } from '../stores/exercises.js'
import ExercisesView from './ExercisesView.vue'

const router = useRouter()
const route = useRoute()
const routinesStore = useRoutinesStore()
const exercisesStore = useExercisesStore()

const isEdit = !!route.params.id
const saving = ref(false)
const saveError = ref('')
const pickerOpen = ref(false)

const form = ref({ name: '', rest_between_sets_seconds: 90 })
const items = ref([]) // { _key, exercise_id, name, type, target_sets, target_reps, rest_seconds }

let keyCounter = 0
function nextKey() { return ++keyCounter }

onMounted(async () => {
  await exercisesStore.load()
  if (isEdit) {
    const routine = await routinesStore.getWithExercises(route.params.id)
    form.value = { name: routine.name, rest_between_sets_seconds: routine.rest_between_sets_seconds }
    items.value = routine.exercises.map(e => ({
      _key: nextKey(),
      exercise_id: e.exercise_id,
      name: e.name,
      type: e.type,
      target_sets: e.target_sets,
      target_reps: e.target_reps,
      rest_seconds: e.rest_seconds,
    }))
  }
})

function stepRest(delta) {
  form.value.rest_between_sets_seconds = Math.max(15, form.value.rest_between_sets_seconds + delta)
}

function moveUp(i) {
  const arr = items.value
  ;[arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]
}

function moveDown(i) {
  const arr = items.value
  ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
}

function removeItem(i) {
  items.value.splice(i, 1)
}

async function onPick(exercise) {
  pickerOpen.value = false
  // Ensure the exercise row exists in DB (FK requirement)
  await exercisesStore.ensureInDb(exercise)
  items.value.push({
    _key: nextKey(),
    exercise_id: exercise.id,
    name: exercise.name,
    type: exercise.type,
    target_sets: null,
    target_reps: null,
    rest_seconds: null,
  })
}

async function save() {
  if (!form.value.name.trim()) { saveError.value = 'Routine name is required.'; return }
  saving.value = true
  saveError.value = ''
  try {
    const payload = {
      name: form.value.name.trim(),
      rest_between_sets_seconds: form.value.rest_between_sets_seconds,
    }
    if (isEdit) {
      await routinesStore.update(route.params.id, payload, items.value)
    } else {
      await routinesStore.create(payload, items.value)
    }
    router.back()
  } catch (e) {
    saveError.value = e.message
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.header-row {
  display: flex; align-items: center; gap: 8px; margin-bottom: 20px;
}
.back-btn { padding: 0; min-height: 44px; width: 44px; }
.save-btn { margin-left: auto; }
.save-error { color: var(--danger); font-size: 13px; margin-bottom: 12px; }

.form-field { margin-bottom: 20px; }

.rest-row {
  display: flex; align-items: center; gap: 16px; margin-top: 6px;
}
.rest-step-btn {
  width: 44px; height: 44px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text);
  font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.rest-step-btn:active { opacity: 0.7; }
.rest-value { font-size: 22px; font-weight: 700; min-width: 60px; text-align: center; }

.section-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
}
.section-title { font-size: 13px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
.section-count {
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 10px; padding: 1px 7px; font-size: 12px; color: var(--text-secondary);
}

.exercise-items { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }

.ex-card {
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 12px 14px;
}
.ex-card-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
}
.ex-card-name { flex: 1; font-size: 15px; font-weight: 600; }
.ex-card-actions { display: flex; gap: 4px; }

.icon-btn {
  width: 34px; height: 34px; border-radius: 8px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  color: var(--text-secondary); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.icon-btn:disabled { opacity: 0.3; cursor: default; }
.icon-btn.danger { color: var(--danger); border-color: transparent; }
.icon-btn:active { opacity: 0.7; }

.ex-card-inputs { display: flex; gap: 8px; }
.mini-field { flex: 1; }
.mini-field label { font-size: 11px; }
.mini-input { padding: 8px 10px; font-size: 14px; text-align: center; }

.add-ex-btn { margin-top: 4px; }

/* Exercise picker overlay */
.picker-overlay {
  position: fixed; inset: 0; background: var(--bg); z-index: 300;
  display: flex; flex-direction: column; overflow: hidden;
}
</style>

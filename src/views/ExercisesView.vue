<template>
  <main class="page">
    <div class="header-row">
      <button class="back-btn btn btn-ghost" @click="pickMode ? emit('cancel') : router.back()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <h1 class="page-title" style="margin:0">{{ pickMode ? 'Pick Exercise' : 'Exercises' }}</h1>
      <button v-if="!pickMode" class="btn btn-primary add-btn" @click="openForm(null)">+ Add</button>
      <button v-else class="btn btn-ghost add-btn" style="color:var(--text-secondary)" @click="emit('cancel')">Cancel</button>
    </div>

    <!-- Search + filter row -->
    <div class="search-row">
      <input v-model="query" type="search" placeholder="Search…" class="search-input" />
      <button class="filter-btn" :class="{ active: hasFilters }" @click="filterSheetOpen = true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
        Filter
        <span v-if="activeFilterCount" class="filter-count">{{ activeFilterCount }}</span>
      </button>
    </div>

    <!-- Active filter chips (compact) -->
    <div v-if="hasFilters" class="active-filters">
      <button v-if="typeFilter" class="chip chip-active" @click="typeFilter = null">
        {{ typeFilter }} ✕
      </button>
      <button v-if="muscleFilter" class="chip chip-active" @click="muscleFilter = null">
        {{ muscleFilter }} ✕
      </button>
    </div>

    <div v-if="!store.loaded" class="empty-state"><p>Loading exercises…</p></div>

    <template v-else>
      <p class="results-count">{{ filtered.length }} exercises</p>

      <div class="exercise-list">
        <button
          v-for="ex in filtered"
          :key="ex.id"
          class="exercise-row"
          @click="openDetail(ex)"
        >
          <div class="ex-info">
            <span class="ex-name">{{ ex.name }}</span>
            <span class="ex-meta">{{ (ex.primary_muscles || []).join(', ') || '—' }}</span>
          </div>
          <div class="ex-right">
            <span class="type-badge" :class="ex.type">{{ ex.type }}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </button>

        <div v-if="filtered.length === 0" class="empty-state">
          <p>No exercises match your filters.</p>
        </div>
      </div>
    </template>

    <Teleport to="body">
      <!-- Filter sheet -->
      <div v-if="filterSheetOpen" class="sheet-backdrop" @click="filterSheetOpen = false">
        <div class="sheet" @click.stop>
          <div class="sheet-handle" />
          <div class="sheet-body">
            <div class="sheet-title-row">
              <h2>Filter</h2>
              <button class="btn btn-ghost" style="color:var(--text-secondary);font-size:13px" @click="typeFilter = null; muscleFilter = null">Clear all</button>
            </div>

            <label>Type</label>
            <div class="chip-row">
              <button v-for="t in types" :key="t.value" class="chip" :class="{ active: typeFilter === t.value }" @click="typeFilter = typeFilter === t.value ? null : t.value">
                {{ t.label }}
              </button>
            </div>

            <label style="margin-top:16px">Muscle group</label>
            <div class="chip-row">
              <button v-for="m in muscles" :key="m" class="chip chip-sm" :class="{ active: muscleFilter === m }" @click="muscleFilter = muscleFilter === m ? null : m">
                {{ m }}
              </button>
            </div>

            <button class="btn btn-primary btn-full" style="margin-top:24px" @click="filterSheetOpen = false">
              Show {{ filtered.length }} exercises
            </button>
          </div>
        </div>
      </div>

      <!-- Exercise detail sheet -->
      <div v-if="detail" class="sheet-backdrop" @click="detail = null">
        <div class="sheet" @click.stop>
          <div class="sheet-handle" />
          <div class="sheet-body">
            <div class="detail-header">
              <h2>{{ detail.name }}</h2>
              <span class="type-badge" :class="detail.type">{{ detail.type }}</span>
            </div>
            <p class="detail-muscles">{{ (detail.primary_muscles || []).join(' · ') || '—' }}</p>
            <p v-if="detail.equipment" class="detail-equip">Equipment: {{ detail.equipment }}</p>
            <p v-if="detail.instructions" class="detail-instructions">{{ detail.instructions }}</p>
            <div class="sheet-actions">
              <button v-if="detail.source === 'custom'" class="btn btn-secondary" style="flex:1" @click="openForm(detail); detail = null">Edit</button>
              <button v-if="detail.source === 'custom'" class="btn btn-danger" style="flex:1" @click="confirmDelete(detail)">Delete</button>
              <button v-if="pickMode" class="btn btn-primary" style="flex:1" @click="pickExercise(detail)">Select</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Add / edit form sheet -->
      <div v-if="formOpen" class="sheet-backdrop" @click="closeForm">
        <div class="sheet" @click.stop>
          <div class="sheet-handle" />
          <div class="sheet-body">
            <h2 style="margin-bottom:20px">{{ editing ? 'Edit Exercise' : 'New Exercise' }}</h2>
            <div class="form-field">
              <label>Name</label>
              <input v-model="form.name" placeholder="e.g. Barbell Squat" />
            </div>
            <div class="form-field">
              <label>Type</label>
              <div class="chip-row" style="margin-top:6px">
                <button v-for="t in types" :key="t.value" class="chip" :class="{ active: form.type === t.value }" @click="form.type = t.value">
                  {{ t.label }}
                </button>
              </div>
            </div>
            <div class="form-field">
              <label>Primary muscles (comma-separated)</label>
              <input v-model="form.musclesRaw" placeholder="e.g. chest, triceps" />
            </div>
            <div class="form-field">
              <label>Equipment</label>
              <input v-model="form.equipment" placeholder="e.g. barbell" />
            </div>
            <div class="form-field">
              <label>Notes / instructions</label>
              <textarea v-model="form.instructions" rows="3" placeholder="Optional" />
            </div>
            <p v-if="formError" class="form-error">{{ formError }}</p>
            <button class="btn btn-primary btn-full" :disabled="saving" @click="saveForm">
              {{ saving ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </main>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useExercisesStore } from '../stores/exercises.js'

const props = defineProps({ pickMode: { type: Boolean, default: false } })
const emit = defineEmits(['pick', 'cancel'])

const router = useRouter()
const store = useExercisesStore()

onMounted(() => store.load())

const query = ref('')
const typeFilter = ref(null)
const muscleFilter = ref(null)
const filterSheetOpen = ref(false)
const detail = ref(null)
const formOpen = ref(false)
const editing = ref(null)
const saving = ref(false)
const formError = ref('')

const types = [
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'yoga', label: 'Yoga' },
  { value: 'custom', label: 'Custom' },
]

const muscles = [
  'abdominals','abductors','adductors','biceps','calves','chest',
  'forearms','glutes','hamstrings','lats','lower back','middle back',
  'neck','quadriceps','shoulders','traps','triceps',
]

const hasFilters = computed(() => !!(typeFilter.value || muscleFilter.value))
const activeFilterCount = computed(() => (typeFilter.value ? 1 : 0) + (muscleFilter.value ? 1 : 0))

const filtered = computed(() => {
  let list = store.all
  if (typeFilter.value) list = list.filter(e => e.type === typeFilter.value)
  if (muscleFilter.value) list = list.filter(e => (e.primary_muscles || []).includes(muscleFilter.value))
  if (query.value.trim()) {
    const q = query.value.toLowerCase()
    list = list.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.primary_muscles || []).some(m => m.includes(q))
    )
  }
  return list
})

const blankForm = () => ({ name: '', type: 'strength', musclesRaw: '', equipment: '', instructions: '' })
const form = ref(blankForm())

function openDetail(ex) { detail.value = ex }

function openForm(ex) {
  editing.value = ex
  form.value = ex
    ? { name: ex.name, type: ex.type, musclesRaw: (ex.primary_muscles || []).join(', '), equipment: ex.equipment || '', instructions: ex.instructions || '' }
    : blankForm()
  formError.value = ''
  formOpen.value = true
}

function closeForm() { formOpen.value = false }

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/, '')
}

async function saveForm() {
  if (!form.value.name.trim()) { formError.value = 'Name is required.'; return }
  saving.value = true
  formError.value = ''
  try {
    await store.addCustom({
      id: editing.value ? editing.value.id : slugify(form.value.name),
      name: form.value.name.trim(),
      type: form.value.type,
      primary_muscles: form.value.musclesRaw.split(',').map(s => s.trim()).filter(Boolean),
      equipment: form.value.equipment.trim() || null,
      instructions: form.value.instructions.trim() || null,
    })
    formOpen.value = false
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

async function confirmDelete(ex) {
  if (!confirm(`Delete "${ex.name}"?`)) return
  await store.deleteCustom(ex.id)
  detail.value = null
}

function pickExercise(ex) {
  emit('pick', ex)
  detail.value = null
}
</script>

<style scoped>
.header-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.back-btn { padding: 0; min-height: 44px; width: 44px; }
.add-btn { margin-left: auto; }

.search-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.search-input { flex: 1; }
.filter-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  min-height: 44px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
.filter-btn.active { border-color: var(--accent); color: var(--accent); }
.filter-count {
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  border-radius: 10px;
  padding: 1px 6px;
}

.active-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.chip {
  padding: 6px 14px;
  min-height: 34px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.chip.active, .chip-active {
  background: var(--accent-dim);
  border-color: var(--accent);
  color: var(--accent);
}
.chip-sm { padding: 4px 10px; min-height: 28px; font-size: 12px; }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 4px; }

.results-count { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; }

.exercise-list { display: flex; flex-direction: column; }
.exercise-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 12px;
  background: var(--bg-surface);
  border: none;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  width: 100%;
}
.exercise-row:first-child { border-radius: var(--radius) var(--radius) 0 0; }
.exercise-row:last-child { border-radius: 0 0 var(--radius) var(--radius); border-bottom: none; }
.exercise-row:only-child { border-radius: var(--radius); border-bottom: none; }
.exercise-row:active { background: var(--bg-elevated); }

.ex-info { flex: 1; min-width: 0; }
.ex-name { display: block; font-size: 15px; font-weight: 500; }
.ex-meta { display: block; font-size: 12px; color: var(--text-secondary); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: capitalize; }
.ex-right { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); flex-shrink: 0; }

.type-badge {
  font-size: 11px; font-weight: 700; padding: 2px 7px;
  border-radius: 10px; text-transform: uppercase; letter-spacing: 0.3px;
}
.type-badge.strength { background: rgba(99,102,241,0.2); color: #a5b4fc; }
.type-badge.cardio   { background: rgba(234,179,8,0.2);  color: #fde68a; }
.type-badge.yoga     { background: rgba(20,184,166,0.2); color: #5eead4; }
.type-badge.custom   { background: var(--accent-dim);    color: var(--accent); }

.sheet-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  z-index: 400; display: flex; align-items: flex-end;
}
.sheet {
  background: var(--bg-surface); border-radius: 20px 20px 0 0;
  width: 100%; max-height: 85dvh; overflow-y: auto;
  border-top: 1px solid var(--border);
}
.sheet-handle {
  width: 36px; height: 4px; background: var(--border);
  border-radius: 2px; margin: 12px auto 4px;
}
.sheet-body { padding: 12px 20px 48px; }
.sheet-title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.sheet-title-row h2 { font-size: 18px; font-weight: 700; }

.detail-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.detail-header h2 { font-size: 20px; font-weight: 700; flex: 1; }
.detail-muscles { font-size: 13px; color: var(--text-secondary); margin-bottom: 8px; text-transform: capitalize; }
.detail-equip { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; text-transform: capitalize; }
.detail-instructions { font-size: 14px; line-height: 1.6; margin-bottom: 20px; }
.sheet-actions { display: flex; gap: 10px; margin-top: 20px; }

.form-field { margin-bottom: 16px; }
.form-error { color: var(--danger); font-size: 13px; margin-bottom: 12px; }
</style>

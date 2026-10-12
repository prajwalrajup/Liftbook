<template>
  <Teleport to="body">
    <div class="sheet-backdrop" @click="$emit('close')">
      <div class="sheet" @click.stop>
        <div class="sheet-handle" />
        <div class="sheet-body">
          <h2 class="sheet-title">{{ label }}</h2>

          <p v-if="!rows.length" class="empty">No habits scheduled this day.</p>

          <div v-for="h in rows" :key="h.id" class="row-wrap">
            <button class="habit-row" :class="{ done: store.isDone(h.id, iso) }" @click="tap(h)">
              <span class="check" aria-hidden="true">{{ store.isDone(h.id, iso) ? '✓' : '' }}</span>
              <span class="habit-text">
                <span class="habit-name">{{ h.name }}</span>
                <span v-if="h.kind === 'quit'" class="habit-tag">Quit</span>
                <span v-if="h.mandatory" class="habit-tag req">Required</span>
              </span>
              <span v-if="h.metric !== 'boolean' && store.isDone(h.id, iso)" class="habit-value">
                {{ formatValue(h, store.valueOf(h.id, iso)) }}
              </span>
            </button>

            <form v-if="editing?.id === h.id" class="inline-entry" @submit.prevent="save(h)">
              <input
                ref="valueInput"
                v-model="editing.value"
                type="number"
                inputmode="decimal"
                min="0"
                step="any"
                :aria-label="h.metric === 'timer' ? 'Minutes' : (h.unit || 'Amount')"
                :placeholder="h.metric === 'timer' ? 'Minutes' : (h.unit || 'Amount')"
              />
              <button class="btn btn-secondary">Save</button>
              <button v-if="store.isDone(h.id, iso)" type="button" class="btn btn-danger" @click="unmark(h)">
                Clear
              </button>
            </form>
            <p v-if="editing?.id === h.id && editing.error" class="entry-error">{{ editing.error }}</p>
          </div>

          <button class="btn btn-ghost btn-full" style="margin-top:12px" @click="$emit('close')">Done</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { useHabitsStore } from '../stores/habits.js'
import { formatValue, fromISO } from '../lib/habitStats.js'

const props = defineProps({ iso: { type: String, required: true } })
defineEmits(['close'])

const store = useHabitsStore()
const editing = ref(null)
const valueInput = ref(null)

const label = computed(() =>
  fromISO(props.iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
)

const rows = computed(() => {
  const dow = fromISO(props.iso).getDay()
  return store.habits.filter((h) => h.days.includes(dow) && h.created_on <= props.iso)
})

const fail = () => alert('Could not save. Try again.')

function tap(h) {
  if (h.metric === 'boolean') {
    editing.value = null
    store.setLog(h.id, props.iso, store.isDone(h.id, props.iso) ? undefined : null).catch(fail)
    return
  }
  if (editing.value?.id === h.id) { editing.value = null; return }
  editing.value = { id: h.id, value: store.valueOf(h.id, props.iso) ?? '', error: '' }
  nextTick(() => valueInput.value?.[0]?.focus?.() ?? valueInput.value?.focus?.())
}

async function save(h) {
  const v = Number(editing.value.value)
  if (editing.value.value === '' || !(v > 0)) { editing.value.error = 'Enter a value above 0.'; return }
  try {
    await store.setLog(h.id, props.iso, v)
    editing.value = null
  } catch { fail() }
}

async function unmark(h) {
  try {
    await store.setLog(h.id, props.iso, undefined)
    editing.value = null
  } catch { fail() }
}
</script>

<style scoped>
.sheet-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  z-index: 200; display: flex; align-items: flex-end;
}
.sheet {
  background: var(--bg-surface); border-radius: 20px 20px 0 0; width: 100%;
  max-height: 90dvh; overflow-y: auto; border-top: 1px solid var(--border);
}
.sheet-handle { width: 36px; height: 4px; background: var(--border); border-radius: 2px; margin: 12px auto 4px; }
.sheet-body { padding: 12px 16px calc(24px + var(--safe-bottom)); }
.sheet-title { font-size: 20px; font-weight: 700; margin-bottom: 16px; }
.empty { color: var(--text-secondary); font-size: 14px; }

.row-wrap { margin-bottom: 8px; }
.habit-row {
  display: flex; align-items: center; gap: 14px; width: 100%; min-height: 56px;
  padding: 10px 14px; text-align: left; color: var(--text);
  background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius);
  font-size: 16px; cursor: pointer;
}
.check {
  flex: none; width: 28px; height: 28px; border-radius: 50%;
  border: 2px solid var(--border); display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 800; color: #fff;
}
.habit-row.done .check { background: var(--success); border-color: var(--success); }
.habit-row.done .habit-name { color: var(--text-secondary); text-decoration: line-through; }
.habit-text { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; min-width: 0; }
.habit-name { font-weight: 500; overflow-wrap: anywhere; }
.habit-tag { font-size: 11px; font-weight: 700; color: var(--danger); border: 1px solid var(--danger); border-radius: 6px; padding: 1px 6px; }
.habit-tag.req { color: var(--text-secondary); border-color: var(--border); }
.habit-value { margin-left: auto; font-size: 14px; font-weight: 600; color: var(--success); white-space: nowrap; }

.inline-entry { display: flex; gap: 8px; margin-top: 8px; }
.inline-entry input { flex: 1; min-width: 0; min-height: 44px; }
.inline-entry .btn { min-height: 44px; }
.entry-error { color: var(--danger); font-size: 14px; margin-top: 6px; }
</style>

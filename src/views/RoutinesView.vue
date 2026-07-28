<template>
  <main class="page">
    <div class="header-row">
      <h1 class="page-title" style="margin:0">Routines</h1>
      <RouterLink to="/routines/new" class="btn btn-primary">+ New</RouterLink>
    </div>

    <RouterLink to="/exercises" class="exercises-link card">
      <div class="link-body">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        Browse exercise library
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </RouterLink>

    <div class="divider" />

    <div v-if="!store.loaded" class="empty-state"><p>Loading…</p></div>

    <template v-else>
      <div v-if="store.routines.length === 0" class="empty-state">
        <p>No routines yet.<br />Tap + New to create one.</p>
      </div>

      <div v-else class="routine-list">
        <div v-for="r in store.routines" :key="r.id" class="routine-card card">
          <div class="routine-info">
            <span class="routine-name">{{ r.name }}</span>
            <span class="routine-meta">Rest {{ r.rest_between_sets_seconds }}s between sets</span>
          </div>
          <div class="routine-actions">
            <RouterLink :to="`/routines/${r.id}/edit`" class="btn btn-secondary btn-sm">Edit</RouterLink>
            <button class="btn btn-danger btn-sm" @click="remove(r)">Delete</button>
          </div>
        </div>
      </div>
    </template>
  </main>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRoutinesStore } from '../stores/routines.js'

const store = useRoutinesStore()
onMounted(() => store.load())

async function remove(r) {
  if (!confirm(`Delete "${r.name}"?`)) return
  await store.remove(r.id)
}
</script>

<style scoped>
.header-row {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;
}
.exercises-link {
  display: flex; align-items: center; justify-content: space-between;
  text-decoration: none; color: var(--text); margin-bottom: 0;
}
.link-body {
  display: flex; align-items: center; gap: 8px;
  color: var(--accent); font-weight: 600; font-size: 14px;
}

.routine-list { display: flex; flex-direction: column; gap: 10px; }
.routine-card { display: flex; align-items: center; gap: 12px; }
.routine-info { flex: 1; min-width: 0; }
.routine-name { display: block; font-size: 16px; font-weight: 600; }
.routine-meta { display: block; font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
.routine-actions { display: flex; gap: 8px; flex-shrink: 0; }
.btn-sm { min-height: 36px; padding: 0 12px; font-size: 13px; }
</style>

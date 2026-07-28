import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import sql from '../lib/db.js'

export const useExercisesStore = defineStore('exercises', () => {
  const library = ref([])
  const custom = ref([])
  const loaded = ref(false)

  function normalize(e) {
    return { ...e, primary_muscles: e.primary_muscles ?? [] }
  }

  async function load() {
    if (loaded.value) return
    // Load static JSON first so UI isn't blocked by a DB hiccup
    const staticData = await fetch('/exercises.json').then(r => r.json())
    library.value = staticData.map(normalize)
    loaded.value = true
    // Then fetch custom exercises from DB (non-blocking for initial render)
    try {
      const rows = await sql`select * from exercises where source = 'custom' order by name`
      custom.value = rows.map(normalize)
    } catch (e) {
      console.warn('Could not load custom exercises:', e.message)
    }
  }

  const all = computed(() => {
    const customIds = new Set(custom.value.map(e => e.id))
    return [
      ...custom.value,
      ...library.value.filter(e => !customIds.has(e.id)),
    ]
  })

  async function addCustom(exercise) {
    await sql`
      insert into exercises (id, name, type, primary_muscles, equipment, instructions, source)
      values (
        ${exercise.id},
        ${exercise.name},
        ${exercise.type},
        ${exercise.primary_muscles},
        ${exercise.equipment ?? null},
        ${exercise.instructions ?? null},
        'custom'
      )
      on conflict (id) do update set
        name            = excluded.name,
        type            = excluded.type,
        primary_muscles = excluded.primary_muscles,
        equipment       = excluded.equipment,
        instructions    = excluded.instructions
    `
    const rows = await sql`select * from exercises where source = 'custom' order by name`
    custom.value = rows.map(normalize)
  }

  async function deleteCustom(id) {
    await sql`delete from exercises where id = ${id} and source = 'custom'`
    custom.value = custom.value.filter(e => e.id !== id)
  }

  async function ensureInDb(exercise) {
    await sql`
      insert into exercises (id, name, type, primary_muscles, equipment, instructions, source)
      values (
        ${exercise.id},
        ${exercise.name},
        ${exercise.type},
        ${exercise.primary_muscles},
        ${exercise.equipment ?? null},
        ${exercise.instructions ?? null},
        ${exercise.source ?? 'free-exercise-db'}
      )
      on conflict (id) do nothing
    `
  }

  return { library, custom, all, loaded, load, addCustom, deleteCustom, ensureInDb }
})

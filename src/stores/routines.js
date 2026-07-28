import { defineStore } from 'pinia'
import { ref } from 'vue'
import sql from '../lib/db.js'

export const useRoutinesStore = defineStore('routines', () => {
  const routines = ref([])
  const loaded = ref(false)

  async function load() {
    if (loaded.value) return
    routines.value = await sql`select * from routines order by name`
    loaded.value = true
  }

  async function reload() {
    routines.value = await sql`select * from routines order by name`
  }

  async function getWithExercises(id) {
    const [routine] = await sql`select * from routines where id = ${id}`
    const exercises = await sql`
      select re.*, e.name, e.type, e.primary_muscles, e.equipment
      from routine_exercises re
      join exercises e on e.id = re.exercise_id
      where re.routine_id = ${id}
      order by re.position
    `
    return { ...routine, exercises }
  }

  async function create(data, exerciseItems) {
    const [routine] = await sql`
      insert into routines (name, rest_between_sets_seconds)
      values (${data.name}, ${data.rest_between_sets_seconds})
      returning *
    `
    await saveExercises(routine.id, exerciseItems)
    await reload()
    return routine
  }

  async function update(id, data, exerciseItems) {
    await sql`
      update routines
      set name = ${data.name}, rest_between_sets_seconds = ${data.rest_between_sets_seconds}
      where id = ${id}
    `
    await saveExercises(id, exerciseItems)
    await reload()
  }

  async function saveExercises(routineId, items) {
    // Replace all exercises for this routine
    await sql`delete from routine_exercises where routine_id = ${routineId}`
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      await sql`
        insert into routine_exercises
          (routine_id, exercise_id, position, target_sets, target_reps, rest_seconds)
        values (
          ${routineId},
          ${item.exercise_id},
          ${i},
          ${item.target_sets ?? null},
          ${item.target_reps ?? null},
          ${item.rest_seconds ?? null}
        )
      `
    }
  }

  async function remove(id) {
    await sql`delete from routines where id = ${id}`
    routines.value = routines.value.filter(r => r.id !== id)
  }

  return { routines, loaded, load, reload, getWithExercises, create, update, remove }
})

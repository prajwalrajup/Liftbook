<template>
  <main class="page">
    <h1 class="page-title">DB Test</h1>

    <div class="card" style="margin-bottom: 16px;">
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">Write a test exercise row</p>
      <button class="btn btn-primary btn-full" :disabled="writing" @click="writeRow">
        {{ writing ? 'Writing…' : 'Write row' }}
      </button>
      <p v-if="writeResult" class="result" :class="writeResult.ok ? 'ok' : 'err'">{{ writeResult.msg }}</p>
    </div>

    <div class="card" style="margin-bottom: 16px;">
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">Read exercises table</p>
      <button class="btn btn-secondary btn-full" :disabled="reading" @click="readRows">
        {{ reading ? 'Reading…' : 'Read rows' }}
      </button>
      <pre v-if="readResult" class="result" :class="readResult.ok ? 'ok' : 'err'">{{ readResult.msg }}</pre>
    </div>

    <div class="card">
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">Clean up test row</p>
      <button class="btn btn-danger btn-full" :disabled="deleting" @click="deleteRow">
        {{ deleting ? 'Deleting…' : 'Delete test row' }}
      </button>
      <p v-if="deleteResult" class="result" :class="deleteResult.ok ? 'ok' : 'err'">{{ deleteResult.msg }}</p>
    </div>
  </main>
</template>

<script setup>
import { ref } from 'vue'
import sql from '../lib/db.js'

const writing = ref(false)
const reading = ref(false)
const deleting = ref(false)
const writeResult = ref(null)
const readResult = ref(null)
const deleteResult = ref(null)

async function writeRow() {
  writing.value = true
  writeResult.value = null
  try {
    await sql`
      insert into exercises (id, name, type, source)
      values ('__test__', 'DB Connection Test', 'custom', 'custom')
      on conflict (id) do update set name = excluded.name
    `
    writeResult.value = { ok: true, msg: '✓ Row written (id = __test__)' }
  } catch (e) {
    writeResult.value = { ok: false, msg: e.message }
  } finally {
    writing.value = false
  }
}

async function readRows() {
  reading.value = true
  readResult.value = null
  try {
    const rows = await sql`select id, name, type from exercises limit 10`
    readResult.value = { ok: true, msg: JSON.stringify(rows, null, 2) }
  } catch (e) {
    readResult.value = { ok: false, msg: e.message }
  } finally {
    reading.value = false
  }
}

async function deleteRow() {
  deleting.value = true
  deleteResult.value = null
  try {
    await sql`delete from exercises where id = '__test__'`
    deleteResult.value = { ok: true, msg: '✓ Test row deleted' }
  } catch (e) {
    deleteResult.value = { ok: false, msg: e.message }
  } finally {
    deleting.value = false
  }
}
</script>

<style scoped>
.result {
  margin-top: 10px;
  font-size: 13px;
  padding: 10px;
  border-radius: var(--radius-sm);
  white-space: pre-wrap;
  word-break: break-all;
}
.ok { background: rgba(61,184,122,0.12); color: var(--success); }
.err { background: rgba(224,74,74,0.12); color: var(--danger); }
</style>

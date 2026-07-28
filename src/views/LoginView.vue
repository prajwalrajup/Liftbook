<template>
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-logo">🏋️</div>
      <h1 class="login-title">Liftbook</h1>

      <form @submit.prevent="submit">
        <div class="field">
          <label for="username">Username</label>
          <input
            id="username"
            v-model="username"
            type="text"
            autocomplete="username"
            autocapitalize="none"
            placeholder="username"
            required
          />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="password"
            required
          />
        </div>

        <p v-if="error" class="error-msg">Invalid credentials</p>

        <button type="submit" class="btn btn-primary btn-full" style="margin-top:8px">
          Sign in
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const error = ref(false)

function submit() {
  if (
    username.value === import.meta.env.VITE_APP_USER &&
    password.value === import.meta.env.VITE_APP_PASS
  ) {
    sessionStorage.setItem('lb_auth', '1')
    const redirect = route.query.redirect || '/today'
    router.replace(redirect)
  } else {
    error.value = true
  }
}
</script>

<style scoped>
.login-wrap {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 20px;
  background: var(--bg);
}
.login-card {
  width: 100%;
  max-width: 360px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 36px 24px 28px;
}
.login-logo {
  font-size: 48px;
  text-align: center;
  margin-bottom: 8px;
}
.login-title {
  font-size: 24px;
  font-weight: 800;
  text-align: center;
  letter-spacing: -0.5px;
  margin-bottom: 28px;
}
.field {
  margin-bottom: 16px;
}
.error-msg {
  font-size: 13px;
  color: var(--danger);
  margin-top: 4px;
  text-align: center;
}
</style>

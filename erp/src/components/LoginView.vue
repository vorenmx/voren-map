<template>
  <div class="login">
    <div class="login-card">
      <div class="brand">
        <span class="brand-logo">🏢</span>
        <div>
          <h1>Voren ERP</h1>
          <p>Sistema interno de gestión</p>
        </div>
      </div>
      <button class="btn btn-primary login-btn" @click="signInWithGoogle">
        <svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.6 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.95S8.78 6.28 12 6.28c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.74 14.55 2.9 12 2.9 6.98 2.9 2.9 6.98 2.9 12s4.08 9.1 9.1 9.1c5.25 0 8.72-3.69 8.72-8.89 0-.6-.06-1.05-.15-1.51z"/></svg>
        Iniciar sesión con Google
      </button>
      <p v-if="authError" class="login-error">{{ authError }}</p>
      <p class="login-note">Solo cuentas <strong>@voren.com.mx</strong></p>
    </div>
  </div>
</template>

<script setup>
import { useAuth } from '../composables/useAuth.js';
const { signInWithGoogle, authError } = useAuth();
</script>

<style scoped>
.login {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(1200px 600px at 50% -10%, rgba(29,78,216,0.18), transparent), var(--bg);
}
.login-card {
  width: 340px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 28px;
  box-shadow: var(--shadow);
  text-align: center;
}
.brand { display: flex; align-items: center; gap: 12px; justify-content: center; margin-bottom: 22px; }
.brand-logo { font-size: 34px; }
.brand h1 { margin: 0; font-size: 20px; }
.brand p { margin: 2px 0 0; font-size: 12px; color: var(--text-dim); }
.login-btn { width: 100%; justify-content: center; padding: 11px; }
.login-error { color: var(--danger); font-size: 12px; margin-top: 12px; }
.login-note { color: var(--text-dim); font-size: 11px; margin-top: 16px; }
</style>

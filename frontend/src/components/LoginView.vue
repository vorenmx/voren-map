<template>
  <div class="login-screen">
    <div class="login-card">
      <div class="login-logo">🏍</div>
      <h1 class="login-title">Tiendas de Motos México</h1>

      <div class="login-actions">
        <p v-if="authError" class="login-error">{{ authError }}</p>

        <button type="button" class="google-btn" :disabled="signing" @click="handleGoogleSignIn">
          <span v-if="signing" class="spinner" aria-hidden="true"></span>
          <svg v-else class="google-icon" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
            <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.86 11.86 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
          </svg>
          {{ signing ? 'Conectando…' : 'Continuar con Google' }}
        </button>
      </div>

      <p class="login-note">Solo cuentas autorizadas tienen acceso.</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAuth } from '../composables/useAuth.js';

const { signInWithGoogle, authError } = useAuth();
const signing = ref(false);

async function handleGoogleSignIn() {
  signing.value = true;
  await signInWithGoogle();
  signing.value = false;
}
</script>

<style scoped>
.login-screen {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f1117;
  z-index: 9999;
}

.login-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  background: #1a1d27;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 48px 40px;
  width: 100%;
  max-width: 380px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
  box-sizing: border-box;
}

@media (max-width: 440px) {
  .login-card {
    border-radius: 0;
    min-height: 100dvh;
    justify-content: center;
    padding: 40px 28px;
  }
}

.login-logo {
  font-size: 48px;
  line-height: 1;
  margin-bottom: 4px;
}

.login-title {
  font-size: 20px;
  font-weight: 700;
  color: #f1f5f9;
  margin: 0;
  text-align: center;
}

.login-actions {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  margin-top: 8px;
}

.google-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 4px;
  padding: 13px 16px;
  width: 100%;
  background: #fff;
  color: #1f1f1f;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
  font-family: inherit;
}

.google-btn:hover:not(:disabled) {
  background: #f8f9fa;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.google-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.google-icon {
  flex-shrink: 0;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(0, 0, 0, 0.15);
  border-top-color: #4285f4;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.login-error {
  font-size: 13px;
  color: #f87171;
  text-align: center;
  margin: 0;
  padding: 10px 14px;
  background: rgba(248, 113, 113, 0.08);
  border: 1px solid rgba(248, 113, 113, 0.2);
  border-radius: 8px;
}

.login-note {
  font-size: 12px;
  color: #475569;
  margin: 0;
  text-align: center;
}
</style>

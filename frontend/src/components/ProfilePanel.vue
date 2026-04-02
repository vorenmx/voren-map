<template>
  <Transition name="profile-slide">
    <div v-if="visible" class="profile-panel">
      <!-- Header -->
      <div class="panel-header">
        <h2 class="panel-title">Mi Perfil</h2>
        <button class="close-btn" @click="emit('close')" title="Cerrar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="panel-body">
        <!-- Avatar + account info -->
        <div class="avatar-section">
          <div class="avatar-circle">{{ initials }}</div>
          <div class="account-info">
            <div class="account-name">{{ userDisplayName || user?.displayName || 'Sin nombre' }}</div>
            <div class="account-email">{{ user?.email }}</div>
            <div v-if="user?.metadata?.creationTime" class="account-meta">
              Cuenta creada {{ formatDate(user.metadata.creationTime) }}
            </div>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Change display name -->
        <div class="form-section">
          <h3 class="section-title">Nombre de Pantalla</h3>
          <div class="field-group">
            <input
              v-model="newName"
              type="text"
              placeholder="Tu nombre"
              class="field-input"
              maxlength="60"
              @keydown.enter="saveName"
            />
          </div>
          <div v-if="nameMsg.text" class="feedback" :class="nameMsg.type">{{ nameMsg.text }}</div>
          <button
            class="save-btn"
            :disabled="nameSaving || !newName.trim() || newName.trim() === (userDisplayName || user?.displayName || '')"
            @click="saveName"
          >
            <span v-if="nameSaving" class="btn-spinner"></span>
            {{ nameSaving ? 'Guardando…' : 'Guardar Nombre' }}
          </button>
        </div>

        <div class="divider"></div>

        <p class="google-account-hint">
          Iniciaste sesión con Google. La seguridad de la cuenta (contraseña, 2 pasos) se administra en
          <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer">tu cuenta de Google</a>.
        </p>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useAuth } from '../composables/useAuth.js';

const props = defineProps({
  visible: { type: Boolean, default: false },
});

const emit = defineEmits(['close']);

const { user, userDisplayName, updateUserProfile } = useAuth();

// ── Initials ─────────────────────────────────────────────────────────────────
const initials = computed(() => {
  const name = userDisplayName.value || user.value?.displayName;
  if (name) {
    return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  }
  return (user.value?.email?.[0] ?? 'U').toUpperCase();
});

// ── Name change ───────────────────────────────────────────────────────────────
const newName = ref('');
const nameSaving = ref(false);
const nameMsg = ref({ text: '', type: '' });

watch(
  () => props.visible,
  (v) => {
    if (v) {
      newName.value = userDisplayName.value || user.value?.displayName || '';
      nameMsg.value = { text: '', type: '' };
    }
  }
);

async function saveName() {
  if (!newName.value.trim()) return;
  nameSaving.value = true;
  nameMsg.value = { text: '', type: '' };
  try {
    await updateUserProfile(newName.value.trim());
    nameMsg.value = { text: 'Nombre actualizado correctamente.', type: 'success' };
  } catch {
    nameMsg.value = { text: 'No se pudo actualizar el nombre. Intenta de nuevo.', type: 'error' };
  } finally {
    nameSaving.value = false;
  }
}

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}
</script>

<style scoped>
.profile-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 360px;
  height: 100%;
  background: rgba(10, 15, 30, 0.97);
  backdrop-filter: blur(16px);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  z-index: 50;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  flex-shrink: 0;
}

.panel-title {
  font-size: 16px;
  font-weight: 700;
  color: #f1f5f9;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  transition: color 0.15s, background 0.15s;
}
.close-btn:hover {
  color: #f1f5f9;
  background: rgba(255, 255, 255, 0.08);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.panel-body::-webkit-scrollbar { width: 4px; }
.panel-body::-webkit-scrollbar-track { background: transparent; }
.panel-body::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.12); border-radius: 2px; }

.avatar-section {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar-circle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1d4ed8, #6d28d9);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  letter-spacing: 0.02em;
}

.account-info { min-width: 0; }

.account-name {
  font-size: 16px;
  font-weight: 600;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-email {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-meta {
  font-size: 11px;
  color: #475569;
  margin-top: 4px;
}

.divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.07);
  flex-shrink: 0;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-label {
  font-size: 11px;
  color: #64748b;
  font-weight: 500;
}

.field-input {
  width: 100%;
  padding: 9px 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #f1f5f9;
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
  box-sizing: border-box;
}
.field-input:focus {
  border-color: rgba(99, 130, 246, 0.5);
  background: rgba(255, 255, 255, 0.09);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}
.field-input::placeholder { color: #475569; }

.save-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 9px 16px;
  background: #1d4ed8;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s, opacity 0.15s;
  align-self: flex-start;
}
.save-btn:hover:not(:disabled) { background: #2563eb; }
.save-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.btn-spinner {
  width: 13px;
  height: 13px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.feedback {
  font-size: 12px;
  padding: 8px 10px;
  border-radius: 6px;
  line-height: 1.4;
}
.feedback.success {
  background: rgba(34, 197, 94, 0.1);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.2);
}
.feedback.error {
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.google-account-hint {
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
  margin: 0;
}
.google-account-hint a {
  color: #93c5fd;
  text-decoration: none;
}
.google-account-hint a:hover {
  text-decoration: underline;
}

/* Slide transition */
.profile-slide-enter-active,
.profile-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.profile-slide-enter-from,
.profile-slide-leave-to {
  transform: translateX(100%);
}

@media (max-width: 640px) {
  .profile-panel {
    position: fixed;
    width: 90vw;
    max-width: 360px;
    z-index: 250;
  }
}
</style>

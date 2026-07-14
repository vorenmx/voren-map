<template>
  <div class="user-menu" ref="wrapperRef">
    <button class="avatar-btn" @click="isOpen = !isOpen" :title="user?.email">
      {{ initials }}
    </button>

    <Transition name="dropdown-fade">
      <div v-if="isOpen" class="user-dropdown">
        <div class="user-info">
          <div class="user-avatar-lg">{{ initials }}</div>
          <div class="user-details">
            <div class="user-name">{{ displayName || 'Usuario' }}</div>
            <div class="user-email">{{ user?.email }}</div>
          </div>
        </div>
        <div class="divider"></div>
        <button class="menu-item" @click="emit('open-profile'); isOpen = false">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          Perfil
        </button>
        <button class="menu-item" @click="openErp">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          Ir al ERP
        </button>
        <button class="menu-item danger" @click="emit('sign-out'); isOpen = false">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Cerrar Sesión
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  user: { type: Object, default: null },
  displayName: { type: String, default: null },
});

const emit = defineEmits(['open-profile', 'sign-out']);

const isOpen = ref(false);
const wrapperRef = ref(null);

// ERP hosting URL (overridable via VITE_ERP_URL for staging/custom domains).
const ERP_URL = import.meta.env.VITE_ERP_URL || 'https://voren-erp.web.app';

function openErp() {
  isOpen.value = false;
  window.location.assign(ERP_URL);
}

const initials = computed(() => {
  const name = props.displayName || props.user?.displayName;
  if (name) {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }
  return (props.user?.email?.[0] ?? 'U').toUpperCase();
});

function handleClickOutside(e) {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target)) {
    isOpen.value = false;
  }
}

onMounted(() => document.addEventListener('mousedown', handleClickOutside));
onBeforeUnmount(() => document.removeEventListener('mousedown', handleClickOutside));
</script>

<style scoped>
.user-menu {
  position: relative;
  flex-shrink: 0;
}

.avatar-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1d4ed8, #6d28d9);
  border: none;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  letter-spacing: 0.02em;
  transition: opacity 0.15s, box-shadow 0.15s;
}
.avatar-btn:hover {
  opacity: 0.88;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3);
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 210px;
  background: rgba(13, 20, 40, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(16px);
  z-index: 300;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 14px 12px;
}

.user-avatar-lg {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1d4ed8, #6d28d9);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  letter-spacing: 0.02em;
}

.user-details { min-width: 0; }

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 11px;
  color: #64748b;
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.07);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 10px 14px;
  background: none;
  border: none;
  color: #cbd5e1;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: background 0.1s;
}
.menu-item:hover {
  background: rgba(255, 255, 255, 0.07);
  color: #f1f5f9;
}
.menu-item.danger { color: #f87171; }
.menu-item.danger:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #fca5a5;
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}
</style>

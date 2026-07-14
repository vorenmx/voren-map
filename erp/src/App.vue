<template>
  <div v-if="authLoading" class="splash">
    <span>🏢</span>
  </div>

  <LoginView v-else-if="!user" />

  <div v-else class="shell">
    <aside class="sidebar" :class="{ open: mobileOpen }">
      <div class="side-brand">
        <span class="side-logo">🏢</span>
        <span class="side-title">Voren ERP</span>
      </div>

      <nav class="side-nav">
        <template v-for="item in nav" :key="item.to || item.type">
          <div v-if="item.type === 'divider'" class="side-divider" role="separator" />
          <RouterLink
            v-else
            :to="item.to"
            class="side-link"
            active-class="active"
            @click="mobileOpen = false"
          >
            <span class="side-ico">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </RouterLink>
        </template>
      </nav>

      <div class="side-foot">
        <div class="side-user">
          <div class="side-avatar">{{ inicial }}</div>
          <div class="side-user-info">
            <div class="side-user-name">{{ userDisplayName }}</div>
            <div class="side-user-rol">{{ rolLabel }}</div>
          </div>
        </div>
        <button class="btn btn-sm" @click="signOut">Salir</button>
      </div>
    </aside>

    <div v-if="mobileOpen" class="backdrop" @click="mobileOpen = false" />

    <main class="content">
      <header class="topbar">
        <button class="menu-btn" @click="mobileOpen = true" aria-label="Menú">☰</button>
        <h2 class="topbar-title">{{ route.meta.titulo || 'Voren ERP' }}</h2>
      </header>
      <div class="page">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import LoginView from './components/LoginView.vue';
import { useAuth } from './composables/useAuth.js';

const route = useRoute();
const { user, authLoading, userDisplayName, rol, signOut } = useAuth();
const mobileOpen = ref(false);

const nav = [
  { to: '/', label: 'Inicio', icon: '🏠' },
  { to: '/crm', label: 'CRM', icon: '📈' },
  { to: '/clientes', label: 'Clientes', icon: '🧾' },
  { to: '/equipo', label: 'Equipo', icon: '👥' },
  { to: '/almacen', label: 'Almacén', icon: '📦' },
  { type: 'divider' },
  { to: '/graficos', label: 'Gráficos', icon: '📊' },
  { to: '/analisis', label: 'Análisis IA', icon: '🤖' },
];

const rolLabel = computed(() => ({
  admin: 'Administrador',
  gerente: 'Gerente',
  ventas: 'Ventas',
  lectura: 'Lectura',
}[rol.value] || 'Lectura'));

const inicial = computed(() => (userDisplayName.value || '?').charAt(0).toUpperCase());
</script>

<style scoped>
.splash {
  height: 100vh; display: flex; align-items: center; justify-content: center;
  font-size: 56px; background: var(--bg);
}
.shell { display: flex; height: 100vh; width: 100vw; overflow: hidden; }

/* Sidebar */
.sidebar {
  width: 224px; flex-shrink: 0; background: var(--bg-elevated);
  border-right: 1px solid var(--border); display: flex; flex-direction: column;
}
.side-brand { display: flex; align-items: center; gap: 10px; padding: 16px 18px; border-bottom: 1px solid var(--border); }
.side-logo { font-size: 22px; }
.side-title { font-weight: 700; font-size: 15px; }
.side-nav { flex: 1; padding: 12px 10px; display: flex; flex-direction: column; gap: 3px; }
.side-divider {
  height: 1px; margin: 8px 12px; background: var(--border); flex-shrink: 0;
}
.side-link {
  display: flex; align-items: center; gap: 11px; padding: 9px 12px;
  border-radius: var(--radius); color: var(--text-muted); font-size: 13px; font-weight: 500;
  transition: all 0.15s;
}
.side-link:hover { background: var(--hover); color: var(--text); }
.side-link.active { background: var(--primary); color: #fff; }
.side-ico { font-size: 15px; }
.side-foot { padding: 12px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; }
.side-user { display: flex; align-items: center; gap: 10px; }
.side-avatar {
  width: 32px; height: 32px; border-radius: 50%; background: var(--accent);
  display: flex; align-items: center; justify-content: center; font-weight: 700; color: #fff; flex-shrink: 0;
}
.side-user-info { min-width: 0; }
.side-user-name { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.side-user-rol { font-size: 11px; color: var(--text-dim); }

/* Content */
.content { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.topbar {
  display: flex; align-items: center; gap: 12px; padding: 12px 20px;
  border-bottom: 1px solid var(--border); background: var(--bg-elevated);
}
.topbar-title { margin: 0; font-size: 16px; font-weight: 700; }
.menu-btn { display: none; background: none; border: none; color: var(--text); font-size: 20px; cursor: pointer; }
.page { flex: 1; overflow: auto; padding: 20px; }

.backdrop { display: none; }

@media (max-width: 760px) {
  .sidebar {
    position: fixed; inset: 0 auto 0 0; z-index: 200; transform: translateX(-100%);
    transition: transform 0.2s;
  }
  .sidebar.open { transform: translateX(0); }
  .menu-btn { display: block; }
  .backdrop { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 150; }
}
</style>

<template>
  <div class="equipo">
    <div class="head">
      <div class="tabs">
        <button class="btn btn-sm" :class="{ 'btn-primary': tab==='directorio' }" @click="tab='directorio'">Directorio</button>
        <button class="btn btn-sm" :class="{ 'btn-primary': tab==='actividad' }" @click="tab='actividad'">Actividad por vendedor</button>
      </div>
      <button v-if="esAdminOGerente && tab==='directorio'" class="btn btn-primary" @click="nuevo">+ Empleado</button>
    </div>

    <!-- Directorio -->
    <div v-if="tab==='directorio'" class="card">
      <table class="table">
        <thead>
          <tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Equipo</th><th>Territorio</th><th>Estado</th><th v-if="esAdminOGerente"></th></tr>
        </thead>
        <tbody>
          <tr v-for="e in empleados" :key="e.id">
            <td>{{ e.nombre }}</td>
            <td class="dim">{{ e.email }}</td>
            <td><span class="pill">{{ rolLabel(e.rol) }}</span></td>
            <td>{{ e.equipo || '—' }}</td>
            <td>{{ e.territorio || '—' }}</td>
            <td><span class="pill" :class="e.activo !== false ? 'ok' : 'off'">{{ e.activo !== false ? 'Activo' : 'Inactivo' }}</span></td>
            <td v-if="esAdminOGerente"><button class="btn btn-sm" @click="editar(e)">Editar</button></td>
          </tr>
          <tr v-if="empleados.length === 0"><td colspan="7" class="dim">Sin empleados aún.</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Actividad -->
    <div v-else class="card">
      <table class="table">
        <thead>
          <tr><th>Vendedor</th><th>Visitas</th><th>Exitosas</th><th>Tasa éxito</th><th>Prom. score</th><th>Última visita</th></tr>
        </thead>
        <tbody>
          <tr v-for="a in actividad" :key="a.email">
            <td>{{ nombreDe(a.email) }}</td>
            <td>{{ a.visitas }}</td>
            <td>{{ a.exitosas }}</td>
            <td>{{ a.tasaExito }}%</td>
            <td>{{ a.promedioScore ?? '—' }}</td>
            <td class="dim">{{ a.ultimaVisita ? a.ultimaVisita.toLocaleDateString('es-MX') : '—' }}</td>
          </tr>
          <tr v-if="actividad.length === 0"><td colspan="6" class="dim">Sin actividad registrada.</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Editor -->
    <div v-if="editando" class="modal-backdrop" @click.self="editando = null">
      <div class="modal card">
        <h3>{{ editando.id ? 'Editar empleado' : 'Nuevo empleado' }}</h3>
        <label>Email</label>
        <input v-model="editando.email" class="input" :disabled="!!editando.id" placeholder="persona@voren.com.mx" />
        <label>Nombre</label>
        <input v-model="editando.nombre" class="input" />
        <div class="row">
          <div>
            <label>Rol</label>
            <select v-model="editando.rol" class="select">
              <option value="admin">Administrador</option>
              <option value="gerente">Gerente</option>
              <option value="ventas">Ventas</option>
              <option value="lectura">Lectura</option>
            </select>
          </div>
          <div>
            <label>Equipo</label>
            <input v-model="editando.equipo" class="input" />
          </div>
        </div>
        <div class="row">
          <div>
            <label>Territorio</label>
            <input v-model="editando.territorio" class="input" />
          </div>
          <div>
            <label>Gerente (email)</label>
            <input v-model="editando.gerenteEmail" class="input" />
          </div>
        </div>
        <label class="check"><input type="checkbox" v-model="editando.activo" /> Activo</label>
        <div class="modal-actions">
          <button class="btn" @click="editando = null">Cancelar</button>
          <button class="btn btn-primary" @click="guardar" :disabled="guardando">Guardar</button>
        </div>
        <p v-if="err" class="err">{{ err }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useEmpleados } from '../composables/useEmpleados.js';
import { useAuth } from '../composables/useAuth.js';

const { empleados, fetchEmpleados, guardarEmpleado, actividadPorVendedor } = useEmpleados();
const { esAdminOGerente } = useAuth();

const tab = ref('directorio');
const actividad = ref([]);
const editando = ref(null);
const guardando = ref(false);
const err = ref(null);

onMounted(async () => {
  await fetchEmpleados();
  const map = await actividadPorVendedor();
  actividad.value = [...map.values()].sort((a, b) => b.visitas - a.visitas);
});

function rolLabel(r) {
  return { admin: 'Administrador', gerente: 'Gerente', ventas: 'Ventas', lectura: 'Lectura' }[r] || 'Lectura';
}
function nombreDe(email) {
  return empleados.value.find((e) => e.email === email)?.nombre || email;
}
function nuevo() { editando.value = { email: '', nombre: '', rol: 'ventas', activo: true }; err.value = null; }
function editar(e) { editando.value = { ...e }; err.value = null; }

async function guardar() {
  guardando.value = true;
  err.value = null;
  try {
    await guardarEmpleado(editando.value);
    editando.value = null;
  } catch (e) {
    err.value = e.message;
  } finally {
    guardando.value = false;
  }
}
</script>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.tabs { display: flex; gap: 8px; }
.pill.ok { color: var(--success); }
.pill.off { color: var(--text-dim); }
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 300; display: flex; align-items: center; justify-content: center; }
.modal { width: 440px; max-width: 92vw; }
.modal h3 { margin: 0 0 14px; }
.modal label { margin-top: 10px; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.check { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
.check input { width: auto; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
.err { color: var(--danger); font-size: 12px; margin-top: 10px; }
</style>

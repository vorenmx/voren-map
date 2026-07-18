import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', name: 'inicio', component: () => import('../views/DashboardView.vue'), meta: { titulo: 'Inicio' } },
  { path: '/crm', name: 'crm', component: () => import('../views/CrmView.vue'), meta: { titulo: 'CRM' } },
  { path: '/clientes', name: 'clientes', component: () => import('../views/ClientesView.vue'), meta: { titulo: 'Clientes' } },
  { path: '/graficos', name: 'graficos', component: () => import('../views/GraficosView.vue'), meta: { titulo: 'Gráficos' } },
  { path: '/equipo', name: 'equipo', component: () => import('../views/EquipoView.vue'), meta: { titulo: 'Equipo' } },
  { path: '/almacen', name: 'almacen', component: () => import('../views/AlmacenView.vue'), meta: { titulo: 'Almacén' } },
  { path: '/pedidos', name: 'pedidos', component: () => import('../views/PedidosView.vue'), meta: { titulo: 'Pedidos' } },
  { path: '/analisis', name: 'analisis', component: () => import('../views/AnalisisView.vue'), meta: { titulo: 'Análisis IA' } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

export default createRouter({
  history: createWebHistory(),
  routes,
});

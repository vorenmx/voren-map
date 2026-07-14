<template>
  <div class="chart-wrap">
    <Line v-if="hasData" :data="chartData" :options="options" />
    <div v-else class="empty">{{ emptyText }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const props = defineProps({
  labels: { type: Array, default: () => [] },
  values: { type: Array, default: () => [] },
  label: { type: String, default: '' },
  color: { type: String, default: '#3b82f6' },
  emptyText: { type: String, default: 'Sin datos aún' },
});

const hasData = computed(() => props.labels.length > 0 && props.values.some((v) => Number(v) > 0));

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [{
    label: props.label,
    data: props.values,
    borderColor: props.color,
    backgroundColor: props.color + '33',
    fill: true,
    tension: 0.3,
    pointRadius: 3,
    pointHoverRadius: 5,
    borderWidth: 2,
  }],
}));

const options = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  scales: {
    x: {
      ticks: { color: '#64748b', maxRotation: 45, font: { size: 10 } },
      grid: { color: 'rgba(255,255,255,0.04)' },
    },
    y: {
      beginAtZero: true,
      ticks: { color: '#64748b', precision: 0, font: { size: 10 } },
      grid: { color: 'rgba(255,255,255,0.06)' },
    },
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label(ctx) {
          return ` ${props.label || 'Valor'}: ${ctx.raw}`;
        },
      },
    },
  },
};
</script>

<style scoped>
.chart-wrap { position: relative; height: 260px; width: 100%; }
.empty {
  height: 100%; display: flex; align-items: center; justify-content: center;
  color: var(--text-dim); font-size: 13px; border: 1px dashed var(--border); border-radius: var(--radius);
}
</style>

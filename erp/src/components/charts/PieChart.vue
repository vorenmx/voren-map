<template>
  <div class="chart-wrap">
    <Pie v-if="hasData" :data="chartData" :options="options" />
    <div v-else class="empty">{{ emptyText }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Pie } from 'vue-chartjs';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const props = defineProps({
  labels: { type: Array, default: () => [] },
  values: { type: Array, default: () => [] },
  colors: { type: Array, default: () => [] },
  emptyText: { type: String, default: 'Sin datos aún' },
});

const PALETTE = [
  '#3b82f6', '#34d399', '#fbbf24', '#a78bfa', '#f87171',
  '#22d3ee', '#fb923c', '#e879f9', '#4ade80', '#60a5fa',
  '#c084fc', '#f472b6',
];

const hasData = computed(() => props.values.some((v) => Number(v) > 0));

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [{
    data: props.values,
    backgroundColor: props.labels.map((_, i) => props.colors[i] || PALETTE[i % PALETTE.length]),
    borderColor: '#111827',
    borderWidth: 2,
  }],
}));

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: '#94a3b8',
        boxWidth: 12,
        padding: 12,
        font: { size: 11, family: 'Inter, system-ui, sans-serif' },
      },
    },
    tooltip: {
      callbacks: {
        label(ctx) {
          const total = ctx.dataset.data.reduce((s, n) => s + Number(n || 0), 0);
          const val = Number(ctx.raw || 0);
          const pct = total ? ((val / total) * 100).toFixed(1) : 0;
          return ` ${ctx.label}: ${val} (${pct}%)`;
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

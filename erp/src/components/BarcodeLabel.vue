<template>
  <div class="label">
    <svg ref="svgEl"></svg>
    <button class="btn btn-sm" @click="imprimir">🖨️ Imprimir</button>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import JsBarcode from 'jsbarcode';

const props = defineProps({
  value: { type: String, required: true },
  nombre: { type: String, default: '' },
});
const svgEl = ref(null);

function render() {
  if (!svgEl.value || !props.value) return;
  try {
    JsBarcode(svgEl.value, props.value, {
      format: 'CODE128', displayValue: true, fontSize: 14, height: 50, margin: 6,
    });
  } catch { /* invalid value */ }
}

onMounted(render);
watch(() => props.value, render);

function imprimir() {
  const svg = svgEl.value?.outerHTML || '';
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>${props.nombre}</title></head><body style="text-align:center;font-family:sans-serif">
    <div>${props.nombre}</div>${svg}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}
</script>

<style scoped>
.label { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; background: #fff; padding: 10px; border-radius: var(--radius); width: fit-content; }
</style>

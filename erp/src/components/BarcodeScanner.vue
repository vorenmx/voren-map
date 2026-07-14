<template>
  <div class="scanner">
    <div class="scan-row">
      <input
        ref="inputEl"
        v-model="manual"
        class="input"
        placeholder="Escanea o escribe el código…"
        @keyup.enter="emitManual"
        autofocus
      />
      <button class="btn" @click="toggleCam">{{ escaneando ? 'Detener' : '📷 Cámara' }}</button>
    </div>
    <video v-show="escaneando" ref="videoEl" class="video" muted playsinline></video>
    <p v-if="error" class="err">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useEscaner } from '../composables/useEscaner.js';

const emit = defineEmits(['scanned']);
const { escaneando, error, iniciar, detener } = useEscaner();
const videoEl = ref(null);
const inputEl = ref(null);
const manual = ref('');

onMounted(() => inputEl.value?.focus());
onBeforeUnmount(() => detener());

function emitManual() {
  if (manual.value.trim()) {
    emit('scanned', manual.value.trim());
    manual.value = '';
  }
}
async function toggleCam() {
  if (escaneando.value) { detener(); return; }
  await iniciar(videoEl.value, (code) => {
    detener();
    emit('scanned', code);
  });
}
</script>

<style scoped>
.scan-row { display: flex; gap: 8px; }
.video { width: 100%; max-width: 360px; margin-top: 10px; border-radius: var(--radius); border: 1px solid var(--border); }
.err { color: var(--danger); font-size: 12px; }
</style>

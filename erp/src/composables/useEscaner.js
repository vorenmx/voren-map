import { ref } from 'vue';
import { BrowserMultiFormatReader } from '@zxing/browser';

/**
 * Camera-based barcode scanner (EAN/UPC/Code128) using @zxing/browser.
 * Attach to a <video> element ref; emits decoded text via onResult.
 */
export function useEscaner() {
  const escaneando = ref(false);
  const error = ref(null);
  let controls = null;
  let reader = null;

  async function iniciar(videoEl, onResult) {
    error.value = null;
    try {
      reader = new BrowserMultiFormatReader();
      escaneando.value = true;
      controls = await reader.decodeFromVideoDevice(undefined, videoEl, (result) => {
        if (result) onResult(result.getText());
      });
    } catch (e) {
      error.value = 'No se pudo acceder a la cámara: ' + (e?.message || e);
      escaneando.value = false;
    }
  }

  function detener() {
    try { controls?.stop(); } catch { /* noop */ }
    controls = null;
    reader = null;
    escaneando.value = false;
  }

  return { escaneando, error, iniciar, detener };
}

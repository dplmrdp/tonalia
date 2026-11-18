// Transcribe la letra con Whisper dentro del navegador (transformers.js + ONNX en WebAssembly).
// La primera vez descarga el modelo desde Hugging Face; después el navegador lo guarda en caché.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2';

env.allowLocalModels = false;

let asr = null, loaded = '';

self.onmessage = async (e) => {
  const { audio, model, language } = e.data;
  try {
    if (!asr || loaded !== model) {
      asr = await pipeline('automatic-speech-recognition', model, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (p) => self.postMessage({ type: 'load', p }),
      });
      loaded = model;
    }
    self.postMessage({ type: 'run' });
    const out = await asr(audio, {
      language: language || null,
      task: 'transcribe',
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    const chunks = out.chunks && out.chunks.length ? out.chunks : [{ timestamp: [0, null], text: out.text }];
    self.postMessage({ type: 'done', chunks });
  } catch (err) {
    self.postMessage({ type: 'error', message: String((err && err.message) || err) });
  }
};

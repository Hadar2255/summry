let _pipelinePromise = null;
let _currentModel = null;

export const WHISPER_MODELS = [
  { id: 'Xenova/whisper-tiny', label: 'Tiny (מהיר, ~75MB)', sizeMB: 75 },
  { id: 'Xenova/whisper-base', label: 'Base (מאוזן, ~150MB)', sizeMB: 150 },
  { id: 'onnx-community/whisper-small', label: 'Small (איכותי לעברית, ~250MB)', sizeMB: 250 }
];

export const DEFAULT_MODEL = 'Xenova/whisper-base';

export async function loadWhisper(modelId = DEFAULT_MODEL, onProgress) {
  if (_pipelinePromise && _currentModel === modelId) return _pipelinePromise;

  _currentModel = modelId;
  _pipelinePromise = (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    const dtype = 'q8';
    let device = 'wasm';
    try {
      if (navigator.gpu && (await navigator.gpu.requestAdapter())) device = 'webgpu';
    } catch {}

    return await pipeline('automatic-speech-recognition', modelId, {
      dtype,
      device,
      progress_callback: (p) => {
        if (onProgress && p?.status === 'progress') {
          onProgress({
            file: p.file,
            loaded: p.loaded,
            total: p.total,
            progress: p.progress ?? (p.total ? p.loaded / p.total : 0)
          });
        }
      }
    });
  })();

  try {
    return await _pipelinePromise;
  } catch (e) {
    _pipelinePromise = null;
    _currentModel = null;
    throw e;
  }
}

export async function transcribeAudio(audioFloat32, {
  modelId = DEFAULT_MODEL,
  language = 'he',
  onModelProgress,
  onChunk
} = {}) {
  const transcriber = await loadWhisper(modelId, onModelProgress);
  const result = await transcriber(audioFloat32, {
    language,
    task: 'transcribe',
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
    callback_function: onChunk
  });

  const chunks = (result.chunks || []).map((c, i) => ({
    id: i + 1,
    start: c.timestamp?.[0] ?? 0,
    end: c.timestamp?.[1] ?? 0,
    text: (c.text || '').trim()
  })).filter(c => c.text);

  return { text: (result.text || '').trim(), chunks };
}

export function formatTimestamp(sec) {
  if (!Number.isFinite(sec)) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

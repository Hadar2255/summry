const API_ENDPOINT = '/api/transcribe';

export async function transcribeAudio(blob, { signal, language = 'he' } = {}) {
  if (!blob || !(blob instanceof Blob)) {
    throw new Error('audio blob required');
  }

  const ext = mimeToExtension(blob.type);
  const form = new FormData();
  form.append('audio', blob, `meeting.${ext}`);
  form.append('language', language);

  let res;
  try {
    res = await fetch(API_ENDPOINT, { method: 'POST', body: form, signal });
  } catch (e) {
    throw new Error('לא ניתן להתחבר לשרת התמלול (' + e.message + ')');
  }

  let payload;
  try {
    payload = await res.json();
  } catch {
    throw new Error(`תגובת שרת לא תקינה (סטטוס ${res.status})`);
  }

  if (!res.ok) {
    throw new Error(payload?.error || `שגיאת שרת תמלול (${res.status})`);
  }

  return {
    text: payload.text || '',
    chunks: Array.isArray(payload.chunks) ? payload.chunks : []
  };
}

export async function checkTranscribeBackend() {
  try {
    const empty = new Blob([], { type: 'audio/webm' });
    const form = new FormData();
    form.append('audio', empty, 'ping.webm');
    const res = await fetch(API_ENDPOINT, { method: 'POST', body: form });
    if (res.ok) return { ok: true };
    const payload = await res.json().catch(() => ({}));
    if (res.status === 500 && /GROQ_API_KEY/i.test(payload?.error || '')) {
      return { ok: false, error: 'GROQ_API_KEY חסר ב-Vercel' };
    }
    if (res.status === 404) return { ok: false, error: '/api/transcribe לא נמצא' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function mimeToExtension(mime) {
  if (!mime) return 'webm';
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mpeg')) return 'mp3';
  return 'webm';
}

export function formatTimestamp(sec) {
  if (!Number.isFinite(sec)) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

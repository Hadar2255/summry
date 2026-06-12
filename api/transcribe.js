export const config = { runtime: 'edge' };

const TRANSCRIBE_MODEL = 'whisper-large-v3';
const HEBREW_PROMPT = 'תמלול פגישה עסקית בעברית. דוברים מנהלים, צוות פיתוח, לקוחות. נושאים: תקציב, פרויקטים, משימות, לוחות זמנים, החלטות.';

/* CORS is open because the Android app calls this API from a local
   WebView origin. The Groq key never leaves the server either way. */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS, ...(init.headers || {}) }
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'POST only' }, { status: 405 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return json({ error: 'GROQ_API_KEY missing on server' }, { status: 500 });
  }

  let inForm;
  try {
    inForm = await req.formData();
  } catch (e) {
    return json({ error: 'multipart body required' }, { status: 400 });
  }

  const audio = inForm.get('audio');
  if (!audio || typeof audio === 'string') {
    return json({ error: 'audio field required' }, { status: 400 });
  }

  const language = (inForm.get('language') || 'he').toString();

  const promptParam = inForm.get('prompt');
  const customPrompt = typeof promptParam === 'string' && promptParam.trim() ? promptParam.trim() : null;

  const groqForm = new FormData();
  groqForm.append('file', audio, audio.name || 'meeting.webm');
  groqForm.append('model', TRANSCRIBE_MODEL);
  groqForm.append('language', language);
  groqForm.append('response_format', 'verbose_json');
  groqForm.append('temperature', '0');
  if (language === 'he') {
    groqForm.append('prompt', customPrompt || HEBREW_PROMPT);
  } else if (customPrompt) {
    groqForm.append('prompt', customPrompt);
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: groqForm
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => '');
      const msg =
        groqRes.status === 401 ? 'מפתח Groq בשרת לא תקין' :
        groqRes.status === 413 ? 'הקובץ גדול מדי (מקסימום ~25MB ב-Groq Free)' :
        groqRes.status === 429 ? 'חרגת ממכסת ה-Free Tier של Groq' :
        `Groq error (${groqRes.status}): ${errText.slice(0, 300)}`;
      return json({ error: msg }, { status: groqRes.status });
    }

    const data = await groqRes.json();
    const text = (data.text || '').trim();
    const segments = Array.isArray(data.segments) ? data.segments : [];
    const chunks = segments
      .map((s, i) => ({
        id: i + 1,
        start: typeof s.start === 'number' ? s.start : 0,
        end: typeof s.end === 'number' ? s.end : 0,
        text: (s.text || '').trim()
      }))
      .filter(c => c.text);

    return json({ text, chunks });
  } catch (e) {
    return json({ error: `Server error: ${e.message}` }, { status: 500 });
  }
}

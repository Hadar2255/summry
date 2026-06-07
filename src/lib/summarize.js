const API_ENDPOINT = '/api/summarize';

export async function summarizeMeeting(transcript, { signal } = {}) {
  if (!transcript || !transcript.trim()) throw new Error('התמלול ריק');

  let res;
  try {
    res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript }),
      signal
    });
  } catch (e) {
    throw new Error('לא ניתן להתחבר לשרת הסיכום (' + e.message + ')');
  }

  let payload;
  try {
    payload = await res.json();
  } catch {
    throw new Error(`תגובת שרת לא תקינה (סטטוס ${res.status})`);
  }

  if (!res.ok) {
    throw new Error(payload?.error || `שגיאת שרת (${res.status})`);
  }

  const content = payload?.content;
  if (!content) throw new Error('השרת החזיר תגובה ריקה');

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('המודל החזיר JSON לא תקני');
  }

  return {
    title: String(parsed.title || 'פגישה ללא כותרת').trim(),
    summary: String(parsed.summary || '').trim(),
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks.map((t, i) => ({
      id: i + 1,
      text: String(t.text || '').trim(),
      assignee: String(t.assignee || '').trim(),
      deadline: String(t.deadline || '').trim(),
      done: false
    })).filter(t => t.text) : [],
    proposedMeeting: parsed.proposedMeeting ? {
      title: String(parsed.proposedMeeting.title || '').trim(),
      date: String(parsed.proposedMeeting.date || '').trim(),
      time: String(parsed.proposedMeeting.time || '').trim(),
      attendees: String(parsed.proposedMeeting.attendees || '').trim()
    } : { title: '', date: '', time: '', attendees: '' }
  };
}

export async function checkSummarizeBackend() {
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: 'בדיקה' })
    });
    if (res.ok) return { ok: true };
    const payload = await res.json().catch(() => ({}));
    if (res.status === 500 && /GROQ_API_KEY/i.test(payload?.error || '')) {
      return { ok: false, error: 'GROQ_API_KEY חסר ב-Vercel' };
    }
    if (res.status === 404) return { ok: false, error: '/api/summarize לא נמצא — האם הפריסה על Vercel?' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

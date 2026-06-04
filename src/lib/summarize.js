const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

export const SUMMARIZE_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `אתה עוזר AI לניתוח פגישות עסקיות בעברית.
קיבלת תמלול של פגישה. הפק ניתוח מובנה בעברית בלבד בפורמט JSON.

החזר JSON עם השדות הבאים בדיוק:
{
  "title": "כותרת קצרה (עד 8 מילים) שמסכמת את נושא הפגישה",
  "summary": "סיכום מנהלים תמציתי (3-5 משפטים) המכסה את הנקודות המרכזיות וההחלטות",
  "tasks": [
    {
      "text": "תיאור המשימה",
      "assignee": "שם המבצע אם הוזכר, אחרת מחרוזת ריקה",
      "deadline": "תאריך בפורמט YYYY-MM-DD אם הוזכר/מוסק, אחרת מחרוזת ריקה"
    }
  ],
  "proposedMeeting": {
    "title": "כותרת לפגישת המשך אם נדרשת, אחרת מחרוזת ריקה",
    "date": "YYYY-MM-DD אם נקבע/הוסכם, אחרת מחרוזת ריקה",
    "time": "HH:MM אם נקבע, אחרת מחרוזת ריקה",
    "attendees": "שמות מופרדים בפסיק אם הוזכרו, אחרת מחרוזת ריקה"
  }
}

חוקים:
- תמיד החזר JSON תקני בלבד, ללא טקסט נוסף.
- כל הטקסט חייב להיות בעברית.
- אם אין משימות — החזר מערך ריק.
- אל תמציא פרטים שלא הופיעו בתמלול.`;

export async function summarizeMeeting(transcript, { apiKey, signal } = {}) {
  if (!apiKey) throw new Error('חסר מפתח Groq API. הוסף בהגדרות.');
  if (!transcript || !transcript.trim()) throw new Error('התמלול ריק');

  const userMessage = `להלן תמלול הפגישה. הפק את ה-JSON המבוקש:\n\n${transcript}`;

  const res = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: SUMMARIZE_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ]
    }),
    signal
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    if (res.status === 401) throw new Error('מפתח Groq לא תקין. בדוק בהגדרות.');
    if (res.status === 429) throw new Error('חרגת ממכסת ה-Free Tier של Groq. נסה שוב בעוד דקה.');
    throw new Error(`שגיאת Groq (${res.status}): ${errBody.slice(0, 200)}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq לא החזיר תוכן');

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Groq החזיר JSON לא תקני');
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

export async function testGroqKey(apiKey) {
  if (!apiKey) return { ok: false, error: 'חסר מפתח' };
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (res.status === 401) return { ok: false, error: 'מפתח לא תקין' };
    if (!res.ok) return { ok: false, error: `שגיאה (${res.status})` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

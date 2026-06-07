export const config = { runtime: 'edge' };

const MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `אתה עוזר AI לניתוח פגישות עסקיות בעברית. קיבלת תמלול גולמי שהופק על ידי Whisper. התמלול עלול להכיל שגיאות כתיב, מילים שגויות שנשמעות דומות, סימני פיסוק חסרים, ופיצול משפטים שגוי — במיוחד בעברית.

המשימה שלך: לתקן את התמלול כדי שיהיה קריא, ואז להפיק ניתוח מובנה. החזר JSON בעברית בלבד עם השדות הבאים בדיוק:

{
  "correctedTranscript": "התמלול המתוקן — אותו תוכן בדיוק עם שגיאות כתיב/פיסוק מתוקנות. אל תוסיף או תוריד מידע. שמור פסקאות לפי דובר אם ברור. אל תמציא נתונים.",
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

חוקים קריטיים:
- תקן רק שגיאות כתיב, פיסוק, ומילים שנשמעות דומה. אל תשנה משמעות.
- אל תוסיף מידע שלא הופיע בתמלול. אל תמציא משימות, תאריכים, או שמות.
- כל הטקסט בעברית בלבד.
- JSON תקני בלבד, ללא טקסט נוסף לפני או אחרי.`;

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return json({ error: 'POST only' }, { status: 405 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return json({ error: 'GROQ_API_KEY חסר בהגדרות Vercel. הוסף Environment Variable.' }, { status: 500 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  const transcript = body?.transcript;
  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    return json({ error: 'transcript field required' }, { status: 400 });
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `להלן תמלול הפגישה. הפק את ה-JSON המבוקש:\n\n${transcript}` }
        ]
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => '');
      const msg =
        groqRes.status === 401 ? 'מפתח Groq בשרת לא תקין' :
        groqRes.status === 429 ? 'חרגת ממכסת ה-Free Tier של Groq' :
        `Groq error (${groqRes.status}): ${errText.slice(0, 300)}`;
      return json({ error: msg }, { status: groqRes.status });
    }

    const data = await groqRes.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return json({ error: 'Groq returned empty content' }, { status: 502 });

    return json({ content });
  } catch (e) {
    return json({ error: `Server error: ${e.message}` }, { status: 500 });
  }
}

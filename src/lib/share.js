/* ============================================================
   share.js — draft email + Google Calendar links (no OAuth)
   Builds mailto: and calendar.google.com/render?TEMPLATE URLs.
   The user reviews the pre-filled draft and confirms (send/save).
   ============================================================ */

function pad(n) {
  return String(n).padStart(2, '0');
}

/* Google Calendar wants:  YYYYMMDDTHHMMSS  (local, no Z)
   or for all-day events:  YYYYMMDD         (end is exclusive) */
function gcalDateTime(dateStr, timeStr) {
  // dateStr: "YYYY-MM-DD", timeStr: "HH:MM"
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '09:00').split(':').map(Number);
  return `${y}${pad(m)}${pad(d)}T${pad(hh)}${pad(mm)}00`;
}

function addOneDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
}

function compactDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${y}${pad(m)}${pad(d)}`;
}

/* Add 1 hour to HH:MM, returns HH:MM (clamps at 23:59) */
function plusOneHour(timeStr) {
  const [hh, mm] = (timeStr || '09:00').split(':').map(Number);
  const end = Math.min(23 * 60 + 59, hh * 60 + mm + 60);
  return `${pad(Math.floor(end / 60))}:${pad(end % 60)}`;
}

/* ------------------------------------------------------------ */
/*                    GOOGLE CALENDAR LINKS                      */
/* ------------------------------------------------------------ */

export function calendarLinkForMeeting({ title, date, time, attendees, details }) {
  if (!date) return null;
  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', title || 'פגישה');

  if (time) {
    const start = gcalDateTime(date, time);
    const end = gcalDateTime(date, plusOneHour(time));
    params.set('dates', `${start}/${end}`);
  } else {
    // all-day
    params.set('dates', `${compactDate(date)}/${addOneDay(date)}`);
  }

  if (details) params.set('details', details);
  if (attendees) {
    const emails = attendees
      .split(',')
      .map(s => s.trim())
      .filter(s => /@/.test(s));
    if (emails.length) params.set('add', emails.join(','));
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function calendarLinkForTask(task, meetingTitle) {
  if (!task?.deadline) return null;
  const details = [
    task.assignee ? `אחראי/ת: ${task.assignee}` : '',
    meetingTitle ? `מתוך הפגישה: ${meetingTitle}` : '',
    'נוצר ע"י SummAI'
  ].filter(Boolean).join('\n');

  return calendarLinkForMeeting({
    title: `משימה: ${task.text}`,
    date: task.deadline,
    time: '',           // all-day deadline reminder
    attendees: '',
    details
  });
}

/* ------------------------------------------------------------ */
/*                      EMAIL DRAFT (mailto)                     */
/* ------------------------------------------------------------ */

function formatDeadline(deadline) {
  if (!deadline) return '';
  try {
    return new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
      .format(new Date(deadline));
  } catch {
    return deadline;
  }
}

export function buildEmailDraft(meeting) {
  const lines = [];
  lines.push(`סיכום פגישה: ${meeting.title || 'ללא כותרת'}`);
  if (meeting.dateLabel) lines.push(`תאריך: ${meeting.dateLabel}`);
  lines.push('');

  if (meeting.summary) {
    lines.push('── סיכום מנהלים ──');
    lines.push(meeting.summary);
    lines.push('');
  }

  const tasks = meeting.tasks || [];
  if (tasks.length) {
    lines.push('── משימות לביצוע ──');
    tasks.forEach((t, i) => {
      const parts = [`${i + 1}. ${t.text}`];
      const meta = [];
      if (t.assignee) meta.push(`אחראי/ת: ${t.assignee}`);
      if (t.deadline) meta.push(`יעד: ${formatDeadline(t.deadline)}`);
      if (t.done) meta.push('✓ הושלם');
      if (meta.length) parts.push(`   (${meta.join(' | ')})`);
      lines.push(parts.join('\n'));
    });
    lines.push('');
  }

  const pm = meeting.proposedMeeting;
  if (pm && (pm.title || pm.date)) {
    lines.push('── פגישת המשך מוצעת ──');
    if (pm.title) lines.push(`נושא: ${pm.title}`);
    if (pm.date) lines.push(`מועד: ${formatDeadline(pm.date)}${pm.time ? ` בשעה ${pm.time}` : ''}`);
    if (pm.attendees) lines.push(`משתתפים: ${pm.attendees}`);
    lines.push('');
  }

  lines.push('—');
  lines.push('נשלח באמצעות SummAI');

  const subject = `סיכום פגישה — ${meeting.title || 'פגישה'}`;
  const body = lines.join('\n');

  return { subject, body };
}

export function mailtoUrl(meeting, to = '') {
  const { subject, body } = buildEmailDraft(meeting);
  const params = new URLSearchParams();
  params.set('subject', subject);
  params.set('body', body);
  // URLSearchParams encodes spaces as '+', but mail clients want %20 in body
  const qs = params.toString().replace(/\+/g, '%20');
  return `mailto:${encodeURIComponent(to)}?${qs}`;
}

/* Gmail compose web URL — opens Gmail draft in browser (good when
   the default mail app isn't configured, e.g. desktop). */
export function gmailComposeUrl(meeting, to = '') {
  const { subject, body } = buildEmailDraft(meeting);
  const params = new URLSearchParams();
  params.set('view', 'cm');
  params.set('fs', '1');
  if (to) params.set('to', to);
  params.set('su', subject);
  params.set('body', body);
  return `https://mail.google.com/mail/?${params.toString()}`;
}

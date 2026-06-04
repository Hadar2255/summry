import React, { useState, useEffect, useMemo } from 'react';
import {
  Mic, MicOff, Upload, Bell, Sparkles, FileText, Home,
  Settings as SettingsIcon, CheckCircle2, Calendar as CalendarIcon,
  CalendarDays, Mail, Shield, Lock, Database, Activity, Zap,
  ListChecks, Plus, Trash2, Save, ChevronRight, User,
  Signal, Wifi, BatteryFull, CheckSquare, Square, LogOut, Globe,
  MessageSquare, Volume2, UserPlus, Edit3, X, Users
} from 'lucide-react';

/* ============================================================
   SummAI — AI Meeting Assistant for B2B (Hebrew RTL)
   Single-file interactive prototype rendered inside a phone frame
   ============================================================ */

const SAPPHIRE = '#0F2042';

const INITIAL_MEETINGS = [
  { id: 1, title: 'ישיבת הנהלה - תקציב Q3', date: '3 ביוני 2026', duration: '47 דקות', participants: 6 },
  { id: 2, title: 'סיכום חציון פרויקט אטלס', date: '1 ביוני 2026', duration: '1:12 שעות', participants: 9 },
  { id: 3, title: 'פגישה עם הלקוח NorthStar', date: '29 במאי 2026', duration: '32 דקות', participants: 4 },
  { id: 4, title: 'סינק שבועי - צוות מוצר', date: '27 במאי 2026', duration: '28 דקות', participants: 5 }
];

const INITIAL_SUMMARY =
  'בישיבת ההנהלה נדונו אבני הדרך לרבעון השלישי של 2026, כולל אישור התקציב המעודכן לפרויקט אטלס בסך 2.4 מיליון ש"ח. הוסכם על קידום ההשקה הבינלאומית באוקטובר ועל גיוס שני אנשי פיתוח נוספים. כמו כן הוצגו תוצאות שביעות רצון הלקוחות (NPS 62) ונקבע יעד לרבעון הבא של 70.';

const INITIAL_TASKS = [
  { id: 1, text: 'להכין מצגת תקציב מעודכנת', assignee: 'דנה כהן',    deadline: '2026-06-08', done: false },
  { id: 2, text: 'לתאם פגישת Kick-Off עם צוות הפיתוח', assignee: 'יוסי לוי',     deadline: '2026-06-05', done: true  },
  { id: 3, text: 'לסכם דרישות חוקיות מהלקוח', assignee: 'נועה שמש',     deadline: '2026-06-12', done: false }
];

const INITIAL_PROPOSED = {
  title: 'פולו-אפ - אישור תקציב Q3',
  date: '2026-06-09',
  time: '10:30',
  attendees: 'דנה כהן, יוסי לוי, רינה אבני'
};

const ASSIGNEES = ['דנה כהן', 'יוסי לוי', 'נועה שמש', 'רינה אבני', 'אורי ברק'];

/* Speaker diarization — palette + seed data */
const SPEAKER_COLORS = {
  indigo:  { bg: 'bg-indigo-100',  text: 'text-indigo-800',  ring: 'ring-indigo-300',  solid: 'bg-indigo-500',  dot: 'bg-indigo-500'  },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-800', ring: 'ring-emerald-300', solid: 'bg-emerald-500', dot: 'bg-emerald-500' },
  amber:   { bg: 'bg-amber-100',   text: 'text-amber-900',   ring: 'ring-amber-300',   solid: 'bg-amber-500',   dot: 'bg-amber-500'   },
  rose:    { bg: 'bg-rose-100',    text: 'text-rose-800',    ring: 'ring-rose-300',    solid: 'bg-rose-500',    dot: 'bg-rose-500'    },
  sky:     { bg: 'bg-sky-100',     text: 'text-sky-800',     ring: 'ring-sky-300',     solid: 'bg-sky-500',     dot: 'bg-sky-500'     },
  slate:   { bg: 'bg-slate-200',   text: 'text-slate-700',   ring: 'ring-slate-300',   solid: 'bg-slate-500',   dot: 'bg-slate-500'   }
};

const COLOR_KEYS = ['indigo', 'emerald', 'amber', 'rose', 'sky'];

const INITIAL_SPEAKERS = [
  { id: 's1', name: 'דנה כהן',         color: 'indigo',  trained: true  },
  { id: 's2', name: 'יוסי לוי',        color: 'emerald', trained: true  },
  { id: 's3', name: 'נועה שמש',        color: 'amber',   trained: true  },
  { id: 's4', name: 'דובר לא מזוהה',   color: 'slate',   trained: false }
];

const INITIAL_TRANSCRIPT = [
  { id: 1, speakerId: 's1', time: '00:14', text: 'בואו נתחיל בסקירת הביצועים של הרבעון השני. ה-NPS עלה ל-62 — שיפור של 8 נקודות מהרבעון הקודם.' },
  { id: 2, speakerId: 's2', time: '00:42', text: 'מצוין. בהקשר הזה, אני חושב שאנחנו צריכים להגדיל את התקציב של פרויקט אטלס לפחות ב-15%.' },
  { id: 3, speakerId: 's3', time: '01:08', text: 'אני מסכימה. אבל לפני שמאשרים, צריך לוודא שיש לנו עמידה רגולטורית מלאה בשווקים החדשים.' },
  { id: 4, speakerId: 's1', time: '01:35', text: 'נכון, זה קריטי. נועה, תוכלי לסכם את הדרישות החוקיות עד סוף השבוע?' },
  { id: 5, speakerId: 's3', time: '01:48', text: 'בהחלט, אטפל בזה. אני אצור קשר גם עם הצוות המשפטי בלונדון.' },
  { id: 6, speakerId: 's4', time: '02:12', text: 'אני רוצה להעלות נקודה לגבי גיוס שני אנשי פיתוח נוספים — מתי נוכל לפרסם משרות?' },
  { id: 7, speakerId: 's2', time: '02:30', text: 'יוסי, תוכל לתאם איתי פגישת Kick-Off עם צוות הפיתוח השבוע הבא?' },
  { id: 8, speakerId: 's1', time: '02:55', text: 'מסכמים: אטלס מאושר עם תקציב מוגדל, דנה מכינה מצגת מעודכנת, נועה מטפלת ברגולציה, ויוסי בתיאום הצוות. נפגשים שוב בשבוע הבא.' }
];


/* ============================================================ */
/*                         PHONE FRAME                          */
/* ============================================================ */

function PhoneFrame({ children }) {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 flex items-center justify-center p-4 sm:p-8">
      <div className="relative" style={{ width: 'min(100vw - 32px, 392px)' }}>
        {/* Outer device shell */}
        <div
          className="relative bg-zinc-900 rounded-[3rem] p-[12px] shadow-[0_30px_60px_-20px_rgba(15,32,66,0.5)]"
          style={{ height: 'min(96vh, 844px)' }}
        >
          {/* Physical buttons */}
          <span className="absolute -right-[2px] top-28 h-12 w-[3px] bg-zinc-800 rounded-l-md" />
          <span className="absolute -left-[2px] top-32 h-10 w-[3px] bg-zinc-800 rounded-r-md" />
          <span className="absolute -left-[2px] top-48 h-16 w-[3px] bg-zinc-800 rounded-r-md" />

          {/* Inner screen */}
          <div className="relative h-full w-full bg-slate-50 rounded-[2.3rem] overflow-hidden" dir="rtl">
            {/* Notch */}
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-50 w-32 h-7 bg-black rounded-full flex items-center justify-end pr-3">
              <span className="w-2 h-2 rounded-full bg-zinc-700" />
            </div>
            {/* Status bar */}
            <div className="relative z-10 h-11 px-7 flex items-center justify-between bg-transparent" dir="ltr">
              <span className="text-[14px] font-semibold text-zinc-900 tracking-tight">9:41</span>
              <span className="flex items-center gap-1.5 text-zinc-900">
                <Signal className="w-3.5 h-3.5" />
                <Wifi className="w-3.5 h-3.5" />
                <BatteryFull className="w-5 h-5" />
              </span>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ */
/*                            APP                               */
/* ============================================================ */

export default function App() {
  const [activeTab, setActiveTab]               = useState('dashboard');
  const [isRecording, setIsRecording]           = useState(false);
  const [recordingTime, setRecordingTime]       = useState(0);
  const [selectedMeeting, setSelectedMeeting]   = useState(INITIAL_MEETINGS[0]);
  const [meetings]                              = useState(INITIAL_MEETINGS);
  const [summary, setSummary]                   = useState(INITIAL_SUMMARY);
  const [tasks, setTasks]                       = useState(INITIAL_TASKS);
  const [proposedMeeting, setProposedMeeting]   = useState(INITIAL_PROPOSED);
  const [integrations, setIntegrations]         = useState({ calendar: true, gmail: false });
  const [speakers, setSpeakers]                 = useState(INITIAL_SPEAKERS);
  const [transcript, setTranscript]             = useState(INITIAL_TRANSCRIPT);
  const [toast, setToast]                       = useState(null);

  useEffect(() => {
    if (!isRecording) { setRecordingTime(0); return; }
    const id = setInterval(() => setRecordingTime(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  const showToast = (message, kind = 'success') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 2800);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const openMeeting = (m) => {
    setSelectedMeeting(m);
    setActiveTab('analysis');
  };

  return (
    <PhoneFrame>
      <div className="relative h-[calc(100%-44px)] flex flex-col bg-slate-50">
        <div className="flex-1 overflow-y-auto phone-scroll pb-24">
          {activeTab === 'dashboard' && (
            <DashboardScreen
              meetings={meetings}
              isRecording={isRecording}
              setIsRecording={setIsRecording}
              recordingTime={recordingTime}
              formatTime={formatTime}
              openMeeting={openMeeting}
              showToast={showToast}
              speakers={speakers}
            />
          )}
          {activeTab === 'analysis' && (
            <AnalysisScreen
              meeting={selectedMeeting}
              summary={summary}
              setSummary={setSummary}
              tasks={tasks}
              setTasks={setTasks}
              proposedMeeting={proposedMeeting}
              setProposedMeeting={setProposedMeeting}
              transcript={transcript}
              speakers={speakers}
              setSpeakers={setSpeakers}
              goToSettings={() => setActiveTab('settings')}
              showToast={showToast}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsScreen
              integrations={integrations}
              setIntegrations={setIntegrations}
              speakers={speakers}
              setSpeakers={setSpeakers}
              showToast={showToast}
            />
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className="absolute bottom-24 inset-x-4 z-50 animate-slide-up pointer-events-none">
            <div className={`pointer-events-none px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 ${
              toast.kind === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-white'
            }`}>
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium leading-tight">{toast.message}</p>
            </div>
          </div>
        )}

        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </PhoneFrame>
  );
}

/* ============================================================ */
/*                  SCREEN 1 — DASHBOARD                        */
/* ============================================================ */

function DashboardScreen({ meetings, isRecording, setIsRecording, recordingTime, formatTime, openMeeting, showToast, speakers }) {
  const trainedSpeakers = useMemo(() => speakers.filter(s => s.trained), [speakers]);
  const [currentSpeakerIdx, setCurrentSpeakerIdx] = useState(0);

  useEffect(() => {
    if (!isRecording || trainedSpeakers.length === 0) return;
    const id = setInterval(() => {
      setCurrentSpeakerIdx(i => (i + 1) % trainedSpeakers.length);
    }, 2500);
    return () => clearInterval(id);
  }, [isRecording, trainedSpeakers.length]);

  const currentSpeaker = isRecording && trainedSpeakers.length > 0
    ? trainedSpeakers[currentSpeakerIdx % trainedSpeakers.length]
    : null;

  return (
    <div className="px-5 pt-1">
      <header className="flex items-center justify-between py-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#0F2042] flex items-center justify-center shadow-md shadow-[#0F2042]/25">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-[17px] font-extrabold text-[#0F2042] leading-tight">SummAI</h1>
            <p className="text-[11px] text-slate-500 leading-tight">מרכז הפגישות</p>
          </div>
        </div>
        <button className="relative w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center">
          <Bell className="w-[18px] h-[18px] text-[#0F2042]" />
          <span className="absolute top-1.5 left-1.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white" />
        </button>
      </header>

      {/* Hero recording card */}
      <div
        className={`relative rounded-3xl p-5 mb-3 overflow-hidden transition-colors duration-300 ${
          isRecording
            ? 'bg-gradient-to-br from-rose-50 via-white to-rose-100 border-2 border-rose-200'
            : 'bg-gradient-to-br from-[#0F2042] via-[#152a5a] to-[#1f3a73]'
        }`}
      >
        {!isRecording && (
          <>
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-12 -right-6 w-32 h-32 bg-emerald-400/20 rounded-full blur-2xl" />
          </>
        )}

        <div className="relative flex items-center justify-between mb-4">
          <div>
            <p className={`text-[11px] font-semibold mb-1 ${isRecording ? 'text-rose-600' : 'text-blue-200'}`}>
              {isRecording ? 'הקלטה פעילה' : 'מוכן להקלטה'}
            </p>
            <p className={`text-2xl font-extrabold tracking-tight ${isRecording ? 'text-rose-900' : 'text-white'}`}>
              {isRecording ? formatTime(recordingTime) : 'פגישה חדשה'}
            </p>
            <p className={`text-[11px] mt-0.5 ${isRecording ? 'text-rose-700/80' : 'text-blue-200/90'}`}>
              {isRecording ? 'הסטרימינג מאובטח (AES-256)' : 'AI יזהה משימות אוטומטית'}
            </p>
          </div>

          {isRecording ? (
            <div className="flex items-end gap-[3px] h-10 px-2">
              {[14, 22, 10, 28, 18, 24, 12].map((h, i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-rose-500 animate-pulse"
                  style={{ height: `${h}px`, animationDelay: `${i * 0.12}s`, animationDuration: '0.9s' }}
                />
              ))}
            </div>
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
              <Mic className="w-6 h-6 text-white" />
            </div>
          )}
        </div>

        <button
          onClick={() => {
            setIsRecording(!isRecording);
            showToast(isRecording ? 'ההקלטה נשמרה - מעבד...' : 'התחלת הקלטה מאובטחת');
          }}
          className={`relative w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold transition-all ${
            isRecording
              ? 'bg-rose-600 text-white animate-ring-pulse'
              : 'bg-white text-[#0F2042] hover:bg-blue-50'
          }`}
        >
          {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          <span className="text-[15px]">{isRecording ? 'עצור הקלטה' : 'התחל הקלטת פגישה'}</span>
        </button>

        {/* Live speaker indicator */}
        {currentSpeaker && (
          <div className="relative mt-3 bg-white/70 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2 border border-rose-200">
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-ping" />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${SPEAKER_COLORS[currentSpeaker.color].solid}`} />
            </span>
            <Volume2 className="w-3.5 h-3.5 text-rose-700 flex-shrink-0" />
            <span className="text-[11px] font-bold text-rose-900">מדבר עכשיו:</span>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${SPEAKER_COLORS[currentSpeaker.color].bg}`}>
              <span className={`w-4 h-4 rounded-full ${SPEAKER_COLORS[currentSpeaker.color].solid} text-white text-[8px] font-bold flex items-center justify-center`}>
                {currentSpeaker.name.charAt(0)}
              </span>
              <span className={`text-[11px] font-bold ${SPEAKER_COLORS[currentSpeaker.color].text}`}>
                {currentSpeaker.name}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Upload secondary */}
      <button
        onClick={() => showToast('הקובץ הועלה — ה-AI מתחיל לעבד')}
        className="w-full flex items-center justify-center gap-2 py-3 mb-5 rounded-2xl border-2 border-dashed border-slate-300 bg-white text-[#0F2042] font-semibold text-sm hover:bg-slate-50 hover:border-[#0F2042]/40 transition-colors"
      >
        <Upload className="w-4 h-4" />
        <span>העלה קובץ שמע</span>
      </button>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <Stat label="פגישות החודש" value="14" tone="default" />
        <Stat label="משימות פתוחות" value="7"  tone="default" />
        <Stat label="סינכרון יומן"  value="פעיל" tone="emerald" />
      </div>

      {/* Recent meetings */}
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-sm font-extrabold text-[#0F2042]">פגישות אחרונות</h2>
        <button className="text-[11px] font-semibold text-slate-500">הצג הכל</button>
      </div>

      <div className="space-y-2">
        {meetings.map(m => (
          <button
            key={m.id}
            onClick={() => openMeeting(m)}
            className="w-full bg-white rounded-2xl p-3.5 border border-slate-200 flex items-center gap-3 text-right hover:border-[#0F2042]/40 hover:shadow-sm active:scale-[0.99] transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-[#0F2042]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-bold text-[#0F2042] truncate">{m.title}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] text-slate-500">{m.date}</span>
                <span className="text-slate-300">•</span>
                <span className="text-[11px] text-slate-500">{m.duration}</span>
                <span className="text-slate-300">•</span>
                <span className="text-[11px] text-slate-500">{m.participants} משתתפים</span>
              </div>
            </div>
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              מעובד
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="bg-white rounded-2xl px-3 py-2.5 border border-slate-200">
      <p className="text-[10px] text-slate-500 mb-0.5">{label}</p>
      <p className={`text-lg font-extrabold ${tone === 'emerald' ? 'text-emerald-600' : 'text-[#0F2042]'}`}>
        {value}
      </p>
    </div>
  );
}

/* ============================================================ */
/*               SCREEN 2 — MEETING ANALYSIS                    */
/* ============================================================ */

function AnalysisScreen({ meeting, summary, setSummary, tasks, setTasks, proposedMeeting, setProposedMeeting, transcript, speakers, setSpeakers, goToSettings, showToast }) {
  const [localSummary, setLocalSummary] = useState(summary);
  useEffect(() => setLocalSummary(summary), [summary, meeting?.id]);

  const updateTask  = (id, key, value) => setTasks(prev => prev.map(t => t.id === id ? { ...t, [key]: value } : t));
  const removeTask  = (id) => setTasks(prev => prev.filter(t => t.id !== id));
  const addTask     = () => {
    const newId = (tasks.reduce((m, t) => Math.max(m, t.id), 0) || 0) + 1;
    setTasks(prev => [...prev, { id: newId, text: '', assignee: '', deadline: '', done: false }]);
  };

  const openCount = useMemo(() => tasks.filter(t => !t.done).length, [tasks]);
  const isDirty = localSummary !== summary;

  return (
    <div className="px-5 pt-1">
      <header className="flex items-start justify-between py-3 mb-2 gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-500 mb-0.5">ניתוח AI</p>
          <h1 className="text-[16px] font-extrabold text-[#0F2042] line-clamp-2 leading-snug">{meeting?.title}</h1>
          <p className="text-[11px] text-slate-500 mt-1">
            {meeting?.date} • {meeting?.duration} • {meeting?.participants} משתתפים
          </p>
        </div>
        <span className="flex-shrink-0 mt-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          מעובד
        </span>
      </header>

      {/* Executive summary */}
      <Section icon={<Sparkles className="w-4 h-4 text-[#0F2042]" />} title="סיכום מנהלים" aside="נוצר ע&quot;י AI">
        <div className="bg-white rounded-2xl border border-slate-200 p-3">
          <textarea
            value={localSummary}
            onChange={(e) => setLocalSummary(e.target.value)}
            rows={6}
            className="w-full text-[13px] text-slate-700 leading-relaxed resize-none focus:outline-none placeholder:text-slate-400 bg-transparent"
            placeholder="ערוך את סיכום ה-AI..."
            dir="rtl"
          />
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-[10px] text-slate-400">
              {localSummary.length} תווים {isDirty && <span className="text-amber-600 font-semibold">• לא נשמר</span>}
            </span>
            <button
              onClick={() => { setSummary(localSummary); showToast('הסיכום נשמר בהצלחה'); }}
              disabled={!isDirty}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                isDirty
                  ? 'bg-[#0F2042] text-white hover:bg-[#152a5a]'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              שמור סיכום
            </button>
          </div>
        </div>
      </Section>

      {/* Transcript by speaker */}
      <TranscriptSection
        transcript={transcript}
        speakers={speakers}
        setSpeakers={setSpeakers}
        goToSettings={goToSettings}
        showToast={showToast}
      />

      {/* Action items */}
      <Section icon={<ListChecks className="w-4 h-4 text-[#0F2042]" />} title="משימות לביצוע" aside={`${openCount} פתוחות`}>
        <div className="space-y-2">
          {tasks.map(t => (
            <div key={t.id} className={`bg-white rounded-2xl border p-3 transition-colors ${t.done ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'}`}>
              <div className="flex items-start gap-2 mb-2">
                <button
                  onClick={() => updateTask(t.id, 'done', !t.done)}
                  className="mt-0.5 flex-shrink-0"
                  aria-label="סמן כהושלמה"
                >
                  {t.done
                    ? <CheckSquare className="w-5 h-5 text-emerald-600" />
                    : <Square className="w-5 h-5 text-slate-300" />}
                </button>
                <input
                  type="text"
                  value={t.text}
                  onChange={(e) => updateTask(t.id, 'text', e.target.value)}
                  placeholder="תיאור המשימה..."
                  className={`flex-1 text-[13px] font-semibold bg-transparent focus:outline-none ${
                    t.done ? 'line-through text-slate-400' : 'text-[#0F2042]'
                  }`}
                />
                <button
                  onClick={() => removeTask(t.id)}
                  aria-label="מחק משימה"
                  className="text-slate-300 hover:text-rose-500 transition-colors p-1 flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 pr-7">
                <div className="bg-slate-50 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                  <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <input
                    list={`assignees-${t.id}`}
                    value={t.assignee}
                    onChange={(e) => updateTask(t.id, 'assignee', e.target.value)}
                    placeholder="מבצע"
                    className="bg-transparent text-[11px] font-semibold text-[#0F2042] focus:outline-none flex-1 min-w-0 placeholder:text-slate-400 placeholder:font-normal"
                  />
                  <datalist id={`assignees-${t.id}`}>
                    {ASSIGNEES.map(a => <option key={a} value={a} />)}
                  </datalist>
                </div>
                <div className="bg-slate-50 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                  <CalendarIcon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <input
                    type="date"
                    value={t.deadline}
                    onChange={(e) => updateTask(t.id, 'deadline', e.target.value)}
                    className="bg-transparent text-[11px] font-semibold text-[#0F2042] focus:outline-none flex-1 min-w-0"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addTask}
          className="w-full mt-2 py-2.5 rounded-2xl border-2 border-dashed border-slate-300 text-[#0F2042] text-xs font-bold flex items-center justify-center gap-1.5 hover:border-[#0F2042]/50 hover:bg-blue-50/40 transition-colors"
        >
          <Plus className="w-4 h-4" />
          הוסף משימה חדשה
        </button>
      </Section>

      {/* Proposed meeting */}
      <Section icon={<CalendarDays className="w-4 h-4 text-[#0F2042]" />} title='פגישות מוצעות ללו"ז'>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-l from-blue-50 via-white to-emerald-50 px-3 py-2 flex items-center gap-2 border-b border-slate-100">
            <Zap className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[11px] font-bold text-emerald-700">זוהה אוטומטית ע&quot;י ה-AI</span>
          </div>
          <div className="p-3 space-y-2.5">
            <Field label="כותרת">
              <input
                type="text"
                value={proposedMeeting.title}
                onChange={(e) => setProposedMeeting({ ...proposedMeeting, title: e.target.value })}
                className="w-full text-sm font-semibold text-[#0F2042] bg-slate-50 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#0F2042]/30"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="תאריך">
                <input
                  type="date"
                  value={proposedMeeting.date}
                  onChange={(e) => setProposedMeeting({ ...proposedMeeting, date: e.target.value })}
                  className="w-full text-xs font-semibold text-[#0F2042] bg-slate-50 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-[#0F2042]/30"
                />
              </Field>
              <Field label="שעה">
                <input
                  type="time"
                  value={proposedMeeting.time}
                  onChange={(e) => setProposedMeeting({ ...proposedMeeting, time: e.target.value })}
                  className="w-full text-xs font-semibold text-[#0F2042] bg-slate-50 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-[#0F2042]/30"
                />
              </Field>
            </div>
            <Field label="משתתפים">
              <input
                type="text"
                value={proposedMeeting.attendees}
                onChange={(e) => setProposedMeeting({ ...proposedMeeting, attendees: e.target.value })}
                placeholder="שמות מופרדים בפסיק"
                className="w-full text-xs font-semibold text-[#0F2042] bg-slate-50 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#0F2042]/30"
              />
            </Field>

            <button
              onClick={() => showToast('הפגישה נקבעה בהצלחה ב-Google Calendar!')}
              className="w-full mt-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 transition-colors"
            >
              <CalendarIcon className="w-4 h-4" />
              ערוך ואשר פגישה ביומן
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ icon, title, aside, children }) {
  return (
    <section className="mb-4">
      <div className="flex items-center gap-1.5 mb-2 px-0.5">
        {icon}
        <h2 className="text-[13px] font-extrabold text-[#0F2042]">{title}</h2>
        {aside && <span className="text-[10px] text-slate-400 mr-auto font-medium">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-500 mb-1 block">{label}</label>
      {children}
    </div>
  );
}

/* ============================================================ */
/*               SCREEN 3 — SETTINGS & SECURITY                 */
/* ============================================================ */

function SettingsScreen({ integrations, setIntegrations, speakers, setSpeakers, showToast }) {
  const toggle = (key, name) => {
    const next = !integrations[key];
    setIntegrations({ ...integrations, [key]: next });
    showToast(next ? `${name} חובר בהצלחה דרך OAuth` : `החיבור ל-${name} נותק`);
  };

  return (
    <div className="px-5 pt-1">
      <header className="py-3 mb-2">
        <h1 className="text-xl font-extrabold text-[#0F2042]">הגדרות ואבטחה</h1>
        <p className="text-[11px] text-slate-500 mt-0.5">ניהול חשבון, אינטגרציות והגנה ארגונית</p>
      </header>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#0F2042] to-blue-700 flex items-center justify-center text-white font-extrabold text-sm">
          הב
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-[#0F2042] truncate">הדר ברסלב</p>
          <p className="text-[11px] text-slate-500 truncate">חשבון Enterprise • Acme Corp</p>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 rotate-180 flex-shrink-0" />
      </div>

      {/* Integrations */}
      <SettingsGroup title="אינטגרציות">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <IntegrationRow
            icon={<CalendarDays className="w-5 h-5 text-blue-600" />}
            bg="bg-blue-50"
            title="Google Calendar"
            desc="סנכרון פגישות והוספה אוטומטית"
            connected={integrations.calendar}
            onToggle={() => toggle('calendar', 'Google Calendar')}
          />
          <div className="h-px bg-slate-100 mr-[68px]" />
          <IntegrationRow
            icon={<Mail className="w-5 h-5 text-rose-500" />}
            bg="bg-rose-50"
            title="Gmail"
            desc="שליחת סיכומים ועדכוני משימות"
            connected={integrations.gmail}
            onToggle={() => toggle('gmail', 'Gmail')}
          />
        </div>
      </SettingsGroup>

      {/* Voice profiles */}
      <SettingsGroup title="פרופילי קול">
        <VoiceProfileSection
          speakers={speakers}
          setSpeakers={setSpeakers}
          showToast={showToast}
        />
      </SettingsGroup>

      {/* Enterprise security */}
      <SettingsGroup title="אבטחה ארגונית">
        <div className="relative rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-emerald-50 border-2 border-emerald-200 p-4 overflow-hidden">
          <div className="absolute -left-8 -top-8 w-32 h-32 bg-emerald-200/40 rounded-full blur-2xl" />
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-emerald-300/30 rounded-full blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-md shadow-emerald-600/40">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">סטטוס אבטחה</p>
                <p className="text-[14px] font-extrabold text-emerald-900">מאובטח ברמת Enterprise</p>
              </div>
              <span className="mr-auto px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                ACTIVE
              </span>
            </div>
            <div className="space-y-2">
              <SecurityRow icon={<Lock className="w-4 h-4" />} title="הצפנת נתונים" desc="במנוחה ובסירקולציה (AES-256)" />
              <SecurityRow icon={<Database className="w-4 h-4" />} title='מדיניות אפס שמירת נתונים' desc="Zero Data Retention Active" />
              <SecurityRow icon={<Activity className="w-4 h-4" />} title="ניטור ופיקוח" desc="SOC 2 Type II • ISO 27001" />
              <SecurityRow icon={<Globe className="w-4 h-4" />} title="מיקום אחסון" desc="EU-West • תאימות GDPR" />
            </div>
          </div>
        </div>
      </SettingsGroup>

      {/* Actions */}
      <SettingsGroup title="פעולות">
        <div className="space-y-2">
          <button className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <span className="text-sm font-semibold text-[#0F2042]">ייצוא נתונים</span>
            <ChevronRight className="w-4 h-4 text-slate-400 rotate-180" />
          </button>
          <button className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <span className="text-sm font-semibold text-[#0F2042]">תמיכה ארגונית</span>
            <ChevronRight className="w-4 h-4 text-slate-400 rotate-180" />
          </button>
          <button className="w-full bg-rose-50 border border-rose-100 rounded-2xl py-3 px-4 text-sm font-bold text-rose-600 hover:bg-rose-100 transition-colors flex items-center justify-center gap-2">
            <LogOut className="w-4 h-4" />
            התנתקות
          </button>
        </div>
      </SettingsGroup>

      <p className="text-center text-[10px] text-slate-400 py-3">SummAI v2.4 • יוני 2026</p>
    </div>
  );
}

function SettingsGroup({ title, children }) {
  return (
    <section className="mb-5">
      <h2 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-2 px-1">{title}</h2>
      {children}
    </section>
  );
}

function IntegrationRow({ icon, bg, title, desc, connected, onToggle }) {
  return (
    <div className="w-full p-3 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-2xl ${bg} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[14px] font-bold text-[#0F2042]">{title}</p>
          {connected && (
            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
              מחובר
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 truncate">{desc}</p>
      </div>
      <button
        onClick={onToggle}
        aria-pressed={connected}
        aria-label={`${connected ? 'נתק' : 'חבר'} ${title}`}
        className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${connected ? 'right-0.5' : 'right-[22px]'}`} />
      </button>
    </div>
  );
}

function SecurityRow({ icon, title, desc }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-bold text-emerald-900 truncate">{title}</p>
        <p className="text-[10px] text-emerald-700/80 truncate">{desc}</p>
      </div>
      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
    </div>
  );
}

/* ============================================================ */
/*               SPEAKER DIARIZATION COMPONENTS                 */
/* ============================================================ */

function TranscriptSection({ transcript, speakers, setSpeakers, goToSettings, showToast }) {
  const [activeFilterId, setActiveFilterId] = useState(null);
  const [editingId, setEditingId]           = useState(null);
  const [draftName, setDraftName]           = useState('');

  const speakersById = useMemo(() => {
    const map = {};
    speakers.forEach(s => { map[s.id] = s; });
    return map;
  }, [speakers]);

  const visible = useMemo(() => {
    if (!activeFilterId) return transcript;
    return transcript.filter(u => u.speakerId === activeFilterId);
  }, [transcript, activeFilterId]);

  const startEdit = (speaker) => {
    setEditingId(speaker.id);
    setDraftName(speaker.name);
  };

  const commitEdit = () => {
    const trimmed = draftName.trim();
    if (!trimmed) { setEditingId(null); return; }
    setSpeakers(prev => prev.map(s => s.id === editingId ? { ...s, name: trimmed } : s));
    setEditingId(null);
    showToast('שם הדובר עודכן בכל הציטוטים');
  };

  const promoteToProfile = (speaker) => {
    setSpeakers(prev => prev.map(s => s.id === speaker.id ? { ...s, trained: true, color: 'sky' } : s));
    showToast('פרופיל קול נוצר — מעבר להגדרות');
    setTimeout(() => goToSettings && goToSettings(), 600);
  };

  return (
    <Section
      icon={<MessageSquare className="w-4 h-4 text-[#0F2042]" />}
      title="תמלול לפי דובר"
      aside={`${transcript.length} ציטוטים`}
    >
      <SpeakerFilterChips
        speakers={speakers}
        activeFilterId={activeFilterId}
        setActiveFilterId={setActiveFilterId}
        transcript={transcript}
      />

      <div className="space-y-2 mt-2">
        {visible.map(u => {
          const speaker = speakersById[u.speakerId];
          if (!speaker) return null;
          const isEditing = editingId === speaker.id;
          return (
            <SpeakerBubble
              key={u.id}
              utterance={u}
              speaker={speaker}
              isEditing={isEditing}
              draftName={draftName}
              setDraftName={setDraftName}
              onStartEdit={() => startEdit(speaker)}
              onCommitEdit={commitEdit}
              onCancelEdit={() => setEditingId(null)}
              onPromoteToProfile={() => promoteToProfile(speaker)}
            />
          );
        })}
        {visible.length === 0 && (
          <div className="text-center py-6 text-xs text-slate-400">
            אין ציטוטים לדובר זה
          </div>
        )}
      </div>
    </Section>
  );
}

function SpeakerFilterChips({ speakers, activeFilterId, setActiveFilterId, transcript }) {
  const counts = useMemo(() => {
    const c = {};
    transcript.forEach(u => { c[u.speakerId] = (c[u.speakerId] || 0) + 1; });
    return c;
  }, [transcript]);

  const present = speakers.filter(s => counts[s.id] > 0);

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto phone-scroll pb-1 -mx-0.5 px-0.5">
      <button
        onClick={() => setActiveFilterId(null)}
        className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
          activeFilterId === null
            ? 'bg-[#0F2042] text-white'
            : 'bg-white border border-slate-200 text-slate-600'
        }`}
      >
        <Users className="w-3 h-3" />
        הכל
      </button>
      {present.map(s => {
        const colors = SPEAKER_COLORS[s.color];
        const active = activeFilterId === s.id;
        return (
          <button
            key={s.id}
            onClick={() => setActiveFilterId(active ? null : s.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
              active
                ? `${colors.bg} ${colors.text} ring-2 ${colors.ring}`
                : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
            {s.name}
            <span className="text-slate-400 font-medium">{counts[s.id]}</span>
          </button>
        );
      })}
    </div>
  );
}

function SpeakerBubble({ utterance, speaker, isEditing, draftName, setDraftName, onStartEdit, onCommitEdit, onCancelEdit, onPromoteToProfile }) {
  const colors = SPEAKER_COLORS[speaker.color];
  const initial = speaker.name.charAt(0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3">
      <div className="flex items-start gap-2.5">
        <div className={`w-9 h-9 rounded-full ${colors.solid} text-white text-sm font-extrabold flex items-center justify-center flex-shrink-0 ring-2 ${colors.ring}`}>
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {isEditing ? (
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onCommitEdit();
                    if (e.key === 'Escape') onCancelEdit();
                  }}
                  className={`flex-1 min-w-0 text-[13px] font-bold ${colors.text} bg-slate-50 rounded-md px-2 py-0.5 focus:outline-none focus:ring-2 ${colors.ring}`}
                />
                <button onClick={onCommitEdit} className="text-emerald-600 p-1" aria-label="שמור">
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <button onClick={onCancelEdit} className="text-slate-400 p-1" aria-label="בטל">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onStartEdit}
                className={`flex items-center gap-1 text-[13px] font-extrabold ${colors.text} hover:underline decoration-dotted`}
              >
                {speaker.name}
                <Edit3 className="w-3 h-3 opacity-50" />
              </button>
            )}
            <span className="text-[10px] text-slate-400 font-medium tabular-nums">{utterance.time}</span>
            {speaker.trained ? (
              <span className={`text-[9px] font-bold ${colors.text} ${colors.bg} px-1.5 py-0.5 rounded-full flex items-center gap-0.5`}>
                <Volume2 className="w-2.5 h-2.5" />
                מזוהה
              </span>
            ) : (
              <button
                onClick={onPromoteToProfile}
                className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 hover:bg-amber-200 transition-colors"
              >
                <UserPlus className="w-2.5 h-2.5" />
                צור פרופיל קול
              </button>
            )}
          </div>
          <p className="text-[13px] text-slate-700 leading-relaxed">{utterance.text}</p>
        </div>
      </div>
    </div>
  );
}

function VoiceProfileSection({ speakers, setSpeakers, showToast }) {
  const [trainingSpeaker, setTrainingSpeaker] = useState(null);

  const startTraining = (speaker) => setTrainingSpeaker(speaker);

  const completeTraining = () => {
    if (!trainingSpeaker) return;
    setSpeakers(prev => prev.map(s =>
      s.id === trainingSpeaker.id
        ? { ...s, trained: true, color: s.color === 'slate' ? 'sky' : s.color }
        : s
    ));
    setTrainingSpeaker(null);
    showToast('פרופיל קול נשמר • הזיהוי פעיל לפגישות עתידיות');
  };

  const deleteSpeaker = (id) => {
    setSpeakers(prev => prev.filter(s => s.id !== id));
    showToast('הפרופיל הוסר');
  };

  const addProfile = () => {
    const usedColors = new Set(speakers.map(s => s.color));
    const nextColor = COLOR_KEYS.find(c => !usedColors.has(c)) || 'sky';
    const newId = `s${Date.now()}`;
    setSpeakers(prev => [...prev, { id: newId, name: 'משתתף חדש', color: nextColor, trained: false }]);
    showToast('פרופיל חדש נוסף — לחץ "אמן" להפעלה');
  };

  const updateName = (id, name) => {
    setSpeakers(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {speakers.map((s, idx) => (
          <React.Fragment key={s.id}>
            {idx > 0 && <div className="h-px bg-slate-100 mr-[68px]" />}
            <VoiceProfileRow
              speaker={s}
              onTrain={() => startTraining(s)}
              onDelete={() => deleteSpeaker(s.id)}
              onRename={(name) => updateName(s.id, name)}
            />
          </React.Fragment>
        ))}
      </div>

      <button
        onClick={addProfile}
        className="w-full mt-2 py-2.5 rounded-2xl border-2 border-dashed border-slate-300 text-[#0F2042] text-xs font-bold flex items-center justify-center gap-1.5 hover:border-[#0F2042]/50 hover:bg-blue-50/40 transition-colors"
      >
        <UserPlus className="w-4 h-4" />
        הוסף פרופיל קול חדש
      </button>

      {trainingSpeaker && (
        <TrainingOverlay
          speaker={trainingSpeaker}
          onComplete={completeTraining}
          onCancel={() => setTrainingSpeaker(null)}
        />
      )}
    </>
  );
}

function VoiceProfileRow({ speaker, onTrain, onDelete, onRename }) {
  const colors = SPEAKER_COLORS[speaker.color];
  return (
    <div className="w-full p-3 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-2xl ${colors.solid} text-white text-sm font-extrabold flex items-center justify-center flex-shrink-0`}>
        {speaker.name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <input
          value={speaker.name}
          onChange={(e) => onRename(e.target.value)}
          className="w-full text-[14px] font-bold text-[#0F2042] bg-transparent focus:outline-none focus:bg-slate-50 rounded px-1 -mx-1"
        />
        <div className="flex items-center gap-1.5 mt-0.5">
          {speaker.trained ? (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              מאומן
            </span>
          ) : (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
              ממתין לאימון
            </span>
          )}
          <span className="text-[10px] text-slate-500">
            {speaker.trained ? '30/30 שניות' : '0/30 שניות'}
          </span>
        </div>
      </div>
      <button
        onClick={onTrain}
        className={`flex-shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors ${
          speaker.trained
            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            : 'bg-[#0F2042] text-white hover:bg-[#152a5a]'
        }`}
      >
        {speaker.trained ? 'אמן מחדש' : 'אמן'}
      </button>
      <button
        onClick={onDelete}
        aria-label="מחק פרופיל"
        className="text-slate-300 hover:text-rose-500 transition-colors p-1 flex-shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function TrainingOverlay({ speaker, onComplete, onCancel }) {
  const [progress, setProgress] = useState(0);
  const colors = SPEAKER_COLORS[speaker.color];

  useEffect(() => {
    const start = Date.now();
    const duration = 3000;
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(id);
        setTimeout(onComplete, 250);
      }
    }, 60);
    return () => clearInterval(id);
  }, [onComplete]);

  return (
    <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center px-6 animate-slide-up">
      <div className="bg-white rounded-3xl p-6 w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-rose-600" />
            <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wide">מאמן פרופיל קול</span>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-700" aria-label="בטל">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col items-center text-center mb-4">
          <div className="relative mb-3">
            <span className="absolute inset-0 rounded-full bg-rose-500/30 animate-ping" />
            <div className={`relative w-20 h-20 rounded-full ${colors.solid} flex items-center justify-center text-white text-3xl font-extrabold shadow-xl`}>
              {speaker.name.charAt(0)}
            </div>
          </div>
          <h3 className="text-lg font-extrabold text-[#0F2042] mb-1">{speaker.name}</h3>
          <p className="text-xs text-slate-500">דבר/י לכ-30 שניות בקול טבעי</p>
        </div>

        <div className="mb-4">
          <div className="flex items-end gap-[3px] h-10 justify-center mb-3">
            {Array.from({ length: 16 }).map((_, i) => (
              <span
                key={i}
                className="w-[3px] rounded-full bg-rose-500 animate-pulse"
                style={{
                  height: `${10 + Math.abs(Math.sin((i + progress / 4) * 0.7)) * 28}px`,
                  animationDelay: `${i * 0.05}s`,
                  animationDuration: '0.7s'
                }}
              />
            ))}
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] font-bold text-slate-500 tabular-nums">
            <span>{Math.round((progress / 100) * 30)} שניות</span>
            <span>30 שניות</span>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200"
        >
          בטל אימון
        </button>
      </div>
    </div>
  );
}

/* ============================================================ */
/*                      BOTTOM NAVIGATION                       */
/* ============================================================ */

function BottomNav({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'dashboard', label: 'מרכז הפגישות', icon: Home },
    { id: 'analysis',  label: 'ניתוח פגישה',  icon: FileText },
    { id: 'settings',  label: 'הגדרות',       icon: SettingsIcon }
  ];

  return (
    <div className="absolute bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 pb-7 pt-2 px-4" style={{ touchAction: 'manipulation' }}>
      <div className="flex items-stretch justify-around gap-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex flex-col items-center gap-1 py-1.5 group cursor-pointer select-none"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              <div className={`w-12 h-7 flex items-center justify-center rounded-full transition-all pointer-events-none ${
                active ? 'bg-[#0F2042] text-white' : 'text-slate-400'
              }`}>
                <Icon className="w-[18px] h-[18px]" />
              </div>
              <span className={`text-[10px] font-bold transition-colors pointer-events-none ${active ? 'text-[#0F2042]' : 'text-slate-400'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Mic, MicOff, Upload, Bell, Sparkles, FileText, Home,
  Settings as SettingsIcon, CheckCircle2, Calendar as CalendarIcon,
  CalendarDays, Mail, Shield, Lock, Zap,
  ListChecks, Plus, Trash2, Save, ChevronRight, User,
  CheckSquare, Square,
  MessageSquare, UserPlus, X, Cpu, Loader2, AlertTriangle,
  Brain, ArrowRight, RefreshCw, Send, CalendarPlus, ExternalLink
} from 'lucide-react';

import { useRecorder } from './lib/recording';
import { processRecording } from './lib/pipeline';
import {
  listMeetings, saveMeeting, deleteMeeting, getSetting, setSetting
} from './lib/storage';
import { formatTimestamp, checkTranscribeBackend } from './lib/transcribe';
import { checkSummarizeBackend } from './lib/summarize';
import {
  mailtoUrl, gmailComposeUrl, buildEmailDraft,
  calendarLinkForMeeting, calendarLinkForTask
} from './lib/share';

/* ============================================================
   SummAI — AI Meeting Assistant (Hebrew RTL)
   - Local recording (MediaRecorder, browser)
   - Server transcription (Groq Whisper-large-v3-turbo via /api)
   - Server summarization (Groq Llama 3.3 via /api)
   - Meetings + audio stored in IndexedDB on device
   ============================================================ */

const ASSIGNEES = ['דנה כהן', 'יוסי לוי', 'נועה שמש', 'רינה אבני', 'אורי ברק'];

const SPEAKER_COLORS = {
  indigo:  { bg: 'bg-indigo-100',  text: 'text-indigo-800',  ring: 'ring-indigo-300',  solid: 'bg-indigo-500',  dot: 'bg-indigo-500'  },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-800', ring: 'ring-emerald-300', solid: 'bg-emerald-500', dot: 'bg-emerald-500' },
  amber:   { bg: 'bg-amber-100',   text: 'text-amber-900',   ring: 'ring-amber-300',   solid: 'bg-amber-500',   dot: 'bg-amber-500'   },
  rose:    { bg: 'bg-rose-100',    text: 'text-rose-800',    ring: 'ring-rose-300',    solid: 'bg-rose-500',    dot: 'bg-rose-500'    },
  sky:     { bg: 'bg-sky-100',     text: 'text-sky-800',     ring: 'ring-sky-300',     solid: 'bg-sky-500',     dot: 'bg-sky-500'     },
  slate:   { bg: 'bg-slate-200',   text: 'text-slate-700',   ring: 'ring-slate-300',   solid: 'bg-slate-500',   dot: 'bg-slate-500'   }
};

const COLOR_KEYS = ['indigo', 'emerald', 'amber', 'rose', 'sky'];

const DEFAULT_SPEAKERS = [
  { id: 's_default', name: 'דובר', color: 'slate', trained: false }
];

const STAGE_LABELS = {
  'saving-audio':       { label: 'שומר אודיו', detail: 'מאחסן את ההקלטה במכשיר' },
  'transcribing':       { label: 'מתמלל בעברית', detail: 'Groq Whisper-large דרך השרת' },
  'summarizing':        { label: 'מסכם עם Llama 3.3', detail: 'מחלץ סיכום, משימות ופגישות מוצעות' },
  'done':               { label: 'מוכן!', detail: '' },
  'error':              { label: 'שגיאה',  detail: '' }
};

const PIPELINE_STAGES = ['saving-audio', 'transcribing', 'summarizing', 'done'];

async function runBackendChecks() {
  const [transcribe, summarize] = await Promise.all([
    checkTranscribeBackend(),
    checkSummarizeBackend()
  ]);
  const ok = transcribe.ok && summarize.ok;
  return {
    ok,
    error: transcribe.ok ? summarize.error : transcribe.error,
    transcribe,
    summarize
  };
}

function formatHebrewDate(iso) {
  try {
    return new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
      .format(new Date(iso));
  } catch { return iso; }
}

function formatDurationLabel(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')} שעות`;
  if (m > 0) return `${m} דקות`;
  return `${s} שניות`;
}

function formatTimer(s) {
  const total = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/* ============================================================ */
/*                          APP SHELL                           */
/*  Full-screen on mobile / APK; centered column on desktop.    */
/* ============================================================ */

function AppShell({ children }) {
  return (
    <div className="h-[100dvh] w-full bg-slate-200 flex justify-center overflow-hidden">
      <div
        className="relative w-full sm:max-w-md h-full bg-slate-50 sm:shadow-[0_0_40px_rgba(15,32,66,0.18)] overflow-hidden"
        dir="rtl"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {children}
      </div>
    </div>
  );
}

/* ============================================================ */
/*                            APP                               */
/* ============================================================ */

export default function App() {
  const [activeTab, setActiveTab]           = useState('dashboard');
  const [meetings, setMeetings]             = useState([]);
  const [selectedMeetingId, setSelectedId]  = useState(null);
  const [backendStatus, setBackendStatus]   = useState(null);
  const [speakers, setSpeakers]             = useState(DEFAULT_SPEAKERS);
  const [processing, setProcessing]         = useState(null);
  const [toast, setToast]                   = useState(null);
  const [loaded, setLoaded]                 = useState(false);

  const showToast = useCallback((message, kind = 'success') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [list, savedSpeakers] = await Promise.all([
          listMeetings(),
          getSetting('speakers')
        ]);
        setMeetings(list || []);
        if (Array.isArray(savedSpeakers) && savedSpeakers.length) setSpeakers(savedSpeakers);
      } catch (e) {
        console.error('Load failed', e);
      } finally {
        setLoaded(true);
      }
    })();
    runBackendChecks().then(setBackendStatus);
  }, []);

  const refreshBackend = useCallback(async () => {
    setBackendStatus(null);
    const result = await runBackendChecks();
    setBackendStatus(result);
    return result;
  }, []);

  useEffect(() => { if (loaded) setSetting('speakers', speakers); }, [speakers, loaded]);

  const selectedMeeting = useMemo(
    () => meetings.find(m => m.id === selectedMeetingId) || null,
    [meetings, selectedMeetingId]
  );

  const updateMeeting = useCallback((id, patch) => {
    setMeetings(prev => {
      const target = prev.find(x => x.id === id);
      if (!target) return prev;
      const next = typeof patch === 'function' ? patch(target) : { ...target, ...patch };
      saveMeeting(next);
      return prev.map(x => x.id === id ? next : x);
    });
  }, []);

  const removeMeeting = useCallback(async (id) => {
    await deleteMeeting(id);
    setMeetings(prev => prev.filter(m => m.id !== id));
    if (selectedMeetingId === id) {
      setSelectedId(null);
      setActiveTab('dashboard');
    }
    showToast('הפגישה נמחקה');
  }, [selectedMeetingId, showToast]);

  const runPipeline = useCallback(async (blob, durationSec) => {
    setProcessing({ stage: 'saving-audio', progress: 0 });
    try {
      const meeting = await processRecording({
        blob,
        durationSec,
        onStage: ({ stage, progress, error, warning }) => {
          setProcessing(prev => ({
            stage,
            progress: progress ?? prev?.progress ?? 0,
            error,
            warning
          }));
        }
      });
      const list = await listMeetings();
      setMeetings(list);
      setSelectedId(meeting.id);
      setActiveTab('analysis');
      setProcessing(null);
      showToast(
        meeting.status === 'done'
          ? 'הפגישה מוכנה!'
          : 'תמלול נשמר — סיכום AI נכשל. ערוך ידנית.',
        meeting.status === 'done' ? 'success' : 'warning'
      );
    } catch (e) {
      const list = await listMeetings();
      setMeetings(list);
      setProcessing({ stage: 'error', error: e.message });
      showToast(e.message || 'שגיאה בעיבוד', 'error');
      setTimeout(() => setProcessing(null), 4500);
    }
  }, [showToast]);

  const openMeeting = useCallback((m) => {
    setSelectedId(m.id);
    setActiveTab('analysis');
  }, []);

  return (
    <AppShell>
      <div className="relative h-full flex flex-col bg-slate-50">
        <div className="flex-1 overflow-y-auto phone-scroll pb-24">
          {activeTab === 'dashboard' && (
            <DashboardScreen
              meetings={meetings}
              backendStatus={backendStatus}
              processing={processing}
              runPipeline={runPipeline}
              openMeeting={openMeeting}
              goToSettings={() => setActiveTab('settings')}
              showToast={showToast}
            />
          )}
          {activeTab === 'analysis' && selectedMeeting && (
            <AnalysisScreen
              meeting={selectedMeeting}
              updateMeeting={(patch) => updateMeeting(selectedMeeting.id, patch)}
              removeMeeting={() => removeMeeting(selectedMeeting.id)}
              goToDashboard={() => setActiveTab('dashboard')}
              showToast={showToast}
            />
          )}
          {activeTab === 'analysis' && !selectedMeeting && (
            <EmptyAnalysis goToDashboard={() => setActiveTab('dashboard')} />
          )}
          {activeTab === 'settings' && (
            <SettingsScreen
              speakers={speakers}
              setSpeakers={setSpeakers}
              backendStatus={backendStatus}
              refreshBackend={refreshBackend}
              meetings={meetings}
              showToast={showToast}
            />
          )}
        </div>

        {toast && (
          <div className="absolute bottom-24 inset-x-4 z-50 animate-slide-up pointer-events-none">
            <div className={`pointer-events-none px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 ${
              toast.kind === 'success' ? 'bg-emerald-600 text-white'
              : toast.kind === 'warning' ? 'bg-amber-600 text-white'
              : toast.kind === 'error' ? 'bg-rose-600 text-white'
              : 'bg-slate-800 text-white'
            }`}>
              {toast.kind === 'error' ? <AlertTriangle className="w-5 h-5 flex-shrink-0" />
               : <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
              <p className="text-sm font-medium leading-tight">{toast.message}</p>
            </div>
          </div>
        )}

        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </AppShell>
  );
}

/* ============================================================ */
/*                  SCREEN 1 — DASHBOARD                        */
/* ============================================================ */

function DashboardScreen({ meetings, backendStatus, processing, runPipeline, openMeeting, goToSettings, showToast }) {
  const recorder = useRecorder();
  const { state: recState, duration, level, error: recError, start, stop } = recorder;
  const isRecording = recState === 'recording';
  const isStopping = recState === 'stopping';
  const isProcessing = !!processing;
  const backendOk = backendStatus?.ok;
  const backendDown = backendStatus && !backendStatus.ok;

  const handleToggle = useCallback(async () => {
    if (isRecording) {
      const result = await stop();
      if (result?.blob) {
        runPipeline(result.blob, result.durationSec);
      }
    } else {
      try {
        await start();
      } catch (e) {
        showToast(e.message || 'לא ניתן להתחיל הקלטה', 'error');
      }
    }
  }, [isRecording, stop, start, runPipeline, showToast]);

  useEffect(() => {
    if (recError) showToast(recError, 'error');
  }, [recError, showToast]);

  const openTasks = useMemo(
    () => meetings.reduce((a, m) => a + (m.tasks || []).filter(t => !t.done).length, 0),
    [meetings]
  );

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

      {backendDown && !isProcessing && (
        <button
          onClick={goToSettings}
          className="w-full mb-3 bg-amber-50 border-2 border-amber-200 rounded-2xl p-3 flex items-start gap-2.5 text-right hover:bg-amber-100 transition-colors"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-bold text-amber-900">שרת ה-AI לא זמין</p>
            <p className="text-[11px] text-amber-800 mt-0.5">{backendStatus?.error || 'בדוק הגדרות פריסה'}. אפשר עדיין להקליט — התמלול ייעשה, רק בלי סיכום אוטומטי.</p>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-700 rotate-180 flex-shrink-0 mt-1" />
        </button>
      )}

      {isProcessing ? (
        <ProcessingCard processing={processing} />
      ) : (
        <RecordingCard
          isRecording={isRecording}
          isStopping={isStopping}
          duration={duration}
          level={level}
          onToggle={handleToggle}
        />
      )}

      <button
        disabled={isProcessing || isRecording}
        onClick={() => showToast('העלאת קובץ תהיה זמינה בקרוב')}
        className="w-full flex items-center justify-center gap-2 py-3 mb-5 rounded-2xl border-2 border-dashed border-slate-300 bg-white text-[#0F2042] font-semibold text-sm hover:bg-slate-50 hover:border-[#0F2042]/40 transition-colors disabled:opacity-40"
      >
        <Upload className="w-4 h-4" />
        <span>העלה קובץ שמע</span>
      </button>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <Stat label="פגישות שמורות" value={String(meetings.length)} tone="default" />
        <Stat label="משימות פתוחות" value={String(openTasks)} tone="default" />
        <Stat
          label="שרת AI"
          value={backendStatus === null ? '...' : backendOk ? 'פעיל' : 'לא זמין'}
          tone={backendOk ? 'emerald' : backendDown ? 'amber' : 'default'}
        />
      </div>

      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-sm font-extrabold text-[#0F2042]">פגישות שמורות</h2>
        {meetings.length > 0 && (
          <span className="text-[11px] font-semibold text-slate-500">{meetings.length} סה"כ</span>
        )}
      </div>

      {meetings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 mx-auto mb-2.5 flex items-center justify-center">
            <Mic className="w-6 h-6 text-[#0F2042]" />
          </div>
          <p className="text-[13px] font-bold text-[#0F2042] mb-1">עוד אין פגישות</p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            הקש על "התחל הקלטה" למעלה כדי להקליט את הפגישה הראשונה שלך.
            <br />הכל נשמר במכשיר שלך — אף אחד אחר לא רואה.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {meetings.map(m => (
            <MeetingRow key={m.id} meeting={m} onOpen={() => openMeeting(m)} />
          ))}
        </div>
      )}
    </div>
  );
}

function RecordingCard({ isRecording, isStopping, duration, level, onToggle }) {
  const bars = useMemo(() => {
    const heights = [];
    for (let i = 0; i < 11; i++) {
      const base = 6;
      const factor = isRecording ? (0.5 + Math.abs(Math.sin(i * 1.3 + duration * 4)) * 0.5) : 0.3;
      heights.push(base + factor * level * 30 + (isRecording ? 4 : 0));
    }
    return heights;
  }, [isRecording, duration, level]);

  return (
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
            {isRecording ? 'מקליט עכשיו' : 'מוכן להקלטה'}
          </p>
          <p className={`text-2xl font-extrabold tracking-tight tabular-nums ${isRecording ? 'text-rose-900' : 'text-white'}`}>
            {isRecording ? formatTimer(duration) : 'פגישה חדשה'}
          </p>
          <p className={`text-[11px] mt-0.5 ${isRecording ? 'text-rose-700/80' : 'text-blue-200/90'}`}>
            {isRecording ? 'אודיו נשאר במכשיר שלך בלבד' : 'הקלטה מקומית • תמלול AI'}
          </p>
        </div>

        {isRecording ? (
          <div className="flex items-end gap-[3px] h-12 px-2">
            {bars.map((h, i) => (
              <span
                key={i}
                className="w-[3px] rounded-full bg-rose-500 transition-all duration-100"
                style={{ height: `${h}px` }}
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
        onClick={onToggle}
        disabled={isStopping}
        className={`relative w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold transition-all disabled:opacity-60 ${
          isRecording
            ? 'bg-rose-600 text-white animate-ring-pulse'
            : 'bg-white text-[#0F2042] hover:bg-blue-50'
        }`}
      >
        {isStopping ? <Loader2 className="w-5 h-5 animate-spin" />
         : isRecording ? <MicOff className="w-5 h-5" />
         : <Mic className="w-5 h-5" />}
        <span className="text-[15px]">
          {isStopping ? 'מסיים...' : isRecording ? 'עצור הקלטה' : 'התחל הקלטת פגישה'}
        </span>
      </button>
    </div>
  );
}

function ProcessingCard({ processing }) {
  const { stage, error, warning } = processing;
  const info = STAGE_LABELS[stage] || { label: stage, detail: '' };
  const isError = stage === 'error';

  const idx = PIPELINE_STAGES.indexOf(stage);
  const totalProgress = isError ? 0
    : stage === 'done' ? 100
    : Math.round(((Math.max(0, idx) + 0.4) / PIPELINE_STAGES.length) * 100);

  return (
    <div className={`relative rounded-3xl p-5 mb-3 overflow-hidden border-2 ${
      isError ? 'bg-rose-50 border-rose-200' : 'bg-gradient-to-br from-indigo-50 via-white to-blue-50 border-blue-200'
    }`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
          isError ? 'bg-rose-600' : 'bg-[#0F2042]'
        }`}>
          {isError ? <AlertTriangle className="w-5 h-5 text-white" />
           : <Loader2 className="w-5 h-5 text-white animate-spin" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-bold uppercase tracking-wide ${isError ? 'text-rose-700' : 'text-blue-700'}`}>
            {isError ? 'נכשל' : 'מעבד פגישה'}
          </p>
          <p className={`text-lg font-extrabold leading-tight ${isError ? 'text-rose-900' : 'text-[#0F2042]'}`}>
            {info.label}
          </p>
          {(info.detail || error) && (
            <p className={`text-[11px] mt-0.5 leading-snug ${isError ? 'text-rose-700' : 'text-slate-500'}`} style={{ wordBreak: 'break-word' }}>
              {error || info.detail}
            </p>
          )}
        </div>
      </div>

      {!isError && (
        <>
          <div className="h-2 bg-white/70 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-l from-emerald-500 to-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${totalProgress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold">
            <span className="text-slate-500">שלב {Math.max(1, idx + 1)} מתוך {PIPELINE_STAGES.length - 1}</span>
            <span className="text-[#0F2042]">{totalProgress}%</span>
          </div>
          {warning && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-[11px] text-amber-900">
              <AlertTriangle className="w-3 h-3 inline-block ml-1" />
              {warning}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MeetingRow({ meeting, onOpen }) {
  const status = meeting.status || 'done';
  return (
    <button
      onClick={onOpen}
      className="w-full bg-white rounded-2xl p-3.5 border border-slate-200 flex items-center gap-3 text-right hover:border-[#0F2042]/40 hover:shadow-sm active:scale-[0.99] transition-all"
    >
      <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
        <FileText className="w-5 h-5 text-[#0F2042]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-bold text-[#0F2042] truncate">{meeting.title || 'פגישה ללא כותרת'}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[11px] text-slate-500">{meeting.dateLabel || formatHebrewDate(meeting.createdAt)}</span>
          <span className="text-slate-300">•</span>
          <span className="text-[11px] text-slate-500">{meeting.durationLabel || formatDurationLabel(meeting.durationSec)}</span>
          {(meeting.tasks || []).length > 0 && (
            <>
              <span className="text-slate-300">•</span>
              <span className="text-[11px] text-slate-500">{meeting.tasks.length} משימות</span>
            </>
          )}
        </div>
      </div>
      <MeetingStatusBadge status={status} />
    </button>
  );
}

function MeetingStatusBadge({ status }) {
  if (status === 'processing') {
    return (
      <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 flex items-center gap-1">
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
        מעבד
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 flex items-center gap-1">
        <AlertTriangle className="w-2.5 h-2.5" />
        נכשל
      </span>
    );
  }
  if (status === 'partial') {
    return (
      <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 flex items-center gap-1">
        <AlertTriangle className="w-2.5 h-2.5" />
        חלקי
      </span>
    );
  }
  return (
    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 flex items-center gap-1">
      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
      מעובד
    </span>
  );
}

function Stat({ label, value, tone }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-600'
                  : tone === 'amber' ? 'text-amber-600'
                  : 'text-[#0F2042]';
  return (
    <div className="bg-white rounded-2xl px-3 py-2.5 border border-slate-200">
      <p className="text-[10px] text-slate-500 mb-0.5">{label}</p>
      <p className={`text-lg font-extrabold ${toneClass}`}>{value}</p>
    </div>
  );
}

/* ============================================================ */
/*                EMPTY ANALYSIS PLACEHOLDER                    */
/* ============================================================ */

function EmptyAnalysis({ goToDashboard }) {
  return (
    <div className="px-5 pt-1 h-full flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 rounded-3xl bg-blue-50 flex items-center justify-center mb-3">
        <FileText className="w-8 h-8 text-[#0F2042]" />
      </div>
      <h2 className="text-[15px] font-extrabold text-[#0F2042] mb-1">אין פגישה פתוחה</h2>
      <p className="text-[12px] text-slate-500 mb-4 max-w-xs">בחר פגישה מהרשימה במרכז הפגישות, או הקלט פגישה חדשה.</p>
      <button
        onClick={goToDashboard}
        className="bg-[#0F2042] text-white py-2.5 px-4 rounded-xl text-sm font-bold flex items-center gap-2"
      >
        <ArrowRight className="w-4 h-4 rotate-180" />
        חזרה למרכז
      </button>
    </div>
  );
}

/* ============================================================ */
/*               SCREEN 2 — MEETING ANALYSIS                    */
/* ============================================================ */

function AnalysisScreen({ meeting, updateMeeting, removeMeeting, goToDashboard, showToast }) {
  const [localSummary, setLocalSummary] = useState(meeting.summary || '');
  const [localTitle, setLocalTitle] = useState(meeting.title || '');
  useEffect(() => {
    setLocalSummary(meeting.summary || '');
    setLocalTitle(meeting.title || '');
  }, [meeting.id, meeting.summary, meeting.title]);

  const tasks = meeting.tasks || [];
  const proposedMeeting = meeting.proposedMeeting || { title: '', date: '', time: '', attendees: '' };
  const transcriptChunks = meeting.transcriptChunks || [];

  const updateTask = (id, key, value) =>
    updateMeeting(prev => ({ ...prev, tasks: (prev.tasks || []).map(t => t.id === id ? { ...t, [key]: value } : t) }));
  const removeTask = (id) =>
    updateMeeting(prev => ({ ...prev, tasks: (prev.tasks || []).filter(t => t.id !== id) }));
  const addTask = () =>
    updateMeeting(prev => {
      const list = prev.tasks || [];
      const newId = (list.reduce((m, t) => Math.max(m, t.id || 0), 0) || 0) + 1;
      return { ...prev, tasks: [...list, { id: newId, text: '', assignee: '', deadline: '', done: false }] };
    });
  const updateProposed = (key, value) =>
    updateMeeting(prev => ({ ...prev, proposedMeeting: { ...(prev.proposedMeeting || {}), [key]: value } }));

  const openCount = useMemo(() => tasks.filter(t => !t.done).length, [tasks]);
  const isDirty = localSummary !== (meeting.summary || '') || localTitle !== (meeting.title || '');

  const confirmDelete = () => {
    if (confirm(`למחוק את הפגישה "${meeting.title}"? לא ניתן לשחזר.`)) {
      removeMeeting();
    }
  };

  return (
    <div className="px-5 pt-1">
      <header className="flex items-start justify-between py-3 mb-2 gap-3">
        <button
          onClick={goToDashboard}
          className="flex-shrink-0 mt-1 w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50"
          aria-label="חזרה"
        >
          <ArrowRight className="w-4 h-4 text-[#0F2042]" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-slate-500 mb-0.5">ניתוח AI</p>
          <input
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            className="w-full text-[16px] font-extrabold text-[#0F2042] leading-snug bg-transparent focus:outline-none focus:bg-white focus:px-2 focus:-mx-2 focus:rounded-lg"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            {meeting.dateLabel} • {meeting.durationLabel}
          </p>
        </div>
        <button
          onClick={confirmDelete}
          aria-label="מחק"
          className="flex-shrink-0 mt-1 w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 flex items-center justify-center"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </header>

      {meeting.status === 'partial' && (
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-amber-900">סיכום AI לא הופק</p>
            <p className="text-[10.5px] text-amber-800 mt-0.5 leading-snug">
              התמלול נשמר אך שרת ה-AI לא הצליח לסכם. בדוק סטטוס בהגדרות וערוך סיכום ידנית למטה.
            </p>
          </div>
        </div>
      )}

      <Section icon={<Sparkles className="w-4 h-4 text-[#0F2042]" />} title="סיכום מנהלים" aside="ניתן לעריכה">
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
              onClick={() => {
                updateMeeting({ summary: localSummary, title: localTitle });
                showToast('הסיכום נשמר בהצלחה');
              }}
              disabled={!isDirty}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                isDirty ? 'bg-[#0F2042] text-white hover:bg-[#152a5a]' : 'bg-slate-100 text-slate-400'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              שמור
            </button>
          </div>
        </div>
      </Section>

      <EmailSection meeting={meeting} showToast={showToast} />

      <TranscriptSection chunks={transcriptChunks} transcriptText={meeting.transcriptText || ''} />

      <Section icon={<ListChecks className="w-4 h-4 text-[#0F2042]" />} title="משימות לביצוע" aside={`${openCount} פתוחות`}>
        <div className="space-y-2">
          {tasks.length === 0 && (
            <p className="text-center text-[11px] text-slate-400 py-3">לא זוהו משימות. הוסף ידנית למטה.</p>
          )}
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
                    value={t.assignee || ''}
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
                    value={t.deadline || ''}
                    onChange={(e) => updateTask(t.id, 'deadline', e.target.value)}
                    className="bg-transparent text-[11px] font-semibold text-[#0F2042] focus:outline-none flex-1 min-w-0"
                  />
                </div>
              </div>
              {t.deadline && t.text && (
                <a
                  href={calendarLinkForTask(t, meeting.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 mr-7 inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  הוסף ליומן Google
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              )}
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

      {(proposedMeeting.title || proposedMeeting.date) && (
        <Section icon={<CalendarDays className="w-4 h-4 text-[#0F2042]" />} title='פגישה מוצעת ללו"ז'>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-l from-blue-50 via-white to-emerald-50 px-3 py-2 flex items-center gap-2 border-b border-slate-100">
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[11px] font-bold text-emerald-700">זוהה אוטומטית ע"י ה-AI</span>
            </div>
            <div className="p-3 space-y-2.5">
              <Field label="כותרת">
                <input
                  type="text"
                  value={proposedMeeting.title || ''}
                  onChange={(e) => updateProposed('title', e.target.value)}
                  className="w-full text-sm font-semibold text-[#0F2042] bg-slate-50 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#0F2042]/30"
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="תאריך">
                  <input
                    type="date"
                    value={proposedMeeting.date || ''}
                    onChange={(e) => updateProposed('date', e.target.value)}
                    className="w-full text-xs font-semibold text-[#0F2042] bg-slate-50 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-[#0F2042]/30"
                  />
                </Field>
                <Field label="שעה">
                  <input
                    type="time"
                    value={proposedMeeting.time || ''}
                    onChange={(e) => updateProposed('time', e.target.value)}
                    className="w-full text-xs font-semibold text-[#0F2042] bg-slate-50 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-[#0F2042]/30"
                  />
                </Field>
              </div>
              <Field label="משתתפים">
                <input
                  type="text"
                  value={proposedMeeting.attendees || ''}
                  onChange={(e) => updateProposed('attendees', e.target.value)}
                  placeholder="שמות מופרדים בפסיק"
                  className="w-full text-xs font-semibold text-[#0F2042] bg-slate-50 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#0F2042]/30"
                />
              </Field>

              <a
                href={calendarLinkForMeeting({
                  title: proposedMeeting.title,
                  date: proposedMeeting.date,
                  time: proposedMeeting.time,
                  attendees: proposedMeeting.attendees,
                  details: `מתוך הפגישה: ${meeting.title || ''}\nנוצר ע"י SummAI`
                }) || undefined}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!proposedMeeting.date) {
                    e.preventDefault();
                    showToast('הוסף תאריך לפגישה כדי לפתוח ביומן', 'warning');
                  }
                }}
                className="w-full mt-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 transition-colors"
              >
                <CalendarIcon className="w-4 h-4" />
                פתח ביומן Google לאישור
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>
            </div>
          </div>
        </Section>
      )}
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

function EmailSection({ meeting, showToast }) {
  const [to, setTo] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const draft = useMemo(() => buildEmailDraft(meeting), [meeting]);

  const hasContent = (meeting.summary || '').trim() || (meeting.tasks || []).length > 0;
  if (!hasContent) return null;

  const openMail = () => {
    window.location.href = mailtoUrl(meeting, to.trim());
    showToast('נפתח דראפט במייל — בדקי ושלחי');
  };

  const openGmail = () => {
    window.open(gmailComposeUrl(meeting, to.trim()), '_blank', 'noopener');
    showToast('נפתח דראפט ב-Gmail — בדקי ושלחי');
  };

  return (
    <Section icon={<Mail className="w-4 h-4 text-[#0F2042]" />} title="שליחת סיכום במייל" aside="דראפט מוכן">
      <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2.5">
        <Field label="נמען (אופציונלי)">
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="name@example.com"
            dir="ltr"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="w-full text-xs font-semibold text-[#0F2042] bg-slate-50 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#0F2042]/30 placeholder:text-slate-400 placeholder:font-normal"
          />
        </Field>

        <button
          onClick={() => setShowPreview(v => !v)}
          className="w-full flex items-center justify-between text-[11px] font-bold text-slate-500 hover:text-[#0F2042] py-1"
        >
          <span>{showPreview ? 'הסתר תצוגה מקדימה' : 'הצג תצוגה מקדימה של המייל'}</span>
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showPreview ? '-rotate-90' : 'rotate-180'}`} />
        </button>

        {showPreview && (
          <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-500 mb-0.5">נושא</p>
            <p className="text-[12px] font-semibold text-[#0F2042] mb-2">{draft.subject}</p>
            <p className="text-[10px] font-bold text-slate-500 mb-0.5">תוכן</p>
            <pre className="text-[11px] text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{draft.body}</pre>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={openMail}
            className="bg-[#0F2042] hover:bg-[#152a5a] text-white py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            אפליקציית מייל
          </button>
          <button
            onClick={openGmail}
            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            Gmail
          </button>
        </div>
        <p className="text-[10px] text-slate-400 leading-snug">
          הדראפט נפתח מוכן עם הסיכום והמשימות. את רק בודקת ולוחצת "שלח".
        </p>
      </div>
    </Section>
  );
}

function TranscriptSection({ chunks, transcriptText }) {
  const [expanded, setExpanded] = useState(false);

  if (!chunks.length && !transcriptText) return null;

  const showCount = expanded ? chunks.length : Math.min(5, chunks.length);
  const visible = chunks.slice(0, showCount);

  return (
    <Section
      icon={<MessageSquare className="w-4 h-4 text-[#0F2042]" />}
      title="תמלול מלא"
      aside={chunks.length ? `${chunks.length} מקטעים` : 'טקסט רציף'}
    >
      {chunks.length > 0 ? (
        <>
          <div className="space-y-2">
            {visible.map(c => (
              <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold text-slate-400 tabular-nums">{formatTimestamp(c.start)}</span>
                  <span className="text-slate-300">—</span>
                  <span className="text-[10px] font-medium text-slate-400 tabular-nums">{formatTimestamp(c.end)}</span>
                </div>
                <p className="text-[13px] text-slate-700 leading-relaxed">{c.text}</p>
              </div>
            ))}
          </div>
          {chunks.length > 5 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full mt-2 py-2.5 rounded-2xl border border-slate-200 bg-white text-[#0F2042] text-xs font-bold hover:bg-slate-50"
            >
              {expanded ? 'הצג פחות' : `הצג עוד ${chunks.length - 5} מקטעים`}
            </button>
          )}
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-3">
          <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">{transcriptText}</p>
        </div>
      )}
    </Section>
  );
}

/* ============================================================ */
/*               SCREEN 3 — SETTINGS & PRIVACY                  */
/* ============================================================ */

function SettingsScreen({ speakers, setSpeakers, backendStatus, refreshBackend, meetings, showToast }) {
  return (
    <div className="px-5 pt-1">
      <header className="py-3 mb-2">
        <h1 className="text-xl font-extrabold text-[#0F2042]">הגדרות ופרטיות</h1>
        <p className="text-[11px] text-slate-500 mt-0.5">מצב חיבור לשרת ופרופילים</p>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#0F2042] to-blue-700 flex items-center justify-center text-white font-extrabold text-sm">
          הב
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-[#0F2042] truncate">הדר ברסלב</p>
          <p className="text-[11px] text-slate-500 truncate">מצב מקומי • {meetings.length} פגישות שמורות</p>
        </div>
      </div>

      <SettingsGroup title="מנוע AI">
        <AIEngineSection
          backendStatus={backendStatus}
          refreshBackend={refreshBackend}
          showToast={showToast}
        />
      </SettingsGroup>

      <SettingsGroup title="אינטגרציות">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <InfoRow
            icon={<Mail className="w-5 h-5 text-rose-500" />}
            bg="bg-rose-50"
            title="שליחת מייל"
            desc="פותח דראפט מוכן באפליקציית המייל או ב-Gmail — את שולחת"
          />
          <div className="h-px bg-slate-100 mr-[68px]" />
          <InfoRow
            icon={<CalendarDays className="w-5 h-5 text-blue-600" />}
            bg="bg-blue-50"
            title="Google Calendar"
            desc="כל משימה ופגישה נפתחות ביומן עם הפרטים — את מאשרת"
          />
        </div>
        <p className="text-[10px] text-slate-400 mt-2 px-1 leading-snug">
          הפעולות זמינות במסך ניתוח הפגישה. ללא חיבור חשבון — האפליקציה רק מכינה דראפט ואת מאשרת בלחיצה.
        </p>
      </SettingsGroup>

      <SettingsGroup title="פרופילי דובר (פיתוח עתידי)">
        <VoiceProfileSection
          speakers={speakers}
          setSpeakers={setSpeakers}
          showToast={showToast}
        />
      </SettingsGroup>

      <SettingsGroup title="פרטיות">
        <div className="relative rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-emerald-50 border-2 border-emerald-200 p-4 overflow-hidden">
          <div className="absolute -left-8 -top-8 w-32 h-32 bg-emerald-200/40 rounded-full blur-2xl" />
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-emerald-300/30 rounded-full blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-md shadow-emerald-600/40">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">מצב הפעלה</p>
                <p className="text-[14px] font-extrabold text-emerald-900">מקומי במכשיר</p>
              </div>
              <span className="mr-auto px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                ON-DEVICE
              </span>
            </div>
            <div className="space-y-2">
              <SecurityRow icon={<Mic className="w-4 h-4" />} title="אודיו נשמר במכשיר" desc="עותק נשלח לתמלול ונמחק" />
              <SecurityRow icon={<Cpu className="w-4 h-4" />} title="תמלול ב-Groq Whisper" desc="דרך השרת שלך ב-Vercel" />
              <SecurityRow icon={<Brain className="w-4 h-4" />} title="סיכום ב-Llama 3.3" desc="דרך השרת שלך ב-Vercel" />
              <SecurityRow icon={<Lock className="w-4 h-4" />} title="מפתח Groq רק בשרת" desc="לא בקוד הדפדפן" />
            </div>
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup title="פעולות">
        <div className="space-y-2">
          <button
            onClick={() => {
              if (confirm('למחוק את כל הפגישות וההגדרות? לא ניתן לשחזר.')) {
                indexedDB.deleteDatabase('summai');
                location.reload();
              }
            }}
            className="w-full bg-rose-50 border border-rose-100 rounded-2xl py-3 px-4 text-sm font-bold text-rose-600 hover:bg-rose-100 transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            מחק את כל הנתונים מהמכשיר
          </button>
        </div>
      </SettingsGroup>

      <p className="text-center text-[10px] text-slate-400 py-3">SummAI v0.2 • Local-first</p>
    </div>
  );
}

function AIEngineSection({ backendStatus, refreshBackend, showToast }) {
  const [refreshing, setRefreshing] = useState(false);

  const t = backendStatus?.transcribe;
  const s = backendStatus?.summarize;

  const handleRefresh = async () => {
    setRefreshing(true);
    const r = await refreshBackend();
    setRefreshing(false);
    showToast(r.ok ? '✓ השרת מגיב' : `✗ ${r.error}`, r.ok ? 'success' : 'error');
  };

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-slate-200 p-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Brain className="w-4 h-4 text-indigo-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-[#0F2042]">חיבור לשרת AI</p>
            <p className="text-[10.5px] text-slate-500">Groq דרך Vercel — תמלול + סיכום</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="בדוק שוב"
            className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
        </div>

        <BackendRow label="/api/transcribe" status={t} />
        <div className="h-px bg-slate-100 my-2" />
        <BackendRow label="/api/summarize" status={s} />

        {backendStatus && !backendStatus.ok && (
          <div className="mt-2.5 bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-[11px] text-rose-900 leading-snug">
            <p className="font-bold mb-1">השרת לא מגיב:</p>
            <p style={{ wordBreak: 'break-word' }}>{backendStatus.error}</p>
            <p className="mt-1.5 text-rose-700">
              Vercel → Project → Settings → Environment Variables → הוסף <code className="bg-rose-100 px-1 rounded">GROQ_API_KEY</code> ואז Redeploy.
            </p>
          </div>
        )}

        <p className="text-[10px] text-slate-400 mt-2.5 leading-snug">
          המפתח שמור בצד השרת (Vercel env var). הדפדפן רק שולח אודיו וטקסט ל-/api.
        </p>
      </div>
    </div>
  );
}

function BackendRow({ label, status }) {
  return (
    <div className="flex items-center gap-2">
      <code className="text-[11px] text-[#0F2042] font-mono flex-1" dir="ltr">{label}</code>
      {!status ? (
        <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
      ) : status.ok ? (
        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">פעיל</span>
      ) : (
        <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">לא זמין</span>
      )}
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

function InfoRow({ icon, bg, title, desc }) {
  return (
    <div className="w-full p-3 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-2xl ${bg} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-[#0F2042]">{title}</p>
        <p className="text-[11px] text-slate-500 leading-snug">{desc}</p>
      </div>
      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
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
/*                  VOICE PROFILE COMPONENTS                    */
/* ============================================================ */

function VoiceProfileSection({ speakers, setSpeakers, showToast }) {
  const deleteSpeaker = (id) => {
    setSpeakers(prev => prev.filter(s => s.id !== id));
    showToast('הפרופיל הוסר');
  };

  const addProfile = () => {
    const usedColors = new Set(speakers.map(s => s.color));
    const nextColor = COLOR_KEYS.find(c => !usedColors.has(c)) || 'sky';
    const newId = `s${Date.now()}`;
    setSpeakers(prev => [...prev, { id: newId, name: 'משתתף חדש', color: nextColor, trained: false }]);
    showToast('פרופיל נוסף — אימון אמיתי יגיע בעתיד');
  };

  const updateName = (id, name) => {
    setSpeakers(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  };

  return (
    <>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 mb-2 text-[10.5px] text-amber-800 leading-snug">
        זיהוי דובר אמיתי דורש מודל נוסף שעדיין לא נטמע. כרגע התמלול לא מפריד דוברים.
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {speakers.map((s, idx) => (
          <React.Fragment key={s.id}>
            {idx > 0 && <div className="h-px bg-slate-100 mr-[68px]" />}
            <VoiceProfileRow
              speaker={s}
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
        הוסף פרופיל
      </button>
    </>
  );
}

function VoiceProfileRow({ speaker, onDelete, onRename }) {
  const colors = SPEAKER_COLORS[speaker.color] || SPEAKER_COLORS.slate;
  return (
    <div className="w-full p-3 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-2xl ${colors.solid} text-white text-sm font-extrabold flex items-center justify-center flex-shrink-0`}>
        {speaker.name.charAt(0) || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <input
          value={speaker.name}
          onChange={(e) => onRename(e.target.value)}
          className="w-full text-[14px] font-bold text-[#0F2042] bg-transparent focus:outline-none focus:bg-slate-50 rounded px-1 -mx-1"
        />
        <span className="text-[10px] font-bold text-slate-500">פרופיל ויזואלי בלבד</span>
      </div>
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
    <div
      className="absolute bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 pt-2 px-4"
      style={{ touchAction: 'manipulation', paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
    >
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

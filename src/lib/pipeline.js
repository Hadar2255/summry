import { transcribeAudio } from './transcribe';
import { summarizeMeeting } from './summarize';
import { saveAudio, saveMeeting } from './storage';

function newId() {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function formatHebrewDate(iso) {
  try {
    return new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
      .format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDurationLabel(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')} שעות`;
  if (m > 0) return `${m} דקות`;
  return `${s} שניות`;
}

export async function processRecording({
  blob,
  durationSec,
  onStage,
  signal
}) {
  const id = newId();
  const createdAt = new Date().toISOString();
  const stage = (s, extra = {}) => onStage && onStage({ stage: s, ...extra });

  stage('saving-audio');
  await saveAudio(id, blob);

  let baseMeeting = {
    id,
    createdAt,
    durationSec,
    title: 'מעבד פגישה חדשה...',
    dateLabel: formatHebrewDate(createdAt),
    durationLabel: formatDurationLabel(durationSec),
    participants: 1,
    status: 'processing',
    summary: '',
    transcriptText: '',
    transcriptChunks: [],
    tasks: [],
    proposedMeeting: { title: '', date: '', time: '', attendees: '' },
    audioMime: blob.type
  };
  await saveMeeting(baseMeeting);

  try {
    stage('transcribing');
    const { text, chunks } = await transcribeAudio(blob, { signal });
    if (signal?.aborted) throw new Error('aborted');

    if (!text || !text.trim()) {
      throw new Error('התמלול חזר ריק. ייתכן שהאודיו שקט מדי או קצר מאוד.');
    }

    baseMeeting = { ...baseMeeting, transcriptText: text, transcriptChunks: chunks };
    await saveMeeting(baseMeeting);

    stage('summarizing');
    let aiResult;
    try {
      aiResult = await summarizeMeeting(text, { signal });
    } catch (e) {
      baseMeeting = {
        ...baseMeeting,
        title: text.split(/\s+/).slice(0, 8).join(' ') || 'פגישה ללא כותרת',
        summary: '(לא היה ניתן ליצור סיכום AI: ' + e.message + ')',
        status: 'partial'
      };
      await saveMeeting(baseMeeting);
      stage('done', { meeting: baseMeeting, warning: e.message });
      return baseMeeting;
    }

    const finalMeeting = {
      ...baseMeeting,
      title: aiResult.title || baseMeeting.title,
      summary: aiResult.summary,
      tasks: aiResult.tasks,
      proposedMeeting: aiResult.proposedMeeting,
      rawTranscriptText: text,
      transcriptText: aiResult.correctedTranscript || text,
      status: 'done'
    };
    await saveMeeting(finalMeeting);
    stage('done', { meeting: finalMeeting });
    return finalMeeting;
  } catch (e) {
    const failed = { ...baseMeeting, status: 'failed', error: e.message };
    await saveMeeting(failed);
    stage('error', { error: e.message });
    throw e;
  }
}

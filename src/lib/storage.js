import { openDB } from 'idb';

const DB_NAME = 'summai';
const DB_VERSION = 1;

let _dbPromise = null;
function db() {
  if (!_dbPromise) {
    _dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('meetings')) {
          const s = d.createObjectStore('meetings', { keyPath: 'id' });
          s.createIndex('createdAt', 'createdAt');
        }
        if (!d.objectStoreNames.contains('audio')) {
          d.createObjectStore('audio');
        }
        if (!d.objectStoreNames.contains('kv')) {
          d.createObjectStore('kv');
        }
      }
    });
  }
  return _dbPromise;
}

export async function listMeetings() {
  const d = await db();
  const all = await d.getAllFromIndex('meetings', 'createdAt');
  return all.reverse();
}

export async function getMeeting(id) {
  return (await db()).get('meetings', id);
}

export async function saveMeeting(meeting) {
  await (await db()).put('meetings', meeting);
  return meeting;
}

export async function deleteMeeting(id) {
  const d = await db();
  const tx = d.transaction(['meetings', 'audio'], 'readwrite');
  await tx.objectStore('meetings').delete(id);
  await tx.objectStore('audio').delete(id);
  await tx.done;
}

export async function saveAudio(id, blob) {
  await (await db()).put('audio', blob, id);
}

export async function getAudio(id) {
  return (await db()).get('audio', id);
}

export async function getSetting(key) {
  return (await db()).get('kv', key);
}

export async function setSetting(key, value) {
  await (await db()).put('kv', value, key);
}

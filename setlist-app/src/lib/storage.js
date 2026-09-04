// Cross-device sync needs somewhere both the host and every guest phone can
// read/write the same queue. Claude's own artifact preview provides a
// built-in `window.storage` for that — but that API only exists inside
// Claude's sandbox, not in a normal deployed webpage. So here we use the
// Firebase Realtime Database REST API instead, which needs no SDK and no
// server code: a plain fetch() against a URL is enough.
//
// If you haven't set up Firebase yet, everything still works on a single
// device via localStorage — see the README for the 2-minute Firebase setup
// that turns on real cross-device syncing.

const FIREBASE_URL = (import.meta.env.VITE_FIREBASE_DB_URL || '').replace(/\/$/, '');

export function isRemote() {
  return !!FIREBASE_URL;
}

async function remoteGet(path) {
  const res = await fetch(`${FIREBASE_URL}/${path}.json`);
  if (!res.ok) throw new Error('read failed');
  return res.json();
}

async function remoteSet(path, value) {
  await fetch(`${FIREBASE_URL}/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
}

export async function getQueue(room) {
  if (isRemote()) {
    try {
      const val = await remoteGet(`rooms/${room}/queue`);
      return val || [];
    } catch (e) {
      return [];
    }
  }
  try {
    return JSON.parse(localStorage.getItem(`setlist-queue-${room}`) || '[]');
  } catch (e) {
    return [];
  }
}

export async function setQueue(room, list) {
  if (isRemote()) {
    try {
      await remoteSet(`rooms/${room}/queue`, list);
    } catch (e) {
      /* best effort */
    }
    return;
  }
  localStorage.setItem(`setlist-queue-${room}`, JSON.stringify(list));
}

export async function getNow(room) {
  if (isRemote()) {
    try {
      return await remoteGet(`rooms/${room}/now`);
    } catch (e) {
      return null;
    }
  }
  try {
    return JSON.parse(localStorage.getItem(`setlist-now-${room}`) || 'null');
  } catch (e) {
    return null;
  }
}

export async function setNow(room, item) {
  if (isRemote()) {
    try {
      await remoteSet(`rooms/${room}/now`, item);
    } catch (e) {
      /* best effort */
    }
    return;
  }
  localStorage.setItem(`setlist-now-${room}`, JSON.stringify(item));
}

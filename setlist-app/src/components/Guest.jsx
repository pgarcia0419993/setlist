import { useEffect, useState } from 'react';
import { getQueue, setQueue as saveQueue, getNow, isRemote } from '../lib/storage.js';
import { extractVideoId, fetchMeta } from '../lib/youtube.js';

const COOLDOWN_MS = 45000;

export default function Guest({ room }) {
  const [name, setName] = useState(() => localStorage.getItem('setlist-guest-name') || '');
  const [input, setInput] = useState('');
  const [queue, setQueueState] = useState([]);
  const [now, setNowState] = useState(null);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const [q, n] = await Promise.all([getQueue(room), getNow(room)]);
      if (!cancelled) {
        setQueueState(q);
        setNowState(n);
      }
    }
    refresh();
    const t = setInterval(refresh, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [room]);

  useEffect(() => {
    function tick() {
      const last = parseInt(localStorage.getItem(`setlist-last-add-${room}`) || '0', 10);
      setCooldown(Math.max(0, COOLDOWN_MS - (Date.now() - last)));
    }
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [room]);

  async function handleAdd() {
    const cleanedName = name.trim() || 'guest';
    localStorage.setItem('setlist-guest-name', cleanedName);

    if (cooldown > 0) {
      setMsg({ text: 'One at a time — wait for your cooldown.', type: 'err' });
      return;
    }
    const id = extractVideoId(input);
    if (!id) {
      setMsg({ text: "That doesn't look like a YouTube link.", type: 'err' });
      return;
    }
    setMsg({ text: 'Adding…', type: '' });
    const [current, currentNow] = await Promise.all([getQueue(room), getNow(room)]);
    if (current.some((i) => i.videoId === id) || (currentNow && currentNow.videoId === id)) {
      setMsg({ text: 'That song is already lined up.', type: 'err' });
      return;
    }
    const meta = await fetchMeta(id);
    const next = [
      ...current,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        videoId: id,
        title: meta.title,
        thumb: meta.thumb,
        author: meta.author,
        addedBy: cleanedName,
      },
    ];
    await saveQueue(room, next);
    localStorage.setItem(`setlist-last-add-${room}`, String(Date.now()));
    setQueueState(next);
    setInput('');
    setMsg({ text: 'Added! It will play soon.', type: 'ok' });
  }

  return (
    <div id="app">
      <div className="guest-wrap">
        <div className="wordmark">
          <span className="display">SETLIST</span>
          <span className="dot" />
        </div>
        <div className="guest-badge">
          Adding to room <b>{room}</b>
        </div>

        {!isRemote() && (
          <div className="file-warn">
            This site isn't connected to a shared database yet, so what you add here may not reach
            the host's screen. Ask the host to finish the Firebase setup in the README.
          </div>
        )}

        <div className="card">
          <div className="now-label">
            <span className="dot" /> NOW PLAYING
          </div>
          <div className="now-title" style={{ fontSize: 17 }}>{now ? now.title : 'Nothing yet'}</div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div className="name-row">
            <input
              placeholder="Your name (shown on the queue)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="add-row">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Paste a YouTube link…"
            />
            <button onClick={handleAdd} disabled={cooldown > 0}>Add</button>
          </div>
          <div className={`msg ${msg.type}`}>{msg.text}</div>
          <div className="cooldown">
            {cooldown > 0 ? `You can add another song in ${Math.ceil(cooldown / 1000)}s.` : ''}
          </div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div className="setlist-head">
            <h2>Up next</h2>
            <span>{queue.length} {queue.length === 1 ? 'song' : 'songs'}</span>
          </div>
          <ul className="queue-list">
            {queue.length === 0 && <div className="empty-note">Nothing queued yet — add the first one!</div>}
            {queue.map((item, i) => (
              <li className="qitem" key={item.id}>
                <div className="qnum">{i + 1}</div>
                <img className="qthumb" src={item.thumb} alt="" />
                <div className="qmeta">
                  <div className="qtitle">{item.title}</div>
                  <div className="qby">added by {item.addedBy || 'guest'}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

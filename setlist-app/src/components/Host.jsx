import { useEffect, useRef, useState } from "react";
import {
  getQueue,
  setQueue as saveQueue,
  getNow,
  setNow as saveNow,
  isRemote,
} from "../lib/storage.js";
import { extractVideoId, fetchMeta, randomCode } from "../lib/youtube.js";

export default function Host() {
  const [room] = useState(() => {
    let code = localStorage.getItem("setlist-host-room");
    if (!code) {
      code = randomCode(4);
      localStorage.setItem("setlist-host-room", code);
    }
    return code;
  });
  const [queue, setQueueState] = useState([]);
  const [now, setNowState] = useState(null);
  const [started, setStarted] = useState(false);
  const [input, setInput] = useState("");
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [playerError, setPlayerError] = useState(null);
  const iframeRef = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    startedRef.current = started;
  }, [started]);

  const guestUrl = `${window.location.origin}${window.location.pathname}?room=${room}`;

  // hydrate "now playing" once (e.g. after a reload)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const n = await getNow(room);
      if (!cancelled && n) setNowState(n);
    })();
    return () => {
      cancelled = true;
    };
  }, [room]);

  // poll for guest additions
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const remote = await getQueue(room);
      if (cancelled) return;
      setQueueState((local) => {
        const merged = local.filter((i) => remote.some((r) => r.id === i.id));
        const localIds = new Set(merged.map((i) => i.id));
        remote.forEach((r) => {
          if (!localIds.has(r.id)) merged.push(r);
        });
        return merged;
      });
    }
    poll();
    const t = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [room]);

  // auto-advance via the YouTube embed's postMessage protocol, and surface
  // playback errors (e.g. a video with embedding disabled) instead of
  // leaving YouTube's own error screen as the only feedback
  useEffect(() => {
    function onMessage(e) {
      let data = e.data;
      if (typeof data !== "string") return;
      try {
        data = JSON.parse(data);
      } catch (err) {
        return;
      }
      const state =
        data && data.info && typeof data.info.playerState !== "undefined"
          ? data.info.playerState
          : data && data.event === "onStateChange"
          ? data.info
          : undefined;
      if (state === 0) playNext();

      const errorCode =
        data && data.event === "onError"
          ? data.info
          : data && data.info && typeof data.info.errorCode !== "undefined"
          ? data.info.errorCode
          : undefined;
      if (typeof errorCode !== "undefined") {
        const blocked = errorCode === 101 || errorCode === 150;
        setPlayerError(
          blocked
            ? "This video's owner has disabled playback on other sites — skipping to the next one."
            : "That video can't be played — skipping to the next one."
        );
        setTimeout(() => {
          setPlayerError(null);
          playNext();
        }, 2500);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pingListener() {
    [300, 800, 1500, 3000].forEach((delay) => {
      setTimeout(() => {
        try {
          iframeRef.current?.contentWindow.postMessage(
            JSON.stringify({ event: "listening", id: "ytframe" }),
            "*"
          );
        } catch (e) {
          /* ignore */
        }
      }, delay);
    });
  }

  function loadVideo(videoId) {
    if (!iframeRef.current) return;
    iframeRef.current.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&playsinline=1&rel=0`;
    pingListener();
  }

  function playNext() {
    setQueueState((current) => {
      if (current.length === 0) {
        setNowState(null);
        saveNow(room, null);
        return current;
      }
      const [next, ...rest] = current;
      setNowState(next);
      saveQueue(room, rest);
      saveNow(room, next);
      if (startedRef.current) loadVideo(next.videoId);
      return rest;
    });
  }

  function handleStart() {
    setStarted(true);
    startedRef.current = true;
    if (now) {
      loadVideo(now.videoId);
    } else if (queue.length) {
      playNext();
    } else {
      setMsg({ text: "Add a song below first, then hit start.", type: "" });
    }
  }

  async function handleAdd() {
    const id = extractVideoId(input);
    if (!id) {
      setMsg({ text: "That doesn't look like a YouTube link.", type: "err" });
      return;
    }
    setMsg({ text: "Adding…", type: "" });
    const meta = await fetchMeta(id);
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      videoId: id,
      title: meta.title,
      thumb: meta.thumb,
      author: meta.author,
      addedBy: "Host",
    };
    let willAutoPlay = false;
    setQueueState((current) => {
      const next = [...current, item];
      saveQueue(room, next);
      willAutoPlay = startedRef.current && !now;
      return next;
    });
    setInput("");
    setMsg({ text: "Added to the queue.", type: "ok" });
    if (willAutoPlay) playNext();
  }

  function moveItem(idx, dir) {
    setQueueState((current) => {
      const swap = idx + dir;
      if (swap < 0 || swap >= current.length) return current;
      const next = [...current];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      saveQueue(room, next);
      return next;
    });
  }

  function removeItem(idx) {
    setQueueState((current) => {
      const next = current.filter((_, i) => i !== idx);
      saveQueue(room, next);
      return next;
    });
  }

  function clearQueue() {
    setQueueState(() => {
      saveQueue(room, []);
      return [];
    });
  }

  return (
    <div id="app">
      <div className="wordmark">
        <span className="display">SETLIST</span>
        <span className="dot" />
      </div>
      <p className="tagline">
        Your speakers, the room's playlist. Scan to add — no account needed.
      </p>

      {!isRemote() && (
        <div className="file-warn">
          <b>Running in local-only mode.</b> No Firebase database is configured,
          so the queue only syncs on this device — guests scanning the QR code
          from their own phone won't see it. See the README for the two-minute
          setup that turns on real cross-device syncing.
        </div>
      )}

      <div className="host-grid">
        <div>
          <div className="stage-frame">
            <div className="yt-wrap" id="ytwrap">
              <iframe
                ref={iframeRef}
                title="Now playing"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
              {!started && (
                <div className="start-overlay" onClick={handleStart}>
                  <button className="start-btn">▶ Start the show</button>
                </div>
              )}
              {playerError && (
                <div
                  className="start-overlay"
                  style={{ background: "rgba(28,10,20,0.9)" }}
                >
                  <div
                    style={{
                      maxWidth: 320,
                      textAlign: "center",
                      padding: "0 20px",
                      fontSize: 14,
                    }}
                  >
                    {playerError}
                  </div>
                </div>
              )}
            </div>
            <div className="now-info">
              <div className="now-label">
                <span className="dot" /> NOW PLAYING
              </div>
              <div className="now-title">
                {now ? now.title : "Nothing yet — add a song to begin"}
              </div>
              <div className="now-sub">
                {now && now.author ? `from ${now.author}` : ""}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <div className="setlist-head">
              <h2>Up next</h2>
              <span>
                {queue.length}{" "}
                {queue.length === 1 ? "song queued" : "songs queued"}
              </span>
            </div>
            <ul className="queue-list">
              {queue.length === 0 && (
                <div className="empty-note">
                  The queue is empty. Share the QR code, or add one yourself
                  below.
                </div>
              )}
              {queue.map((item, i) => (
                <li className="qitem" key={item.id}>
                  <div className="qnum">{i + 1}</div>
                  <img className="qthumb" src={item.thumb} alt="" />
                  <div className="qmeta">
                    <div className="qtitle">{item.title}</div>
                    <div className="qby">
                      added by {item.addedBy || "guest"}
                    </div>
                  </div>
                  <div className="qactions">
                    <button
                      className="icon-btn"
                      onClick={() => moveItem(i, -1)}
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => moveItem(i, 1)}
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => removeItem(i)}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="add-row">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Paste a YouTube link…"
              />
              <button onClick={handleAdd}>Add</button>
            </div>
            <div className="host-controls">
              <button className="ghost-btn" onClick={playNext}>
                Skip song
              </button>
              <button className="ghost-btn" onClick={clearQueue}>
                Clear queue
              </button>
            </div>
            <div className={`msg ${msg.type}`}>{msg.text}</div>
          </div>
        </div>

        <div className="card join-card">
          <h2>Scan to add a song</h2>
          <p>Anyone on this code can queue a track from their phone.</p>
          <div className="qr-box">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                guestUrl
              )}`}
              alt="QR code to join the queue"
            />
          </div>
          <div className="room-code">{room}</div>
          <div className="join-url">{guestUrl}</div>
        </div>
      </div>
    </div>
  );
}

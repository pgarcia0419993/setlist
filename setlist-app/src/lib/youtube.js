export function extractVideoId(raw) {
  if (!raw) return null;
  raw = raw.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.hostname.includes('youtu.be')) return url.pathname.slice(1).split('/')[0];
    if (url.pathname.includes('/shorts/')) return url.pathname.split('/shorts/')[1].split('/')[0];
    if (url.pathname.includes('/embed/')) return url.pathname.split('/embed/')[1].split('/')[0];
    const v = url.searchParams.get('v');
    if (v) return v;
  } catch (e) {
    /* not a valid URL, fall through to regex */
  }
  const m = raw.match(/([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export async function fetchMeta(videoId) {
  try {
    const res = await fetch(
      'https://www.youtube.com/oembed?url=' +
        encodeURIComponent('https://www.youtube.com/watch?v=' + videoId) +
        '&format=json'
    );
    if (!res.ok) throw new Error('oembed failed');
    const data = await res.json();
    return { title: data.title, thumb: data.thumbnail_url, author: data.author_name };
  } catch (e) {
    return {
      title: 'YouTube video',
      thumb: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      author: '',
    };
  }
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function randomCode(len) {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

/* MultiView — Twitch / YouTube / Kick 複数配信同時視聴アプリ */

// ---------------------------------------------------------------- constants
const MAX_STREAMS = 9;
const LS = {
  session: 'mtv.session.v1',
  presets: 'mtv.presets.v1',
  recent: 'mtv.recent.v1',
};
const RESERVED = new Set([
  'directory', 'videos', 'settings', 'downloads', 'search', 'popout',
  'embed', 'subscriptions', 'wallet', 'drops', 'p', 'store', 'turbo',
]);
let GAP = 8; // compactモードでは詰める（relayoutで更新）
const HEAD_H = window.matchMedia && matchMedia('(pointer: coarse)').matches ? 36 : 30;
const isCoarse = () => window.matchMedia && matchMedia('(pointer: coarse)').matches;
// ビューポート寸法は innerWidth ではなく documentElement 基準（CSSビューポートと常に一致）
const vpW = () => document.documentElement.clientWidth;
const vpH = () => document.documentElement.clientHeight;

const $ = (sel, el = document) => el.querySelector(sel);

const ICONS = {
  grip: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  volOff: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4zM23 9l-6 6M17 9l6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  volOn: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  maximize: '<svg viewBox="0 0 24 24"><path d="M15 3h6v6M21 3l-7 7M9 21H3v-6M3 21l7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  reload: '<svg viewBox="0 0 24 24"><path d="M23 4v6h-6M20.5 15a9 9 0 1 1-2-9.4L23 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ext: '<svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  // platform logos
  tw: '<svg viewBox="0 0 24 24"><path d="M4.3 3 3 6.4V20h4.7v2h2.6l2-2h3.9l4.8-4.8V3H4.3zm14.9 11.4-2.7 2.7h-4.3l-2 2v-2H6.5V4.7h12.7v9.7zM14.2 7.6h1.7v5h-1.7zm-4.6 0h1.7v5H9.6z" fill="#a970ff"/></svg>',
  yt: '<svg viewBox="0 0 24 24"><path d="M23 12s0-3.8-.5-5.6c-.3-1-1-1.8-2-2C18.7 4 12 4 12 4s-6.7 0-8.5.4c-1 .2-1.7 1-2 2C1 8.2 1 12 1 12s0 3.8.5 5.6c.3 1 1 1.8 2 2 1.8.4 8.5.4 8.5.4s6.7 0 8.5-.4c1-.2 1.7-1 2-2 .5-1.8.5-5.6.5-5.6z" fill="#f00"/><path d="M9.8 15.3V8.7l5.7 3.3z" fill="#fff"/></svg>',
  kick: '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="4" fill="#53fc18"/><path d="M7 6h3.5v4L14 6h4l-4.5 6L18 18h-4l-3.5-4v4H7z" fill="#0b0b0f"/></svg>',
};

// ---------------------------------------------------------------- dom refs
const content = $('#content');
const stage = $('#stage');
const emptyState = $('#empty-state');
const recentBlock = $('#recent-block');
const recentChips = $('#recent-chips');
const addForm = $('#add-form');
const addInput = $('#add-input');
const suggestEl = $('#suggest');
const chatPanel = $('#chat-panel');
const chatTabs = $('#chat-tabs');
const chatFramesEl = $('#chat-frames');
const chatEmpty = $('#chat-empty');
const resizer = $('#resizer');
const toastsEl = $('#toasts');
const helpDlg = $('#help-dlg');
const presetsPop = $('#presets-pop');
const presetList = $('#preset-list');
const btn = {
  layoutGrid: $('#layout-grid-btn'),
  layoutFocus: $('#layout-focus-btn'),
  mute: $('#mute-btn'),
  presets: $('#presets-btn'),
  share: $('#share-btn'),
  chat: $('#chat-btn'),
  help: $('#help-btn'),
  fs: $('#fs-btn'),
  chatPopout: $('#chat-popout'),
  chatClose: $('#chat-close'),
  helpClose: $('#help-close'),
  presetSave: $('#preset-save'),
};

// ---------------------------------------------------------------- state
// チャンネルキーは "tw:name" / "yt:videoIdまたはUC..チャンネルID" / "kick:name" 形式
const state = {
  channels: [],
  layout: 'grid',      // 'grid' | 'focus'
  focusName: null,
  audibleName: null,   // 音声ONのキー (null = 全ミュート)
  chatOpen: true,
  activeChat: null,
  chatWidth: 340,
};

const players = new Map();       // key -> Twitch.Player (twitchのみ)
const playerFrames = new Map();  // key -> iframe (yt / kick)
const tileEls = new Map();       // key -> .tile element
const chatEls = new Map();       // key -> chat iframe / placeholder div
const tileStatus = new Map();    // key -> 'loading' | 'live' | 'offline' (twitchのみ)
const CHAT_CELL = Symbol('chat');

// ---------------------------------------------------------------- utils
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function toast(msg, type = 'info', duration = 2600) {
  const el = document.createElement('div');
  el.className = 'toast' + (type !== 'info' ? ' ' + type : '');
  el.textContent = msg;
  toastsEl.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

function whenTwitchReady(cb, onFail) {
  if (window.Twitch && window.Twitch.Player) { cb(); return; }
  let waited = 0;
  const iv = setInterval(() => {
    if (window.Twitch && window.Twitch.Player) { clearInterval(iv); cb(); }
    else if ((waited += 150) > 12000) { clearInterval(iv); if (onFail) onFail(); }
  }, 150);
}

// ---------------------------------------------------------------- platform helpers
function parseEntry(key) {
  const i = key.indexOf(':');
  if (i < 0) return { platform: 'tw', id: key };
  return { platform: key.slice(0, i), id: key.slice(i + 1) };
}

const isYtChannel = (id) => /^UC[A-Za-z0-9_-]{22}$/.test(id);

// 生文字列 → 正規化キー（不正なら null）
function normalizeKey(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;
  const i = t.indexOf(':');
  let platform = 'tw';
  let id = t;
  if (i > -1) {
    platform = t.slice(0, i).toLowerCase();
    id = t.slice(i + 1);
  }
  if (platform === 'twitch') platform = 'tw';
  if (platform === 'youtube') platform = 'yt';
  if (platform === 'tw' || platform === 'kick') {
    id = id.toLowerCase();
    if (!/^[a-z0-9_]{2,25}$/.test(id)) return null;
    if (platform === 'tw' && RESERVED.has(id)) return null;
  } else if (platform === 'yt') {
    if (!/^[A-Za-z0-9_-]{11}$/.test(id) && !isYtChannel(id)) return null;
  } else {
    return null;
  }
  return platform + ':' + id;
}

// URLからキーを抽出（対応外URLは null）
function extractFromUrl(t) {
  let m;
  if ((m = t.match(/youtu\.be\/([A-Za-z0-9_-]{11})/))) return 'yt:' + m[1];
  if ((m = t.match(/youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|live\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/))) return 'yt:' + m[1];
  if ((m = t.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/))) return 'yt:' + m[1];
  if ((m = t.match(/kick\.com\/([A-Za-z0-9_]{2,25})/i))) return 'kick:' + m[1].toLowerCase();
  if ((m = t.match(/twitch\.tv\/([A-Za-z0-9_]{2,25})/i))) return 'tw:' + m[1].toLowerCase();
  return null;
}

function parseInput(raw) {
  const tokens = raw.split(/[\s,、;]+/).filter(Boolean);
  const valid = [];
  const invalid = [];
  for (const t of tokens) {
    const cleaned = t.replace(/^[@#]/, '');
    const key = extractFromUrl(cleaned) || normalizeKey(cleaned);
    if (key) valid.push(key);
    else invalid.push(t);
  }
  return { valid: [...new Set(valid)], invalid };
}

function displayName(key) {
  const { platform, id } = parseEntry(key);
  if (platform === 'yt') return isYtChannel(id) ? 'YouTube Live' : id;
  return id;
}

function platIcon(key) {
  const { platform } = parseEntry(key);
  return ICONS[platform] || ICONS.tw;
}

const domId = (key) => 'ph-' + key.replace(/[^a-zA-Z0-9_-]/g, '-');

function watchUrl(key) {
  const { platform, id } = parseEntry(key);
  if (platform === 'yt') {
    return isYtChannel(id)
      ? `https://www.youtube.com/channel/${id}/live`
      : `https://www.youtube.com/watch?v=${id}`;
  }
  if (platform === 'kick') return `https://kick.com/${id}`;
  return `https://www.twitch.tv/${id}`;
}

function ytSrc(id, muted) {
  const base = isYtChannel(id)
    ? `https://www.youtube.com/embed/live_stream?channel=${id}&`
    : `https://www.youtube.com/embed/${id}?`;
  return base + `autoplay=1&mute=${muted ? 1 : 0}&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
}

const kickSrc = (id, muted) => `https://player.kick.com/${id}?autoplay=true&muted=${muted}`;

function effectiveFocus() {
  if (state.channels.length < 2) return null;
  return state.channels.includes(state.focusName) ? state.focusName : state.channels[0];
}

// ---------------------------------------------------------------- persistence
function saveSession() {
  lsSet(LS.session, {
    channels: state.channels,
    layout: state.layout,
    focusName: state.focusName,
    chatOpen: state.chatOpen,
    activeChat: state.activeChat,
    chatWidth: state.chatWidth,
  });
}

function getRecent() {
  return lsGet(LS.recent, []).map(normalizeKey).filter(Boolean);
}

function pushRecent(key) {
  const rec = getRecent().filter((k) => k !== key);
  rec.unshift(key);
  lsSet(LS.recent, rec.slice(0, 12));
}

// ---------------------------------------------------------------- URL hash
// twitchはプレフィックス無しの素の名前、他は yt:xxx / kick:xxx 形式
const hashString = () =>
  state.channels.map((k) => (k.startsWith('tw:') ? k.slice(3) : k)).join('/');

function readHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  if (!raw) return [];
  return [...new Set(raw.split('/').map(normalizeKey).filter(Boolean))].slice(0, MAX_STREAMS);
}

function writeHash() {
  try {
    if (state.channels.length) {
      history.replaceState(null, '', '#' + hashString());
    } else {
      history.replaceState(null, '', location.pathname + location.search);
    }
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------- tiles & players
function setStatus(key, st) {
  if (parseEntry(key).platform !== 'tw') return;
  tileStatus.set(key, st);
  const el = tileEls.get(key);
  if (!el) return;
  const badge = $('.badge', el);
  const cover = $('.cover', el);
  badge.classList.remove('live', 'loading');
  if (st === 'live') {
    badge.textContent = 'LIVE';
    badge.classList.add('live');
    cover.classList.add('hidden');
  } else if (st === 'offline') {
    badge.textContent = 'オフライン';
    $('.cover-msg', el).textContent = '配信はオフラインです';
    cover.classList.remove('hidden');
  } else {
    badge.textContent = '読込中';
    badge.classList.add('loading');
    cover.classList.add('hidden');
  }
}

function createPlayer(key) {
  const { platform, id } = parseEntry(key);
  const muted = state.audibleName !== key;

  if (platform === 'tw') {
    whenTwitchReady(() => {
      const host = document.getElementById(domId(key));
      if (!host) return;
      const player = new Twitch.Player(domId(key), {
        channel: id,
        parent: [location.hostname],
        width: '100%',
        height: '100%',
        autoplay: true,
        muted: true,
      });
      players.set(key, player);
      const P = window.Twitch.Player;
      player.addEventListener(P.READY, () => {
        try { player.setMuted(state.audibleName !== key); } catch { /* ignore */ }
      });
      player.addEventListener(P.ONLINE, () => setStatus(key, 'live'));
      player.addEventListener(P.PLAYING, () => setStatus(key, 'live'));
      player.addEventListener(P.OFFLINE, () => setStatus(key, 'offline'));
    }, () => {
      const el = tileEls.get(key);
      if (!el) return;
      $('.cover-msg', el).textContent = 'プレーヤーを読み込めませんでした（ネットワークを確認してください）';
      $('.cover', el).classList.remove('hidden');
    });
    return;
  }

  const host = document.getElementById(domId(key));
  if (!host) return;
  const f = document.createElement('iframe');
  f.src = platform === 'yt' ? ytSrc(id, muted) : kickSrc(id, muted);
  f.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
  f.setAttribute('allowfullscreen', '');
  if (platform === 'kick') f.dataset.muted = String(muted);
  host.appendChild(f);
  playerFrames.set(key, f);
}

function reloadPlayer(key) {
  const el = tileEls.get(key);
  if (!el) return;
  const body = $('.tile-body', el);
  const old = $('.player-host', body);
  if (old) old.remove();
  players.delete(key);
  playerFrames.delete(key);
  const host = document.createElement('div');
  host.className = 'player-host';
  host.id = domId(key);
  body.prepend(host);
  setStatus(key, 'loading');
  $('.cover', el).classList.add('hidden');
  createPlayer(key);
}

function createTile(key) {
  const { platform } = parseEntry(key);
  const el = document.createElement('div');
  el.className = 'tile';
  el.dataset.name = key;
  el.innerHTML = `
    <div class="tile-head">
      <span class="grip" title="ドラッグで並べ替え">${ICONS.grip}</span>
      <span class="plat">${platIcon(key)}</span>
      <span class="tile-name"></span>
      <span class="badge loading">読込中</span>
      <span class="spacer"></span>
      <button class="t-btn b-audio" title="この配信の音声を聞く">${ICONS.volOff}</button>
      <button class="t-btn b-chat" title="この配信のチャットを表示">${ICONS.chat}</button>
      <button class="t-btn b-focus" title="拡大表示（フォーカス）">${ICONS.maximize}</button>
      <button class="t-btn b-reload" title="プレーヤーを再読み込み">${ICONS.reload}</button>
      <button class="t-btn b-pop" title="配信サイトで開く">${ICONS.ext}</button>
      <button class="t-btn b-close" title="この配信を閉じる">${ICONS.x}</button>
    </div>
    <div class="tile-body">
      <div class="player-host" id="${domId(key)}"></div>
      <div class="cover hidden">
        <div class="cover-msg">配信はオフラインです</div>
        <button class="cover-reload">再読み込み</button>
      </div>
    </div>`;
  $('.tile-name', el).textContent = displayName(key);
  if (platform !== 'tw') $('.badge', el).style.display = 'none';

  // --- ボタン類
  $('.b-audio', el).addEventListener('click', () =>
    setAudible(state.audibleName === key ? null : key));
  $('.b-chat', el).addEventListener('click', () => {
    setActiveChat(key);
    if (!state.chatOpen) toggleChat(true);
  });
  $('.b-focus', el).addEventListener('click', () => toggleFocusTile(key));
  $('.b-reload', el).addEventListener('click', () => reloadPlayer(key));
  $('.b-pop', el).addEventListener('click', () =>
    window.open(watchUrl(key), '_blank', 'noopener'));
  $('.b-close', el).addEventListener('click', () => removeChannel(key));
  $('.cover-reload', el).addEventListener('click', () => reloadPlayer(key));

  // --- ドラッグで並べ替え（Pointer Events: マウス・タッチ両対応）
  const head = $('.tile-head', el);
  wireTileDrag(el, head, key);
  head.addEventListener('dblclick', (e) => {
    if (!e.target.closest('.t-btn')) toggleFocusTile(key);
  });

  stage.appendChild(el);
  tileEls.set(key, el);
  setStatus(key, 'loading');
  createPlayer(key);
}

function toggleFocusTile(key) {
  if (state.layout === 'focus' && effectiveFocus() === key) {
    setLayout('grid');
  } else {
    state.focusName = key;
    setLayout('focus');
  }
}

// ヘッダーを掴んでタイルを移動し、重なったタイルと入れ替える。
// ポインタキャプチャで iframe 上でもイベントを受け続け、
// elementFromPoint でドロップ先を判定する（ドラッグ元は pointer-events:none）。
function wireTileDrag(el, head, key) {
  head.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.t-btn')) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    let lastTarget = null;
    try { head.setPointerCapture(e.pointerId); } catch { /* ignore */ }

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragging) {
        if (Math.hypot(dx, dy) < 7) return;
        dragging = true;
        el.classList.add('drag-src');
        el.style.zIndex = '40';
      }
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const tile = under && under.closest ? under.closest('.tile') : null;
      const tgt = tile && tile !== el ? tile.dataset.name : null;
      if (lastTarget && lastTarget !== tgt) {
        const prev = tileEls.get(lastTarget);
        if (prev) prev.classList.remove('drop-target');
      }
      if (tgt) tileEls.get(tgt).classList.add('drop-target');
      lastTarget = tgt;
    };

    const finish = (ev) => {
      head.removeEventListener('pointermove', onMove);
      head.removeEventListener('pointerup', finish);
      head.removeEventListener('pointercancel', finish);
      if (lastTarget) {
        const prev = tileEls.get(lastTarget);
        if (prev) prev.classList.remove('drop-target');
      }
      if (!dragging) return;
      el.classList.remove('drag-src');
      if (ev.type === 'pointerup' && lastTarget) {
        handleDropSwap(key, lastTarget);
      } else {
        relayout(true); // スナップバック
      }
      el.style.transform = '';
      setTimeout(() => { el.style.zIndex = ''; }, 320);
    };

    head.addEventListener('pointermove', onMove);
    head.addEventListener('pointerup', finish);
    head.addEventListener('pointercancel', finish);
  });
}

function handleDropSwap(src, tgt) {
  const focus = state.layout === 'focus' ? effectiveFocus() : null;
  if (focus && tgt === focus) {
    state.focusName = src;
  } else if (focus && src === focus) {
    state.focusName = tgt;
  } else {
    const a = state.channels.indexOf(src);
    const b = state.channels.indexOf(tgt);
    if (a < 0 || b < 0) return;
    [state.channels[a], state.channels[b]] = [state.channels[b], state.channels[a]];
  }
  afterMutation(true);
}

function flashTile(key) {
  const el = tileEls.get(key);
  if (!el) return;
  el.classList.add('drop-target');
  setTimeout(() => el.classList.remove('drop-target'), 800);
}

// ---------------------------------------------------------------- audio
function applyMute(key, muted) {
  const { platform } = parseEntry(key);
  if (platform === 'tw') {
    const p = players.get(key);
    if (p) { try { p.setMuted(muted); } catch { /* ignore */ } }
  } else if (platform === 'yt') {
    const f = playerFrames.get(key);
    if (f && f.contentWindow) {
      f.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: muted ? 'mute' : 'unMute', args: [] }), '*');
    }
  } else if (platform === 'kick') {
    // Kickは実行時の音声APIが無いため、ミュート状態が変わったらパラメータを変えて再読込
    const f = playerFrames.get(key);
    if (f && f.dataset.muted !== String(muted)) {
      f.dataset.muted = String(muted);
      f.src = kickSrc(parseEntry(key).id, muted);
    }
  }
}

function setAudible(key) {
  state.audibleName = key;
  for (const k of state.channels) applyMute(k, k !== key);
  updateAudibleUI();
  saveSession();
}

function updateAudibleUI() {
  for (const [k, el] of tileEls) {
    const on = state.audibleName === k;
    el.classList.toggle('audible', on);
    const b = $('.b-audio', el);
    b.classList.toggle('on', on);
    b.innerHTML = on ? ICONS.volOn : ICONS.volOff;
    b.title = on ? 'ミュートする' : 'この配信の音声を聞く';
  }
  btn.mute.classList.toggle('audible', !!state.audibleName);
}

// ---------------------------------------------------------------- chat
function ensureChatFrame(key) {
  if (chatEls.has(key)) return;
  const { platform, id } = parseEntry(key);
  let el;
  if (platform === 'tw') {
    el = document.createElement('iframe');
    el.src = `https://www.twitch.tv/embed/${id}/chat?parent=${location.hostname}&darkpopout`;
    el.setAttribute('allow', 'clipboard-write');
  } else if (platform === 'yt' && !isYtChannel(id)) {
    el = document.createElement('iframe');
    el.src = `https://www.youtube.com/live_chat?v=${id}&embed_domain=${location.hostname}&dark_theme=1`;
    el.classList.add('yt-chat');
  } else if (platform === 'kick') {
    el = document.createElement('iframe');
    el.src = `https://kick.com/popout/${id}/chat`;
  } else {
    el = document.createElement('div');
    el.className = 'chat-na';
    el.textContent = 'この形式（YouTubeチャンネル指定）はチャット埋め込みに未対応です。動画URLで追加するとチャットを表示できます。';
  }
  el.classList.add('chat-frame');
  el.dataset.name = key;
  chatFramesEl.appendChild(el);
  chatEls.set(key, el);
  fitYtChats();
}

// YouTubeチャットはパネルが狭いと内容が右で見切れる（特にiOSのiframe幅バグ）。
// 一定幅(360px)でレンダリングし、パネル幅に合わせて縮小表示することで全体を収める。
const YT_CHAT_RENDER_W = 360;

function fitYtChats() {
  const w = chatFramesEl.clientWidth;
  const h = chatFramesEl.clientHeight;
  if (!w || !h) return;
  chatFramesEl.querySelectorAll('.yt-chat').forEach((f) => {
    if (w >= YT_CHAT_RENDER_W) {
      f.style.width = '';
      f.style.height = '';
      f.style.transform = '';
      f.style.transformOrigin = '';
      return;
    }
    const scale = w / YT_CHAT_RENDER_W;
    f.style.width = YT_CHAT_RENDER_W + 'px';
    f.style.height = Math.round(h / scale) + 'px';
    f.style.transform = `scale(${scale})`;
    f.style.transformOrigin = 'top left';
  });
}

function setActiveChat(key) {
  state.activeChat = key;
  if (key) ensureChatFrame(key);
  for (const [k, f] of chatEls) f.classList.toggle('active', k === key);
  chatEmpty.classList.toggle('hidden', !!key);
  renderChatTabs();
  saveSession();
}

function renderChatTabs() {
  chatTabs.innerHTML = '';
  for (const key of state.channels) {
    const t = document.createElement('button');
    t.className = 'chat-tab' + (state.activeChat === key ? ' active' : '');
    t.setAttribute('role', 'tab');
    t.setAttribute('aria-selected', String(state.activeChat === key));
    t.innerHTML = platIcon(key);
    const span = document.createElement('span');
    span.textContent = displayName(key);
    t.appendChild(span);
    t.addEventListener('click', () => setActiveChat(key));
    chatTabs.appendChild(t);
  }
}

function toggleChat(force) {
  state.chatOpen = force !== undefined ? force : !state.chatOpen;
  document.body.classList.toggle('chat-open', state.chatOpen);
  btn.chat.setAttribute('aria-pressed', String(state.chatOpen));
  if (state.chatOpen && !state.activeChat && state.channels.length) {
    setActiveChat(state.channels[0]);
  }
  relayout(true);
  saveSession();
}

// ---------------------------------------------------------------- layout engine
let animTimer = null;

// 狭い画面ではサイドパネルをやめ、チャットをレイアウト内の1枠として扱う
function isChatTiled() {
  return state.chatOpen && vpW() < 940;
}

function bestGrid(n, W, H) {
  let best = null;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const tw = (W - GAP * (cols + 1)) / cols;
    const th = (H - GAP * (rows + 1)) / rows;
    if (tw <= 0 || th <= 0) continue;
    const eff = Math.min(tw, (th - HEAD_H) * 16 / 9);
    if (!best || eff > best.eff) best = { cols, rows, tw, th, eff };
  }
  return best || { cols: 1, rows: n, tw: Math.max(50, W - GAP * 2), th: 200, eff: 0 };
}

// セル内に「16:9映像 + ヘッダー」がぴったり収まるタイル寸法を返す
// （余った領域はタイル外の余白になり、映像の内部レターボックスを防ぐ）
function fit169(cw, ch) {
  const targetH = Math.round(cw * 9 / 16) + HEAD_H;
  if (targetH <= ch) return { w: cw, h: targetH };
  return { w: Math.max(120, Math.round((ch - HEAD_H) * 16 / 9)), h: ch };
}

// 領域 R {x,y,w,h} 内にグリッド配置
function layoutGridRegion(names, R, rects) {
  const total = names.length;
  if (!total) return;
  const { cols, rows, tw, th } = bestGrid(total, R.w, R.h);
  const fit = fit169(tw, th);
  const gridH = rows * fit.h + (rows - 1) * GAP;
  const y0 = R.y + Math.max(GAP, Math.round((R.h - gridH) / 2));
  names.forEach((name, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const inRow = r === rows - 1 ? total - cols * (rows - 1) : cols;
    const rowW = inRow * fit.w + (inRow - 1) * GAP;
    const x0 = R.x + Math.max(GAP, Math.round((R.w - rowW) / 2));
    rects.set(name, {
      x: x0 + c * (fit.w + GAP),
      y: y0 + r * (fit.h + GAP),
      w: fit.w,
      h: fit.h,
    });
  });
}

// 領域 R 内にフォーカス配置（メイン大 + 残りは帯状に並べる）
// 横長の領域なら右に縦帯、縦長なら下に横帯
function layoutFocusRegion(names, R, rects) {
  const focus = effectiveFocus();
  const rest = names.filter((x) => x !== focus);
  const k = rest.length;
  if (R.w >= R.h) {
    const stripW = clamp(Math.round(R.w * 0.24), 180, 400);
    const mainW = R.w - stripW - GAP * 3;
    const mainH = R.h - GAP * 2;
    const mf = fit169(mainW, mainH);
    rects.set(focus, {
      x: R.x + GAP + Math.round((mainW - mf.w) / 2),
      y: R.y + GAP + Math.round((mainH - mf.h) / 2),
      w: mf.w,
      h: mf.h,
    });
    const cellH = Math.floor((R.h - GAP * (k + 1)) / k);
    const f = fit169(stripW, cellH);
    const totalH = k * f.h + (k - 1) * GAP;
    let y = R.y + Math.max(GAP, Math.round((R.h - totalH) / 2));
    const x = R.x + R.w - stripW - GAP + Math.round((stripW - f.w) / 2);
    for (const name of rest) {
      rects.set(name, { x, y, w: f.w, h: f.h });
      y += f.h + GAP;
    }
  } else {
    const stripH = clamp(Math.round(R.h * 0.24), 110, 260);
    const mainW = R.w - GAP * 2;
    const mainH = R.h - stripH - GAP * 3;
    const mf = fit169(mainW, mainH);
    rects.set(focus, {
      x: R.x + GAP + Math.round((mainW - mf.w) / 2),
      y: R.y + GAP + Math.round((mainH - mf.h) / 2),
      w: mf.w,
      h: mf.h,
    });
    const cellW = Math.floor((R.w - GAP * (k + 1)) / k);
    const f = fit169(cellW, stripH);
    const totalW = k * f.w + (k - 1) * GAP;
    let x = R.x + Math.max(GAP, Math.round((R.w - totalW) / 2));
    const y = R.y + R.h - stripH - GAP + Math.round((stripH - f.h) / 2);
    for (const name of rest) {
      rects.set(name, { x, y, w: f.w, h: f.h });
      x += f.w + GAP;
    }
  }
}

function relayout(animate = false) {
  const n = state.channels.length;
  emptyState.classList.toggle('hidden', n > 0);

  // 低い画面（横持ちスマホ等）はツールバーを格納して表示領域を最大化
  const compact = vpH() < 500;
  GAP = compact ? 6 : 8;
  document.body.classList.toggle('compact', compact);
  if (!compact) document.body.classList.remove('tb-open');
  updateRotateHint();

  const chatTiled = isChatTiled();
  document.body.classList.toggle('chat-tiled', chatTiled);
  chatPanel.style.display = chatTiled && !n ? 'none' : '';
  if (!chatTiled) {
    chatPanel.style.left = '';
    chatPanel.style.top = '';
    chatPanel.style.height = '';
    chatPanel.style.width = state.chatWidth + 'px';
  }
  if (!n) return;

  if (animate) {
    content.classList.add('anim');
    clearTimeout(animTimer);
    animTimer = setTimeout(() => content.classList.remove('anim'), 340);
  }

  // ※ chat-tiled のクラス切替がステージ幅に影響するため、サイズはクラス適用後に読む
  const W = stage.clientWidth;
  const H = stage.clientHeight;
  const rects = new Map();
  let region = { x: 0, y: 0, w: W, h: H };

  if (chatTiled) {
    if (H >= W) {
      // 縦画面: チャットは下部の1枠
      const chatH = clamp(Math.round(H * 0.34), 160, 420);
      rects.set(CHAT_CELL, { x: GAP, y: H - chatH - GAP, w: W - GAP * 2, h: chatH });
      region = { x: 0, y: 0, w: W, h: H - chatH - GAP };
    } else {
      // 横画面: チャットは右側の1枠（スマホ横持ちでは細くして映像側を広く使う）
      const chatW = compact
        ? clamp(Math.round(W * 0.22), 190, 300)
        : clamp(Math.round(W * 0.3), 240, 400);
      rects.set(CHAT_CELL, { x: W - chatW - GAP, y: GAP, w: chatW, h: H - GAP * 2 });
      region = { x: 0, y: 0, w: W - chatW - GAP, h: H };
    }
  }

  if (state.layout === 'focus' && n >= 2) {
    layoutFocusRegion(state.channels, region, rects);
  } else {
    layoutGridRegion(state.channels, region, rects);
  }

  for (const [key, r] of rects) {
    const el = key === CHAT_CELL ? chatPanel : tileEls.get(key);
    if (!el) continue;
    el.style.left = Math.round(r.x) + 'px';
    el.style.top = Math.round(r.y) + 'px';
    el.style.width = Math.round(r.w) + 'px';
    el.style.height = Math.round(r.h) + 'px';
  }
}

// ---------------------------------------------------------------- mutations
function _add(key) {
  state.channels.push(key);
  createTile(key);
  pushRecent(key);
}

function _remove(key) {
  const i = state.channels.indexOf(key);
  if (i < 0) return;
  state.channels.splice(i, 1);
  const el = tileEls.get(key);
  if (el) el.remove();
  tileEls.delete(key);
  players.delete(key);
  playerFrames.delete(key);
  tileStatus.delete(key);
  const f = chatEls.get(key);
  if (f) f.remove();
  chatEls.delete(key);
}

function afterMutation(animate = true) {
  if (state.focusName && !state.channels.includes(state.focusName)) state.focusName = null;
  if (state.audibleName && !state.channels.includes(state.audibleName)) state.audibleName = null;
  if (state.activeChat && !state.channels.includes(state.activeChat)) state.activeChat = null;
  if (!state.activeChat && state.channels.length && state.chatOpen) {
    setActiveChat(state.channels[0]);
  } else {
    renderChatTabs();
    chatEmpty.classList.toggle('hidden', !!state.activeChat);
  }
  updateAudibleUI();
  relayout(animate);
  writeHash();
  saveSession();
  renderRecent();
  updateTitle();
}

function addChannels(keys) {
  const wasEmpty = state.channels.length === 0;
  const added = [];
  for (const k of keys) {
    if (state.channels.includes(k)) {
      toast(`${displayName(k)} は追加済みです`);
      flashTile(k);
      continue;
    }
    if (state.channels.length >= MAX_STREAMS) {
      toast(`同時に視聴できるのは最大 ${MAX_STREAMS} 配信までです`, 'error');
      break;
    }
    _add(k);
    added.push(k);
  }
  if (added.length) {
    afterMutation(true);
    toast(`${added.map(displayName).join(', ')} を追加しました`);
    if (wasEmpty) {
      setTimeout(() => toast('音声はタイルのスピーカーボタン（または数字キー 1〜9）でONにできます', 'accent', 4200), 700);
    }
  }
}

function removeChannel(key) {
  _remove(key);
  afterMutation(true);
}

// hash・プリセット読み込みなど「目標リストに合わせる」同期（既存タイルは再読込しない）
function syncFromNames(target) {
  const t = [...new Set(target.map(normalizeKey).filter(Boolean))].slice(0, MAX_STREAMS);
  for (const k of [...state.channels]) if (!t.includes(k)) _remove(k);
  for (const k of t) if (!state.channels.includes(k)) _add(k);
  state.channels = t.filter((k) => tileEls.has(k));
  afterMutation(true);
}

function updateTitle() {
  document.title = state.channels.length
    ? `(${state.channels.length}) ${state.channels.map(displayName).join(' / ')} — MultiView`
    : 'MultiView — 複数配信を同時視聴 (Twitch / YouTube / Kick)';
}

// ---------------------------------------------------------------- recent / suggest
function renderRecent() {
  const rec = getRecent();
  recentBlock.classList.toggle('hidden', rec.length === 0);
  recentChips.innerHTML = '';
  for (const key of rec.slice(0, 10)) {
    const c = document.createElement('button');
    c.className = 'chip';
    c.innerHTML = platIcon(key);
    const span = document.createElement('span');
    span.textContent = displayName(key);
    c.appendChild(span);
    c.addEventListener('click', () => addChannels([key]));
    recentChips.appendChild(c);
  }
}

let sugItems = [];
let sugIdx = -1;

function buildSuggest() {
  const q = addInput.value.trim().toLowerCase();
  sugItems = getRecent()
    .filter((k) => !state.channels.includes(k) && (!q || k.toLowerCase().includes(q) || displayName(k).toLowerCase().includes(q)))
    .slice(0, 8);
  sugIdx = -1;
  suggestEl.innerHTML = '';
  if (!sugItems.length) { suggestEl.classList.add('hidden'); return; }
  const label = document.createElement('div');
  label.className = 'sug-label';
  label.textContent = '最近見たチャンネル';
  suggestEl.appendChild(label);
  sugItems.forEach((key, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sug-item';
    b.dataset.idx = i;
    b.innerHTML = platIcon(key);
    const span = document.createElement('span');
    span.textContent = displayName(key);
    b.appendChild(span);
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => {
      addChannels([key]);
      addInput.value = '';
      buildSuggest();
      addInput.focus();
    });
    suggestEl.appendChild(b);
  });
  suggestEl.classList.remove('hidden');
}

function hideSuggest() {
  suggestEl.classList.add('hidden');
  sugIdx = -1;
}

function highlightSug() {
  suggestEl.querySelectorAll('.sug-item').forEach((el, i) =>
    el.classList.toggle('active', i === sugIdx));
}

// ---------------------------------------------------------------- presets
function getPresets() { return lsGet(LS.presets, []); }

function renderPresets() {
  const ps = getPresets();
  presetList.innerHTML = '';
  if (!ps.length) {
    const d = document.createElement('div');
    d.className = 'preset-empty';
    d.textContent = '保存されたプリセットはありません';
    presetList.appendChild(d);
    return;
  }
  ps.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'preset-item';
    const info = document.createElement('div');
    info.className = 'preset-info';
    const nm = document.createElement('div');
    nm.className = 'preset-name';
    nm.textContent = p.name;
    const chs = document.createElement('div');
    chs.className = 'preset-chs';
    chs.textContent = p.channels.map(normalizeKey).filter(Boolean).map(displayName).join(' / ');
    info.append(nm, chs);
    const del = document.createElement('button');
    del.className = 'icon-btn icon-btn-sm preset-del';
    del.title = '削除';
    del.innerHTML = ICONS.x;
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      const arr = getPresets();
      arr.splice(i, 1);
      lsSet(LS.presets, arr);
      renderPresets();
    });
    item.append(info, del);
    item.addEventListener('click', () => {
      syncFromNames(p.channels);
      togglePresetsPop(false);
      toast(`プリセット「${p.name}」を読み込みました`, 'accent');
    });
    presetList.appendChild(item);
  });
}

function togglePresetsPop(force) {
  const show = force !== undefined ? force : presetsPop.classList.contains('hidden');
  presetsPop.classList.toggle('hidden', !show);
  if (show) renderPresets();
}

// ---------------------------------------------------------------- misc actions
function shareUrl() {
  if (!state.channels.length) { toast('共有する配信がありません', 'error'); return; }
  const url = location.origin + location.pathname + '#' + hashString();
  const done = () => toast('URLをコピーしました', 'accent');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(done).catch(() => fallbackCopy(url, done));
  } else {
    fallbackCopy(url, done);
  }
}

function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); }
  catch { toast(text, 'info', 6000); }
  ta.remove();
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
    return;
  }
  const p = document.documentElement.requestFullscreen();
  if (p && p.then) {
    p.then(() => {
      // スマホでは全画面と同時に横画面へ固定（対応ブラウザのみ / iOSは非対応）
      if (isCoarse() && screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    }).catch(() => {});
  }
}

// ---------------------------------------------------------------- 横画面推奨ヒント
const rotateHint = $('#rotate-hint');
let rotateHintDismissed = false;
try { rotateHintDismissed = sessionStorage.getItem('mtv.rotateHint') === '1'; } catch { /* ignore */ }

function updateRotateHint() {
  const portraitPhone = isCoarse() && vpW() < 720 && vpH() > vpW();
  rotateHint.classList.toggle('hidden',
    !portraitPhone || rotateHintDismissed || state.channels.length === 0);
}

function dismissRotateHint() {
  rotateHintDismissed = true;
  try { sessionStorage.setItem('mtv.rotateHint', '1'); } catch { /* ignore */ }
  updateRotateHint();
}

function setLayout(mode) {
  state.layout = mode;
  btn.layoutGrid.setAttribute('aria-pressed', String(mode === 'grid'));
  btn.layoutFocus.setAttribute('aria-pressed', String(mode === 'focus'));
  relayout(true);
  saveSession();
}

// ---------------------------------------------------------------- wiring
function wireToolbar() {
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (sugIdx >= 0 && sugItems[sugIdx]) {
      addChannels([sugItems[sugIdx]]);
      addInput.value = '';
      buildSuggest();
      return;
    }
    const raw = addInput.value.trim();
    if (!raw) return;
    const { valid, invalid } = parseInput(raw);
    if (invalid.length) toast(`認識できない入力です: ${invalid.join(', ')}`, 'error');
    if (valid.length) addChannels(valid);
    addInput.value = '';
    hideSuggest();
  });

  addInput.addEventListener('focus', buildSuggest);
  addInput.addEventListener('input', buildSuggest);
  addInput.addEventListener('blur', () => setTimeout(hideSuggest, 120));
  addInput.addEventListener('keydown', (e) => {
    if (suggestEl.classList.contains('hidden')) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      sugIdx = (sugIdx + 1) % sugItems.length;
      highlightSug();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      sugIdx = sugIdx <= 0 ? sugItems.length - 1 : sugIdx - 1;
      highlightSug();
    } else if (e.key === 'Escape') {
      hideSuggest();
    }
  });

  btn.layoutGrid.addEventListener('click', () => setLayout('grid'));
  btn.layoutFocus.addEventListener('click', () => setLayout('focus'));
  btn.mute.addEventListener('click', () => setAudible(null));
  btn.share.addEventListener('click', shareUrl);
  btn.chat.addEventListener('click', () => toggleChat());
  btn.chatClose.addEventListener('click', () => toggleChat(false));
  btn.chatPopout.addEventListener('click', () => {
    if (!state.activeChat) return;
    const { platform, id } = parseEntry(state.activeChat);
    let url = null;
    if (platform === 'tw') url = `https://www.twitch.tv/popout/${id}/chat`;
    else if (platform === 'yt' && !isYtChannel(id)) url = `https://www.youtube.com/live_chat?is_popout=1&v=${id}`;
    else if (platform === 'kick') url = `https://kick.com/popout/${id}/chat`;
    if (url) window.open(url, '_blank', 'noopener,width=400,height=720');
    else toast('このチャットはポップアウトに対応していません', 'error');
  });
  btn.fs.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () =>
    btn.fs.setAttribute('aria-pressed', String(!!document.fullscreenElement)));

  btn.help.addEventListener('click', () => helpDlg.showModal());
  btn.helpClose.addEventListener('click', () => helpDlg.close());
  helpDlg.addEventListener('click', (e) => {
    if (e.target === helpDlg) helpDlg.close();
  });

  btn.presets.addEventListener('click', () => togglePresetsPop());
  btn.presetSave.addEventListener('click', () => {
    if (!state.channels.length) { toast('保存する配信がありません', 'error'); return; }
    const input = $('#preset-name');
    const name = input.value.trim() || state.channels.map(displayName).join(' + ').slice(0, 40);
    const ps = getPresets();
    ps.unshift({ name, channels: [...state.channels] });
    lsSet(LS.presets, ps.slice(0, 20));
    input.value = '';
    renderPresets();
    toast(`プリセット「${name}」を保存しました`, 'accent');
  });

  // compactモード: ハンドルでツールバーを開閉
  $('#tb-toggle').addEventListener('click', () =>
    document.body.classList.toggle('tb-open'));

  // 横画面推奨ヒント: タップで全画面（+横画面ロック）、×で閉じる
  rotateHint.addEventListener('click', () => toggleFullscreen());
  $('#rotate-hint-close').addEventListener('click', (e) => {
    e.stopPropagation();
    dismissRotateHint();
  });

  // ポップオーバー等の外側クリックで閉じる
  document.addEventListener('pointerdown', (e) => {
    if (!presetsPop.classList.contains('hidden') &&
        !e.target.closest('#presets-pop, #presets-btn')) {
      togglePresetsPop(false);
    }
    if (document.body.classList.contains('tb-open') &&
        !e.target.closest('#toolbar, #tb-toggle')) {
      document.body.classList.remove('tb-open');
    }
  });
}

function wireResizer() {
  resizer.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    resizer.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startW = state.chatWidth;
    document.body.classList.add('resizing');
    const onMove = (ev) => {
      state.chatWidth = clamp(startW + (startX - ev.clientX), 280, 520);
      chatPanel.style.width = state.chatWidth + 'px';
    };
    const onUp = () => {
      resizer.removeEventListener('pointermove', onMove);
      resizer.removeEventListener('pointerup', onUp);
      resizer.removeEventListener('pointercancel', onUp);
      document.body.classList.remove('resizing');
      saveSession();
    };
    resizer.addEventListener('pointermove', onMove);
    resizer.addEventListener('pointerup', onUp);
    resizer.addEventListener('pointercancel', onUp);
  });
}

function wireKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (document.querySelector('dialog[open]')) return;
    const k = e.key;
    if (k >= '1' && k <= '9') {
      const key = state.channels[Number(k) - 1];
      if (key) setAudible(state.audibleName === key ? null : key);
    } else if (k === 'm' || k === 'M') {
      setAudible(null);
    } else if (k === 'c' || k === 'C') {
      toggleChat();
    } else if (k === 'f' || k === 'F') {
      toggleFullscreen();
    } else if (k === 'g' || k === 'G') {
      setLayout(state.layout === 'grid' ? 'focus' : 'grid');
    } else if (k === '?') {
      helpDlg.showModal();
    } else if (k === 'Escape') {
      togglePresetsPop(false);
      hideSuggest();
    }
  });
}

// ---------------------------------------------------------------- init
function init() {
  const sess = lsGet(LS.session, null);
  if (sess) {
    if (sess.layout === 'focus' || sess.layout === 'grid') state.layout = sess.layout;
    if (typeof sess.chatOpen === 'boolean') state.chatOpen = sess.chatOpen;
    if (typeof sess.chatWidth === 'number') state.chatWidth = clamp(sess.chatWidth, 280, 520);
    if (typeof sess.focusName === 'string') state.focusName = normalizeKey(sess.focusName);
  }
  chatPanel.style.width = state.chatWidth + 'px';
  document.body.classList.toggle('chat-open', state.chatOpen);
  btn.chat.setAttribute('aria-pressed', String(state.chatOpen));
  btn.layoutGrid.setAttribute('aria-pressed', String(state.layout === 'grid'));
  btn.layoutFocus.setAttribute('aria-pressed', String(state.layout === 'focus'));
  if (vpW() < 720) {
    addInput.placeholder = 'チャンネル名 / URL を追加';
  }

  wireToolbar();
  wireResizer();
  wireKeyboard();

  const fromHash = readHash();
  const initial = fromHash.length
    ? fromHash
    : (sess && Array.isArray(sess.channels) ? sess.channels : []);
  syncFromNames(initial);
  const savedChat = sess && normalizeKey(sess.activeChat);
  if (savedChat && state.channels.includes(savedChat)) {
    setActiveChat(savedChat);
  }
  renderRecent();

  window.addEventListener('hashchange', () => {
    const names = readHash();
    if (names.join('/') !== state.channels.join('/')) syncFromNames(names);
  });

  new ResizeObserver(() => relayout(false)).observe(stage);
  new ResizeObserver(() => fitYtChats()).observe(chatFramesEl);
  new ResizeObserver(() => relayout(false)).observe(document.documentElement);
  // ResizeObserverが拾えないケース（画面回転・表示モード切替等）の保険
  window.addEventListener('resize', () => relayout(false));

  if (!window.Twitch) {
    whenTwitchReady(() => {}, () =>
      toast('Twitchプレーヤーの読み込みに失敗しました。ネットワーク接続を確認してください。', 'error', 6000));
  }
}

init();

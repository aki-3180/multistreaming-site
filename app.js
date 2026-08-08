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
let GAP = 6; // compactモードではさらに詰める（relayoutで更新）
// ヘッダー高さはCSSのメディアクエリ側で決まるので、実測してレイアウト計算に使う。
// 定数で持つとポインタ種別の判定タイミング次第で実際とずれ、タイルに死に領域ができる。
let HEAD_H = 30;
const isCoarse = () => window.matchMedia && matchMedia('(pointer: coarse)').matches;
// ホーム画面から起動した「アプリ」として動いているか（iOS/Android両対応）
const isStandalone = () =>
  (window.matchMedia && matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)').matches) ||
  window.navigator.standalone === true;

function measureHeadH() {
  const el = tileEls.values().next().value;
  if (!el) { HEAD_H = isCoarse() ? 36 : 30; return; }
  const head = el.querySelector('.tile-head');
  // 映像に重ねて表示しているときはレイアウト上の高さを占有しない
  HEAD_H = getComputedStyle(head).position === 'absolute' ? 0 : head.offsetHeight;
}
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
  lock: '<svg viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="9.5" rx="2.4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.2 10.5V7.2a3.8 3.8 0 0 1 7.6 0v3.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  unlock: '<svg viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="9.5" rx="2.4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.2 10.5V7.2a3.8 3.8 0 0 1 7.2-1.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
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
const qualityPop = $('#quality-pop');
const qualityList = $('#quality-list');
const keepAliveItem = $('#keepalive-item');
const keepAliveNa = $('#keepalive-na');
const btn = {
  layoutGrid: $('#layout-grid-btn'),
  layoutFocus: $('#layout-focus-btn'),
  mute: $('#mute-btn'),
  quality: $('#quality-btn'),
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
  quality: 'auto',
  keepAlive: false,    // バックグラウンドでも再生を止めない（実験的・keepAliveActive 参照）
};

// 画質。過剰な解像度はデコード負荷＝発熱の主因だが、画質の指定は
// 再生セッションの作り直しを伴う（実測でPAUSE→PLAYが発火する）ため、
// Twitchでは指定するたびに広告が入り直しうる。既定では触らない。
const QUALITY_OPTIONS = [
  { id: 'auto', label: '自動（推奨）', desc: '配信側の自動選択に任せる。広告が増えません' },
  { id: 'source', label: '最高画質', desc: '配信元のまま。負荷は最大' },
  { id: '720', label: '高画質 720p', desc: '' },
  { id: '480', label: '標準 480p', desc: '' },
  { id: '360', label: '軽量 360p', desc: '発熱と電池消費を抑える' },
  { id: '160', label: '最軽量 160p', desc: '多数の配信でも軽い' },
];

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
    // 復元時に「どれを聞いていたか」まで戻す（適用は初回タップ後・下記 pendingAudible）
    audibleName: state.audibleName || pendingAudible,
    chatOpen: state.chatOpen,
    activeChat: state.activeChat,
    chatWidth: state.chatWidth,
    quality: state.quality,
    keepAlive: state.keepAlive,
  });
}

// 保存領域が「容量逼迫時に消してよいデータ」扱いだと、しばらく開かないだけで
// 前回の構成が消える。アプリとして常用するので永続化を要求しておく。
async function requestPersistentStorage() {
  if (!navigator.storage || !navigator.storage.persist) return;
  try {
    if (await navigator.storage.persisted()) return;
    await navigator.storage.persist();
  } catch { /* ignore */ }
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
        const m = state.audibleName !== key;
        try { player.setMuted(m); } catch { /* ignore */ }
        nativeMuted.set(key, m);
        muteSettleAt.set(key, performance.now() + MUTE_SETTLE_MS);
        // 音量まわり（バックグラウンド維持）は再生が始まってから適用する。
        // ただし維持モードを使っていないときは上の setMuted だけで足りている。
        // 操作から切り離されたタイミングでのミュート解除は、iOSでは自動再生の
        // 判定に引っかかって再生が止まり得る（＝再開時に広告になる）ので呼ばない。
        setTimeout(() => {
          if (players.get(key) !== player || !keepAliveActive()) return;
          applyMute(key, state.audibleName !== key);
        }, MUTE_SETTLE_MS);
      });
      player.addEventListener(P.ONLINE, () => setStatus(key, 'live'));
      player.addEventListener(P.PAUSE, () => notePlayerPaused(key));
      // PLAYINGは広告の再生開始でも発火する。ここで画質を変えると広告が作り直されて
      // 先に進まなくなるため、画質の適用はここでは行わない。
      player.addEventListener(P.PLAYING, () => setStatus(key, 'live'));
      player.addEventListener(P.OFFLINE, () => setStatus(key, 'offline'));
      scheduleInitialQuality(key);
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
  if (platform === 'yt') {
    f.addEventListener('load', () => {
      applyQuality(key);
      // プレーヤーの準備が整う前の宣言は無視されるので数回試す
      ytListen(f);
      setTimeout(() => ytListen(f), 1200);
      setTimeout(() => ytListen(f), 4000);
      muteSettleAt.set(key, performance.now() + MUTE_SETTLE_MS);
      // 維持モードのときだけ音量を触る（理由はTwitch側の同じ箇所を参照）
      setTimeout(() => {
        if (playerFrames.get(key) !== f || !keepAliveActive()) return;
        applyMute(key, state.audibleName !== key);
      }, MUTE_SETTLE_MS);
    });
  }
  nativeMuted.set(key, muted);
  host.appendChild(f);
  playerFrames.set(key, f);
}

// スマホのブラウザは一時停止した動画のデコーダとバッファを手放すため、再開が
// 「新しい視聴の開始」になり、Twitchでは毎回プリロール広告が入る。
// PCはプレーヤーが再生位置を保持するので同じ操作でも広告にならない（実測）。
// 気づかずに繰り返すと広告だらけになるので、一度だけ案内する。
let pauseHintShown = false;
let pauseHintMutedUntil = 0;

const mutePauseHint = (ms = 6000) => {
  pauseHintMutedUntil = Math.max(pauseHintMutedUntil, performance.now() + ms);
};

function notePlayerPaused(key) {
  if (pauseHintShown || !isCoarse()) return;
  // 自分で作り直したとき・バックグラウンド化で止まったときは案内しない
  if (document.hidden || performance.now() < pauseHintMutedUntil) return;
  if (!state.channels.includes(key)) return;
  pauseHintShown = true;
  toast('一時停止すると再開時に広告が入ります。音を止めるだけならスピーカーボタンを使ってください', 'accent', 6000);
}

function reloadPlayer(key) {
  const el = tileEls.get(key);
  if (!el) return;
  mutePauseHint();
  const body = $('.tile-body', el);
  const old = $('.player-host', body);
  if (old) old.remove();
  players.delete(key);
  playerFrames.delete(key);
  appliedQuality.delete(key);
  nativeMuted.delete(key);
  ytVolume.delete(key);
  ytPaused.delete(key);
  muteSettleAt.delete(key);
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
      <button class="t-btn b-touch" title="プレーヤーを直接操作する">${ICONS.lock}</button>
      <button class="t-btn b-chat" title="この配信のチャットを表示">${ICONS.chat}</button>
      <button class="t-btn b-focus" title="拡大表示（フォーカス）">${ICONS.maximize}</button>
      <button class="t-btn b-reload" title="プレーヤーを再読み込み">${ICONS.reload}</button>
      <button class="t-btn b-pop" title="配信サイトで開く">${ICONS.ext}</button>
      <button class="t-btn b-close" title="この配信を閉じる">${ICONS.x}</button>
    </div>
    <div class="tile-body">
      <div class="player-host" id="${domId(key)}"></div>
      <div class="tap-shield" aria-hidden="true"></div>
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
  $('.b-touch', el).addEventListener('click', () => setTouchThrough(key, !touchThrough.has(key)));

  // --- タッチ端末: 映像を触っただけで配信サイトへ飛ばされるのを防ぐ
  $('.tap-shield', el).addEventListener('pointerdown', () => revealHead(key));

  // --- ドラッグで並べ替え（Pointer Events: マウス・タッチ両対応）
  const head = $('.tile-head', el);
  wireTileDrag(el, head, key);
  head.addEventListener('pointerdown', () => revealHead(key));
  head.addEventListener('dblclick', (e) => {
    if (!e.target.closest('.t-btn')) toggleFocusTile(key);
  });

  stage.appendChild(el);
  tileEls.set(key, el);
  setStatus(key, 'loading');
  // 追加直後は操作できるようヘッダーを一度出す（compactでは通常隠れているため）
  revealHead(key);
  createPlayer(key);
}

// ---------------------------------------------------------------- 誤操作の防止
// 映像そのものはリンクになっていて、軽く触れる/クリックするだけで配信サイトへ
// 遷移してしまう。透明なシールドで覆い、操作はこちらのUIだけに届くようにする。
// （プレーヤー内蔵のミュートボタンが効かなくなるので、こちら側のミュートと
//   二重になって状態が食い違う問題も同時に解消される）
const touchThrough = new Set();
const touchThroughTimers = new Map();
// タッチでは指が触れただけで発動するため、開けっぱなしにせず自動で閉じる。
// マウスは意図しないと押さないので、明示的に戻すまで開けたままにする。
const TOUCH_THROUGH_MS = 30000;
let touchThroughHinted = false;

function setTouchThrough(key, on) {
  const el = tileEls.get(key);
  if (!el) return;
  clearTimeout(touchThroughTimers.get(key));
  touchThroughTimers.delete(key);
  if (on) {
    touchThrough.add(key);
    const auto = isCoarse();
    if (auto) {
      touchThroughTimers.set(key, setTimeout(() => setTouchThrough(key, false), TOUCH_THROUGH_MS));
    }
    if (!touchThroughHinted) {
      touchThroughHinted = true;
      toast(auto
        ? 'プレーヤーを直接操作できます（30秒で自動的に戻ります）'
        : 'プレーヤーを直接操作できます。同じボタンで誤クリック防止に戻せます', 'accent', 4200);
    }
  } else {
    touchThrough.delete(key);
  }
  el.classList.toggle('touch-through', on);
  const b = $('.b-touch', el);
  b.classList.toggle('on', on);
  b.innerHTML = on ? ICONS.unlock : ICONS.lock;
  b.title = on ? 'タップの誤操作防止に戻す' : 'プレーヤーを直接操作する';
  if (on) revealHead(key);
}

function lockAllTouchThrough() {
  for (const key of [...touchThrough]) setTouchThrough(key, false);
}

// compact（横持ちなど低い画面）ではヘッダーが映像に重なって視界に入るので、
// 普段は隠しておき、枠を触ったときだけ出す。
const HEAD_SHOW_MS = 3000;
const headShowTimers = new Map();

function revealHead(key) {
  const el = tileEls.get(key);
  if (!el) return;
  el.classList.add('head-show');
  clearTimeout(headShowTimers.get(key));
  headShowTimers.set(key, setTimeout(() => {
    headShowTimers.delete(key);
    // 直接操作中はヘッダーが唯一の戻り道なので出したままにする
    if (!touchThrough.has(key)) el.classList.remove('head-show');
  }, HEAD_SHOW_MS));
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
        // ドラッグ中にヘッダーの自動非表示が走ると掴んでいる対象が消えてしまう
        clearTimeout(headShowTimers.get(key));
        headShowTimers.delete(key);
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
      revealHead(key);
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
// 音量0のままミュートだけ解除しても無音のままで「ボタンは点いているのに聞こえない」
// 状態になる。プレーヤー内蔵UIで0まで絞られている場合があるので必ず戻す。
const MIN_AUDIBLE_VOLUME = 0.5;
const savedVolume = new Map();  // key -> 無音化する前の音量（可聴に戻すとき復元）

// --- バックグラウンド維持（実験的・既定オフ） -----------------------------
// Twitchは「再生が止まって再開する」たびにプリロール広告を挿しこむ。これは
// 配信元の仕組みなので埋め込み側からは消せない。できるのは止めないことだけ。
//
// ブラウザは画面が隠れると「無音の動画」を省電力のために一時停止する。この判定は
// 実効音量（muted なら0、それ以外は volume）が0かどうかで行われるため、
// 単にミュートを外して音量0にするだけでは止められる（実測でも音量0のままなら
// 自動再生ブロックが働かない＝ブラウザは無音と見なしている）。
// 止めさせないためには、聞こえないほど小さくても音量を0より上にする必要がある。
//
// 代償として音声フォーカスを取るので、他アプリの音楽が止まることがある。
// 通信量と電池も使う。効くかどうかも端末とブラウザ次第。既定オフの理由。
const KEEPALIVE_VOLUME = 0.001; // 約-60dB。実質無音
// iOSは volume の変更を無視する（＝全部の音が鳴ってしまう）ため対象外。
// そもそもアプリを離れると全て止まるので効果もない。
const isIOS = () =>
  /iP(hone|od|ad)/.test(navigator.platform || '') ||
  (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

// バックグラウンドが長引いたら通信と電池を無駄にするだけなので、素直に手放す
const KEEPALIVE_RELEASE_MS = 300000;
let keepAliveReleased = false;
let keepAliveReleaseTimer = null;
let hasUserGesture = false;

// ミュート解除には（自動再生ブロックを避けるため）一度の操作が必要
const keepAliveActive = () =>
  state.keepAlive && hasUserGesture && !keepAliveReleased && !isIOS();

function disableKeepAlive(reason) {
  state.keepAlive = false;
  saveSession();
  renderQuality();
  applyAudioStates();
  if (reason) toast(reason, 'error', 5000);
}

// 音量指定が効かない環境では全ての配信から音が出てしまう。反映を実測して、
// 効いていなければミュートへ戻す。
const silentKeys = new Set();
let verifyTimer = null;

function verifyKeepAlive() {
  if (!keepAliveActive()) return;
  for (const key of silentKeys) {
    const p = players.get(key);
    if (!p || key === state.audibleName) continue;
    let v;
    // 再生していないプレーヤーは設定前の音量を返し続けるので判定に使えない
    // （音が漏れる心配も無い）
    try { if (p.isPaused()) continue; v = p.getVolume(); } catch { continue; }
    if (typeof v === 'number' && v > 0.05) {
      disableKeepAlive('この端末では音量を絞れないため、バックグラウンド維持をオフにしました');
      return;
    }
  }
}

function applyMute(key, muted) {
  const { platform } = parseEntry(key);
  // muted かつ維持モードのときは「聞こえない音量で再生を続ける」
  const silent = muted && keepAliveActive() && platform !== 'kick';
  const wasSilent = silentKeys.has(key);
  if (silent) silentKeys.add(key); else silentKeys.delete(key);

  if (platform === 'tw') {
    const p = players.get(key);
    if (p) {
      try {
        // 維持中の極小音量を「元の音量」として覚えてしまわないよう除外する
        const cur = p.getVolume();
        if (!wasSilent && cur > 0) savedVolume.set(key, cur);
        const restore = savedVolume.get(key) || MIN_AUDIBLE_VOLUME;
        if (silent) {
          p.setVolume(KEEPALIVE_VOLUME);
          p.setMuted(false);
        } else if (muted) {
          p.setMuted(true);
          if (wasSilent) p.setVolume(restore);
        } else {
          p.setMuted(false);
          // 読み値の反映が遅れるので、維持状態から戻すときは無条件に復元する
          if (wasSilent || cur === 0) p.setVolume(restore);
        }
      } catch { /* ignore */ }
    }
  } else if (platform === 'yt') {
    const f = playerFrames.get(key);
    if (f && f.contentWindow) {
      const cur = ytVolume.get(key);
      if (!wasSilent && cur > 0) savedVolume.set(key, cur);
      const restore = savedVolume.get(key) || MIN_AUDIBLE_VOLUME * 100;
      if (silent) {
        ytPost(f, 'setVolume', [KEEPALIVE_VOLUME * 100]);
        ytPost(f, 'unMute');
      } else {
        ytPost(f, muted ? 'mute' : 'unMute');
        if (wasSilent || cur === 0) ytPost(f, 'setVolume', [restore]);
      }
    }
  } else if (platform === 'kick') {
    // Kickは実行時の音声APIが無いため、ミュート状態が変わったらパラメータを変えて再読込
    const f = playerFrames.get(key);
    if (f && f.dataset.muted !== String(muted)) {
      f.dataset.muted = String(muted);
      f.src = kickSrc(parseEntry(key).id, muted);
    }
  }
  nativeMuted.set(key, muted);
}

function applyAudioStates() {
  muteWriteAt = performance.now();
  for (const k of state.channels) applyMute(k, k !== state.audibleName);
  // 反映を待ってから検証する（プレーヤーのAPIは非同期に反映される）
  clearTimeout(verifyTimer);
  verifyTimer = setTimeout(verifyKeepAlive, 2000);
}

function setAudible(key) {
  state.audibleName = key;
  applyAudioStates();
  updateAudibleUI();
  saveSession();
}

function setKeepAlive(on) {
  state.keepAlive = on;
  keepAliveReleased = false;
  clearTimeout(keepAliveReleaseTimer);
  renderQuality();
  applyAudioStates();
  saveSession();
  toast(on ? 'バックグラウンドでも再生を維持します' : 'バックグラウンドでは再生を止めます', 'accent');
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

// --- プレーヤー内蔵のミュートボタンとの同期 -------------------------------
// 埋め込みプレーヤー側にもミュートボタンがあり、そちらで操作されるとこちらの
// 表示と実際の音声がずれる（両方鳴る / ボタンは点いているのに無音、など）。
// 実際の状態を読み取り、食い違っていたら「最後に操作されたほう」に合わせる。
const nativeMuted = new Map();   // key -> 実際にミュートされているか
const ytVolume = new Map();      // key -> YouTubeの音量(0-100)
const ytPaused = new Map();      // key -> YouTubeが一時停止中か
const muteSettleAt = new Map();  // key -> この時刻までの読み値は初期化中とみなす
let muteWriteAt = 0;             // こちらから書き込んだ直後は読み値が追いつかない

const MUTE_SYNC_MS = 900;
const MUTE_WRITE_GRACE_MS = 1500;
// 初期化中のプレーヤーは一時的に不正確な値を返す。これを「ユーザーが操作した」と
// 誤認して勝手に音を出さないよう、落ち着くまで読み値を採用しない。
const MUTE_SETTLE_MS = 2500;
let muteSyncTimer = null;

function ytPost(frame, func, args = []) {
  if (!frame || !frame.contentWindow) return;
  try {
    frame.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func, args }), '*');
  } catch { /* ignore */ }
}

// infoDelivery（音量・ミュート状態の通知）を受け取るには購読を宣言する必要がある
function ytListen(frame) {
  if (!frame || !frame.contentWindow) return;
  try {
    frame.contentWindow.postMessage(
      JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
  } catch { /* ignore */ }
}

function keyOfSource(source) {
  for (const [k, f] of playerFrames) if (f.contentWindow === source) return k;
  return null;
}

function onFrameMessage(e) {
  if (!/^https:\/\/(www\.)?youtube(-nocookie)?\.com$/.test(e.origin)) return;
  let d;
  try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
  if (!d || !d.info) return;
  const key = keyOfSource(e.source);
  if (!key) return;
  // playerState: 1=再生中 2=一時停止（復帰時に勝手に再開させないための判定材料）
  if (typeof d.info.playerState === 'number') ytPaused.set(key, d.info.playerState === 2);
  if (typeof d.info.volume === 'number') ytVolume.set(key, d.info.volume);
  if (typeof d.info.muted === 'boolean' || typeof d.info.volume === 'number') {
    // iOSは音量がハード側の管理でプログラムから動かせないため、音量0を
    // ミュート扱いにする判定は成立しない（pollNativeMute と同じ理由）
    const vol = ytVolume.get(key);
    const muted = d.info.muted === true || (!isIOS() && vol === 0);
    nativeMuted.set(key, muted);
    reconcileMute(key, muted);
  }
}

// プレーヤー側が「ミュート解除された」状態なら、その配信を聞きたいという意思表示
// とみなして音声ソロ切替を追従させる（逆にミュートされたら全ミュート扱い）。
function reconcileMute(key, muted) {
  if (performance.now() - muteWriteAt < MUTE_WRITE_GRACE_MS) return;
  if (performance.now() < (muteSettleAt.get(key) || Infinity)) return;
  if (!state.channels.includes(key)) return;
  const expected = state.audibleName !== key;
  if (muted === expected) return;
  if (!muted) setAudible(key);
  else if (state.audibleName === key) setAudible(null);
}

function pollNativeMute() {
  if (document.hidden) return;
  if (performance.now() - muteWriteAt < MUTE_WRITE_GRACE_MS) return;
  // iOSは音量をプログラムから変えられず（ハード音量のみ）、スライダーも無い。
  // 「音量0まで絞られた＝実質ミュート」という判定はそもそも成立しないので使わない。
  // 読み値が0を返す実装に当たると、音声ONの枠を勝手に落としてしまうため。
  const useVolume = !isIOS();
  for (const [key, p] of players) {
    let muted;
    try { muted = p.getMuted() === true || (useVolume && p.getVolume() === 0); } catch { continue; }
    if (nativeMuted.get(key) === muted) continue;
    nativeMuted.set(key, muted);
    reconcileMute(key, muted);
  }
}

function startMuteSync() {
  if (muteSyncTimer) return;
  // TwitchのAPIにはミュート変更イベントが無いため、ごく軽いポーリングで拾う
  muteSyncTimer = setInterval(pollNativeMute, MUTE_SYNC_MS);
}

// ---------------------------------------------------------------- quality
// 表示サイズより高い解像度で再生してもCPU/GPUを浪費するだけなので、
// 指定された高さ（CSSピクセル）を満たす最小の画質を選ぶ。
// 「自動」では applyQuality が何もしないため、ここに来るのは明示指定のときだけ。
function targetHeight() {
  return state.quality === 'source' ? Infinity : Number(state.quality);
}

// setQuality はプレーヤーの再生を作り直すため、呼ぶたびにプリロール広告が
// 再生され得る。同じ画質を選び直したときは触らないよう、適用済みを覚えておく。
const appliedQuality = new Map();

function applyQuality(key) {
  const { platform } = parseEntry(key);

  // 「自動」では画質に一切触らない。setQuality はPCでもスマホでも再生を破棄して
  // 作り直す（実測で PAUSE → PLAY が発火する）ので、Twitchでは呼ぶたびに
  // 広告が入り直しうる。発熱対策で解像度を下げたい場合は明示的に選んでもらう。
  if (state.quality === 'auto') {
    if (platform === 'tw') {
      const prev = appliedQuality.get(key);
      const p = players.get(key);
      // 以前に固定した画質が残っている場合だけ、配信側の自動選択に戻す
      if (p && prev && prev !== 'auto') {
        try { mutePauseHint(); p.setQuality('auto'); appliedQuality.set(key, 'auto'); } catch { /* ignore */ }
      }
    }
    return;
  }

  const target = targetHeight();

  if (platform === 'tw') {
    const p = players.get(key);
    if (!p) return;
    let list;
    try { list = p.getQualities(); } catch { return; }
    if (!list || !list.length) return;
    const usable = list
      .filter((q) => q.group && q.group !== 'auto' && q.height)
      .sort((a, b) => a.height - b.height);
    if (!usable.length) return;
    // 少し下回る程度なら見た目の差は小さいので、上の画質へ飛ばさず負荷を優先する
    const floor = target * 0.85;
    const pick = usable.find((q) => q.height >= floor) || usable[usable.length - 1];
    if (appliedQuality.get(key) === pick.group) return;
    try {
      mutePauseHint(); // setQuality は再生を作り直すので PAUSE が発火する
      p.setQuality(pick.group);
      appliedQuality.set(key, pick.group);
    } catch { /* ignore */ }
  } else if (platform === 'yt') {
    const f = playerFrames.get(key);
    if (!f || !f.contentWindow) return;
    const yq = target >= 1080 ? 'hd1080'
      : target >= 720 ? 'hd720'
      : target >= 480 ? 'large'
      : target >= 360 ? 'medium' : 'small';
    f.contentWindow.postMessage(JSON.stringify({
      event: 'command', func: 'setPlaybackQuality', args: [yq],
    }), '*');
  }
  // Kickのプレーヤーには画質APIが無いため対象外
}

// 画質の自動適用はプレーヤーごとに一度だけ、しかもプリロール広告が終わるころまで
// 待ってから行う。広告の再生中にsetQualityを呼ぶと広告そのものが作り直され、
// カウントダウンが進まないまま配信を視聴できなくなるため。
const QUALITY_INIT_DELAY_MS = 30000;
const qualityInitTimers = new Map();

function scheduleInitialQuality(key) {
  cancelInitialQuality(key);
  qualityInitTimers.set(key, setTimeout(() => {
    qualityInitTimers.delete(key);
    applyQuality(key);
  }, QUALITY_INIT_DELAY_MS));
}

function cancelInitialQuality(key) {
  clearTimeout(qualityInitTimers.get(key));
  qualityInitTimers.delete(key);
}

function setQuality(id) {
  state.quality = id;
  renderQuality();
  state.channels.forEach(applyQuality);
  saveSession();
  const opt = QUALITY_OPTIONS.find((o) => o.id === id);
  if (opt) toast(`画質: ${opt.label}`, 'accent');
}

function renderQuality() {
  const unavailable = isIOS();
  keepAliveItem.classList.toggle('active', state.keepAlive && !unavailable);
  keepAliveItem.setAttribute('aria-checked', String(state.keepAlive && !unavailable));
  keepAliveItem.disabled = unavailable;
  keepAliveNa.hidden = !unavailable;

  qualityList.innerHTML = '';
  for (const opt of QUALITY_OPTIONS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'q-item' + (state.quality === opt.id ? ' active' : '');
    b.innerHTML = `<svg class="q-check" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const text = document.createElement('div');
    text.className = 'q-text';
    const label = document.createElement('div');
    label.className = 'q-label';
    label.textContent = opt.label;
    text.appendChild(label);
    if (opt.desc) {
      const desc = document.createElement('div');
      desc.className = 'q-desc';
      desc.textContent = opt.desc;
      text.appendChild(desc);
    }
    b.appendChild(text);
    b.addEventListener('click', () => {
      setQuality(opt.id);
      toggleQualityPop(false);
    });
    qualityList.appendChild(b);
  }
}

function toggleQualityPop(force) {
  const show = force !== undefined ? force : qualityPop.classList.contains('hidden');
  qualityPop.classList.toggle('hidden', !show);
  if (show) {
    togglePresetsPop(false);
    renderQuality();
  }
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
  fitChatFrames();
}

// パネルが狭いと、チャット内の固定UI（上部バナー・下部の入力欄）が縦を占有して
// コメントがほとんど残らない。基準幅でレンダリングしてパネルサイズまで縮小表示すると、
// 固定UIごと小さくなり同じ面積に多くのコメントが入る（iOSでの横見切れも防げる）。
const CHAT_BASE_W = 330;
// 埋め込みチャットには内部の最小幅があり、これを下回る論理幅で描画すると
// 右端（YouTubeなら絵文字・送信ボタンやメニュー）がはみ出して見切れる。
// 縮小率の下限で論理幅が痩せないよう、プラットフォームごとに必要幅を持つ。
const CHAT_LOGICAL_W = { yt: 380, tw: 330, kick: 330 };
const CHAT_MIN_SCALE = 0.4;

function fitChatFrames() {
  const w = chatFramesEl.clientWidth;
  const h = chatFramesEl.clientHeight;
  if (!w || !h) return;
  chatFramesEl.querySelectorAll('iframe.chat-frame').forEach((f) => {
    const base = CHAT_LOGICAL_W[parseEntry(f.dataset.name).platform] || CHAT_BASE_W;
    const scale = clamp(w / base, CHAT_MIN_SCALE, 1);
    if (scale >= 1) {
      f.style.width = '';
      f.style.height = '';
      f.style.transform = '';
      f.style.transformOrigin = '';
      return;
    }
    f.style.width = Math.round(w / scale) + 'px';
    f.style.height = Math.round(h / scale) + 'px';
    f.style.transform = `scale(${scale})`;
    f.style.transformOrigin = 'top left';
  });
}

// 隠れているチャットも裏で更新され続けてメモリとCPUを食う（モバイルの発熱要因）。
// 一定時間表示されなかったものは破棄し、再表示時に読み込み直す。
// タブを行き来する操作で毎回リロードしないよう、少し猶予を置く。
const CHAT_RELEASE_MS = 20000;
// ただしアプリとして常用する場合、破棄＝再読込のたびにログイン状態を確立し直す
// ことになる（サードパーティCookieが制限された環境では特に不安定）。
// ホーム画面から起動しているときは長めに保持してログインを維持しやすくする。
const CHAT_RELEASE_APP_MS = 180000;
const chatReleaseTimers = new Map();

const chatReleaseMs = () => (isStandalone() ? CHAT_RELEASE_APP_MS : CHAT_RELEASE_MS);

function cancelChatRelease(key) {
  clearTimeout(chatReleaseTimers.get(key));
  chatReleaseTimers.delete(key);
}

function scheduleChatRelease(key) {
  if (chatReleaseTimers.has(key)) return;
  chatReleaseTimers.set(key, setTimeout(() => {
    chatReleaseTimers.delete(key);
    if (state.activeChat === key) return;
    // バックグラウンド中の破棄は「復帰したら全部読み込み直し」になるだけで
    // 得が無いので、戻ってきてから改めて数える
    if (document.hidden) { scheduleChatRelease(key); return; }
    const f = chatEls.get(key);
    if (f) f.remove();
    chatEls.delete(key);
  }, chatReleaseMs()));
}

function setActiveChat(key) {
  state.activeChat = key;
  if (key) {
    cancelChatRelease(key);
    ensureChatFrame(key);
  }
  for (const [k, f] of chatEls) {
    const on = k === key;
    f.classList.toggle('active', on);
    if (!on) scheduleChatRelease(k);
  }
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
  GAP = compact ? 5 : 6;
  document.body.classList.toggle('compact', compact);
  // タッチ端末向けの挙動（タップシールド・ヘッダー自動非表示）はCSS側で分岐する
  document.body.classList.toggle('touch', isCoarse());
  // ヘッダーの扱いは compact 状態で変わるので、クラス適用後に測る
  measureHeadH();
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

  // パネル寸法を変えた直後に縮小率を取り直す（ResizeObserver待ちだと一瞬ずれる）
  fitChatFrames();
  // ※ ここで画質を選び直さないこと。setQualityは再生を作り直すため、
  //    リサイズのたびに呼ぶと広告が延々と最初に戻る。
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
  appliedQuality.delete(key);
  cancelInitialQuality(key);
  tileStatus.delete(key);
  const f = chatEls.get(key);
  if (f) f.remove();
  chatEls.delete(key);
  cancelChatRelease(key);
  nativeMuted.delete(key);
  ytVolume.delete(key);
  ytPaused.delete(key);
  muteSettleAt.delete(key);
  savedVolume.delete(key);
  silentKeys.delete(key);
  touchThrough.delete(key);
  clearTimeout(touchThroughTimers.get(key));
  touchThroughTimers.delete(key);
  clearTimeout(headShowTimers.get(key));
  headShowTimers.delete(key);
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
  updateWakeLock();
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
  if (show) {
    toggleQualityPop(false);
    renderPresets();
  }
}

// ---------------------------------------------------------------- ログインとCookieの案内
// 埋め込みプレーヤーは別サイト扱いなので、サードパーティCookieが通らないと
// Twitchにログイン済みでも匿名視聴者になり、Turbo・サブスクの広告非表示が効かない。
// 実際にCookieが通っているかはページ側から測れない（他オリジンのiframeの中は読めず、
// requestStorageAccessFor は Related Website Sets 専用で twitch.tv には使えない）。
// 測れない以上、ブラウザごとの既定の挙動と設定手順を正しく出すことに徹する。
function browserKind() {
  const ua = navigator.userAgent;
  if (isIOS()) return /CriOS|FxiOS|EdgiOS/.test(ua) ? 'ios-other' : 'safari-ios';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Edg\//.test(ua)) return 'chromium';
  if (/Chrome\/|Chromium\//.test(ua)) return 'chromium';
  if (/Safari\//.test(ua)) return 'safari';
  return 'other';
}

const COOKIE_GUIDE = {
  chromium: {
    title: 'Chrome / Edge',
    state: '既定ではサードパーティCookieは許可されています。ブロック設定にしている場合のみ、下記の変更が必要です。',
    steps: [
      'アドレスバー右端の目のアイコン →「サードパーティCookieを許可」',
      'または 設定 → プライバシーとセキュリティ → サードパーティのCookie →「Cookieの使用を許可するサイト」に <code>[*.]twitch.tv</code> を追加',
    ],
  },
  firefox: {
    title: 'Firefox',
    state: '強化型トラッキング防止により、サードパーティCookieはサイトごとに分離されます（既定で埋め込みにログインが通りません）。',
    steps: ['アドレスバーの盾アイコン →「このサイトでは保護を無効にする」'],
  },
  'safari-ios': {
    title: 'Safari（iPhone / iPad）',
    state: 'iOSはサードパーティのCookieと保存領域を既定で遮断します。埋め込みプレーヤーは「前に広告を出した」といった記録すら残せないため、再生を開始するたびに新規視聴として扱われます。',
    steps: [
      '設定アプリ → Safari →「サイト越えトラッキングを防ぐ」を<b>オフ</b>',
      '変更後、下の「すべて再読み込み」を実行',
      'ホーム画面のアプリとして使っている場合、<b>Safariとは別の保存領域</b>になります。Safariでログイン済みでもアプリ内では別扱いなので、アプリの中のチャットから改めてログインしてください',
      'それでも変わらないときは、埋め込みでは打つ手がありません。枠の「配信サイトで開く」からTwitchアプリで見てください',
    ],
  },
  safari: {
    title: 'Safari（Mac）',
    state: 'サードパーティCookieは既定でブロックされます。',
    steps: ['Safari → 設定 → プライバシー →「サイト越えトラッキングを防ぐ」のチェックを外す'],
  },
  'ios-other': {
    title: 'iOSのブラウザ',
    state: 'iOSのブラウザは中身がすべてSafariと同じ仕組みなので、サードパーティCookieの制限もSafariと同じです。',
    steps: [
      '設定アプリ → Safari →「サイト越えトラッキングを防ぐ」を<b>オフ</b>（Chrome等を使っていてもここが効きます）',
      '変更後、下の「すべて再読み込み」を実行',
      '通らない場合は枠の「配信サイトで開く」からTwitchアプリで見てください',
    ],
  },
  other: {
    title: 'お使いのブラウザ',
    state: 'サードパーティCookieの設定を確認してください。',
    steps: ['ブラウザの設定で <code>twitch.tv</code> のCookieを許可（トラッキング防止の例外に追加）'],
  },
};

function renderCookieEnv() {
  const g = COOKIE_GUIDE[browserKind()] || COOKIE_GUIDE.other;
  const box = $('#cookie-env');
  const steps = g.steps.map((s) => `<li>${s}</li>`).join('');
  const appNote = isStandalone()
    ? '<p class="env-note">アプリとして起動中はアドレスバーが無いので、いったん同じブラウザでこのサイトを開いて設定してください（設定はアプリ側にも反映されます）。</p>'
    : '';
  box.innerHTML = `<div class="env-title">${g.title} の場合</div>
    <p class="env-state">${g.state}</p>
    <ol class="env-steps">${steps}</ol>${appNote}`;
}

function openLoginHelp() {
  renderCookieEnv();
  if (!helpDlg.open) helpDlg.showModal();
  $('#login-help').scrollIntoView({ block: 'start' });
}

// Cookie設定を変えた直後に一度だけ使う想定。プレーヤーは作り直しになるので広告が入る。
function reloadEverything() {
  for (const key of state.channels) reloadPlayer(key);
  for (const [key, f] of chatEls) {
    f.remove();
    chatEls.delete(key);
    cancelChatRelease(key);
  }
  if (state.activeChat) setActiveChat(state.activeChat);
  toast('プレーヤーとチャットを読み込み直しました', 'accent');
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

// ---------------------------------------------------------------- アプリとしての継続性
// スマホではホーム画面から「アプリ」として使う想定。ブラウザのタブと違い、
// 画面消灯や他アプリへの切り替えでプレーヤーが止まり、戻ると広告から始まり直す。
// 埋め込み先のログインCookieはこちらから触れないので、
// 「止めない・作り直さない・状態を失わない」の3点でできる限り近づける。

// 1) 視聴中は画面を消させない（消灯 → 復帰時のプリロール広告を根本から減らす）
let wakeLock = null;

async function updateWakeLock() {
  if (!('wakeLock' in navigator)) return;
  const want = isCoarse() && state.channels.length > 0 && !document.hidden;
  try {
    if (want && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!want && wakeLock) {
      const wl = wakeLock;
      wakeLock = null;
      await wl.release();
    }
  } catch { wakeLock = null; }
}

// 2) 復帰時はプレーヤーを作り直さず、止まっていたら再開させるだけにする
//    （作り直すと必ず広告からになる）。
//    ただし離脱前から自分で止めていたものは、勝手に鳴り出さないよう触らない。
const pausedOnHide = new Set();

function notePausedOnHide() {
  pausedOnHide.clear();
  for (const [key, p] of players) {
    try { if (p.isPaused()) pausedOnHide.add(key); } catch { /* ignore */ }
  }
  for (const [key, paused] of ytPaused) if (paused) pausedOnHide.add(key);
}

// 再開が重なるとN本ぶんの広告と配信が同時に読み込まれ、回線を取り合って
// どれも進まなくなる。見たい枠から順に、少しずつずらして再開する。
const RESUME_STAGGER_MS = 1200;
const resumeTimers = new Set();

function resumeOne(key) {
  if (!state.channels.includes(key)) return;
  const p = players.get(key);
  if (p) { try { if (p.isPaused()) p.play(); } catch { /* ignore */ } return; }
  const f = playerFrames.get(key);
  if (f && parseEntry(key).platform === 'yt') ytPost(f, 'playVideo');
}

function resumePlayers() {
  for (const t of resumeTimers) clearTimeout(t);
  resumeTimers.clear();
  // 音声を聞いている枠 → フォーカス中の枠 → その他 の順
  const order = [...new Set([state.audibleName, effectiveFocus(), ...state.channels])]
    .filter((k) => k && state.channels.includes(k) && !pausedOnHide.has(k));
  order.forEach((key, i) => {
    if (i === 0) { resumeOne(key); return; }
    const t = setTimeout(() => { resumeTimers.delete(t); resumeOne(key); }, i * RESUME_STAGGER_MS);
    resumeTimers.add(t);
  });
}

// 3) 音声ソロの復元。読み込み直後に音を出そうとすると自動再生がブロックされ、
//    映像ごと始まらないことがある。最初のタップ/キー入力まで待ってから適用する。
let pendingAudible = null;

function applyPendingAudible() {
  const key = pendingAudible;
  pendingAudible = null;
  if (!key || !state.channels.includes(key)) return;
  setAudible(key);
  toast(`${displayName(key)} の音声を復元しました`, 'accent');
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register('./sw.js').catch(() => { /* ignore */ });
}

function wireLifecycle() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // モバイルではタブ破棄前にこれしか来ないことがあるので必ず保存する
      saveSession();
      notePausedOnHide();
      mutePauseHint(15000); // 復帰直後にブラウザ都合の一時停止を拾わないように
      // 長時間離れたままなら維持をやめる（無音の再生を続ける意味がなく、
      // 通信量と電池だけを消費するため）
      clearTimeout(keepAliveReleaseTimer);
      keepAliveReleaseTimer = setTimeout(() => {
        keepAliveReleased = true;
        applyAudioStates();
      }, KEEPALIVE_RELEASE_MS);
      return;
    }
    clearTimeout(keepAliveReleaseTimer);
    const wasReleased = keepAliveReleased;
    keepAliveReleased = false;
    if (wasReleased) applyAudioStates();
    updateWakeLock();
    resumePlayers();
    // 復帰直後の誤タップで配信サイトへ飛ばないよう、直接操作は解除しておく
    lockAllTouchThrough();
  });
  window.addEventListener('pagehide', saveSession);

  const onFirstGesture = () => {
    if (hasUserGesture) return;
    hasUserGesture = true;
    // 自動再生ブロックを避けるためここまで保留していた音声関連をまとめて適用する
    if (pendingAudible) applyPendingAudible();
    else applyAudioStates();
    updateWakeLock();
  };
  document.addEventListener('pointerdown', onFirstGesture, { once: true });
  document.addEventListener('keydown', onFirstGesture, { once: true });
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

  btn.help.addEventListener('click', () => {
    renderCookieEnv();
    helpDlg.showModal();
  });
  btn.helpClose.addEventListener('click', () => helpDlg.close());
  $('#reload-all').addEventListener('click', reloadEverything);
  $('#login-help-btn').addEventListener('click', () => {
    toggleQualityPop(false);
    openLoginHelp();
  });
  helpDlg.addEventListener('click', (e) => {
    if (e.target === helpDlg) helpDlg.close();
  });

  btn.quality.addEventListener('click', () => toggleQualityPop());
  keepAliveItem.addEventListener('click', () => setKeepAlive(!state.keepAlive));
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

  // compactモード: ハンドルでツールバーを開閉。
  // 画面最上部の細い当たり判定なので、clickを待たず pointerdown で確定させる
  // （タッチだとブラウザのエッジジェスチャに吸われてclickまで届かないことがある）。
  const tbToggle = $('#tb-toggle');
  tbToggle.addEventListener('pointerdown', (e) => {
    e.preventDefault(); // 続くclickの二重発火を止める
    document.body.classList.toggle('tb-open');
  });
  tbToggle.addEventListener('click', (e) => {
    if (e.detail === 0) document.body.classList.toggle('tb-open'); // キーボード操作
  });

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
    if (!qualityPop.classList.contains('hidden') &&
        !e.target.closest('#quality-pop, #quality-btn')) {
      toggleQualityPop(false);
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
      fitChatFrames();
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
      renderCookieEnv();
      helpDlg.showModal();
    } else if (k === 'q' || k === 'Q') {
      toggleQualityPop();
    } else if (k === 'Escape') {
      togglePresetsPop(false);
      toggleQualityPop(false);
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
    if (QUALITY_OPTIONS.some((o) => o.id === sess.quality)) state.quality = sess.quality;
    if (typeof sess.keepAlive === 'boolean') state.keepAlive = sess.keepAlive;
  }
  renderQuality();
  renderCookieEnv();
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
  wireLifecycle();
  registerServiceWorker();
  requestPersistentStorage();
  startMuteSync();
  window.addEventListener('message', onFrameMessage);

  const fromHash = readHash();
  const initial = fromHash.length
    ? fromHash
    : (sess && Array.isArray(sess.channels) ? sess.channels : []);
  syncFromNames(initial);
  const savedChat = sess && normalizeKey(sess.activeChat);
  if (savedChat && state.channels.includes(savedChat)) {
    setActiveChat(savedChat);
  }
  // 音声は自動再生ブロックを避けるため、最初の操作まで保留する
  const savedAudible = sess && normalizeKey(sess.audibleName);
  if (savedAudible && state.channels.includes(savedAudible)) pendingAudible = savedAudible;
  renderRecent();

  window.addEventListener('hashchange', () => {
    const names = readHash();
    if (names.join('/') !== state.channels.join('/')) syncFromNames(names);
  });

  new ResizeObserver(() => relayout(false)).observe(stage);
  new ResizeObserver(() => fitChatFrames()).observe(chatFramesEl);
  new ResizeObserver(() => relayout(false)).observe(document.documentElement);
  // ResizeObserverが拾えないケース（画面回転・表示モード切替等）の保険
  window.addEventListener('resize', () => relayout(false));

  if (!window.Twitch) {
    whenTwitchReady(() => {}, () =>
      toast('Twitchプレーヤーの読み込みに失敗しました。ネットワーク接続を確認してください。', 'error', 6000));
  }
}

init();

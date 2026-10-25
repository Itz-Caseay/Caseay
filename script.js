'use strict';

/* ---------- Edit these ---------- */
const CONFIG = {
  // Leave empty to auto-load images/caseay-1.jpg, caseay-2.jpg ... (jpg, jpeg, png or webp).
  // Or list your own files, e.g. ['images/stage.jpg', 'images/studio.png']
  images: [],

  // Seconds each photo stays in the hero background before the next one fades in
  heroSeconds: 15,

  // Upcoming release. Fill in what you know; empty fields stay hidden.
  upcoming: {
    title: 'Bold',
    date: '',           // e.g. '2026-12-01T18:00:00' (your local time) starts a countdown
    note: 'feat. Tonni SS',
    cover: '',          // e.g. 'images/covers/upcoming.jpg' (auto-loads that file name if empty)
    link: '',           // pre-save link
    linkText: 'Pre-save'
  },

  // Release covers. Leave empty to auto-load images/covers/<song-name>.jpg
  // (new-in-the-game, no-love, lonely, guapman, chase-him, ram). Or map them yourself:
  // { 'chase-him': 'images/chase-him-cover.png' }
  covers: {},

  // Shown in the footer if filled in
  email: '',

  // Add a link to show its button in the footer. Empty ones stay hidden.
  links: {
    'Spotify': '',
    'Apple Music': '',
    'YouTube': '',
    'Audiomack': ''
  }
};
/* -------------------------------- */

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- Hero: name reacts to the cursor ---------- */
(function hero() {
  const heroEl = $('.hero');
  const photo = $('#heroPhoto');
  const nameEl = $('#name');
  const letters = $$('#name span');

  if (reduceMotion) {
    letters.forEach(l => { l.style.fontVariationSettings = '"wght" 700, "wdth" 90'; });
    return;
  }

  const BASE = { w: 520, d: 76 };
  const PEAK = { w: 800, d: 100 };
  const cur = letters.map(() => ({ t: 0, c: 0 }));
  let px = null, py = null, raf = 0, userActive = false;

  function frame() {
    const radius = Math.max(220, innerWidth * 0.18);
    let moving = false;
    letters.forEach((el, i) => {
      const s = cur[i];
      if (px === null) {
        s.t = 0;
      } else {
        const r = el.getBoundingClientRect();
        const dist = Math.hypot(px - (r.left + r.width / 2), (py - (r.top + r.height / 2)) * 0.5);
        s.t = Math.max(0, 1 - dist / radius);
      }
      s.c += (s.t - s.c) * 0.14;
      if (Math.abs(s.t - s.c) > 0.002) moving = true; else s.c = s.t;
      const k = s.c * s.c * (3 - 2 * s.c);
      el.style.fontVariationSettings =
        `"wght" ${(BASE.w + (PEAK.w - BASE.w) * k).toFixed(1)}, "wdth" ${(BASE.d + (PEAK.d - BASE.d) * k).toFixed(1)}`;
    });
    raf = moving ? requestAnimationFrame(frame) : 0;
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  heroEl.addEventListener('pointermove', e => {
    userActive = true;
    px = e.clientX; py = e.clientY;
    kick();
    if (finePointer) {
      const r = heroEl.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      photo.style.setProperty('--tx', (-nx * 22).toFixed(1) + 'px');
      photo.style.setProperty('--ty', (-ny * 16).toFixed(1) + 'px');
    }
  });

  const leave = () => {
    px = py = null;
    photo.style.setProperty('--tx', '0px');
    photo.style.setProperty('--ty', '0px');
    kick();
  };
  heroEl.addEventListener('pointerleave', leave);
  heroEl.addEventListener('pointercancel', leave);
  heroEl.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') leave(); });

  // One sweep after the intro so people see the name is alive (also works on phones)
  setTimeout(() => {
    if (userActive) return;
    const r = nameEl.getBoundingClientRect();
    const cy = r.top + r.height / 2;
    const start = performance.now();
    const dur = 1500;
    (function step(now) {
      if (userActive) return;
      const t = Math.min((now - start) / dur, 1);
      px = r.left + r.width * t;
      py = cy;
      kick();
      if (t < 1) requestAnimationFrame(step);
      else { px = py = null; kick(); }
    })(start);
  }, 1500);
})();

/* ---------- Songs: play, bars, counter ---------- */
(function songs() {
  const rows = $$('.track');
  const players = new Map();
  const noteTimers = new Map();

  function setState(row, state) {
    row.dataset.state = state;
    const label = (state === 'playing' ? 'Pause ' : 'Play ') + row.dataset.title;
    $('.play', row).setAttribute('aria-label', label);
    // keep the matching cover in sync
    $$('.cover').filter(c => c.dataset.title === row.dataset.title).forEach(c => {
      c.dataset.state = state;
      c.setAttribute('aria-label', label);
    });
  }

  function showNote(row, text) {
    const note = $('.note', row);
    note.textContent = text;
    clearTimeout(noteTimers.get(row));
    noteTimers.set(row, setTimeout(() => { note.textContent = ''; }, 3000));
  }

  function getAudio(row) {
    if (!players.has(row)) {
      const a = new Audio();
      a.preload = 'none';
      a.src = row.dataset.audio;
      a.addEventListener('playing', () => setState(row, 'playing'));
      a.addEventListener('pause', () => setState(row, 'idle'));
      a.addEventListener('ended', () => setState(row, 'idle'));
      a.addEventListener('error', () => { setState(row, 'idle'); showNote(row, 'Preview coming soon'); });
      players.set(row, a);
    }
    return players.get(row);
  }

  function toggle(row) {
    const a = getAudio(row);
    players.forEach((other, r) => { if (r !== row) other.pause(); });
    if (a.paused) {
      const p = a.play();
      if (p) p.catch(() => { if (a.error) { setState(row, 'idle'); showNote(row, 'Preview coming soon'); } });
    } else {
      a.pause();
    }
  }

  rows.forEach(row => {
    setState(row, 'idle');
    $('.play', row).addEventListener('click', () => toggle(row));
  });

  $$('.cover').forEach(c => c.addEventListener('click', () => {
    const row = rows.find(r => r.dataset.title === c.dataset.title);
    if (row) toggle(row);
  }));

  $('#heroPlay').addEventListener('click', () => {
    const row = $('.track[data-title="Chase Him"]');
    row.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    toggle(row);
  });

  // Bars grow and the total counts up when the list comes into view
  const list = $('#tracks');
  const total = $('#total');
  const TARGET = 3100;

  function countUp() {
    if (reduceMotion) return;
    const start = performance.now();
    const dur = 1400;
    (function tick(now) {
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      total.textContent = Math.round(TARGET * eased).toLocaleString('en-US') + '+';
      if (t < 1) requestAnimationFrame(tick);
    })(start);
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        list.classList.add('in');
        countUp();
        io.disconnect();
      }
    }, { threshold: 0.25 });
    io.observe(list);
  } else {
    list.classList.add('in');
  }
})();

/* ---------- Photos: auto-detect, hero portrait, gallery, lightbox ---------- */
(function photos() {
  const probe = src => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => resolve(null);
    img.src = src;
  });

  async function findImages() {
    if (CONFIG.images.length) return CONFIG.images;
    const exts = ['jpg', 'jpeg', 'png', 'webp', 'JPG', 'PNG'];
    const found = [];
    let misses = 0;
    for (let n = 1; n <= 24 && misses < 2; n++) {
      const hits = await Promise.all(exts.map(e => probe(`images/caseay-${n}.${e}`)));
      const hit = hits.find(Boolean);
      if (hit) { found.push(hit); misses = 0; } else { misses++; }
    }
    return found;
  }

  const gallery = $('#photos');
  const navPhotos = $('#navPhotos');
  const grid = $('#grid');
  const dlg = $('#lightbox');
  const lbImg = $('img', dlg);
  let imgs = [];
  let idx = 0;

  function showLB() {
    lbImg.src = imgs[idx];
    lbImg.alt = `Caseay photo ${idx + 1} of ${imgs.length}`;
  }
  function openLB(i) { idx = i; showLB(); dlg.showModal(); }
  const step = d => { idx = (idx + d + imgs.length) % imgs.length; showLB(); };

  $('.lb-close', dlg).addEventListener('click', () => dlg.close());
  $('.lb-prev', dlg).addEventListener('click', () => step(-1));
  $('.lb-next', dlg).addEventListener('click', () => step(1));
  dlg.addEventListener('click', e => { if (e.target === dlg || e.target.classList.contains('lb')) dlg.close(); });
  dlg.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  findImages().then(found => {
    imgs = found;

    if (!imgs.length) {
      gallery.hidden = true;
      navPhotos.hidden = true;
      return;
    }

    // Hero background: every photo, one after another
    const slides = document.createElement('div');
    slides.className = 'slides';
    const layers = imgs.map(src => {
      const im = new Image();
      im.src = src;
      im.alt = '';
      im.decoding = 'async';
      slides.append(im);
      return im;
    });
    $('#heroPhoto').append(slides);
    requestAnimationFrame(() => layers[0].classList.add('on'));

    if (layers.length > 1) {
      let i = 0;
      setInterval(() => {
        if (document.hidden) return;
        layers[i].classList.remove('on');
        i = (i + 1) % layers.length;
        layers[i].classList.add('on');
      }, Math.max(3, CONFIG.heroSeconds) * 1000);
    }

    // Gallery
    imgs.forEach((src, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'shot';
      b.setAttribute('aria-label', `Open photo ${i + 1}`);
      const img = new Image();
      img.src = src;
      img.alt = `Caseay photo ${i + 1}`;
      img.decoding = 'async';
      img.addEventListener('load', () => img.classList.add('on'));
      if (img.complete) img.classList.add('on');
      b.append(img);
      b.addEventListener('click', () => openLB(i));
      grid.append(b);
    });
  });
})();

/* ---------- Covers: load real images over the generated art ---------- */
(function covers() {
  const probe = src => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  const exts = ['jpg', 'jpeg', 'png', 'webp', 'JPG', 'PNG'];

  $$('.cover').forEach(async c => {
    const slug = c.dataset.slug;
    let src = CONFIG.covers[slug];
    if (!src) {
      const hits = await Promise.all(exts.map(e => probe(`images/covers/${slug}.${e}`)));
      src = hits.find(Boolean);
    }
    if (!src) return;
    const img = new Image();
    img.src = src;
    img.alt = `${c.dataset.title} cover`;
    img.decoding = 'async';
    c.append(img);
    requestAnimationFrame(() => img.classList.add('on'));
  });
})();

/* ---------- Next release ---------- */
(function upcoming() {
  const u = CONFIG.upcoming;
  const title = $('#nextTitle');
  const name = $('#nextName');
  const dateEl = $('#nextDate');
  const cd = $('#countdown');
  const link = $('#nextLink');
  const box = $('#nextCover');

  if (u.title) {
    name.textContent = u.title;
    $('.art-title', box).textContent = u.title;
  }
  if (u.note) dateEl.textContent = u.note;

  if (u.link) {
    link.href = u.link;
    link.textContent = u.linkText || 'Pre-save';
    link.hidden = false;
  }

  // Cover image: explicit path, or images/covers/upcoming.<ext>
  const probe = src => new Promise(res => {
    const im = new Image();
    im.onload = () => res(src);
    im.onerror = () => res(null);
    im.src = src;
  });
  (async () => {
    let src = u.cover;
    if (!src) {
      const hits = await Promise.all(['jpg', 'jpeg', 'png', 'webp'].map(e => probe(`images/covers/upcoming.${e}`)));
      src = hits.find(Boolean);
    }
    if (!src) return;
    const im = new Image();
    im.src = src;
    im.alt = (u.title || 'Upcoming release') + ' cover';
    box.append(im);
    requestAnimationFrame(() => im.classList.add('on'));
  })();

  // Countdown
  let raw = u.date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw || '')) raw += 'T00:00:00';
  const when = raw ? new Date(raw) : null;
  if (!when || isNaN(when)) return;

  const day = when.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  dateEl.textContent = u.note ? `${day}. ${u.note}` : day;

  const pad = n => String(n).padStart(2, '0');
  const parts = { d: $('#cdD'), h: $('#cdH'), m: $('#cdM'), s: $('#cdS') };
  cd.hidden = false;

  function tick() {
    const ms = when - Date.now();
    if (ms <= 0) {
      cd.hidden = true;
      title.textContent = 'Out now';
      clearInterval(timer);
      return;
    }
    const s = Math.floor(ms / 1000);
    parts.d.textContent = pad(Math.floor(s / 86400));
    parts.h.textContent = pad(Math.floor(s % 86400 / 3600));
    parts.m.textContent = pad(Math.floor(s % 3600 / 60));
    parts.s.textContent = pad(s % 60);
  }
  const timer = setInterval(tick, 1000);
  tick();
})();

/* ---------- Footer ---------- */
(function footer() {
  const wrap = $('#links');
  const entries = Object.entries(CONFIG.links).filter(([, url]) => url);

  entries.forEach(([name, url]) => {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = name;
    wrap.append(a);
  });

  if (CONFIG.email) {
    const a = document.createElement('a');
    a.href = 'mailto:' + CONFIG.email;
    a.textContent = CONFIG.email;
    wrap.append(a);
  }

  if (!wrap.children.length) {
    const p = document.createElement('p');
    p.textContent = 'Search \u201CCaseay\u201D in your streaming app.';
    wrap.append(p);
  }

  $('#year').textContent = new Date().getFullYear();
})();

// Dependency-free regression tests: node --test tests/video-playback.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const main = fs.readFileSync(path.join(__dirname, '../assets/js/main.js'), 'utf8');
const compare = fs.readFileSync(path.join(__dirname, '../assets/js/compare.js'), 'utf8');

class Element extends EventTarget {
  constructor(tag = 'div', className = '') {
    super(); this.tagName = tag; this.className = className; this.children = [];
    this.attributes = {}; this.isConnected = true;
    this.rect = { width: 300, height: 300, top: 0, bottom: 300, left: 0, right: 300 };
    this.classList = {
      add: (name) => { this.className += ' ' + name; },
      contains: (name) => this.className.split(' ').includes(name),
      toggle: (name, enabled) => {
        this.className = this.className.split(' ').filter((n) => n !== name).join(' ');
        if (enabled) this.classList.add(name);
      },
    };
  }
  emit(type) { this.dispatchEvent(new Event(type)); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  getBoundingClientRect() { return this.rect; }
  appendChild(child) { this.children.push(child); child.parent = this; return child; }
  insertBefore(child, sibling) {
    this.children.splice(this.children.indexOf(sibling), 0, child); child.parent = this;
  }
  remove() { this.parent.children = this.parent.children.filter((c) => c !== this); this.isConnected = false; }
  matches(selector) {
    return selector[0] === '.' ? this.classList.contains(selector.slice(1)) : this.tagName === selector;
  }
  querySelectorAll(selector) {
    const parts = selector.split(' '), results = [];
    const walk = (parent) => parent.children.forEach((child) => {
      if (child.matches(parts.at(-1)) && (parts.length === 1 || parent.matches(parts[0]))) results.push(child);
      walk(child);
    });
    walk(this); return results;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}
class Video extends Element {
  constructor() {
    super('video'); this.paused = true; this.playCalls = 0; this.controls = true;
    this.behavior = () => { this.paused = false; this.emit('playing'); return Promise.resolve(); };
  }
  play() { ++this.playCalls; return this.behavior(); }
  pause() { const changed = !this.paused; this.paused = true; if (changed) this.emit('pause'); }
}
function harness({ reduced = false, width = 390, videos = [], comparison = false, observer = true } = {}) {
  const document = new Element(), window = new Element();
  const timers = new Map(), observers = [], warnings = [];
  let nextTimer = 0;
  document.readyState = 'loading'; document.hidden = false;
  document.getElementById = () => null;
  document.createElement = (tag) => tag === 'video' ? new Video() : new Element(tag);
  const root = new Element('div', 'cmp');
  root.setAttribute('data-base', 'assets/media/');
  root.setAttribute('data-scenes', 'one,two');
  root.setAttribute('data-methods', 'ours,world-tracing,genrecon,volfill,lyra2');
  const head = root.appendChild(new Element('div', 'cmp-head'));
  for (const text of ['Input', 'Ours', 'World Tracing', 'GenRecon', 'VolFill', 'Lyra']) {
    head.appendChild(new Element('span')).textContent = text;
  }
  root.appendChild(new Element('button', 'cmp-prev'));
  root.appendChild(new Element('button', 'cmp-next'));
  const viewport = root.appendChild(new Element('div', 'cmp-viewport'));
  const row = viewport.appendChild(new Element('div', 'cmp-row'));
  if (comparison) for (let i = 0; i < 5; ++i) row.appendChild(new Video());
  root.appendChild(new Element('div', 'cmp-dots'));
  document.querySelectorAll = (selector) => selector === 'video[data-autoplay]' ? videos :
    selector === '.cmp' && comparison ? [root] : [];
  window.innerWidth = width; window.innerHeight = 844;
  window.matchMedia = () => ({ matches: reduced });
  class Observer {
    constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); }
    observe(target) { this.targets.push(target); }
    update(target, visible) { this.callback([{ target, isIntersecting: visible, intersectionRatio: visible ? 1 : 0 }]); }
  }
  if (observer) window.IntersectionObserver = Observer;
  const context = vm.createContext({
    window, document, IntersectionObserver: Observer,
    console: { warn: (...args) => warnings.push(args) },
    setTimeout: (fn) => { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout: (id) => timers.delete(id),
  });
  vm.runInContext(main, context);
  return { window, document, root, viewport, row, timers, observers, warnings,
    api: window.RWVideo, boot: () => document.emit('DOMContentLoaded'),
    compare: () => vm.runInContext(compare, context) };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const blocked = () => Promise.reject(Object.assign(new Error('Autoplay denied'), { name: 'NotAllowedError' }));

test('prepares muted inline playback and starts without waiting for canplay', async () => {
  const h = harness(), v = new Video(), playback = h.api.create(v);
  playback.play(false); await flush();
  assert.equal(v.playCalls, 1);
  assert.equal(v.muted && v.defaultMuted && v.playsInline, true);
  assert.equal(v.getAttribute('data-playback'), 'playing');
  assert.equal(v.controls, false);
});

test('policy rejection exposes controls, logs reason, and requires explicit retry', async () => {
  const h = harness(), v = new Video(); v.behavior = blocked;
  const playback = h.api.create(v); playback.play(false); await flush();
  assert.equal(v.controls, true); assert.equal(v.getAttribute('data-playback'), 'blocked');
  assert.equal(h.warnings.length, 1);
  v.emit('canplay'); playback.play(false); assert.equal(v.playCalls, 1);
  v.behavior = () => { v.paused = false; v.emit('playing'); return Promise.resolve(); };
  playback.play(true); await flush();
  assert.equal(v.playCalls, 2); assert.equal(v.getAttribute('data-playback'), 'playing');
});

test('does not issue duplicate play calls while the first is pending', () => {
  const h = harness(), v = new Video(); v.behavior = () => new Promise(() => {});
  const playback = h.api.create(v);
  playback.play(false); v.emit('canplay'); playback.play(false);
  assert.equal(v.playCalls, 1);
});

test('ignores late rejections after leaving the viewport', async () => {
  const h = harness(), v = new Video(); let reject;
  v.behavior = () => new Promise((_, fail) => { reject = fail; });
  const playback = h.api.create(v); playback.play(false); playback.pause();
  reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })); await flush();
  v.emit('canplay');
  assert.equal(v.playCalls, 1); assert.equal(v.getAttribute('data-playback'), 'paused');
  assert.equal(h.warnings.length, 0);
});

test('reduced motion prevents autoplay but allows explicit playback', () => {
  const h = harness({ reduced: true }), v = new Video(), playback = h.api.create(v);
  playback.play(false); v.emit('canplay');
  assert.equal(v.playCalls, 0); assert.equal(v.controls, true);
  playback.play(true); assert.equal(v.playCalls, 1);
});

test('media errors are visible rather than silently swallowed', () => {
  const h = harness(), v = new Video(); h.api.create(v);
  v.error = { code: 4 }; v.emit('error');
  assert.equal(v.controls, true); assert.equal(v.getAttribute('data-playback'), 'error');
  assert.equal(h.warnings.length, 1);
});

for (const width of [390, 1024, 1440]) {
  test(`viewport exit/reentry, tab return and pageshow work at ${width}px`, () => {
    const v = new Video(), h = harness({ width, videos: [v] }); h.boot();
    const obs = h.observers.find((o) => o.targets.includes(v));
    assert.equal(v.playCalls, 1);
    obs.update(v, false); assert.equal(v.paused, true);
    obs.update(v, true); assert.equal(v.playCalls, 2);
    h.document.hidden = true; h.document.emit('visibilitychange'); assert.equal(v.paused, true);
    h.document.hidden = false; h.document.emit('visibilitychange'); assert.equal(v.playCalls, 3);
    v.pause(); h.window.emit('pageshow'); assert.equal(v.playCalls, 4);
  });
}

test('offscreen and disconnected media never start via a readiness retry', () => {
  const v = new Video(); v.rect.top = 1000; v.rect.bottom = 1300;
  const h = harness({ videos: [v] }); h.boot(); v.emit('canplay');
  assert.equal(v.playCalls, 0);
  v.isConnected = false; v._playback.play(true); assert.equal(v.playCalls, 0);
});

test('browsers without IntersectionObserver still play only visible media', () => {
  const v = new Video(), h = harness({ observer: false, videos: [v] }); h.boot();
  assert.equal(v.playCalls, 1);
  v.rect.top = 1000; v.rect.bottom = 1300; h.window.emit('scroll'); assert.equal(v.paused, true);
  v.rect.top = 0; v.rect.bottom = 300; h.window.emit('scroll'); assert.equal(v.playCalls, 2);
});

test('blocked comparisons stop advancing; one explicit click starts all five', async () => {
  const h = harness({ comparison: true }), videos = h.row.querySelectorAll('video');
  videos.forEach((v) => { v.behavior = blocked; }); h.compare(); await flush();
  const button = h.root.querySelector('.cmp-play');
  assert.equal(button.hidden, false); assert.equal(h.timers.size, 0);
  assert.ok(videos.every((v) => v.controls && v.playCalls === 1));
  videos.forEach((v) => { v.behavior = () => { v.paused = false; v.emit('playing'); return Promise.resolve(); }; });
  button.emit('click'); await flush();
  assert.ok(videos.every((v) => v.playCalls === 2 && !v.paused));
  assert.equal(button.hidden, true); assert.equal(h.timers.size, 1);
  h.document.hidden = true; h.document.emit('visibilitychange');
  assert.equal(h.timers.size, 0); assert.ok(videos.every((v) => v.paused));
  h.document.hidden = false; h.document.emit('visibilitychange');
  assert.equal(h.timers.size, 1); assert.ok(videos.every((v) => !v.paused));
});

test('comparison timer waits for all clips, and new scenes use the same controller', () => {
  const h = harness({ comparison: true }), videos = h.row.querySelectorAll('video');
  const slow = videos.at(-1); slow.behavior = () => new Promise(() => {});
  h.compare(); assert.equal(h.timers.size, 0);
  slow.paused = false; slow.emit('playing'); assert.equal(h.timers.size, 1);
  const advance = [...h.timers.values()][0]; advance();
  const next = h.viewport.querySelector('.cmp-row'); assert.notEqual(next, h.row);
  assert.equal(next.querySelectorAll('video').length, 5);
  assert.ok(next.querySelectorAll('video').every((v) => v._playback && v.playCalls === 1));
});

test('reduced-motion comparisons have a manual play option and never auto-advance', () => {
  const h = harness({ comparison: true, reduced: true }); h.compare();
  const videos = h.row.querySelectorAll('video'), button = h.root.querySelector('.cmp-play');
  assert.ok(videos.every((v) => v.playCalls === 0 && v.controls));
  assert.equal(button.hidden, false); button.emit('click');
  assert.ok(videos.every((v) => v.playCalls === 1)); assert.equal(h.timers.size, 0);
});

test('a late playing event cannot restart a paused/offscreen video', () => {
  const h = harness(), v = new Video(), playback = h.api.create(v);
  playback.play(false); playback.pause(); v.emit('playing'); v.emit('canplay');
  assert.equal(v.playCalls, 1); assert.equal(v.getAttribute('data-playback'), 'paused');
});

test('transient playback aborts keep manual controls and can recover on canplay', async () => {
  const h = harness(), v = new Video();
  v.behavior = () => Promise.reject(Object.assign(new Error('Interrupted'), { name: 'AbortError' }));
  const playback = h.api.create(v); playback.play(false); await flush();
  assert.equal(v.controls, true);
  v.behavior = () => { v.paused = false; v.emit('playing'); return Promise.resolve(); };
  v.emit('canplay'); assert.equal(v.playCalls, 2); assert.equal(v.getAttribute('data-playback'), 'playing');
});

import { createClient } from '@supabase/supabase-js';
import './styles.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const prefix = import.meta.env.VITE_TABLE_PREFIX;
const table = `${prefix}_diver_progress`;
const supabase = createClient(url, key);
const app = document.querySelector('#app');
let session, game, saveTimer, lastTap = 0;

const levels = [
  ['Anemone Gate', 'Glass Eels', 4, 70, '#ff9f6e', [{ type: 'eel', hp: 22, speed: 62, damage: 8, points: 16, color: '#ffe082', scale: .8 }]],
  ['Kelp Catacombs', 'Kelp Stalkers', 6, 110, '#5ce6a3', [{ type: 'eel', hp: 26, speed: 72, damage: 9, points: 17, color: '#ffe082', scale: .8 }, { type: 'stalker', hp: 42, speed: 50, damage: 14, points: 29, color: '#48e6a0', scale: 1 }]],
  ['Pearl Forge', 'Crab Wardens', 7, 150, '#ff7b66', [{ type: 'stalker', hp: 46, speed: 54, damage: 16, points: 31, color: '#48e6a0', scale: 1 }, { type: 'warden', hp: 72, speed: 35, damage: 22, points: 48, color: '#ff7b66', scale: 1.15 }]],
  ['Abyss Crown', 'Crown Leviathans', 9, 240, '#d890ff', [{ type: 'warden', hp: 78, speed: 38, damage: 23, points: 52, color: '#ff7b66', scale: 1.15 }, { type: 'leviathan', hp: 128, speed: 27, damage: 34, points: 96, color: '#d890ff', scale: 1.45 }]]
].map(([name, monster, target, reward, tint, monsters]) => ({ name, monster, target, reward, tint, monsters }));
const shopItems = [
  { id: 'trident', icon: '☀', name: 'Sun Trident', cost: 90, apply: s => { s.weapon = 'trident'; } },
  { id: 'net', icon: '◌', name: 'Moon Net', cost: 145, apply: s => { s.weapon = 'net'; } },
  { id: 'armor', icon: '◆', name: 'Coral Armor', cost: 120, apply: s => { s.maxHealth = 140; s.health = Math.min(140, s.health + 40); } },
  { id: 'finburst', icon: '➤', name: 'Finburst', cost: 160, apply: s => { s.speedBoost = 1.28; } }
];

document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
document.addEventListener('touchstart', e => { const now = Date.now(); if (now - lastTap < 320) e.preventDefault(); lastTap = now; }, { passive: false });
const esc = v => String(v).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

function loading(text = 'Opening the reef gate') {
  app.innerHTML = `<main class="auth-screen"><section class="loading-card" aria-live="polite"><div class="reef-spinner"><span></span><span></span><span></span></div><strong>${esc(text)}</strong><p>Syncing diver gear, pearl points, and monster tides.</p></section></main>`;
}
function authLoading(form, on, label) {
  form.querySelectorAll('button,input').forEach(el => { el.disabled = on; });
  const node = form.querySelector('#authLoading');
  node.hidden = !on;
  node.querySelector('span:last-child').textContent = label;
}
function renderAuth(message = '') {
  app.innerHTML = `<main class="auth-screen"><section class="auth-card"><div class="crest">✦</div><p class="eyebrow">3D reef combat</p><h1>Tide of Coral Hollow</h1><p class="auth-copy">Dive into a carved coral arena, battle monster tides, and save your weapons, pearls, and level progress.</p><form class="auth-form" id="authForm"><label>Email<input name="email" type="email" autocomplete="email" placeholder="reef diver email" required></label><label>Password<input name="password" type="password" autocomplete="current-password" minlength="6" placeholder="password" required></label><div class="auth-actions"><button name="mode" value="signin" type="submit">Sign in</button><button name="mode" value="signup" type="submit">Sign up</button></div><button class="link-button" id="resetPassword" type="button">Forgot password</button><div class="auth-loading" id="authLoading" hidden><span class="mini-spinner"></span><span>Signing in</span></div>${message ? `<div class="error" role="alert">${esc(message)}</div>` : ''}</form></section></main>`;
  const form = document.querySelector('#authForm');
  let mode = 'signin';
  form.querySelectorAll('[name="mode"]').forEach(b => b.addEventListener('click', () => { mode = b.value; }));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = form.email.value.trim(), password = form.password.value;
    authLoading(form, true, mode === 'signup' ? 'Creating diver profile' : 'Signing in');
    const result = mode === 'signup' ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) return renderAuth(result.error.message);
    session = result.data.session || (await supabase.auth.getSession()).data.session;
    if (!session && mode === 'signup') return renderAuth('Check your email to confirm the account, then sign in here.');
    loading('Loading saved dive');
    await startGame();
  });
  document.querySelector('#resetPassword').addEventListener('click', async () => {
    const email = form.email.value.trim();
    if (!email) return renderAuth('Enter your email first, then request a reset link.');
    authLoading(form, true, 'Sending recovery current');
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    renderAuth(error ? error.message : 'Password recovery email requested.');
  });
}
async function loadProgress(userId) {
  const { data, error } = await supabase.from(table).select('points, high_score, max_level, loadout').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}
function queueSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveProgress, 350); }
async function saveProgress() {
  if (!game || !session) return;
  const s = game.state;
  const payload = { user_id: session.user.id, points: s.points, high_score: Math.max(s.highScore, s.points), max_level: Math.max(s.maxUnlockedLevel, s.levelIndex + 1), loadout: { purchased: s.purchased, weapon: s.weapon, maxHealth: s.maxHealth, speedBoost: s.speedBoost }, updated_at: new Date().toISOString() };
  const { error } = await supabase.from(table).upsert(payload, { onConflict: 'user_id' });
  if (error) game.message(error.message, 'danger');
}
async function startGame() {
  let progress;
  try { progress = await loadProgress(session.user.id); } catch (e) { renderAuth(`Progress table unavailable: ${e.message}`); return; }
  app.innerHTML = `<main class="game-shell"><canvas id="gameCanvas" aria-label="Tide of Coral Hollow 3D reef arena"></canvas><div class="vignette"></div><section class="game-hud" id="hud"></section><section class="mission-ribbon" id="mission"></section><section class="shop-strip" id="shop" aria-label="Reef shop"></section><button class="sign-out" id="signOut">Exit</button><div class="joystick" id="joystick" aria-label="Movement joystick" role="application"><div class="stick" id="stick"></div></div><button class="attack" id="attack" aria-label="Strike"><span>Strike</span></button><div class="notice" id="notice"></div></main>`;
  game = new CoralGame(progress || {});
  window.gameState = game.state;
  window.__gameTest = { buy: id => game.buy(id), attack: () => game.attack(), setJoystick: (x, y) => game.setJoy(x, y), boostPoints: n => { game.state.points += n; game.ui(); queueSave(); }, nextLevel: () => game.complete() };
  document.querySelector('#signOut').addEventListener('click', async () => { await saveProgress(); await supabase.auth.signOut(); game.destroy(); session = null; renderAuth(); });
}

class CoralGame {
  constructor(progress) {
    this.canvas = document.querySelector('#gameCanvas'); this.ctx = this.canvas.getContext('2d');
    this.hud = document.querySelector('#hud'); this.mission = document.querySelector('#mission'); this.shop = document.querySelector('#shop'); this.notice = document.querySelector('#notice'); this.stick = document.querySelector('#stick');
    const loadout = progress.loadout || {};
    this.state = { points: progress.points || 0, highScore: progress.high_score || 0, levelIndex: Math.max(0, Math.min(levels.length - 1, (progress.max_level || 1) - 1)), maxUnlockedLevel: progress.max_level || 1, maxHealth: loadout.maxHealth || 100, health: loadout.maxHealth || 100, weapon: loadout.weapon || 'spear', purchased: Array.isArray(loadout.purchased) ? loadout.purchased : [], speedBoost: loadout.speedBoost || 1, monstersDefeated: 0, diver: { x: 0, y: 0, r: 20, facing: -.25, bob: 0 }, monsters: [], projectiles: [], particles: [], bubbles: [] };
    this.joy = { x: 0, y: 0, active: false, pointer: null }; this.keys = new Set(); this.last = performance.now(); this.spawn = 0; this.cool = 0; this.msg = 0;
    this.resize = this.resize.bind(this); this.loop = this.loop.bind(this); this.controls(); addEventListener('resize', this.resize); addEventListener('orientationchange', this.resize); this.resize(); this.enter(this.state.levelIndex); this.frame = requestAnimationFrame(this.loop);
  }
  destroy() { cancelAnimationFrame(this.frame); removeEventListener('resize', this.resize); removeEventListener('orientationchange', this.resize); }
  resize() { const dpr = devicePixelRatio || 1; this.w = Math.max(320, innerWidth); this.h = Math.max(260, innerHeight); this.canvas.width = this.w * dpr; this.canvas.height = this.h * dpr; this.canvas.style.width = `${this.w}px`; this.canvas.style.height = `${this.h}px`; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.arena = { l: Math.max(28, this.w * .07), r: Math.min(this.w - 28, this.w * .93), t: Math.max(86, this.h * .17), b: Math.min(this.h - 96, this.h * .82) }; if (!this.state.diver.x) { this.state.diver.x = this.w * .5; this.state.diver.y = this.h * .55; } this.clamp(this.state.diver); }
  controls() { const pad = document.querySelector('#joystick'), move = e => { e.preventDefault(); if (!this.joy.active || e.pointerId !== this.joy.pointer) return; const r = pad.getBoundingClientRect(), dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2, max = r.width * .34, mag = Math.hypot(dx, dy) || 1, lim = Math.min(max, mag); this.setJoy(dx / mag * lim / max, dy / mag * lim / max); }; pad.addEventListener('pointerdown', e => { this.joy.active = true; this.joy.pointer = e.pointerId; pad.setPointerCapture(e.pointerId); move(e); }); pad.addEventListener('pointermove', move); ['pointerup', 'pointercancel'].forEach(type => pad.addEventListener(type, e => { e.preventDefault(); if (e.pointerId === this.joy.pointer) { this.joy.active = false; this.joy.pointer = null; this.setJoy(0, 0); } })); document.querySelector('#attack').addEventListener('pointerdown', e => { e.preventDefault(); this.attack(); }); addEventListener('keydown', e => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) { e.preventDefault(); this.keys.add(e.code); this.keyJoy(); } if (e.code === 'Space') { e.preventDefault(); this.attack(); } }); addEventListener('keyup', e => { this.keys.delete(e.code); this.keyJoy(); }); }
  keyJoy() { const x = (this.keys.has('ArrowRight') || this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('ArrowLeft') || this.keys.has('KeyA') ? 1 : 0), y = (this.keys.has('ArrowDown') || this.keys.has('KeyS') ? 1 : 0) - (this.keys.has('ArrowUp') || this.keys.has('KeyW') ? 1 : 0); if (x || y) { const m = Math.hypot(x, y); this.setJoy(x / m, y / m); } else if (!this.joy.active) this.setJoy(0, 0); }
  setJoy(x, y) { this.joy.x = Math.max(-1, Math.min(1, x)); this.joy.y = Math.max(-1, Math.min(1, y)); this.stick.style.setProperty('--stick-x', `${this.joy.x * 34}px`); this.stick.style.setProperty('--stick-y', `${this.joy.y * 34}px`); }
  level() { return levels[this.state.levelIndex]; }
  clamp(o) { o.x = Math.max(this.arena.l, Math.min(this.arena.r, o.x)); o.y = Math.max(this.arena.t, Math.min(this.arena.b, o.y)); }
  enter(i) { this.state.levelIndex = Math.max(0, Math.min(levels.length - 1, i)); this.state.monstersDefeated = 0; this.state.health = this.state.maxHealth; this.state.monsters = []; this.state.projectiles = []; this.spawn = 0; this.message(`${this.level().name}: defeat ${this.level().target} ${this.level().monster}.`); this.ui(); queueSave(); }
  attack() { if (this.cool > 0) return; const w = this.state.weapon, speed = w === 'trident' ? 520 : 430, dmg = w === 'trident' ? 28 : w === 'net' ? 19 : 17, a = this.state.diver.facing; this.state.projectiles.push({ x: this.state.diver.x + Math.cos(a) * 28, y: this.state.diver.y + Math.sin(a) * 20, z: 24, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed * .72, damage: dmg, life: 1.05, net: w === 'net' }); this.cool = w === 'trident' ? .22 : .32; this.burst(this.state.diver.x + Math.cos(a) * 36, this.state.diver.y + Math.sin(a) * 22, '#fff0a8', 4); }
  spawnMonster() { const pool = this.level().monsters, t = pool[Math.floor(Math.random() * pool.length)], e = Math.floor(Math.random() * 4), x = e === 0 ? this.arena.l - 45 : e === 1 ? this.arena.r + 45 : this.arena.l + Math.random() * (this.arena.r - this.arena.l), y = e === 2 ? this.arena.t - 35 : e === 3 ? this.arena.b + 35 : this.arena.t + Math.random() * (this.arena.b - this.arena.t); this.state.monsters.push({ ...t, x, y, hp: t.hp, maxHp: t.hp, slow: 0, bite: 0, wobble: Math.random() * 10 }); }
  buy(id) { const item = shopItems.find(x => x.id === id); if (!item || this.state.purchased.includes(id) || this.state.points < item.cost) return false; this.state.points -= item.cost; this.state.purchased.push(id); item.apply(this.state); this.message(`${item.name} fused into your dive gear.`, 'gold'); this.ui(); queueSave(); return true; }
  complete() { const l = this.level(); this.state.points += l.reward; this.state.highScore = Math.max(this.state.highScore, this.state.points); this.state.maxUnlockedLevel = Math.max(this.state.maxUnlockedLevel, this.state.levelIndex + 2); this.burst(this.state.diver.x, this.state.diver.y, l.tint, 24); this.enter(this.state.levelIndex < levels.length - 1 ? this.state.levelIndex + 1 : levels.length - 1); }
  message(text, tone = 'normal') { this.notice.textContent = text; this.notice.dataset.tone = tone; this.notice.hidden = false; this.msg = 3.4; }
  burst(x, y, color, count) { for (let i = 0; i < count; i++) { const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 100; this.state.particles.push({ x, y, z: 16 + Math.random() * 18, vx: Math.cos(a) * s, vy: Math.sin(a) * s * .55, vz: 20 + Math.random() * 42, color, life: .45 + Math.random() * .5 }); } }
  update(dt) { const s = this.state, d = s.diver; this.cool = Math.max(0, this.cool - dt); this.msg = Math.max(0, this.msg - dt); this.notice.hidden = this.msg <= 0; d.bob += dt * 5; if (Math.hypot(this.joy.x, this.joy.y) > .06) { d.facing = Math.atan2(this.joy.y * .72, this.joy.x); d.x += this.joy.x * 178 * s.speedBoost * dt; d.y += this.joy.y * 139 * s.speedBoost * dt; this.clamp(d); } this.spawn -= dt; if (this.spawn <= 0 && s.monsters.length < Math.min(6, 2 + s.levelIndex)) { this.spawnMonster(); this.spawn = Math.max(.55, 1.35 - s.levelIndex * .15); } s.projectiles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.z = 20 + Math.sin((1.05 - p.life) * 14) * 7; }); s.projectiles = s.projectiles.filter(p => p.life > 0 && p.x > -100 && p.x < this.w + 100 && p.y > -100 && p.y < this.h + 100); for (const m of s.monsters) { m.wobble += dt * 4; m.slow = Math.max(0, m.slow - dt); m.bite = Math.max(0, m.bite - dt); const dx = d.x - m.x, dy = d.y - m.y, dist = Math.hypot(dx, dy) || 1, sp = m.speed * (m.slow > 0 ? .42 : 1); m.x += dx / dist * sp * dt; m.y += dy / dist * sp * .76 * dt; if (dist < d.r + 20 * m.scale && m.bite <= 0) { s.health -= m.damage; m.bite = 1.05; this.message(`${m.type.toUpperCase()} cracked your air shell.`, 'danger'); this.burst(d.x, d.y, '#ff5f6d', 8); if (s.health <= 0) { s.points = Math.max(0, Math.floor(s.points * .85)); this.enter(s.levelIndex); } } } for (const p of s.projectiles) for (const m of s.monsters) if (Math.hypot(p.x - m.x, (p.y - m.y) * 1.22) < 24 * m.scale) { m.hp -= p.damage; p.life = 0; if (p.net) m.slow = 2.3; this.burst(m.x, m.y, p.net ? '#c8fff3' : '#fff0a8', 6); break; } const before = s.monsters.length; s.monsters = s.monsters.filter(m => { if (m.hp > 0) return true; s.points += m.points; s.monstersDefeated++; s.highScore = Math.max(s.highScore, s.points); this.burst(m.x, m.y, m.color, 12); return false; }); if (s.monsters.length !== before) { this.ui(); queueSave(); } if (s.monstersDefeated >= this.level().target) this.complete(); s.particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= 95 * dt; p.life -= dt; }); s.particles = s.particles.filter(p => p.life > 0); while (s.bubbles.length < 54) s.bubbles.push({ x: Math.random() * this.w, y: this.h + Math.random() * 100, z: Math.random(), r: 1 + Math.random() * 4, sp: 12 + Math.random() * 42 }); s.bubbles.forEach(b => { b.y -= b.sp * dt; b.x += Math.sin(performance.now() / 1000 + b.y * .03) * dt * 8; if (b.y < -15) { b.y = this.h + 15; b.x = Math.random() * this.w; } }); window.gameState = s; }
  ui() { const l = this.level(), hp = Math.max(0, this.state.health / this.state.maxHealth) * 100, done = Math.min(100, this.state.monstersDefeated / l.target * 100); this.hud.innerHTML = `<div class="hud-plaque"><span>Depth</span><strong>${this.state.levelIndex + 1}/${levels.length}</strong></div><div class="hud-plaque"><span>Air</span><strong>${Math.ceil(Math.max(0, this.state.health))}</strong><i style="--fill:${hp}%"></i></div><div class="hud-plaque"><span>Pearls</span><strong>${this.state.points}</strong></div><div class="hud-plaque"><span>Relic</span><strong>${esc(this.state.weapon)}</strong></div>`; this.mission.innerHTML = `<div><span>${esc(l.name)}</span><strong>${esc(l.monster)}</strong></div><div class="mission-meter"><i style="width:${done}%"></i></div><b>${this.state.monstersDefeated}/${l.target}</b>`; this.shop.innerHTML = shopItems.map(i => { const owned = this.state.purchased.includes(i.id), disabled = owned || this.state.points < i.cost; return `<button class="shop-card" data-buy="${i.id}" ${disabled ? 'disabled' : ''}><span class="shop-icon">${i.icon}</span><strong>${esc(i.name)}</strong><small>${owned ? 'Owned' : `${i.cost} pearls`}</small></button>`; }).join(''); this.shop.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => this.buy(b.dataset.buy))); }
  drawWorld(c) { const l = this.level(), a = this.arena, g = c.createLinearGradient(0, 0, 0, this.h); g.addColorStop(0, '#12091f'); g.addColorStop(.45, '#0c2f32'); g.addColorStop(1, '#130919'); c.fillStyle = g; c.fillRect(0, 0, this.w, this.h); c.save(); c.globalAlpha = .28; const glow = c.createRadialGradient(this.w * .5, this.h * .42, 20, this.w * .5, this.h * .42, Math.max(this.w, this.h) * .55); glow.addColorStop(0, l.tint); glow.addColorStop(1, 'transparent'); c.fillStyle = glow; c.fillRect(0, 0, this.w, this.h); c.restore(); const floor = c.createLinearGradient(0, a.t, 0, a.b + 70); floor.addColorStop(0, 'rgba(32,109,96,.55)'); floor.addColorStop(1, 'rgba(24,9,32,.94)'); c.fillStyle = floor; c.beginPath(); c.moveTo(this.w * .5, a.t - 26); c.lineTo(a.r, a.t + 44); c.lineTo(a.r - 34, a.b + 36); c.quadraticCurveTo(this.w * .5, a.b + 82, a.l + 34, a.b + 36); c.lineTo(a.l, a.t + 44); c.closePath(); c.fill(); for (let i = 0; i < 9; i++) { const t = i / 8, y = a.t + 20 + (a.b - a.t) * t; c.strokeStyle = `rgba(255,224,130,${.22 - t * .1})`; c.beginPath(); c.moveTo(a.l + 25 * t, y); c.quadraticCurveTo(this.w * .5, y + 16, a.r - 25 * t, y); c.stroke(); } for (let i = 0; i < 10; i++) this.coral(c, a.l + i * ((a.r - a.l) / 9), a.b + 14 + Math.sin(i) * 10, i); for (const b of this.state.bubbles) { c.globalAlpha = .25 + b.z * .35; c.strokeStyle = '#d6fff8'; c.beginPath(); c.arc(b.x, b.y, b.r * (.7 + b.z), 0, Math.PI * 2); c.stroke(); } c.globalAlpha = 1; }
  coral(c, x, y, i) { c.save(); c.translate(x, y); c.strokeStyle = i % 2 ? '#ff7b66' : '#48e6a0'; c.lineWidth = 4; c.globalAlpha = .62; for (let a = 0; a < 3; a++) { const lean = (a - 1) * 16 + Math.sin(performance.now() / 900 + i) * 6; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(lean * .4, -34, lean, -58 - a * 8); c.stroke(); } c.restore(); }
  shadow(c, x, y, rx, ry, o) { c.fillStyle = `rgba(0,0,0,${o})`; c.beginPath(); c.ellipse(x, y + 18, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
  diver(c) { const d = this.state.diver, bob = Math.sin(d.bob) * 4; this.shadow(c, d.x, d.y, 27, 10, .32); c.save(); c.translate(d.x, d.y - 18 + bob); c.rotate(d.facing); const suit = c.createLinearGradient(-24, -20, 24, 20); suit.addColorStop(0, '#fff6bb'); suit.addColorStop(.48, '#ffb35f'); suit.addColorStop(1, '#9d3f32'); c.fillStyle = suit; c.beginPath(); c.ellipse(0, 0, 27, 16, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#d6fff8'; c.beginPath(); c.arc(16, -2, 10, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#ff7b66'; c.lineWidth = 5; c.beginPath(); c.moveTo(-18, -10); c.lineTo(-35, -24); c.moveTo(-18, 10); c.lineTo(-35, 24); c.stroke(); c.strokeStyle = this.state.weapon === 'net' ? '#c8fff3' : '#fff0a8'; c.lineWidth = 4; c.beginPath(); c.moveTo(21, 0); c.lineTo(50, 0); c.stroke(); c.restore(); }
  monster(c, m) { this.shadow(c, m.x, m.y, 24 * m.scale, 9 * m.scale, .28); c.save(); c.translate(m.x, m.y - 16 * m.scale + Math.sin(m.wobble) * 4); c.rotate(Math.atan2(this.state.diver.y - m.y, this.state.diver.x - m.x)); c.scale(m.scale, m.scale); const body = c.createLinearGradient(-28, -24, 32, 28); body.addColorStop(0, '#fff8cf'); body.addColorStop(.22, m.color); body.addColorStop(1, '#32102c'); c.fillStyle = body; c.beginPath(); if (m.type === 'eel') c.ellipse(0, 0, 33, 10 + Math.sin(m.wobble) * 2, 0, 0, Math.PI * 2); else if (m.type === 'stalker') { c.moveTo(32, 0); c.lineTo(-15, -27); c.lineTo(-5, 0); c.lineTo(-15, 27); c.closePath(); } else if (m.type === 'warden') c.arc(0, 0, 27, 0, Math.PI * 2); else c.ellipse(0, 0, 42, 25, 0, 0, Math.PI * 2); c.fill(); c.restore(); c.fillStyle = 'rgba(9,7,18,.7)'; c.fillRect(m.x - 27 * m.scale, m.y - 46 * m.scale, 54 * m.scale, 5); c.fillStyle = m.slow > 0 ? '#c8fff3' : '#ff5f6d'; c.fillRect(m.x - 27 * m.scale, m.y - 46 * m.scale, 54 * m.scale * Math.max(0, m.hp / m.maxHp), 5); }
  projectile(c, p) { this.shadow(c, p.x, p.y, 10, 3, .2); c.save(); c.translate(p.x, p.y - p.z); c.fillStyle = p.net ? '#c8fff3' : '#fff0a8'; c.shadowColor = c.fillStyle; c.shadowBlur = 16; c.beginPath(); c.ellipse(0, 0, p.net ? 9 : 7, p.net ? 5 : 4, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
  render() { const c = this.ctx; c.clearRect(0, 0, this.w, this.h); this.drawWorld(c); const items = [...this.state.monsters.map(m => ({ y: m.y, draw: () => this.monster(c, m) })), { y: this.state.diver.y, draw: () => this.diver(c) }, ...this.state.projectiles.map(p => ({ y: p.y, draw: () => this.projectile(c, p) })), ...this.state.particles.map(p => ({ y: p.y, draw: () => { c.save(); c.globalAlpha = Math.max(0, p.life); c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y - p.z, 3, 0, Math.PI * 2); c.fill(); c.restore(); } }))]; items.sort((a, b) => a.y - b.y).forEach(i => i.draw()); }
  loop(now) { const dt = Math.min(.05, (now - this.last) / 1000); this.last = now; this.update(dt); this.render(); this.frame = requestAnimationFrame(this.loop); }
}

async function boot() {
  if (!url || !key || !prefix) { app.innerHTML = '<main class="auth-screen"><section class="auth-card"><h1>Tide of Coral Hollow</h1><div class="error">Missing Supabase environment configuration.</div></section></main>'; return; }
  loading('Checking diver session');
  session = (await supabase.auth.getSession()).data.session;
  if (session) await startGame(); else renderAuth();
  supabase.auth.onAuthStateChange((_event, next) => { session = next; });
}
boot();

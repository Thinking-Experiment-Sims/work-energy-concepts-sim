/**
 * main.js — Work & Energy Concepts Simulator
 * Rendering, UI, canvas drawing, energy bars, force arrows.
 */

const SCENARIOS = {
  freefall:      { label: 'Free Fall',            icon: '⬇️' },
  rampfriction:  { label: 'Block on Ramp + Friction', icon: '📐' },
  springlaunch:  { label: 'Spring Launch',        icon: '🌀' },
  pendulum:      { label: 'Pendulum',             icon: '🔵' },
  angleexplorer: { label: 'Angle Explorer',       icon: '📏' },
};

const COLORS = {
  ke:      '#0f7e9b',
  ug:      '#d67b19',
  us:      '#7c3aed',
  gravity: '#1a7f4e',
  normal:  '#0f7e9b',
  friction:'#c0392b',
  applied: '#d67b19',
  tension: '#7c3aed',
  spring:  '#7c3aed',
  obj:     '#0f7e9b',
};

const sim = new SimulationEngine();
let animId = null;
let activeTab = 'energy';

/* ── DOM refs ───────────────────────────────────────────────────── */
const canvas    = document.getElementById('simCanvas');
const ctx       = canvas.getContext('2d');
const playBtn   = document.getElementById('playBtn');
const resetBtn  = document.getElementById('resetBtn');
const pauseBtn  = document.getElementById('pauseBtn');
const themeBtn  = document.getElementById('themeBtn');
const scenBtns  = document.querySelectorAll('.scen-btn');
const tabBtns   = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

/* ── Parameter sliders ──────────────────────────────────────────── */
const paramGroups = document.querySelectorAll('.param-group');

function initControls() {
  document.querySelectorAll('[data-param]').forEach(el => {
    const key = el.dataset.param;
    const out = document.getElementById(key + '-val');
    el.value = sim.params[key];
    if (out) out.textContent = Number(el.value).toFixed(el.dataset.decimals || 1);
    el.addEventListener('input', () => {
      const v = parseFloat(el.value);
      if (out) out.textContent = v.toFixed(el.dataset.decimals || 1);
      sim.setParam(key, v);
      stopAnim();
      drawFrame();
    });
  });
}

/* ── Scenario switching ─────────────────────────────────────────── */
function switchScenario(name) {
  stopAnim();
  sim.setScenario(name);
  scenBtns.forEach(b => b.classList.toggle('active', b.dataset.scen === name));
  paramGroups.forEach(g => {
    g.hidden = g.dataset.scen !== name;
  });
  updateGuide();
  drawFrame();
}

/* ── Play / Pause / Reset ───────────────────────────────────────── */
function startAnim() {
  if (animId) return;
  playBtn.textContent  = 'Running…';
  playBtn.disabled     = true;
  pauseBtn.disabled    = false;
  tick();
}
function stopAnim() {
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  playBtn.textContent  = '▶ Run';
  playBtn.disabled     = false;
  pauseBtn.disabled    = true;
  pauseBtn.textContent = '⏸ Pause';
  sim.isPaused         = false;
}
function tick() {
  sim.update();
  drawFrame();
  updateMetrics();
  if (!sim.state.done && !sim.isPaused) {
    animId = requestAnimationFrame(tick);
  } else if (sim.state.done) {
    stopAnim();
    playBtn.textContent = '✓ Done — Reset to replay';
    playBtn.disabled    = true;
  }
}

/* ── Canvas ─────────────────────────────────────────────────────── */
function resizeCanvas() {
  const wrap = canvas.parentElement;
  canvas.width  = wrap.clientWidth;
  canvas.height = Math.min(420, Math.round(wrap.clientWidth * 0.52));
  drawFrame();
}

function drawFrame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const W = canvas.width, H = canvas.height;
  drawBackground(W, H);
  switch (sim.scenario) {
    case 'freefall':      drawFreeFall(W, H);      break;
    case 'rampfriction':  drawRamp(W, H);           break;
    case 'springlaunch':  drawSpring(W, H);         break;
    case 'pendulum':      drawPendulum(W, H);       break;
    case 'angleexplorer': drawAngleExplorer(W, H);  break;
  }
  drawEnergyBars(W, H);
}

function drawBackground(W, H) {
  const isDark = document.body.dataset.theme === 'dark';
  ctx.fillStyle = isDark ? '#0f141c' : '#f2f8fc';
  ctx.fillRect(0, 0, W, H);
  // ground line
  ctx.strokeStyle = isDark ? 'rgba(229,204,143,0.25)' : 'rgba(18,49,64,0.15)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(0, H - 30); ctx.lineTo(W, H - 30); ctx.stroke();
  ctx.setLineDash([]);
}

/* ── Scene drawers ──────────────────────────────────────────────── */
function drawFreeFall(W, H) {
  const s = sim.state;
  const p = sim.params;
  const ground = H - 30;
  const top    = 24;
  const scale  = (ground - top) / p.ff_height;
  const cy     = ground - s.y * scale;
  const r      = 20;

  // height dashed line
  ctx.strokeStyle = COLORS.ug; ctx.lineWidth = 1.5; ctx.setLineDash([4,3]);
  ctx.beginPath(); ctx.moveTo(W*0.5, cy + r); ctx.lineTo(W*0.5, ground); ctx.stroke();
  ctx.setLineDash([]);

  // h label
  const h = Math.max(0, s.y).toFixed(2);
  ctx.fillStyle = COLORS.ug; ctx.font = 'bold 13px IBM Plex Sans';
  ctx.fillText(`h = ${h} m`, W*0.5 + 10, (cy + ground) / 2 + 5);

  // ball
  drawCircle(W*0.5, cy, r, COLORS.obj);

  // gravity arrow (if moving)
  if (!sim.state.done) drawArrow(W*0.5, cy + r, W*0.5, cy + r + 45, COLORS.gravity, 'F_g');

  // velocity label
  const spd = Math.abs(s.vel).toFixed(2);
  ctx.fillStyle = COLORS.ke; ctx.font = 'bold 13px IBM Plex Sans';
  ctx.fillText(`v = ${spd} m/s`, W*0.5 + 26, cy + 6);
}

function drawRamp(W, H) {
  const s = sim.state;
  const p = sim.params;
  const α = p.rf_angle * Math.PI / 180;
  const ground = H - 30;
  const rampLen = Math.min(W * 0.7, 320);
  const x0 = W * 0.08, y0 = ground;
  const x1 = x0 + rampLen * Math.cos(α);
  const y1 = y0 - rampLen * Math.sin(α);

  // ramp surface
  const isDark = document.body.dataset.theme === 'dark';
  ctx.strokeStyle = isDark ? '#e5cc8f' : '#123140'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();

  // block along ramp
  const prog  = s.pos / s.L;
  const bx    = x0 + (x1 - x0) * prog;
  const by    = y0 + (y1 - y0) * prog;
  const bsize = 22;

  ctx.save();
  ctx.translate(bx, by - bsize / 2);
  ctx.rotate(-α);
  ctx.fillStyle = COLORS.obj;
  ctx.fillRect(-bsize/2, -bsize/2, bsize, bsize);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.strokeRect(-bsize/2, -bsize/2, bsize, bsize);
  ctx.restore();

  // force arrows on block
  const nx = -Math.sin(α), ny = -Math.cos(α);      // normal direction
  const tx  =  Math.cos(α), ty  = -Math.sin(α);    // down-ramp direction
  const headX = bx, headY = by - bsize/2;

  // gravity (down)
  drawArrow(headX, headY, headX, headY + 50, COLORS.gravity, 'F_g');
  // friction (up ramp)
  if (s.vel > 0.01)
    drawArrow(headX, headY, headX - tx*40, headY + ty*40, COLORS.friction, 'f_k');
  // normal (perpendicular)
  drawArrow(headX, headY, headX + nx*40, headY + ny*40, COLORS.normal, 'N');

  // velocity label
  ctx.fillStyle = COLORS.ke; ctx.font = 'bold 13px IBM Plex Sans';
  ctx.fillText(`v = ${s.vel.toFixed(2)} m/s`, bx + 18, by - 30);
}

function drawSpring(W, H) {
  const s   = sim.state;
  const p   = sim.params;
  const gnd = H - 30;
  const cx  = W * 0.45;

  if (s.phase === 'spring') {
    // Draw compressed spring + block
    const maxH  = 140;
    const natH  = 90;
    const compH = natH - (p.sl_dx - s.compression) / p.sl_dx * (natH - 30);
    drawSpringCoil(cx, gnd, compH, 26, COLORS.spring);
    drawRect(cx - 22, gnd - compH - 22, 44, 22, COLORS.obj);
    ctx.fillStyle = COLORS.us; ctx.font = 'bold 12px IBM Plex Sans';
    ctx.textAlign = 'center';
    ctx.fillText(`U_s = ${(0.5*p.sl_k*s.compression**2).toFixed(2)} J`, cx, gnd - compH - 34);
    ctx.textAlign = 'left';
  } else {
    // Block in air
    const maxY  = (p.sl_dx**2 * p.sl_k) / (2 * p.sl_mass * G);
    const scale = (gnd - 40) / Math.max(maxY, 0.5);
    const bx = cx - 22;
    const by = gnd - 22 - s.y * scale;
    drawRect(bx, by, 44, 22, COLORS.obj);
    if (!s.done) drawArrow(cx, by, cx, by - 40 * (s.vel > 0 ? 1 : -1), COLORS.ke, 'v');
    ctx.fillStyle = COLORS.ke; ctx.font = 'bold 13px IBM Plex Sans';
    ctx.fillText(`v = ${Math.abs(s.vel).toFixed(2)} m/s`, cx + 30, by + 14);
    // height label
    ctx.strokeStyle = COLORS.ug; ctx.lineWidth = 1; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(cx - 30, by + 22); ctx.lineTo(cx - 30, gnd); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.ug;
    ctx.fillText(`h=${s.y.toFixed(2)}m`, cx - 90, (by + 22 + gnd)/2);
  }
}

function drawPendulum(W, H) {
  const s   = sim.state;
  const px  = W * 0.5, py = H * 0.12;
  const top = 28;
  const pxLen = Math.min(H * 0.62, 200);
  const bx  = px + pxLen * Math.sin(s.theta);
  const by  = py + pxLen * Math.cos(s.theta);

  // pivot
  ctx.fillStyle = '#6b7280';
  ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI*2); ctx.fill();

  // string
  const isDark = document.body.dataset.theme === 'dark';
  ctx.strokeStyle = isDark ? '#e5cc8f' : '#123140'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke();

  // bob
  drawCircle(bx, by, 20, COLORS.obj);

  // tension arrow (along string toward pivot)
  const len = pxLen;
  const tx  = (px - bx) / len * 48;
  const ty  = (py - by) / len * 48;
  drawArrow(bx, by, bx + tx, by + ty, COLORS.tension, 'T');

  // gravity arrow
  drawArrow(bx, by, bx, by + 45, COLORS.gravity, 'F_g');

  // velocity
  const v = Math.abs(s.L * s.omega).toFixed(2);
  ctx.fillStyle = COLORS.ke; ctx.font = 'bold 13px IBM Plex Sans';
  ctx.fillText(`v = ${v} m/s`, bx + 24, by + 6);

  // height dashed
  const h = s.L * (1 - Math.cos(s.theta));
  ctx.strokeStyle = COLORS.ug; ctx.lineWidth = 1; ctx.setLineDash([4,3]);
  const botY = py + pxLen;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, botY); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COLORS.ug; ctx.font = 'bold 12px IBM Plex Sans';
  ctx.fillText(`h=${h.toFixed(2)}m`, bx + 8, (by + botY)/2);
}

function drawAngleExplorer(W, H) {
  const s   = sim.state;
  const p   = sim.params;
  const gnd = H - 30;
  const x0  = W * 0.1;
  const scale = (W * 0.8) / p.ae_d;
  const bx  = x0 + s.pos * scale;
  const θ   = p.ae_theta * Math.PI / 180;
  const bsize = 26;
  const by  = gnd - bsize/2;

  // ground hatching
  ctx.strokeStyle = '#8fabb5'; ctx.lineWidth = 1.5;
  for (let x = x0; x < W*0.92; x += 18) {
    ctx.beginPath(); ctx.moveTo(x, gnd); ctx.lineTo(x - 10, gnd + 12); ctx.stroke();
  }

  // block
  drawRect(bx - bsize/2, by - bsize/2, bsize, bsize, COLORS.obj);

  // Applied force arrow + components
  const fScale = 2.2;
  const Fx = p.ae_F * Math.cos(θ) * fScale;
  const Fy = p.ae_F * Math.sin(θ) * fScale;
  drawArrow(bx, by, bx + Fx, by - Fy, COLORS.applied, 'F');
  // components dashed
  ctx.strokeStyle = COLORS.applied; ctx.lineWidth = 1; ctx.setLineDash([4,3]);
  ctx.beginPath(); ctx.moveTo(bx + Fx, by - Fy); ctx.lineTo(bx + Fx, by); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Fx, by); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COLORS.applied; ctx.font = '11px IBM Plex Sans';
  ctx.fillText(`F·cosθ`, bx + Fx/2 - 18, by + 13);
  ctx.fillText(`F·sinθ`, bx + Fx + 4, by - Fy/2);

  // friction arrow
  const Fy2 = p.ae_F * Math.sin(θ);
  const N   = Math.max(0, s.mass * 9.8 - Fy2);
  const Ff  = p.ae_mu * N;
  if (s.vel > 0.01)
    drawArrow(bx, by, bx - Ff * fScale * 0.4, by, COLORS.friction, 'f_k');

  // normal arrow
  drawArrow(bx, by, bx, by - N/s.mass * 2.5, COLORS.normal, 'N');
  // gravity arrow
  drawArrow(bx, by, bx, by + 42, COLORS.gravity, 'F_g');

  // angle arc
  ctx.strokeStyle = COLORS.applied; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(bx, by, 30, -θ, 0); ctx.stroke();
  ctx.fillStyle = COLORS.applied; ctx.font = 'bold 12px IBM Plex Sans';
  ctx.fillText(`θ=${p.ae_theta}°`, bx + 34, by - 8);

  // velocity
  ctx.fillStyle = COLORS.ke; ctx.font = 'bold 13px IBM Plex Sans';
  ctx.fillText(`v = ${s.vel.toFixed(2)} m/s`, bx + 14, by - 32);
}

/* ── Energy bar chart (right side of canvas) ────────────────────── */
function drawEnergyBars(W, H) {
  const e    = sim.energies();
  const maxE = Math.max(e.etotal * 1.05, 0.1);
  const bw   = 22, bx0 = W - 110, by0 = H - 38, barH = H - 80;
  const bars = [
    { key:'ke', label:'KE',  color: COLORS.ke, val: e.ke },
    { key:'ug', label:'Ug',  color: COLORS.ug, val: e.ug },
    { key:'us', label:'Us',  color: COLORS.us, val: e.us },
  ];

  // background panel
  const isDark = document.body.dataset.theme === 'dark';
  ctx.fillStyle = isDark ? 'rgba(17,20,27,0.88)' : 'rgba(255,255,255,0.88)';
  ctx.beginPath();
  ctx.roundRect(bx0 - 14, by0 - barH - 14, bars.length*(bw+18) + 14, barH + 30, 8);
  ctx.fill();

  bars.forEach((b, i) => {
    const bx  = bx0 + i * (bw + 18);
    const frac = Math.min(b.val / maxE, 1);
    const h   = frac * barH;

    // track
    ctx.fillStyle = isDark ? '#1e2430' : '#e8f4f9';
    ctx.fillRect(bx, by0 - barH, bw, barH);
    // fill
    ctx.fillStyle = b.color;
    ctx.fillRect(bx, by0 - h, bw, h);
    // label below
    ctx.fillStyle = isDark ? '#eef2f9' : '#123140';
    ctx.font = 'bold 11px IBM Plex Sans';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, bx + bw/2, by0 + 13);
    // value above bar
    ctx.fillStyle = b.color;
    ctx.font = '10px IBM Plex Sans';
    ctx.fillText(b.val.toFixed(1)+'J', bx + bw/2, by0 - h - 4);
  });

  // total E line
  const eH = Math.min(e.etotal / maxE, 1) * barH;
  const x1 = bx0 - 6, x2 = bx0 + bars.length*(bw+18) + 2;
  ctx.strokeStyle = isDark ? '#f59e0b' : '#92400e';
  ctx.lineWidth = 2; ctx.setLineDash([5,3]);
  ctx.beginPath(); ctx.moveTo(x1, by0 - eH); ctx.lineTo(x2, by0 - eH); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = isDark ? '#f59e0b' : '#92400e';
  ctx.font = 'bold 10px IBM Plex Sans';
  ctx.textAlign = 'right';
  ctx.fillText('E_total', x1, by0 - eH - 3);
  ctx.textAlign = 'left';
}

/* ── Drawing helpers ────────────────────────────────────────────── */
function drawArrow(x1, y1, x2, y2, color, label) {
  const angle  = Math.atan2(y2 - y1, x2 - x1);
  const len    = Math.hypot(x2-x1, y2-y1);
  if (len < 6) return;
  const hs = 8;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - hs*Math.cos(angle-0.42), y2 - hs*Math.sin(angle-0.42));
  ctx.lineTo(x2 - hs*Math.cos(angle+0.42), y2 - hs*Math.sin(angle+0.42));
  ctx.closePath(); ctx.fill();
  if (label) {
    ctx.font = 'bold 11px IBM Plex Sans';
    ctx.fillText(label, x2 + 5, y2 + 4);
  }
}

function drawCircle(x, y, r, color) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2);
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
}

function drawRect(x, y, w, h, color) {
  ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
}

function drawSpringCoil(cx, baseY, height, width, color) {
  const coils = 8;
  ctx.strokeStyle = color; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, baseY);
  for (let i = 0; i <= coils * 2; i++) {
    const t  = i / (coils * 2);
    const xc = cx + (i % 2 === 0 ? -width/2 : width/2);
    const yc = baseY - t * height;
    if (i === 0) ctx.moveTo(cx, baseY);
    ctx.lineTo(xc, yc);
  }
  ctx.lineTo(cx, baseY - height);
  ctx.stroke();
}

/* ── Metrics panel ──────────────────────────────────────────────── */
function updateMetrics() {
  const e = sim.energies();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('met-ke',     e.ke.toFixed(3) + ' J');
  set('met-ug',     e.ug.toFixed(3) + ' J');
  set('met-us',     e.us.toFixed(3) + ' J');
  set('met-etotal', e.etotal.toFixed(3) + ' J');
  set('met-wext',   (e.wext || 0).toFixed(3) + ' J');

  const wp = sim.workEquationParts();
  const weq = document.getElementById('work-equation');
  if (weq && wp) {
    if (sim.scenario === 'angleexplorer') {
      weq.innerHTML = `<span class="eq-F">F=${wp.F} N</span> &times; <span class="eq-d">d=${wp.d} m</span> &times; <span class="eq-cos">cos(${wp.cosTheta})=${wp.cosVal}</span> = <strong>${wp.W} J</strong>`;
    } else {
      weq.innerHTML = `<em>${wp.note}</em> &nbsp; <strong>W = ${wp.W} J</strong>`;
    }
  }
  // problem-solving highlight
  const path = sim.problemSolvingPath();
  document.querySelectorAll('.ps-step').forEach(el => el.classList.remove('ps-active'));
  if (path.conservativeOnly) {
    document.getElementById('ps-conserve')?.classList.add('ps-active');
  } else {
    document.getElementById('ps-work-energy')?.classList.add('ps-active');
  }
  const exEl = document.getElementById('ps-example-label');
  if (exEl) exEl.textContent = path.infographicExample;
}

function updateGuide() {
  const path = sim.problemSolvingPath();
  const el = document.getElementById('guide-method');
  if (el) el.textContent = 'Method: ' + path.method;
}

/* ── Tab switching ──────────────────────────────────────────────── */
function initTabs() {
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
      tabPanels.forEach(p => p.classList.toggle('active', p.dataset.tab === activeTab));
    });
  });
}

/* ── Theme toggle ───────────────────────────────────────────────── */
function initTheme() {
  const saved = localStorage.getItem('we-sim-theme') || 'light';
  document.body.dataset.theme = saved;
  themeBtn.textContent = saved === 'dark' ? '☀ Light Mode' : '🌙 Dark Mode';
  themeBtn.addEventListener('click', () => {
    const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    document.body.dataset.theme = next;
    localStorage.setItem('we-sim-theme', next);
    themeBtn.textContent = next === 'dark' ? '☀ Light Mode' : '🌙 Dark Mode';
    drawFrame();
  });
}

/* ── Boot ───────────────────────────────────────────────────────── */
function init() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  initTheme();
  initControls();
  initTabs();

  scenBtns.forEach(btn => {
    btn.addEventListener('click', () => switchScenario(btn.dataset.scen));
  });

  playBtn.addEventListener('click', () => {
    if (sim.state.done) { sim.reset(); stopAnim(); }
    startAnim();
  });
  pauseBtn.addEventListener('click', () => {
    sim.isPaused = !sim.isPaused;
    pauseBtn.textContent = sim.isPaused ? '▶ Resume' : '⏸ Pause';
    if (!sim.isPaused) tick();
  });
  resetBtn.addEventListener('click', () => {
    stopAnim(); sim.reset(); drawFrame(); updateMetrics();
    playBtn.textContent = '▶ Run'; playBtn.disabled = false;
  });

  // init first scenario
  switchScenario('freefall');
  updateMetrics();
}

document.addEventListener('DOMContentLoaded', init);

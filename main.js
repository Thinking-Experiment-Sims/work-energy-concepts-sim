/**
 * main.js — Work & Energy Concepts Simulator
 * Rendering, UI, canvas drawing, energy bars, force arrows.
 */

const sim = new SimulationEngine();
let animId = null;
let activeTab = 'energy';

const COLORS = {
  ke:      '#0f7e9b',
  peg:     '#d67b19',
  pes:     '#7c3aed',
  gravity: '#1a7f4e',
  normal:  '#0f7e9b',
  friction:'#c0392b',
  applied: '#d67b19',
  tension: '#7c3aed',
  spring:  '#7c3aed',
  obj:     '#0f7e9b',
};

/* ── DOM refs ───────────────────────────────────────────────────── */
const canvas       = document.getElementById('simCanvas');
const ctx          = canvas.getContext('2d');
const playBtn      = document.getElementById('playBtn');
const resetBtn     = document.getElementById('resetBtn');
const pauseBtn     = document.getElementById('pauseBtn');
const stepBtn      = document.getElementById('stepBtn');
const slowMoToggle = document.getElementById('slowMoToggle');
const themeBtn     = document.getElementById('themeBtn');
const scenBtns     = document.querySelectorAll('.scen-btn');
const tabBtns      = document.querySelectorAll('.tab-btn');
const tabPanels    = document.querySelectorAll('.tab-panel');

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

function switchScenario(name) {
  stopAnim();
  sim.setScenario(name);
  scenBtns.forEach(b => b.classList.toggle('active', b.dataset.scen === name));
  document.querySelectorAll('.param-group').forEach(g => {
    g.hidden = g.dataset.scen !== name;
  });
  
  const titles = {
    freefall: ['Free Fall', 'Ball drops from rest — watch PE_g convert to KE'],
    rampfriction: ['Ramp + Friction', 'Block slides DOWN — friction removes energy as W_EXT (Thermal)'],
    springlaunch: ['Spring Launch', 'PE_s launches the block upward'],
    pendulum: ['Pendulum', 'Oscillation between PE_g and KE — tension does zero work'],
    angleexplorer: ['Angle Explorer', 'Study how force angle affects work (W = Fd cos θ)']
  };
  
  document.getElementById('scene-title').textContent = titles[name][0];
  document.getElementById('scene-sub').textContent   = titles[name][1];
  
  updateMetrics();
  drawFrame();
}

function startAnim() {
  if (animId) return;
  playBtn.textContent = 'Running...';
  playBtn.disabled = true;
  pauseBtn.disabled = false;
  tick();
}

function stopAnim() {
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  playBtn.textContent = '▶ Run';
  playBtn.disabled = false;
  pauseBtn.disabled = true;
  pauseBtn.textContent = '⏸ Pause';
  sim.isPaused = false;
}

function tick() {
  const timeMult = slowMoToggle.checked ? 0.25 : 1.0;
  const originalDt = sim.dt;
  sim.dt = originalDt * timeMult;
  sim.update();
  sim.dt = originalDt;

  drawFrame();
  updateMetrics();
  
  if (!sim.state.done && !sim.isPaused) {
    animId = requestAnimationFrame(tick);
  } else if (sim.state.done) {
    stopAnim();
  }
}

function step() {
  stopAnim();
  sim.update();
  drawFrame();
  updateMetrics();
}

/* ── Canvas Rendering ───────────────────────────────────────────── */
function resizeCanvas() {
  const wrap = canvas.parentElement;
  canvas.width  = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
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
  ctx.fillStyle = isDark ? '#0f141c' : '#f8fcff';
  ctx.fillRect(0, 0, W, H);
  
  const groundY = H - 50;
  ctx.strokeStyle = isDark ? 'rgba(229,204,143,0.2)' : 'rgba(18,49,64,0.1)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY); ctx.lineTo(W, groundY);
  ctx.stroke();
}

function drawFreeFall(W, H) {
  const s = sim.state, p = sim.params;
  const ground = H - 50, top = 50;
  const scale = (ground - top) / 20;
  const cy = ground - s.y * scale;
  const r = 35;

  drawCircle(W * 0.4, cy, r, COLORS.obj);
  
  if (!s.done) {
    drawArrow(W*0.4, cy, W*0.4, cy + 90, COLORS.gravity, 'Fg');
  }
  
  ctx.fillStyle = COLORS.ke; ctx.font = 'bold 18px IBM Plex Sans';
  ctx.fillText(`v = ${Math.abs(s.vel).toFixed(2)} m/s`, W*0.4 + r + 15, cy + 6);
}

function drawRamp(W, H) {
  const s = sim.state, p = sim.params;
  const ground = H - 50;
  const α = p.rf_angle * Math.PI / 180;
  
  const rampLenPx = Math.min(W * 0.7, 550);
  const x0 = W * 0.1;
  
  const xTop = x0;
  const yTop = ground - rampLenPx * Math.sin(α);
  const xBot = x0 + rampLenPx * Math.cos(α);
  const yBot = ground;

  // Draw ramp
  ctx.strokeStyle = '#64748b'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(xTop, yTop); ctx.lineTo(xBot, yBot); ctx.stroke();
  
  const prog = s.pos / s.L;
  const bx = xTop + (xBot - xTop) * prog;
  const by = yTop + (yBot - yTop) * prog;
  const bsize = 50;

  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(-α);
  drawRect(-bsize/2, -bsize, bsize, bsize, COLORS.obj);
  ctx.restore();
  
  // Forces relative to block center
  const centerX = bx;
  const centerY = by - (bsize/2)*Math.cos(α); // Approx center

  // Normal (perp to ramp)
  const nx = -Math.sin(α), ny = -Math.cos(α);
  drawArrow(bx, by - bsize/2, bx + nx*80, by + ny*80, COLORS.normal, 'N');
  
  // Friction (opposing motion)
  // Motion is DOWN ramp: unit vector is (cosα, sinα) in canvas
  const tx = Math.cos(α), ty = Math.sin(α); 
  if (s.vel > 0.01) {
    // Friction should be UP ramp: (-cosα, -sinα)
    drawArrow(bx, by - bsize/2, bx - tx*90, by - ty*90, COLORS.friction, 'fk');
  }
  
  // Gravity (Straight down)
  drawArrow(bx, by - bsize/2, bx, by - bsize/2 + 100, COLORS.gravity, 'Fg');
}

function drawSpring(W, H) {
  const s = sim.state, p = sim.params;
  const ground = H - 50;
  const cx = W * 0.4;
  
  if (s.phase === 'spring') {
    const natH = 180;
    const currentH = natH - (p.sl_dx - s.compression) * 400;
    drawSpringCoil(cx, ground, currentH, 50, COLORS.spring);
    drawRect(cx - 40, ground - currentH - 50, 80, 50, COLORS.obj);
  } else {
    const maxY = (0.5 * p.sl_k * p.sl_dx**2) / (p.sl_mass * 9.8);
    const scale = (ground - 120) / Math.max(maxY, 2);
    const by = ground - 50 - s.y * scale;
    drawRect(cx - 40, by, 80, 50, COLORS.obj);
    ctx.fillStyle = COLORS.ke; ctx.font = 'bold 18px IBM Plex Sans';
    ctx.fillText(`v = ${s.vel.toFixed(2)} m/s`, cx + 55, by + 30);
  }
}

function drawPendulum(W, H) {
  const s = sim.state, px = W * 0.5, py = 100;
  const Lpx = Math.min(H * 0.7, 400);
  const bx = px + Lpx * Math.sin(s.theta);
  const by = py + Lpx * Math.cos(s.theta);
  
  ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke();
  drawCircle(bx, by, 40, COLORS.obj);
  
  const dx = px - bx, dy = py - by;
  const dist = Math.sqrt(dx*dx + dy*dy);
  drawArrow(bx, by, bx + (dx/dist)*100, by + (dy/dist)*100, COLORS.tension, 'T');
  drawArrow(bx, by, bx, by + 100, COLORS.gravity, 'Fg');
}

function drawAngleExplorer(W, H) {
  const s = sim.state, p = sim.params, gnd = H - 50;
  const bx = W * 0.1 + (s.pos / p.ae_d) * (W * 0.7);
  const bsize = 60;
  const by = gnd - bsize/2;
  const θ = p.ae_theta * Math.PI / 180;

  drawRect(bx - bsize/2, by - bsize/2, bsize, bsize, COLORS.obj);
  
  const Flen = 130;
  drawArrow(bx, by, bx + Math.cos(θ)*Flen, by - Math.sin(θ)*Flen, COLORS.applied, 'F');
  
  ctx.setLineDash([6, 6]); ctx.strokeStyle = COLORS.applied; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(θ)*Flen, by); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx + Math.cos(θ)*Flen, by); ctx.lineTo(bx + Math.cos(θ)*Flen, by - Math.sin(θ)*Flen); ctx.stroke();
  ctx.setLineDash([]);
}

/* ── Energy Bars ────────────────────────────────────────────────── */
function drawEnergyBars(W, H) {
  const e = sim.energies();
  const maxE = Math.max(e.etotal * 1.25, 12);
  const barW = 50, spacing = 25;
  const startX = W - 260, startY = H - 100, maxHeight = 350;
  
  const drawBar = (idx, val, color, label) => {
    const h = (val / maxE) * maxHeight;
    const x = startX + idx * (barW + spacing);
    ctx.fillStyle = color;
    ctx.fillRect(x, startY - h, barW, h);
    ctx.fillStyle = '#64748b'; ctx.font = 'bold 14px IBM Plex Sans'; ctx.textAlign = 'center';
    ctx.fillText(label, x + barW/2, startY + 25);
    ctx.font = '13px IBM Plex Sans';
    ctx.fillText(val.toFixed(1) + 'J', x + barW/2, startY - h - 12);
  };

  drawBar(0, e.ke, COLORS.ke, 'KE');
  drawBar(1, e.peg, COLORS.peg, 'PE_g');
  drawBar(2, e.pes, COLORS.pes, 'PE_s');
  
  const totalH = (e.etotal / maxE) * maxHeight;
  ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3; ctx.setLineDash([8, 5]);
  ctx.beginPath(); ctx.moveTo(startX - 15, startY - totalH); ctx.lineTo(startX + 3 * (barW + spacing), startY - totalH); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 14px IBM Plex Sans'; ctx.textAlign = 'right'; 
  ctx.fillText('Total E', startX - 25, startY - totalH + 6);
  ctx.textAlign = 'left';
}

/* ── Helpers ────────────────────────────────────────────────────── */
function drawCircle(x, y, r, color) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2);
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
}
function drawRect(x, y, w, h, color) {
  ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(x, y, w, h);
}
function drawArrow(x1, y1, x2, y2, color, label) {
  const headlen = 12;
  const angle = Math.atan2(y2-y1, x2-x1);
  ctx.strokeStyle = color; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2-headlen*Math.cos(angle-Math.PI/6), y2-headlen*Math.sin(angle-Math.PI/6));
  ctx.lineTo(x2-headlen*Math.cos(angle+Math.PI/6), y2-headlen*Math.sin(angle+Math.PI/6));
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  if (label) {
    ctx.fillStyle = color; ctx.font = 'bold 18px IBM Plex Sans';
    ctx.fillText(label, x2 + 8, y2 + 8);
  }
}
function drawSpringCoil(cx, baseY, height, width, color) {
  const coils = 12;
  ctx.strokeStyle = color; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(cx, baseY);
  for(let i=0; i<=coils; i++) {
    const y = baseY - (i/coils)*height;
    const x = cx + (i%2==0 ? width/2 : -width/2);
    ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function updateMetrics() {
  const e = sim.energies();
  document.getElementById('met-ke').textContent = e.ke.toFixed(3) + ' J';
  document.getElementById('met-ug').textContent = e.peg.toFixed(3) + ' J';
  document.getElementById('met-us').textContent = e.pes.toFixed(3) + ' J';
  document.getElementById('met-etotal').textContent = e.etotal.toFixed(3) + ' J';
  document.getElementById('met-wext').textContent = (e.wext + e.wfric).toFixed(3) + ' J';
  
  const wp = sim.workEquationParts();
  const weq = document.getElementById('work-equation');
  if (sim.scenario === 'angleexplorer') {
    weq.innerHTML = `<span class="eq-F">F=${wp.F} N</span> &times; <span class="eq-d">d=${wp.d} m</span> &times; <span class="eq-cos">cos(${wp.cosTheta})=${wp.cosVal}</span> = <strong>W_EXT = ${wp.W} J</strong>`;
  } else {
    weq.innerHTML = `<em>${wp.note}</em> &nbsp; <strong>W_EXT = ${wp.W} J</strong>`;
  }
  
  const path = sim.problemSolvingPath();
  document.querySelectorAll('.ps-step').forEach(el => el.classList.remove('ps-active'));
  if (path.conservativeOnly) document.getElementById('ps-conserve')?.classList.add('ps-active');
  else document.getElementById('ps-work-energy')?.classList.add('ps-active');
  document.getElementById('guide-method').innerHTML = 'Method: ' + path.method.replace('Ei', 'E<sub>i</sub>').replace('Ef', 'E<sub>f</sub>');
}

function init() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  initControls();
  
  tabBtns.forEach(btn => btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.querySelector(`.tab-panel[data-tab="${btn.dataset.tab}"]`).classList.add('active');
  }));

  scenBtns.forEach(btn => btn.addEventListener('click', () => switchScenario(btn.dataset.scen)));
  playBtn.addEventListener('click', () => { if (sim.state.done) sim.reset(); startAnim(); });
  pauseBtn.addEventListener('click', () => { sim.isPaused = !sim.isPaused; pauseBtn.textContent = sim.isPaused ? '▶ Resume' : '⏸ Pause'; if (!sim.isPaused) tick(); });
  resetBtn.addEventListener('click', () => { stopAnim(); sim.reset(); drawFrame(); updateMetrics(); });
  stepBtn.addEventListener('click', step);
  themeBtn.addEventListener('click', () => {
    document.body.dataset.theme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    themeBtn.textContent = document.body.dataset.theme === 'dark' ? '☀ Light Mode' : '🌙 Dark Mode';
    drawFrame();
  });

  switchScenario('freefall');
}

document.addEventListener('DOMContentLoaded', init);

/**
 * main.js — Work & Energy Concepts Simulator
 * Rendering, UI, canvas drawing, energy bars, force arrows.
 */

const sim = new SimulationEngine();
let animId = null;
let activeTab = 'energy';

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
    freefall: ['Free Fall', 'Ball drops from rest — watch U_g convert to KE'],
    rampfriction: ['Ramp + Friction', 'Block slides DOWN — friction removes energy as heat'],
    springlaunch: ['Spring Launch', 'Elastic energy launches the block upward'],
    pendulum: ['Pendulum', 'Oscillation between Ug and KE — tension does zero work'],
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
  // If slow mo, we update less per frame or with smaller dt
  const iterations = slowMoToggle.checked ? 1 : 1;
  const timeMult = slowMoToggle.checked ? 0.25 : 1.0;
  
  // Custom update to handle slow motion dt
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
  const scale = (ground - top) / 20; // 20m max
  const cy = ground - s.y * scale;
  const r = 30; // Bigger

  drawCircle(W * 0.4, cy, r, COLORS.obj);
  
  if (!s.done) {
    drawArrow(W*0.4, cy + r, W*0.4, cy + r + 60, COLORS.gravity, 'Fg');
  }
  
  ctx.fillStyle = COLORS.ke; ctx.font = 'bold 16px IBM Plex Sans';
  ctx.fillText(`v = ${Math.abs(s.vel).toFixed(2)} m/s`, W*0.4 + r + 10, cy + 5);
}

function drawRamp(W, H) {
  const s = sim.state, p = sim.params;
  const ground = H - 50;
  const α = p.rf_angle * Math.PI / 180;
  
  const rampLenPx = Math.min(W * 0.7, 500);
  const x0 = W * 0.1;
  const y0 = ground; // Bottom start point
  
  // Top point
  const xTop = x0;
  const yTop = ground - rampLenPx * Math.sin(α);
  // Bottom point
  const xBot = x0 + rampLenPx * Math.cos(α);
  const yBot = ground;

  // Draw ramp
  ctx.strokeStyle = '#64748b'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(xTop, yTop); ctx.lineTo(xBot, yBot); ctx.stroke();
  
  // Block position: pos=0 is Top, pos=L is Bottom
  const prog = s.pos / s.L;
  const bx = xTop + (xBot - xTop) * prog;
  const by = yTop + (yBot - yTop) * prog;
  const bsize = 40;

  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(-α);
  drawRect(-bsize/2, -bsize, bsize, bsize, COLORS.obj);
  
  // Forces
  const headX = 0, headY = -bsize/2;
  // Gravity (always down) - need to unrotate for true down? No, just draw it.
  // Actually drawing relative to block is easier if we rotate back or calculate.
  ctx.restore();
  
  // Draw arrows after restore for absolute direction
  // Normal (perp to ramp)
  const nx = -Math.sin(α), ny = -Math.cos(α);
  drawArrow(bx, by - bsize/2, bx + nx*60, by + ny*60, COLORS.normal, 'N');
  
  // Friction (opposing motion - motion is DOWN ramp, so friction is UP ramp)
  const tx = Math.cos(α), ty = -Math.sin(α); // Unit vector DOWN ramp
  if (s.vel > 0.01) {
    drawArrow(bx, by - bsize/2, bx - tx*70, by - ty*70, COLORS.friction, 'fk');
  }
  
  // Gravity
  drawArrow(bx, by - bsize/2, bx, by - bsize/2 + 80, COLORS.gravity, 'Fg');
}

function drawSpring(W, H) {
  const s = sim.state, p = sim.params;
  const ground = H - 50;
  const cx = W * 0.4;
  
  if (s.phase === 'spring') {
    const natH = 150;
    const currentH = natH - (p.sl_dx - s.compression) * 300; // Scaled
    drawSpringCoil(cx, ground, currentH, 40, COLORS.spring);
    drawRect(cx - 30, ground - currentH - 40, 60, 40, COLORS.obj);
  } else {
    const maxY = (0.5 * p.sl_k * p.sl_dx**2) / (p.sl_mass * 9.8);
    const scale = (ground - 100) / Math.max(maxY, 2);
    const by = ground - 40 - s.y * scale;
    drawRect(cx - 30, by, 60, 40, COLORS.obj);
    ctx.fillStyle = COLORS.ke; ctx.font = 'bold 16px IBM Plex Sans';
    ctx.fillText(`v = ${s.vel.toFixed(2)} m/s`, cx + 40, by + 25);
  }
}

function drawPendulum(W, H) {
  const s = sim.state, px = W * 0.5, py = 80;
  const Lpx = Math.min(H * 0.7, 350);
  const bx = px + Lpx * Math.sin(s.theta);
  const by = py + Lpx * Math.cos(s.theta);
  
  ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke();
  drawCircle(bx, by, 30, COLORS.obj);
  
  // Tension
  const dx = px - bx, dy = py - by;
  const dist = Math.sqrt(dx*dx + dy*dy);
  drawArrow(bx, by, bx + (dx/dist)*80, by + (dy/dist)*80, COLORS.tension, 'T');
  // Gravity
  drawArrow(bx, by, bx, by + 80, COLORS.gravity, 'Fg');
}

function drawAngleExplorer(W, H) {
  const s = sim.state, p = sim.params, gnd = H - 50;
  const bx = W * 0.1 + (s.pos / p.ae_d) * (W * 0.7);
  const bsize = 50;
  const by = gnd - bsize/2;
  const θ = p.ae_theta * Math.PI / 180;

  drawRect(bx - bsize/2, by - bsize/2, bsize, bsize, COLORS.obj);
  
  // Applied Force
  const Flen = 100;
  drawArrow(bx, by, bx + Math.cos(θ)*Flen, by - Math.sin(θ)*Flen, COLORS.applied, 'F');
  
  // Components
  ctx.setLineDash([5, 5]); ctx.strokeStyle = COLORS.applied; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(θ)*Flen, by); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx + Math.cos(θ)*Flen, by); ctx.lineTo(bx + Math.cos(θ)*Flen, by - Math.sin(θ)*Flen); ctx.stroke();
  ctx.setLineDash([]);
}

/* ── Energy Bars ────────────────────────────────────────────────── */
function drawEnergyBars(W, H) {
  const e = sim.energies();
  const maxE = Math.max(e.etotal * 1.2, 10);
  const barW = 40, spacing = 20;
  const startX = W - 220, startY = H - 80, maxHeight = 300;
  
  const drawBar = (idx, val, color, label) => {
    const h = (val / maxE) * maxHeight;
    const x = startX + idx * (barW + spacing);
    ctx.fillStyle = color;
    ctx.fillRect(x, startY - h, barW, h);
    ctx.fillStyle = '#64748b'; ctx.font = '12px IBM Plex Sans'; ctx.textAlign = 'center';
    ctx.fillText(label, x + barW/2, startY + 20);
    ctx.fillText(val.toFixed(1), x + barW/2, startY - h - 10);
  };

  drawBar(0, e.ke, COLORS.ke, 'KE');
  drawBar(1, e.ug, COLORS.ug, 'Ug');
  drawBar(2, e.us, COLORS.us, 'Us');
  
  // Total E line
  const totalH = (e.etotal / maxE) * maxHeight;
  ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(startX - 10, startY - totalH); ctx.lineTo(startX + 3 * (barW + spacing), startY - totalH); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#f59e0b'; ctx.textAlign = 'right'; ctx.fillText('Total E', startX - 15, startY - totalH + 5);
  ctx.textAlign = 'left';
}

/* ── Helpers ────────────────────────────────────────────────────── */
function drawCircle(x, y, r, color) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2);
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
}
function drawRect(x, y, w, h, color) {
  ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);
}
function drawArrow(x1, y1, x2, y2, color, label) {
  const headlen = 10;
  const angle = Math.atan2(y2-y1, x2-x1);
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2-headlen*Math.cos(angle-Math.PI/6), y2-headlen*Math.sin(angle-Math.PI/6));
  ctx.lineTo(x2-headlen*Math.cos(angle+Math.PI/6), y2-headlen*Math.sin(angle+Math.PI/6));
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  if (label) {
    ctx.fillStyle = color; ctx.font = 'bold 14px IBM Plex Sans';
    ctx.fillText(label, x2 + 5, y2 + 5);
  }
}
function drawSpringCoil(cx, baseY, height, width, color) {
  const coils = 12;
  ctx.strokeStyle = color; ctx.lineWidth = 3;
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
  document.getElementById('met-ug').textContent = e.ug.toFixed(3) + ' J';
  document.getElementById('met-us').textContent = e.us.toFixed(3) + ' J';
  document.getElementById('met-etotal').textContent = e.etotal.toFixed(3) + ' J';
  document.getElementById('met-wext').textContent = (e.wext + e.wfric).toFixed(3) + ' J';
  
  const wp = sim.workEquationParts();
  const weq = document.getElementById('work-equation');
  if (sim.scenario === 'angleexplorer') {
    weq.innerHTML = `<span class="eq-F">F=${wp.F} N</span> &times; <span class="eq-d">d=${wp.d} m</span> &times; <span class="eq-cos">cos(${wp.cosTheta})=${wp.cosVal}</span> = <strong>${wp.W} J</strong>`;
  } else {
    weq.innerHTML = `<em>${wp.note}</em> &nbsp; <strong>W = ${wp.W} J</strong>`;
  }
  
  const path = sim.problemSolvingPath();
  document.querySelectorAll('.ps-step').forEach(el => el.classList.remove('ps-active'));
  if (path.conservativeOnly) document.getElementById('ps-conserve')?.classList.add('ps-active');
  else document.getElementById('ps-work-energy')?.classList.add('ps-active');
  document.getElementById('guide-method').textContent = 'Method: ' + path.method;
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

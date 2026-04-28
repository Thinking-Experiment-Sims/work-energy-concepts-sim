/**
 * physics.js — Work & Energy Concepts Simulator
 * SimulationEngine: handles all math, state, and scenario logic.
 * Five scenarios: FreeFall, RampFriction, SpringLaunch, Pendulum, AngleExplorer
 * The Thinking Experiment · g = 9.8 m/s² (SI)
 */

const G = 9.8; // m/s²

/* ─────────────────────────── Scenario Definitions ──────────────────────── */

class SimulationEngine {
  constructor() {
    this.dt       = 1 / 60;
    this.isPaused = false;
    this.time     = 0;
    this.scenario = 'freefall';
    this.params   = this._defaultParams();
    this.state    = {};
    this.history  = []; // {t, ke, ug, us, etotal}
    this.reset();
  }

  _defaultParams() {
    return {
      // Free Fall
      ff_mass   : 2.0,   // kg
      ff_height : 10.0,  // m

      // Ramp with Friction
      rf_mass   : 2.0,   // kg
      rf_angle  : 30,    // deg
      rf_mu     : 0.2,   // kinetic friction coefficient
      rf_length : 6.0,   // m (ramp length)

      // Spring Launch
      sl_mass   : 1.0,   // kg
      sl_k      : 200,   // N/m
      sl_dx     : 0.15,  // m (compression)

      // Pendulum
      pend_mass  : 1.0,  // kg
      pend_L     : 1.5,  // m
      pend_theta0: 40,   // deg (release angle)

      // Angle Explorer
      ae_F     : 20,     // N
      ae_theta : 0,      // deg (angle of force above horizontal)
      ae_d     : 4.0,    // m (distance to push)
      ae_mu    : 0.1,    // kinetic friction coefficient
      ae_mass  : 3.0,    // kg
    };
  }

  /* ── Public API ─────────────────────────────────────────────── */

  setScenario(name) {
    this.scenario = name;
    this.reset();
  }

  setParam(key, value) {
    this.params[key] = value;
    this.reset();
  }

  reset() {
    this.time    = 0;
    this.history = [];
    this.isPaused = false;
    this._initState();
  }

  update() {
    if (this.isPaused || this.state.done) return;
    const steps = 4; // sub-steps for accuracy
    for (let i = 0; i < steps; i++) {
      this._step(this.dt / steps);
    }
    this.time += this.dt;
    const e = this.energies();
    this.history.push({ t: this.time, ...e });
    if (this.history.length > 600) this.history.shift();
  }

  /* ── Energy accounting ──────────────────────────────────────── */

  energies() {
    const s = this.state;
    let ke = 0, ug = 0, us = 0;

    switch (this.scenario) {
      case 'freefall': {
        ke = 0.5 * s.mass * s.vel * s.vel;
        ug = s.mass * G * s.y;
        break;
      }
      case 'rampfriction': {
        ke = 0.5 * s.mass * s.vel * s.vel;
        // height from base of ramp
        const α = this.params.rf_angle * Math.PI / 180;
        const h = Math.max(0, (s.L - s.pos) * Math.sin(α));
        ug = s.mass * G * h;
        break;
      }
      case 'springlaunch': {
        if (s.phase === 'compress') {
          ke = 0;
          us = 0.5 * this.params.sl_k * s.compression * s.compression;
          ug = 0;
        } else {
          ke = 0.5 * s.mass * s.vel * s.vel;
          us = s.phase === 'spring' ? 0.5 * this.params.sl_k * s.compression * s.compression : 0;
          ug = s.mass * G * s.y;
        }
        break;
      }
      case 'pendulum': {
        const h = s.L * (1 - Math.cos(s.theta));
        ke = 0.5 * s.mass * s.L * s.L * s.omega * s.omega;
        ug = s.mass * G * h;
        break;
      }
      case 'angleexplorer': {
        ke = 0.5 * s.mass * s.vel * s.vel;
        ug = 0; // horizontal motion
        break;
      }
    }
    const etotal = ke + ug + us;
    return { ke, ug, us, etotal, wext: s.wext || 0, wfric: s.wfric || 0 };
  }

  /* Work done by applied force in angle explorer, cumulative */
  workEquationParts() {
    const s = this.state;
    switch (this.scenario) {
      case 'freefall':
        return { F: 0, d: this.params.ff_height - s.y, cosTheta: 0,
                 W: 0, note: 'No external force — gravity is internal (ball + Earth system)' };
      case 'rampfriction': {
        const α = this.params.rf_angle * Math.PI / 180;
        const Ff = this.params.rf_mu * s.mass * G * Math.cos(α);
        const d  = s.pos;
        const W  = -Ff * d;
        return { F: Ff.toFixed(2), d: d.toFixed(2), cosTheta: '180°',
                 W: W.toFixed(2), note: 'W_friction = −f_k · d (opposes motion)' };
      }
      case 'springlaunch':
        return { F: '½k(Δx)²', d: this.params.sl_dx.toFixed(2), cosTheta: '—',
                 W: (0.5 * this.params.sl_k * this.params.sl_dx ** 2).toFixed(2),
                 note: 'U_s = ½kΔx² stored in spring → converted to KE' };
      case 'pendulum': {
        const h = s.L * (1 - Math.cos(this.params.pend_theta0 * Math.PI / 180));
        return { F: 'T (tension)', d: '—', cosTheta: '90°',
                 W: 0, note: 'Tension ⊥ motion → W_tension = 0. E conserved.' };
      }
      case 'angleexplorer': {
        const θ = this.params.ae_theta * Math.PI / 180;
        const F = this.params.ae_F;
        const d = s.pos;
        const W = F * d * Math.cos(θ);
        return { F: F.toFixed(1), d: d.toFixed(2), cosTheta: this.params.ae_theta + '°',
                 cosVal: Math.cos(θ).toFixed(3),
                 W: W.toFixed(2), note: 'W = F · d · cos θ' };
      }
    }
  }

  /* ── State initializers ─────────────────────────────────────── */

  _initState() {
    const p = this.params;
    switch (this.scenario) {
      case 'freefall':
        this.state = { mass: p.ff_mass, y: p.ff_height, vel: 0, done: false, wext: 0 };
        break;
      case 'rampfriction': {
        const L = p.rf_length;
        this.state = { mass: p.rf_mass, pos: 0, vel: 0, L, done: false, wfric: 0, wext: 0 };
        break;
      }
      case 'springlaunch':
        this.state = {
          mass: p.sl_mass, phase: 'spring', compression: p.sl_dx,
          vel: 0, y: 0, done: false, wext: 0
        };
        // immediately begin launch (spring energy is initial condition)
        break;
      case 'pendulum': {
        const theta0 = p.pend_theta0 * Math.PI / 180;
        this.state = { mass: p.pend_mass, L: p.pend_L, theta: theta0, omega: 0, done: false, wext: 0 };
        break;
      }
      case 'angleexplorer':
        this.state = { mass: p.ae_mass, pos: 0, vel: 0, done: false, wext: 0, wfric: 0 };
        break;
    }
  }

  /* ── Integrators ────────────────────────────────────────────── */

  _step(dt) {
    const p = this.params;
    const s = this.state;
    if (s.done) return;

    switch (this.scenario) {

      case 'freefall': {
        const acc = -G;
        s.vel += acc * dt; // Euler-Cromer
        s.y   += s.vel * dt;
        if (s.y <= 0) { s.y = 0; s.vel = 0; s.done = true; }
        break;
      }

      case 'rampfriction': {
        const α  = p.rf_angle * Math.PI / 180;
        const Fg = s.mass * G * Math.sin(α);         // down the ramp
        const Ff = p.rf_mu * s.mass * G * Math.cos(α); // friction (opposing motion)
        const acc = (Fg - Ff) / s.mass;
        s.vel  += acc * dt;
        if (s.vel < 0) s.vel = 0; // can't go backwards in this scenario
        const dp    = s.vel * dt;
        s.pos  += dp;
        s.wfric -= Ff * dp; // negative work
        if (s.pos >= s.L) { s.pos = s.L; s.vel = 0; s.done = true; }
        break;
      }

      case 'springlaunch': {
        if (s.phase === 'spring') {
          // Spring force drives the block: F = k·x_remaining
          const Fs  = p.sl_k * s.compression;
          const acc = Fs / s.mass;
          s.vel += acc * dt;
          s.compression -= s.vel * dt;
          if (s.compression <= 0) {
            s.compression = 0;
            s.phase = 'air'; // block leaves spring
          }
        } else if (s.phase === 'air') {
          // Projectile: going straight up
          s.vel -= G * dt;
          s.y   += s.vel * dt;
          if (s.y <= 0 && s.vel < 0) { s.y = 0; s.vel = 0; s.done = true; }
        }
        break;
      }

      case 'pendulum': {
        // θ'' = -(g/L)sin(θ) — Euler-Cromer
        const alpha = -(G / s.L) * Math.sin(s.theta);
        s.omega += alpha * dt;
        s.theta += s.omega * dt;
        // Stop after 3 full swings
        if (this.time > 3 * Math.PI * Math.sqrt(s.L / G) * 2) { s.done = true; }
        break;
      }

      case 'angleexplorer': {
        const θ   = p.ae_theta * Math.PI / 180;
        const Fx  = p.ae_F * Math.cos(θ);       // horizontal component
        const Fy  = p.ae_F * Math.sin(θ);       // vertical lift component
        const N   = Math.max(0, s.mass * G - Fy); // reduced normal force
        const Ff  = p.ae_mu * N;                // kinetic friction
        const net = Fx - Ff;
        const acc = net / s.mass;
        s.vel  += acc * dt;
        if (s.vel < 0) s.vel = 0;
        const dp   = s.vel * dt;
        s.pos += dp;
        s.wext  += p.ae_F * dp * Math.cos(θ);
        s.wfric -= Ff * dp;
        if (s.pos >= p.ae_d) { s.pos = p.ae_d; s.vel = 0; s.done = true; }
        break;
      }
    }
  }

  /* ── Computed helpers for renderer ─────────────────────────── */

  /** Normalised progress 0→1 for scrubber / progress bar */
  progress() {
    const s = this.state;
    switch (this.scenario) {
      case 'freefall':      return 1 - s.y / this.params.ff_height;
      case 'rampfriction':  return s.pos / s.L;
      case 'springlaunch':  return s.phase === 'spring'
          ? (this.params.sl_dx - s.compression) / this.params.sl_dx * 0.3
          : 0.3 + Math.max(0, s.y) / (this.params.sl_dx * Math.sqrt(this.params.sl_k / this.params.sl_mass)) * 0.7;
      case 'pendulum': {
        const θ0 = this.params.pend_theta0 * Math.PI / 180;
        return θ0 === 0 ? 0 : (θ0 - s.theta) / (2 * θ0);
      }
      case 'angleexplorer': return s.pos / this.params.ae_d;
    }
    return 0;
  }

  /** Scenario description for the Problem-Solving Guide highlight */
  problemSolvingPath() {
    switch (this.scenario) {
      case 'freefall':
        return { conservativeOnly: true, externalWork: false,
          method: 'E_i = E_f', infographicExample: 'Example 1 — Free Fall' };
      case 'rampfriction':
        return { conservativeOnly: false, externalWork: true,
          method: 'E_f = E_i + W_friction', infographicExample: 'Example 2 — Block with Friction' };
      case 'springlaunch':
        return { conservativeOnly: true, externalWork: false,
          method: 'E_i = E_f', infographicExample: 'Example 3 — Spring Launch' };
      case 'pendulum':
        return { conservativeOnly: true, externalWork: false,
          method: 'E_i = E_f', infographicExample: 'Example 4 — Ideal Pendulum' };
      case 'angleexplorer':
        return { conservativeOnly: false, externalWork: true,
          method: 'W = F·d·cos θ', infographicExample: 'Step 4 — Calculate Work' };
    }
  }
}

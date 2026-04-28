/**
 * physics.js — Work & Energy Concepts Simulator
 */

const G = 9.8; 

class SimulationEngine {
  constructor() {
    this.dt       = 1 / 60;
    this.isPaused = false;
    this.time     = 0;
    this.scenario = 'freefall';
    this.params   = this._defaultParams();
    this.state    = {};
    this.history  = [];
    this.reset();
  }

  _defaultParams() {
    return {
      ff_mass   : 2.0,
      ff_height : 10.0,
      rf_mass   : 2.0,
      rf_angle  : 30,
      rf_mu     : 0.2,
      rf_length : 6.0,
      sl_mass   : 1.0,
      sl_k      : 200,
      sl_dx     : 0.15,
      pend_mass  : 1.0,
      pend_L     : 1.5,
      pend_theta0: 40,
      ae_F     : 20,
      ae_theta : 0,
      ae_d     : 4.0,
      ae_mu    : 0.1,
      ae_mass  : 3.0,
    };
  }

  setScenario(name) { this.scenario = name; this.reset(); }
  setParam(key, value) { this.params[key] = value; this.reset(); }
  reset() { this.time = 0; this.history = []; this.isPaused = false; this._initState(); }

  update() {
    if (this.isPaused || this.state.done) return;
    const steps = 4;
    for (let i = 0; i < steps; i++) this._step(this.dt / steps);
    this.time += this.dt;
    const e = this.energies();
    this.history.push({ t: this.time, ...e });
    if (this.history.length > 600) this.history.shift();
  }

  energies() {
    const s = this.state;
    let ke = 0, peg = 0, pes = 0;
    switch (this.scenario) {
      case 'freefall':
        ke = 0.5 * s.mass * s.vel * s.vel;
        peg = s.mass * G * s.y;
        break;
      case 'rampfriction':
        ke = 0.5 * s.mass * s.vel * s.vel;
        const α = this.params.rf_angle * Math.PI / 180;
        peg = s.mass * G * Math.max(0, (s.L - s.pos) * Math.sin(α));
        break;
      case 'springlaunch':
        if (s.phase === 'compress') { pes = 0.5 * this.params.sl_k * s.compression * s.compression; }
        else {
          ke = 0.5 * s.mass * s.vel * s.vel;
          pes = s.phase === 'spring' ? 0.5 * this.params.sl_k * s.compression * s.compression : 0;
          peg = s.mass * G * s.y;
        }
        break;
      case 'pendulum':
        ke = 0.5 * s.mass * s.L * s.L * s.omega * s.omega;
        peg = s.mass * G * s.L * (1 - Math.cos(s.theta));
        break;
      case 'angleexplorer':
        ke = 0.5 * s.mass * s.vel * s.vel;
        break;
    }
    return { ke, peg, pes, etotal: ke + peg + pes, wext: s.wext || 0, wfric: s.wfric || 0 };
  }

  workEquationParts() {
    const s = this.state;
    switch (this.scenario) {
      case 'freefall': return { F: 0, d: 0, cosTheta: 0, W: 0, note: 'No external work — gravity is internal' };
      case 'rampfriction': {
        const α = this.params.rf_angle * Math.PI / 180;
        const Ff = this.params.rf_mu * s.mass * G * Math.cos(α);
        return { F: Ff.toFixed(2), d: s.pos.toFixed(2), cosTheta: '180°', W: (-Ff * s.pos).toFixed(2), note: 'WEXT = −fk · d' };
      }
      case 'springlaunch': return { F: 'PEs', d: '—', cosTheta: '—', W: (0.5 * this.params.sl_k * this.params.sl_dx ** 2).toFixed(2), note: 'PEs converted to KE + PEg' };
      case 'pendulum': return { F: 'T', d: '—', cosTheta: '90°', W: 0, note: 'Tension ⊥ motion → WEXT = 0' };
      case 'angleexplorer': {
        const θ = this.params.ae_theta * Math.PI / 180;
        const W = this.params.ae_F * s.pos * Math.cos(θ);
        return { F: this.params.ae_F.toFixed(1), d: s.pos.toFixed(2), cosTheta: this.params.ae_theta + '°', cosVal: Math.cos(θ).toFixed(3), W: W.toFixed(2), note: 'WEXT = F · d · cos θ' };
      }
    }
  }

  _initState() {
    const p = this.params;
    switch (this.scenario) {
      case 'freefall': this.state = { mass: p.ff_mass, y: p.ff_height, vel: 0, done: false }; break;
      case 'rampfriction': this.state = { mass: p.rf_mass, pos: 0, vel: 0, L: p.rf_length, done: false, wfric: 0 }; break;
      case 'springlaunch': this.state = { mass: p.sl_mass, phase: 'spring', compression: p.sl_dx, vel: 0, y: 0, done: false }; break;
      case 'pendulum': this.state = { mass: p.pend_mass, L: p.pend_L, theta: p.pend_theta0 * Math.PI / 180, omega: 0, done: false }; break;
      case 'angleexplorer': this.state = { mass: p.ae_mass, pos: 0, vel: 0, done: false, wext: 0, wfric: 0 }; break;
    }
  }

  _step(dt) {
    const p = this.params, s = this.state;
    if (s.done) return;
    switch (this.scenario) {
      case 'freefall':
        s.vel -= G * dt; s.y += s.vel * dt;
        if (s.y <= 0) { s.y = 0; s.vel = 0; s.done = true; }
        break;
      case 'rampfriction': {
        const α = p.rf_angle * Math.PI / 180, Fg = s.mass * G * Math.sin(α), Ff = p.rf_mu * s.mass * G * Math.cos(α);
        const acc = (Fg - Ff) / s.mass; s.vel += acc * dt; if (s.vel < 0) s.vel = 0;
        const dp = s.vel * dt; s.pos += dp; s.wfric -= Ff * dp;
        if (s.pos >= s.L) { s.pos = s.L; s.vel = 0; s.done = true; }
        break;
      }
      case 'springlaunch':
        if (s.phase === 'spring') {
          const acc = (p.sl_k * s.compression) / s.mass; s.vel += acc * dt; s.compression -= s.vel * dt;
          if (s.compression <= 0) { s.compression = 0; s.phase = 'air'; }
        } else {
          s.vel -= G * dt; s.y += s.vel * dt;
          if (s.y <= 0 && s.vel < 0) { s.y = 0; s.vel = 0; s.done = true; }
        }
        break;
      case 'pendulum':
        s.omega += -(G / s.L) * Math.sin(s.theta) * dt; s.theta += s.omega * dt;
        if (this.time > 15) s.done = true;
        break;
      case 'angleexplorer': {
        const θ = p.ae_theta * Math.PI / 180, Fx = p.ae_F * Math.cos(θ), Fy = p.ae_F * Math.sin(θ);
        const acc = (Fx - p.ae_mu * Math.max(0, s.mass * G - Fy)) / s.mass; s.vel += acc * dt; if (s.vel < 0) s.vel = 0;
        const dp = s.vel * dt; s.pos += dp;
        if (s.pos >= p.ae_d) { s.pos = p.ae_d; s.vel = 0; s.done = true; }
        break;
      }
    }
  }

  problemSolvingPath() {
    switch (this.scenario) {
      case 'freefall': return { conservativeOnly: true, method: 'Ei = Ef' };
      case 'rampfriction': return { conservativeOnly: false, method: 'Ef = Ei + WEXT' };
      case 'springlaunch': return { conservativeOnly: true, method: 'Ei = Ef' };
      case 'pendulum': return { conservativeOnly: true, method: 'Ei = Ef' };
      case 'angleexplorer': return { conservativeOnly: false, method: 'Ef = Ei + WEXT' };
    }
  }
}

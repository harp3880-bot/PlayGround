export class HUD {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      hud: $('hud'), healthFill: $('health-fill'), healthNum: $('health-num'), healthTrack: document.querySelector('.health-track'),
      lowHealth: $('low-health'), ammoMag: $('ammo-mag'), ammoReserve: $('ammo-reserve'), ammoRow: document.querySelector('.ammo-row'),
      weaponName: $('weapon-name'), weaponMode: $('weapon-mode'), reloadFill: $('reload-fill'),
      grenades: $('grenades'), score: $('score'), waveLabel: $('wave-label'), hostiles: $('hostiles'), waveProgress: $('wave-progress'),
      objective: $('objective'), killfeed: $('killfeed'), hitmarker: $('hitmarker'), crosshair: $('crosshair'),
      damageVignette: $('damage-vignette'), damageArrows: $('damage-arrows'), hint: $('hint'), notice: $('notice'),
      subtitle: $('subtitle'), waveBanner: $('wave-banner'), interact: $('interact'), radar: $('radar'),
      bossBar: $('boss-bar'), bossFill: $('boss-fill'), compassStrip: $('compass-strip'), slot1: $('slot-1'), slot2: $('slot-2'),
      gameover: $('gameover'), statKills: $('stat-kills'), statHeads: $('stat-heads'), statAcc: $('stat-acc'),
      statTime: $('stat-time'), statScore: $('stat-score'), statWaves: $('stat-waves'), resultKicker: $('result-kicker'),
      resultTitle: $('result-title'), resultText: $('result-text'), newBest: $('new-best'),
    };
    this.radarCtx = this.el.radar.getContext('2d');
    this.timers = {};
    this.damageFlash = 0;
    this.aim = 0;
    this.time = 0;
    this.best = 0;
    this._buildCompass();
    this._buildDamageArrows();
    this._lastKillEls = [];
    this._reloadStart = 0;
    this._reloadDur = 0;
  }

  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }

  _buildCompass() {
    if (!this.el.compassStrip) return;
    const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    let html = '';
    for (let i = 0; i < 48; i++) {
      const deg = (i * 15) % 360;
      const label = names[deg] || String(deg).padStart(2, '0');
      const card = names[deg] ? ' card' : '';
      html += `<span class="${card.trim()}">${label}</span>`;
    }
    this.el.compassStrip.innerHTML = html;
  }

  _buildDamageArrows() {
    // create 8 pooled arrows
    for (let i = 0; i < 8; i++) {
      const d = document.createElement('div');
      d.className = 'dmg-arrow';
      this.el.damageArrows.appendChild(d);
    }
    this._arrowPool = [...this.el.damageArrows.children];
    this._arrowIdx = 0;
  }

  setHealth(health) {
    const pct = Math.max(0, Math.min(100, health));
    this.el.healthFill.style.width = pct + '%';
    this.el.healthNum.textContent = String(Math.ceil(pct)).padStart(3, '0');
    this.el.healthTrack.classList.toggle('low', pct < 30);
  }

  lowHealth(on) { this.el.lowHealth.classList.toggle('on', on); }

  setAmmo(mag, reserve) {
    this.el.ammoMag.textContent = String(mag).padStart(2, '0');
    this.el.ammoReserve.textContent = reserve === Infinity ? '∞' : String(reserve);
    this.el.ammoRow.classList.toggle('empty', mag === 0);
  }

  setWeapon(name, mode) { this.el.weaponName.textContent = name; this.el.weaponMode.textContent = mode; }
  setSlot(id) {
    this.el.slot1.classList.toggle('active', id === 'rifle');
    this.el.slot2.classList.toggle('active', id === 'pistol');
  }

  setReloading(on, duration = 2) {
    if (on) {
      this._reloadStart = performance.now();
      this._reloadDur = duration * 1000;
      this.el.reloadFill.style.transition = `width ${duration}s linear`;
      this.el.reloadFill.style.width = '0%';
      requestAnimationFrame(() => { this.el.reloadFill.style.width = '100%'; });
    } else {
      this.el.reloadFill.style.transition = 'none';
      this.el.reloadFill.style.width = '0%';
    }
  }

  setGrenades(n) {
    [...this.el.grenades.children].forEach((c, i) => c.classList.toggle('full', i < n));
  }

  setScore(n) { this.el.score.textContent = String(n).padStart(6, '0'); }

  setWave(n, total, remaining, totalInWave) {
    this.el.waveLabel.innerHTML = `WAVE <b>${String(n).padStart(2, '0')}</b> <span>/ ${String(total).padStart(2, '0')}</span>`;
    this.el.hostiles.innerHTML = `HOSTILES <b>${String(Math.max(0, remaining)).padStart(2, '0')}</b> REMAINING`;
    const p = totalInWave ? Math.max(0, Math.min(1, 1 - remaining / totalInWave)) : 0;
    this.el.waveProgress.style.width = (p * 100) + '%';
  }

  setObjective(text) { this.el.objective.textContent = text; }

  setBoss(health, max, show) {
    this.el.bossBar.classList.toggle('hidden', !show);
    if (show && max > 0) this.el.bossFill.style.width = Math.max(0, (health / max) * 100) + '%';
  }

  hitmarker(head = false, kill = false) {
    this.el.hitmarker.classList.remove('show', 'kill');
    void this.el.hitmarker.offsetWidth;
    this.el.hitmarker.classList.toggle('kill', kill || head);
    this.el.hitmarker.classList.add('show');
    clearTimeout(this._hitTimer);
    this._hitTimer = setTimeout(() => this.el.hitmarker.classList.remove('show'), kill ? 160 : 90);
  }

  killfeed(name, head = false, boss = false) {
    const div = document.createElement('div');
    div.className = 'feed' + (head ? ' head' : '');
    div.innerHTML = boss ? `<b>WARDEN</b> ▸ ELIMINATED` : `VECTOR-7 ▸ <b>${name}</b>${head ? ' ◉' : ''}`;
    this.el.killfeed.appendChild(div);
    this._lastKillEls.push(div);
    if (this._lastKillEls.length > 5) { const old = this._lastKillEls.shift(); old.remove(); }
    setTimeout(() => {
      div.classList.add('out');
      setTimeout(() => { div.remove(); this._lastKillEls = this._lastKillEls.filter(x => x !== div); }, 420);
    }, 4200);
  }

  setAim(aim) {
    this.aim = aim;
    this.el.crosshair.style.opacity = String(Math.max(0.06, 1 - aim * 1.15));
    this.el.crosshair.classList.toggle('ads', aim > 0.7);
  }

  setSpread(spread, aim, sprint) {
    this.aim = aim;
    const gap = Math.max(0.6, Math.min(2.2, 0.72 + spread * 30 + (sprint ? 0.25 : 0)));
    this.el.crosshair.style.transform = `translate(-50%,-50%) scale(${gap}) rotate(0deg)`;
    this.el.crosshair.style.opacity = String(Math.max(0.08, 1 - aim * 1.15));
    this.el.crosshair.classList.toggle('ads', aim > 0.7);
  }

  damage(amount) {
    this.damageFlash = Math.min(1, this.damageFlash + 0.45 + amount / 100);
    // directional arrow
    const p = window.__nightfall?.player;
    if (p) {
      const rot = (Math.PI - (p.lastDamageDir || 0)) * 180 / Math.PI;
      const d = this._arrowPool[this._arrowIdx]; this._arrowIdx = (this._arrowIdx + 1) % this._arrowPool.length;
      d.style.setProperty('--rot', rot + 'deg');
      d.classList.add('show');
      clearTimeout(d._t);
      d._t = setTimeout(() => d.classList.remove('show'), 900);
    }
    // camera shake handled in player
  }

  hint(text, dur = 1.4) {
    this.el.hint.textContent = text;
    this.el.hint.classList.add('show');
    clearTimeout(this.timers.hint);
    this.timers.hint = setTimeout(() => this.el.hint.classList.remove('show'), dur * 1000);
  }

  notice(text, dur = 2.6) {
    this.el.notice.textContent = text;
    this.el.notice.classList.add('show');
    clearTimeout(this.timers.notice);
    this.timers.notice = setTimeout(() => this.el.notice.classList.remove('show'), dur * 1000);
  }

  subtitle(text, dur = 4) {
    this.el.subtitle.textContent = text;
    this.el.subtitle.classList.add('show');
    clearTimeout(this.timers.subtitle);
    this.timers.subtitle = setTimeout(() => this.el.subtitle.classList.remove('show'), dur * 1000);
  }

  banner(kicker, big, sub, dur = 3.2) {
    this.el.waveBanner.innerHTML = `
      <div class="eyebrow"><span class="rule"></span>${kicker}<span class="rule"></span></div>
      <div class="big">${big}</div>
      <div class="sub">${sub}</div>`;
    this.el.waveBanner.classList.add('show');
    clearTimeout(this.timers.banner);
    this.timers.banner = setTimeout(() => this.el.waveBanner.classList.remove('show'), dur * 1000);
  }

  interact(text, show = true) {
    this.el.interact.textContent = text;
    this.el.interact.classList.toggle('show', show);
  }

  update(dt) {
    this.time += dt;
    // damage vignette fade
    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.5);
    this.el.damageVignette.style.opacity = String(this.damageFlash * 0.85);
    // compass
    const p = window.__nightfall?.player;
    if (p && this.el.compassStrip) {
      let heading = ((-p.yaw * 180 / Math.PI) % 360 + 360) % 360;
      const offset = heading * 2.94 + 9;
      this.el.compassStrip.style.transform = `translateX(${-offset}px)`;
    }
    // radar
    this.drawRadar();
  }

  drawRadar() {
    const p = window.__nightfall?.player;
    const em = window.__nightfall?.enemies;
    if (!p || !em) return;
    const ctx = this.radarCtx;
    const w = this.el.radar.width, h = this.el.radar.height;
    const cx = w / 2, cy = h / 2, R = w / 2 - 4;
    ctx.clearRect(0, 0, w, h);
    // background rings
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(4,8,11,0.35)'; ctx.fill();
    ctx.strokeStyle = 'rgba(233,229,220,0.10)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.62, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(233,229,220,0.07)'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.strokeStyle = 'rgba(233,229,220,0.045)'; ctx.stroke();
    // sweep
    const sweep = (this.time * 0.7) % (Math.PI * 2);
    const grad = ctx.createConicGradient ? ctx.createConicGradient(sweep - 0.5, cx, cy) : null;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, sweep - 0.55, sweep);
    ctx.closePath(); ctx.fillStyle = 'rgba(127,230,205,0.055)'; ctx.fill();
    // objective marker (uplink)
    const range = 30;
    const yaw = p.yaw;
    const map = (wx, wz) => {
      const dx = wx - p.position.x, dz = wz - p.position.z;
      const sx = dx * Math.cos(yaw) - dz * Math.sin(yaw);
      const sy = dx * Math.sin(yaw) + dz * Math.cos(yaw);
      return [cx + (sx / range) * R, cy + (sy / range) * R];
    };
    const [ox, oy] = map(0, -2);
    if (Math.hypot(ox - cx, oy - cy) < R - 2) {
      ctx.save(); ctx.translate(ox, oy); ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = 'rgba(242,174,85,.75)'; ctx.strokeRect(-4, -4, 8, 8); ctx.restore();
    }
    // enemies
    for (const e of em.enemies) {
      if (e.dead) continue;
      const [ex, ey] = map(e.position.x, e.position.z);
      const d = Math.hypot(ex - cx, ey - cy);
      if (d > R - 3) continue;
      const isBoss = e.type === 'heavy';
      ctx.beginPath(); ctx.arc(ex, ey, isBoss ? 4 : 2.2, 0, Math.PI * 2);
      ctx.fillStyle = isBoss ? '#ff3a2c' : e.state === 'attack' ? '#ff7a5c' : 'rgba(255,90,64,.75)';
      ctx.fill();
      if (isBoss) { ctx.beginPath(); ctx.arc(ex, ey, 7, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,58,44,.45)'; ctx.stroke(); }
    }
    // player triangle
    ctx.save(); ctx.translate(cx, cy);
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-4.5, 5); ctx.closePath();
    ctx.fillStyle = 'rgba(245,242,232,.9)'; ctx.fill(); ctx.restore();
    // heading text
    ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(127,230,205,.65)';
    ctx.fillText('N', cx - 3, 10);
    ctx.restore();
  }

  setResult({ victory, waves, kills, headshots, accuracy, time, score, best, newBest }) {
    this.el.resultKicker.textContent = victory ? 'OPERATION COMPLETE' : 'OPERATOR KIA';
    this.el.resultTitle.textContent = victory ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED';
    this.el.resultTitle.style.color = victory ? '#7fe6cd' : '#ff4438';
    this.el.resultText.textContent = victory
      ? 'The Warden is down and the uplink burst is secure. Exfil is inbound. Blacksite K-17 has been neutralized.'
      : 'The courtyard was overrun. Blacksite K-17 is lost and the Warden has gone dark.';
    this.el.statWaves.textContent = `${waves} / 5`;
    this.el.statKills.textContent = String(kills);
    this.el.statHeads.textContent = String(headshots);
    this.el.statAcc.textContent = Math.round(accuracy * 100) + '%';
    this.el.statTime.textContent = this.formatTime(time);
    this.el.statScore.textContent = String(score).padStart(6, '0');
    this.el.newBest.classList.toggle('hidden', !newBest);
    this.best = best;
  }

  formatTime(sec) {
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}

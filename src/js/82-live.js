// ============================================================================
// 82-live.js — Presentación en vivo compartida (capacidad «room» de Claude)
// El asesor (editor del artefacto) presenta: su cámara, la vista, el lote
// seleccionado, el modo de la casa y la luz se transmiten a todos los que tienen
// la página abierta en ese momento. Cada visitante puede dejar de seguir y
// explorar por su cuenta. Nada se guarda: es solo la sesión en vivo.
// ============================================================================

const Live = {
  room: null, user: null, canPresent: false, presenting: false,
  leader: null, following: true, pose: null, lastMsg: 0, peers: [],

  async init() {
    const c = window.claude; if (!c || typeof c.use !== 'function') return;
    const [room, user] = await Promise.all([c.use('room'), c.use('user')]);
    if (!room) return;
    this.room = room; this.user = user;
    this.canPresent = user ? await user.canEdit().catch(() => false) : false;
    $('#btnLive').hidden = !this.canPresent;
    $('#btnLive').onclick = () => this.presenting ? this.stop() : this.start();
    room.on('cam', m => this.onCam(m), () => { });
    room.on('live', m => { if (m.data && m.data.on === false && this.leader === m.peer) this.leaderGone(); });
    room.onPeers(ch => {
      this.peers = ch.peers;
      if (this.leader && ch.left.some(p => p.peer === this.leader)) this.leaderGone();
      if (this.presenting && ch.joined.length) this.send(true);
      this.renderPeers();
    }, () => { });
    $('#liveFollow').onclick = () => { this.following = !this.following; this.renderBanner(); if (this.following && this.pose) this.applyNow(); };
    $('#liveStop').onclick = () => this.stop();
    // si el visitante toma el control de la cámara, deja de seguir
    App.canvas.addEventListener('pointerdown', () => { if (this.leader && this.following && !this.presenting) { this.following = false; this.renderBanner(); } });
    setInterval(() => this.heartbeat(), 400);
    this.presence();
  },

  // ---- presentador ----
  start() {
    this.presenting = true; this.leader = null; document.body.classList.add('presenting');
    this.send(true); this.renderBanner(); this.presence();
    UI.toast(t('live.started'));
    Track.bump('live');
  },
  stop() {
    if (!this.presenting) return;
    this.presenting = false; document.body.classList.remove('presenting');
    this.room.emit('live', { on: false }).catch(() => { });
    this.renderBanner(); this.presence();
  },
  state() {
    const cam = App.camera, ctl = App.view === 'house' ? App.houseControls : App.siteControls;
    const r = v => Math.round(v * 100) / 100;
    return {
      v: App.view, p: cam.position.toArray().map(r), t: ctl.target.toArray().map(r), q: cam.quaternion.toArray().map(x => Math.round(x * 1e4) / 1e4),
      lot: UI.selectedLot || null, tod: Site.timeOfDay || 'dia',
      house: App.view === 'house' ? { code: HouseViewer.lotCode, model: HouseViewer.model?.id, mode: HouseViewer.mode, decor: HouseViewer.decor, maq: !!HouseViewer.maqueta } : null,
      ts: Date.now(),
    };
  },
  send(force) {
    if (!this.presenting || !this.room) return;
    if (!force && Date.now() - (this._sent || 0) < 160) return;
    const s = this.state(), sig = JSON.stringify({ ...s, ts: 0 });
    if (!force && sig === this._sig && Date.now() - this._sent < 2500) return;
    this._sig = sig; this._sent = Date.now();
    this.room.emit('cam', s).catch(e => { if (e && e.code === 'not_permitted') { this.presenting = false; this.renderBanner(); UI.toast(t('live.denied')); } });
  },
  heartbeat() { this.presence(); if (this.presenting) this.send(false); else if (this.leader && Date.now() - this.lastMsg > 12000) this.leaderGone(); },

  // ---- seguidores ----
  onCam(m) {
    if (m.sameTab || this.presenting || !m.data || m.data.v == null) return;
    if (this.leader !== m.peer) { this.leader = m.peer; this.leaderBy = m.by; this.following = true; this.renderBanner(); }
    this.lastMsg = Date.now(); this.pose = m.data;
    if (this.following) this.applyState(m.data);
  },
  leaderGone() { this.leader = null; this.pose = null; this.renderBanner(); },
  applyNow() { this.applyState(this.pose, true); },
  applyState(s, snap) {
    if (this._busy) return;
    const num = a => Array.isArray(a) && a.length >= 3 && a.every(Number.isFinite);
    if (!num(s.p) || !num(s.t)) return;
    if (s.v === 'site' || s.v === 'hero') {
      if (App.view === 'house') { this._busy = true; App.exitHouse(true); setTimeout(() => this._busy = false, 500); return; }
      if (App.view === 'hero') { $('#cta')?.click(); }
      if (s.tod && s.tod !== Site.timeOfDay && typeof Site.setTimeOfDay === 'function' && LIGHTING[s.tod]) Site.setTimeOfDay(s.tod);
      const code = typeof s.lot === 'string' ? s.lot : null;
      if (code !== (UI.selectedLot || null)) { if (code && Site.lotIndex.has(code)) UI.showLot(Site.lotIndex.get(code)); else if (!code) UI.closeLot(); }
    } else if (s.v === 'house' && s.house) {
      const h = s.house;
      if (App.view !== 'house' || HouseViewer.lotCode !== h.code || (h.model && HouseViewer.model?.id !== h.model)) {
        if (!Site.lotIndex.has(h.code) || (h.model && !Store.data.models[h.model])) return;
        this._busy = true; if (App.view === 'house') App.exitHouse(true);
        setTimeout(() => { App.enterHouse(h.code, h.model); setTimeout(() => this._busy = false, 900); }, App.view === 'house' ? 420 : 0);
        return;
      }
      if (h.decor && h.decor !== HouseViewer.decor && DECOR_STYLES.some(d => d.id === h.decor)) { HouseViewer.setDecor(h.decor); UI.syncDecor && UI.syncDecor(); }
      if (!!h.maq !== !!HouseViewer.maqueta) HouseViewer.setMaqueta(!!h.maq);
      if (h.mode && h.mode !== HouseViewer.mode && ['exterior', 'open', 'walk'].includes(h.mode)) { HouseViewer.setMode(h.mode === 'walk' ? 'open' : h.mode, true); }
    }
    this.goal = { p: new THREE.Vector3().fromArray(s.p), t: new THREE.Vector3().fromArray(s.t), q: Array.isArray(s.q) && s.q.length === 4 ? new THREE.Quaternion().fromArray(s.q) : null, walk: s.house?.mode === 'walk' };
    if (snap) { App.camera.position.copy(this.goal.p); }
  },
  // suavizado de la cámara en cada cuadro (antes de los controles)
  update(dt) {
    if (!this.goal || !this.following || !this.leader || this.presenting || this._busy) return false;
    const k = 1 - Math.exp(-dt * 6), ctl = App.view === 'house' ? App.houseControls : App.siteControls;
    App.camera.position.lerp(this.goal.p, k); ctl.target.lerp(this.goal.t, k);
    if (this.goal.walk && this.goal.q) App.camera.quaternion.slerp(this.goal.q, k); else App.camera.lookAt(ctl.target);
    return true;
  },

  // ---- presencia: qué está mirando cada persona ----
  presence() {
    if (!this.room) return;
    const p = { role: this.presenting ? 'presenter' : 'viewer', view: App.view, lot: UI.selectedLot || null, following: !!(this.leader && this.following) };
    const sig = JSON.stringify(p); if (sig === this._psig) return; this._psig = sig;
    this.room.presence(p).catch(() => { });
  },
  async renderPeers() {
    const el = $('#livePeers'); if (!el) return;
    const others = this.peers.filter(p => !p.sameTab && p.kind === 'viewer');
    const ids = [...new Set(others.map(p => p.by).filter(Boolean))];
    const prof = ids.length && this.user?.profiles ? await this.user.profiles(ids).catch(() => ({})) : {};
    el.innerHTML = '';
    if (!others.length) { el.textContent = t('live.alone'); return; }
    for (const p of others) {
      const li = document.createElement('li');
      const name = (p.by && prof[p.by]?.name) || (p.guest ? t('live.guest') : t('live.someone'));
      const pr = p.presence || {};
      li.textContent = name + (typeof pr.lot === 'string' ? ' · ' + t('live.seeing', { lot: pr.lot.slice(0, 20) }) : '') + (pr.following ? ' · ' + t('live.following') : '');
      el.append(li);
    }
  },
  renderBanner() {
    const b = $('#liveBar');
    b.hidden = !(this.presenting || this.leader);
    b.classList.toggle('is-presenter', this.presenting);
    $('#liveStop').hidden = !this.presenting; $('#livePeers').hidden = !this.presenting; $('#liveFollow').hidden = this.presenting;
    $('#liveFollow').textContent = this.following ? t('live.explore') : t('live.follow');
    $('#liveText').textContent = this.presenting ? t('live.on') : this.following ? t('live.watching') : t('live.paused');
    $('#btnLive').textContent = this.presenting ? t('live.stop') : t('live.btn');
    if (this.presenting) this.renderPeers();
    this.presence();
  },
};

Object.assign(I18N.es, {
  'live.btn': 'Presentar en vivo', 'live.stop': 'Terminar presentación', 'live.on': 'En vivo: todos ven tu pantalla 3D',
  'live.watching': 'Presentación en vivo del asesor', 'live.paused': 'Explorando por tu cuenta', 'live.explore': 'Explorar por mi cuenta',
  'live.follow': 'Volver a seguir al asesor', 'live.started': 'Presentación iniciada: quien tenga la página abierta verá lo mismo que vos',
  'live.denied': 'Solo quien edita el artefacto puede presentar', 'live.alone': 'Aún no hay nadie más conectado',
  'live.guest': 'Invitado', 'live.someone': 'Visitante', 'live.seeing': 'viendo {lot}', 'live.following': 'siguiendo',
});
Object.assign(I18N.en, {
  'live.btn': 'Present live', 'live.stop': 'End presentation', 'live.on': 'Live: everyone sees your 3D screen',
  'live.watching': 'Live presentation by the advisor', 'live.paused': 'Exploring on your own', 'live.explore': 'Explore on my own',
  'live.follow': 'Follow the advisor again', 'live.started': 'Presentation started: anyone with the page open sees what you see',
  'live.denied': 'Only artifact editors can present', 'live.alone': 'Nobody else is connected yet',
  'live.guest': 'Guest', 'live.someone': 'Visitor', 'live.seeing': 'viewing {lot}', 'live.following': 'following',
});

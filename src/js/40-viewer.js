// ============================================================================
// 40-viewer.js — Visor de vivienda: Casa completa · Casa abierta (Dollhouse)
// · Recorrer interior (primera persona con colisiones)
// ============================================================================

const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const Tweens = {
  list: [],
  add(dur, fn, done) { const tw = { t: 0, dur, fn, done }; this.list.push(tw); return tw; },
  clear(tag) { this.list = this.list.filter(t => t.tag !== tag); },
  update(dt) {
    for (const tw of this.list.slice()) {
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      tw.fn(ease(tw.t), tw.t);
      if (tw.t >= 1) { this.list.splice(this.list.indexOf(tw), 1); tw.done && tw.done(); }
    }
  },
};

function flyCamera(camera, controls, toPos, toTarget, dur = 1.3, done) {
  const fp = camera.position.clone(), ft = controls ? controls.target.clone() : new THREE.Vector3();
  Tweens.list = Tweens.list.filter(t => t.tag !== 'cam');
  const tw = Tweens.add(dur, k => {
    camera.position.lerpVectors(fp, toPos, k);
    if (controls) { controls.target.lerpVectors(ft, toTarget, k); camera.lookAt(controls.target); }
  }, done);
  tw.tag = 'cam';
}

const HouseViewer = {
  scene: null, house: null, surroundings: null, mode: 'exterior', decor: 'amueblada',
  model: null, lotCode: null, yaw: Math.PI, pitch: 0, keys: {}, joy: { x: 0, y: 0 }, roofK: 0, cutH: 100,
  hoverRoom: null,

  init() {
    const s = new THREE.Scene(); this.scene = s;
    s.background = new THREE.Color('#cfe1ee');
    s.fog = this._fog = new THREE.Fog('#dfe8ef', 110, 320);
    s.add(this.hemi = new THREE.HemisphereLight('#eef5ff', '#5d6447', 0.35));
    const sun = this.sun = new THREE.DirectionalLight('#fff0d6', 3.0);
    sun.position.set(-16, 15, -12); sun.castShadow = true;
    this.sky = makeRealSky(s, App.renderer, sun.position.clone(), { envIntensity: 0.5, scale: 3000 });
    this.clouds = makeClouds(1500, 9); s.add(this.clouds);
    sun.shadow.mapSize.set(App.lowEnd ? 1024 : 4096, App.lowEnd ? 1024 : 4096);
    const c = sun.shadow.camera; c.left = -15; c.right = 15; c.top = 15; c.bottom = -15; c.near = 1; c.far = 70;
    sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.025;
    sun.target.position.set(3.25, 0, 4);
    s.add(sun, sun.target);
    // luz interior suave para el recorrido
    this.interior = new THREE.PointLight('#fff1dc', 0, 12, 1.4); this.interior.position.set(3.25, 2.3, 4); s.add(this.interior);
    this.bindWalkInput();
  },

  open(lotCode, modelId, decor) {
    const model = Store.data.models[modelId] || { ...DEFAULT_MODELS[modelId || 'A'], plan: PLAN_52 };
    this.model = model; this.lotCode = lotCode;
    this.decor = decor || model.style || 'amueblada';
    this.rebuild();
    this.setMode('exterior', true);
  },

  // Vista maqueta: casa aislada sobre su bloque de terreno, fondo de estudio
  maqueta: false,
  setMaqueta(on) {
    this.maqueta = !!on;
    const s = this.surroundings; if (!s) return;
    s.ctx.visible = !on; s.base.visible = on;
    this.sky.visible = !on; this.clouds.visible = !on;
    // iluminación de estudio para la maqueta: luz más pareja, sombras suaves y tono claro
    this.hemi.intensity = on ? 1.05 : 0.35; this.hemi.color.set(on ? '#ffffff' : '#eef5ff'); this.hemi.groundColor.set(on ? '#d9d4ca' : '#5d6447');
    this.sun.intensity = on ? 2.1 : 3.0; this.sun.position.set(on ? -7 : -16, on ? 22 : 15, on ? -10 : -12);
    this.scene.environmentIntensity = on ? 0.85 : 0.5;
    App.renderer.toneMappingExposure = on ? 0.95 : 0.82;
    this.scene.background.set(on ? '#f3f2ee' : '#cfe1ee');
    this.scene.fog = on ? null : this._fog || (this._fog = new THREE.Fog('#dde6ea', 70, 220));
    UI.syncMaqueta && UI.syncMaqueta();
  },

  setCut(on) { const h = this.house; if (!h) return; h.walls.visible = !on; h.wallsCut.visible = on; if (on) CutPlane.constant = 100; },
  unCut() { if (this.house?.wallsCut.visible) { this.setCut(false); CutPlane.constant = this.house.HC; } },

  rebuild() {
    const wasCut = !!this.house?.wallsCut.visible;
    if (this.house) this.scene.remove(this.house.root);
    if (this.surroundings) this.scene.remove(this.surroundings.group);
    this.house = buildHouse(this.model, this.decor);
    this.surroundings = buildHouseSurroundings(this.model, this.house.W, this.house.D);
    this.scene.add(this.house.root, this.surroundings.group);
    this.setMaqueta(this.maqueta);
    this.applyRoof(this.roofK);
    if (wasCut) this.setCut(true);
    UI.renderRoomTags();
  },

  setDecor(decor) {
    this.decor = decor;
    const pal = { ...PALETTES[decor], id: decor };
    // muebles + pintura interior + piso, sin perder la cámara
    const used = buildFurniture(this.house.furniture, this.model.plan || PLAN_52, decor, pal, this.house.colliders);
    this.house.rooms.forEach(r => r.items = used.filter(f => f.room === r.id).map(f => ITEM_NAMES[f.item] || f.item));
    this.house.walls.traverse(o => {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => { if (m && m.userData.interior) m.color.set(pal.wall); });
    });
    this.house.decor = decor;
    // repintar: reconstruir muros/pisos completos es más sencillo y consistente
    const keep = { mode: this.mode, roofK: this.roofK, cut: CutPlane.constant };
    this.rebuild();
    this.roofK = keep.roofK; this.applyRoof(this.roofK); CutPlane.constant = keep.cut;
  },

  applyRoof(k) {
    // k = 0 techo puesto, 1 techo retirado
    if (!this.house) return;
    const r = this.house.roof;
    r.position.y = k * 3.2;
    r.traverse(o => { if (o.material) { o.material.opacity = 1 - k; o.material.depthWrite = k < 0.5; } });
    r.visible = k < 0.99;
  },

  setMode(mode, instant) {
    const prev = this.mode; this.mode = mode;
    const cam = App.camera, ctl = App.houseControls;
    const W = this.house.W, D = this.house.D, center = new THREE.Vector3(W / 2, 1.0, D / 2);
    const dur = instant ? 0.01 : 1.4;
    UI.houseModeChanged(mode);
    const animRoof = (to, cutTo) => {
      this.unCut();
      const r0 = this.roofK, c0 = Math.min(CutPlane.constant, 6);
      Tweens.add(dur * 0.9, k => {
        this.roofK = r0 + (to - r0) * k; this.applyRoof(this.roofK);
        CutPlane.constant = c0 + (cutTo - c0) * k;
      }, () => { CutPlane.constant = cutTo >= 6 ? 100 : cutTo; this.cutH = CutPlane.constant; if (cutTo < 6) this.setCut(true); });
    };
    if (mode === 'exterior') {
      App.setWalk(false);
      ctl.enabled = true; ctl.minDistance = 6; ctl.maxDistance = 45; ctl.maxPolarAngle = Math.PI * 0.48;
      animRoof(0, 6);
      if (prev === 'walk' || instant) { cam.position.set(W / 2 - 9, 1.7, -10); ctl.target.set(W / 2, 1.6, 0); }
      const k = App.width < 700 ? 1.55 : 1;
      flyCamera(cam, ctl, new THREE.Vector3(W / 2 + (-8.5 - W / 2) * k, 6.2 * k, D / 2 + (-12.5 - D / 2) * k), new THREE.Vector3(W / 2, 1.4, D / 2 - 0.5), dur);
      this.interior.intensity = 0;
    } else if (mode === 'open') {
      App.setWalk(false);
      if (!this._maqAuto) { this._maqAuto = true; this.setMaqueta(true); }   // la casa abierta se presenta como maqueta de estudio
      ctl.enabled = true; ctl.minDistance = 4; ctl.maxDistance = 30; ctl.maxPolarAngle = Math.PI * 0.42;
      if (prev === 'walk') { ctl.target.copy(cam.position).add(new THREE.Vector3(0, -0.6, 0).add(App.forward().multiplyScalar(2))); }
      animRoof(1, this.house.HC);
      const k = App.width < 700 ? 1.7 : 1;
      flyCamera(cam, ctl, new THREE.Vector3(W / 2 - 6.0 * k, 13.5 * k, D / 2 - 7.5 * k), center.clone().setY(0.4), dur * 1.15);
      this.interior.intensity = 0;
    } else if (mode === 'walk') {
      if (this.maqueta) this.setMaqueta(false);
      animRoof(0, 6);
      this.interior.intensity = 6;
      if (instant) this.placeWalker(1.45, 1.0, 0);
    }
  },

  placeWalker(x, z, yaw) {
    const cam = App.camera;
    cam.position.set(x, 1.6, z); this.yaw = yaw; this.pitch = -0.05;
    cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    App.houseControls.enabled = false; App.setWalk(true);
  },

  // Entra a un ambiente con transición de cámara
  enterRoom(roomId) {
    if (this.maqueta) this.setMaqueta(false);
    const r = this.house.rooms.find(q => q.id === roomId) || this.house.rooms[0];
    // punto con mayor holgura respecto a muebles y muros del ambiente
    const cols = this.house.colliders;
    const clearance = (x, z) => {
      let d = Math.min(x - r.x, r.x + r.w - x, z - r.z, r.z + r.d - z);
      for (const c of cols) {
        const dx = Math.max(c.x0 - x, 0, x - c.x1), dz = Math.max(c.z0 - z, 0, z - c.z1);
        d = Math.min(d, Math.hypot(dx, dz));
      }
      return d;
    };
    // punto focal: centro de los muebles del ambiente (o centro del ambiente)
    const inRoom = (this.model.plan || PLAN_52).furniture.filter(f => f.room === r.id && (!f.styles || f.styles.includes(this.decor)) && this.decor !== 'vacia' && !['rug', 'pendant', 'picture'].includes(f.item));
    const fx = inRoom.length ? inRoom.reduce((a, f) => a + f.x, 0) / inRoom.length : r.x + r.w / 2;
    const fz = inRoom.length ? inRoom.reduce((a, f) => a + f.z, 0) / inRoom.length : r.z + r.d / 2;
    // posición tipo "fotógrafo": libre de obstáculos y lo más lejos posible del punto focal
    let tx = r.x + r.w / 2, tz = r.z + r.d / 2, best = -Infinity;
    for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) {
      const x = r.x + 0.3 + (r.w - 0.6) * (i / 12), z = r.z + 0.3 + (r.d - 0.6) * (j / 12);
      const cl = clearance(x, z); if (cl < 0.3) continue;
      const sc = Math.min(cl, 0.5) * 2 + Math.hypot(x - fx, z - fz) * 0.6;
      if (sc > best) { best = sc; tx = x; tz = z; }
    }
    const dF = Math.hypot(fx - tx, fz - tz);
    const yaw = dF > 0.2 ? Math.atan2(-(fx - tx), -(fz - tz)) : (r.d >= r.w ? Math.PI : -Math.PI / 2);
    const pitch = -Math.min(0.45, Math.max(0.12, Math.atan(1.0 / Math.max(dF, 0.5)) * 0.6));
    const cam = App.camera, from = cam.position.clone();
    const to = new THREE.Vector3(tx, 1.6, tz);
    const q0 = cam.quaternion.clone();
    const q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    App.houseControls.enabled = false;
    this.mode = 'walk'; UI.houseModeChanged('walk');
    this.unCut();
    const r0 = this.roofK, c0 = Math.min(CutPlane.constant, 6);
    this.interior.intensity = 6;
    Tweens.add(1.6, k => {
      cam.position.lerpVectors(from, to, k);
      cam.quaternion.slerpQuaternions(q0, q1, k);
      const kr = Math.max(0, (k - 0.55) / 0.45);
      this.roofK = r0 * (1 - kr); this.applyRoof(this.roofK);
      CutPlane.constant = c0 + (6 - c0) * kr;
    }, () => { CutPlane.constant = 100; this.placeWalker(tx, tz, yaw); this.pitch = pitch; UI.toast(`Estás en: ${r.name}`); });
  },

  exitOutside() {
    if (this.mode !== 'walk') this.setMode('walk', true);
    this.placeWalker(1.45, -2.4, Math.PI);
    UI.toast('Estás en el jardín frontal');
  },
  enterFront() {
    this.setMode('walk');
    const cam = App.camera, from = cam.position.clone(), to = new THREE.Vector3(1.45, 1.6, -2.6);
    const q0 = cam.quaternion.clone(), q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.04, Math.PI, 0, 'YXZ'));
    App.houseControls.enabled = false;
    Tweens.add(1.3, k => { cam.position.lerpVectors(from, to, k); cam.quaternion.slerpQuaternions(q0, q1, k); },
      () => { this.placeWalker(1.45, -2.6, Math.PI); UI.toast('Caminá hacia la puerta para entrar'); });
  },

  roomAt(x, z) { return this.house?.rooms.find(r => x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.d) || null; },

  // ---- primera persona ----
  bindWalkInput() {
    addEventListener('keydown', e => { if (e.target.closest('input,textarea,select')) return; this.keys[e.code] = true; });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; });
    const cv = App.canvas;
    let drag = null;
    cv.addEventListener('pointerdown', e => {
      if (!App.walking) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', e => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      const s = e.pointerType === 'touch' ? 0.006 : 0.0042;
      this.yaw -= dx * s; this.pitch = Math.max(-1.2, Math.min(1.1, this.pitch - dy * s));
    });
    const end = e => { if (drag && drag.id === e.pointerId) drag = null; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    // joystick táctil
    const pad = $('#joy'), knob = $('#joy i');
    let jid = null, cx = 0, cy = 0;
    pad.addEventListener('pointerdown', e => { jid = e.pointerId; const r = pad.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; pad.setPointerCapture(jid); move(e); });
    const move = e => {
      if (e.pointerId !== jid) return;
      let dx = e.clientX - cx, dy = e.clientY - cy; const m = Math.hypot(dx, dy), R = 42;
      if (m > R) { dx *= R / m; dy *= R / m; }
      knob.style.transform = `translate(${dx}px,${dy}px)`; this.joy.x = dx / R; this.joy.y = dy / R;
    };
    pad.addEventListener('pointermove', move);
    const stop = e => { if (e.pointerId !== jid) return; jid = null; knob.style.transform = ''; this.joy.x = this.joy.y = 0; };
    pad.addEventListener('pointerup', stop); pad.addEventListener('pointercancel', stop);
    // botones de giro para teclado/accesibilidad
  },

  updateWalk(dt) {
    const cam = App.camera, k = this.keys;
    let f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) - this.joy.y;
    let s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + this.joy.x;
    if (k.ArrowLeft) this.yaw += dt * 1.8;
    if (k.ArrowRight) this.yaw -= dt * 1.8;
    if (k.KeyQ) this.yaw += dt * 1.8;
    if (k.KeyE) this.yaw -= dt * 1.8;
    const run = k.ShiftLeft || k.ShiftRight ? 1.8 : 1;
    const speed = 1.7 * run;
    const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const dx = (-sin * f + cos * s) * speed * dt, dz = (-cos * f - sin * s) * speed * dt;
    const R = 0.22, cols = this.house.colliders.concat(this.surroundings.colliders), b = this.surroundings.bounds;
    const blocked = (x, z) => x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1 || cols.some(c => x > c.x0 - R && x < c.x1 + R && z > c.z0 - R && z < c.z1 + R);
    const p = cam.position;
    if (!blocked(p.x + dx, p.z)) p.x += dx;
    if (!blocked(p.x, p.z + dz)) p.z += dz;
    const bob = len > 0.05 ? Math.sin(performance.now() / 160) * 0.018 : 0;
    p.y = 1.6 + bob;
    cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    const room = this.roomAt(p.x, p.z);
    UI.setWalkRoom(room ? room.name : (p.z < 0 ? 'Jardín frontal' : 'Patio'));
  },

  // ---- selección de ambientes en Casa abierta ----
  pickRoom(raycaster) {
    if (!this.house) return null;
    const hots = this.house.rooms.map(r => r.hot);
    const h = raycaster.intersectObjects(hots, false)[0];
    return h ? h.object.userData.room : null;
  },
  setHoverRoom(id) {
    if (this.hoverRoom === id) return;
    this.hoverRoom = id;
    this.house.rooms.forEach(r => { r.hot.material.opacity = r.id === id ? 0.28 : (r.id === UI.selectedRoom ? 0.18 : 0); });
  },
};

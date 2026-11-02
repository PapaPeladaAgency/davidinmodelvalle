// ============================================================================
// 20-site.js — Residencial 3D (vista aérea interactiva)
// Construye terreno, calles, manzanas, lotes, viviendas, vegetación y accesos
// a partir de LAYOUT (trazado aproximado) + inventario de la base de datos.
// ============================================================================

const _c = new THREE.Color();
const hash01 = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };
const mulberry = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function shapeFromPx(poly) {
  const s = new THREE.Shape();
  poly.forEach(([px, py], i) => { const [x, z] = pxToWorld(px, py); i ? s.lineTo(x, -z) : s.moveTo(x, -z); });
  return s;
}
function flatShapeMesh(poly, color, y, opts = {}) {
  const g = new THREE.ShapeGeometry(shapeFromPx(poly));
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...opts }));
  m.position.y = y; m.receiveShadow = true;
  return m;
}

// Textura de fachada por modelo (ventanas y puerta dibujadas en canvas)
function facadeTexture(model) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const f = model.facade;
  g.fillStyle = f.wall; g.fillRect(0, 0, 256, 128);
  g.fillStyle = f.accent; if (model.id === 'B') g.fillRect(150, 0, 106, 128);
  g.fillRect(0, 118, 256, 10);
  g.fillStyle = '#5c7a93';
  [[30, 40, 44, 40], [180, 40, 50, 40], [100, 40, 30, 30]].forEach(([x, y, w, h]) => {
    g.fillStyle = f.trim; g.fillRect(x - 3, y - 3, w + 6, h + 6);
    g.fillStyle = '#7fa3bf'; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, y, w / 2, h);
  });
  g.fillStyle = f.trim; g.fillRect(138, 54, 26, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

const Site = {
  scene: null, group: null, lots: [], lotIndex: new Map(),
  pads: null, pins: null, houseMeshes: [], labels: [],
  colorMode: 'real', stageFilter: 0, focusBlock: null, showIllustrative: true, hovered: -1, selected: -1,
  overlay: null,

  init() {
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.background = new THREE.Color('#bcd6e8');
    scene.fog = new THREE.Fog('#d3e0ea', 900, 3600);
    const hemi = this.hemi = new THREE.HemisphereLight('#e6f0fb', '#5a6440', 0.35);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight('#ffeacc', 2.9);
    sun.position.set(-300, 300, -170);
    this.sun = sun; this.sunOffset = sun.position.clone();
    this.skyMesh = makeRealSky(scene, App.renderer, sun.position.clone(), { envIntensity: 0.45, scale: 5000 });
    this.clouds = makeClouds(2400, 4); scene.add(this.clouds);
    sun.castShadow = true;
    sun.shadow.mapSize.set(App.lowEnd ? 1024 : 2048, App.lowEnd ? 1024 : 2048);
    const sc = sun.shadow.camera; sc.left = -320; sc.right = 320; sc.top = 320; sc.bottom = -320; sc.near = 50; sc.far = 1200;
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.6;
    sun.target.position.set(0, 0, 60);
    scene.add(sun, sun.target);
    this.group = new THREE.Group(); scene.add(this.group);
    this.buildEnvironment();
  },

  // Entorno permanente: suelo, cerros, volcán, carretera
  buildEnvironment() {
    const env = new THREE.Group(); this.scene.add(env);
    buildMountains(env);
    const gg = new THREE.PlaneGeometry(4200, 4200, 70, 70); gg.rotateX(-Math.PI / 2);
    const pos = gg.attributes.position, cols = [];
    const rnd = mulberry(7);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z - 60);
      const hill = r > 480 ? Math.pow((r - 480) / 900, 1.6) * 90 * (0.6 + 0.4 * Math.sin(x * 0.004) * Math.cos(z * 0.003)) : 0;
      pos.setY(i, hill - 0.4);
      _c.set('#6f8a46').lerp(new THREE.Color('#8c8a4f'), rnd() * 0.5).lerp(new THREE.Color('#4e6b35'), Math.min(1, hill / 80));
      cols.push(_c.r, _c.g, _c.b);
    }
    gg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    gg.computeVertexNormals();
    const gm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    const ground = new THREE.Mesh(gg, gm);
    ground.receiveShadow = true; env.add(ground);
    // Carretera principal (norte) y vía sur
    const asphalt = new THREE.MeshStandardMaterial({ color: '#4a4d52', roughness: 0.9 });
    const hw = new THREE.Mesh(new THREE.BoxGeometry(2400, 0.3, 16), asphalt);
    const [, hz] = pxToWorld(0, LAYOUT.highway.y); hw.position.set(0, 0.05, hz); hw.receiveShadow = true; env.add(hw);
    const lineMat = new THREE.MeshBasicMaterial({ color: '#f2f2ea' });
    for (let x = -1150; x < 1150; x += 12) { const d = new THREE.Mesh(new THREE.BoxGeometry(6, 0.32, 0.3), lineMat); d.position.set(x, 0.06, hz); env.add(d); }
    const [ax, az0] = pxToWorld(...LAYOUT.access.from), [, az1] = pxToWorld(...LAYOUT.access.to);
    const acc = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, Math.abs(az0 - az1) + 4), asphalt);
    acc.position.set(ax, 0.06, (az0 + az1) / 2); acc.receiveShadow = true; env.add(acc);
    // vía sur diagonal
    const [sx0, sz0] = pxToWorld(380, 716), [sx1, sz1] = pxToWorld(1260, 800);
    const sl = Math.hypot(sx1 - sx0, sz1 - sz0);
    const south = new THREE.Mesh(new THREE.BoxGeometry(sl, 0.3, 8), asphalt);
    south.position.set((sx0 + sx1) / 2, 0.05, (sz0 + sz1) / 2 + 8); south.rotation.y = -Math.atan2(sz1 - sz0, sx1 - sx0);
    env.add(south);
    this.env = env;
  },

  clear() {
    this.labels.forEach(l => l.el.remove()); this.labels = [];
    while (this.group.children.length) {
      const o = this.group.children.pop();
      o.traverse(n => { if (n.geometry) n.geometry.dispose(); });
    }
    this.houseMeshes = []; this.pads = null; this.pins = null; this.amenityMeshes = []; this.simple = null;
  },

  // Construye el residencial para un proyecto
  build(project) {
    this.clear();
    this.project = project;
    const inv = Store.data.lots;
    let lots;
    if (project.hasLayout) {
      lots = App.layoutLots.map(l => ({ ...l }));
      this.buildLayoutGround();
    } else {
      lots = this.gridLotsFor(project);
      this.buildGenericGround(project, lots);
    }
    // Inventario: lotes agregados al proyecto que no están en el trazado
    this.lots = lots;
    this.lotIndex = new Map(lots.map((l, i) => [l.code, i]));
    this.buildLots();
    this.buildHouses();
    this.buildPins();
    this.buildTrees(project.hasLayout);
    if (project.hasLayout) this.buildPalms();
    this.buildLabels(project);
    this.buildOverlay(project);
    this.refreshColors();
  },

  gridLotsFor(project) {
    const inv = Object.values(Store.data.lots).filter(l => l.projectId === project.id).sort((a, b) => a.code.localeCompare(b.code));
    const cols = 8;
    return inv.map((l, i) => ({
      code: l.code, stage: l.stage || 1, block: `E${l.stage || 1}-M01`, x: (i % cols) * 9 - cols * 4.5, z: Math.floor(i / cols) * 22 - 40,
      front: 8, depth: 16, alongX: true, face: [0, Math.floor(i / cols) % 2 ? 1 : -1], area: l.area || 128,
    }));
  },

  buildGenericGround(project, lots) {
    const rows = Math.ceil(Math.max(lots.length, 1) / 8);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(110, 0.3, rows * 22 + 30), new THREE.MeshStandardMaterial({ color: '#56595e', roughness: .9 }));
    pad.position.set(-4.5, 0.05, rows * 11 - 51); pad.receiveShadow = true; this.group.add(pad);
  },

  buildLayoutGround() {
    const G = this.group;
    const streets = flatShapeMesh(LAYOUT.boundary, '#55585d', 0.12, { roughness: 0.88 });
    if (!App.noPBR) { scaleUV(streets.geometry, 1 / pbrSize('adoquin')); streets.material = pbrMat('adoquin', { color: '#e8e4dc' }); }
    G.add(streets);
    // Aceras / bordillos por manzana
    const curbMat = App.noPBR ? new THREE.MeshStandardMaterial({ color: '#cfccc4', roughness: 0.9 }) : pbrMat('acera');
    for (const b of LAYOUT.blocks) {
      const [x0, z0] = pxToWorld(b.r[0], b.r[1]), [x1, z1] = pxToWorld(b.r[2], b.r[3]);
      const m = new THREE.Mesh(worldUV(new THREE.BoxGeometry(x1 - x0 + 3, 0.3, z1 - z0 + 3), pbrSize('acera'), pbrSize('acera'), [(x0 + x1) / 2, 0, (z0 + z1) / 2]), curbMat);
      m.position.set((x0 + x1) / 2, 0.2, (z0 + z1) / 2); m.receiveShadow = true; G.add(m);
    }
    // Áreas verdes
    for (const p of LAYOUT.parks) {
      const m = flatShapeMesh(p.poly, '#5f9a45', 0.3);
      if (!App.noPBR) { scaleUV(m.geometry, 1 / pbrSize('zacate')); m.material = pbrMat('zacate'); }
      m.userData.amenity = p.id; G.add(m);
    }
    buildAmenities(G, this);
    buildStreetLife(G, this);
    // Límite punteado (como en la referencia)
    const dashMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const dashGeo = new THREE.BoxGeometry(3.2, 0.5, 0.8);
    const pts = LAYOUT.boundary.map(p => pxToWorld(...p));
    const dashes = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      for (let t = 2; t < len; t += 6) dashes.push([a[0] + Math.cos(ang) * t, a[1] + Math.sin(ang) * t, ang]);
    }
    const dm = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
    const o = new THREE.Object3D();
    dashes.forEach(([x, z, ang], i) => { o.position.set(x, 0.45, z); o.rotation.set(0, -ang, 0); o.updateMatrix(); dm.setMatrixAt(i, o.matrix); });
    G.add(dm);
    // Caseta de acceso
    const [gx, gz] = pxToWorld(...LAYOUT.access.gate);
    const gate = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: '#e8e1d4' });
    [-7, 7].forEach(x => { const p = new THREE.Mesh(new THREE.BoxGeometry(2.4, 6, 2.4), postMat); p.position.set(x, 3, 0); p.castShadow = true; gate.add(p); });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(17, 1.4, 2.6), new THREE.MeshStandardMaterial({ color: '#7a4f35' }));
    beam.position.y = 6.4; beam.castShadow = true; gate.add(beam);
    const booth = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3, 3.5), postMat); booth.position.set(-11, 1.5, 2); booth.castShadow = true; gate.add(booth);
    gate.position.set(gx, 0, gz); G.add(gate);
    // Línea central de calles principales (eje norte-sur)
    const [cx0, cz0] = pxToWorld(748, 128), [, cz1] = pxToWorld(748, 600);
    const lm = new THREE.MeshBasicMaterial({ color: '#e8e4d0' });
    for (let z = cz0; z < cz1; z += 9) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 4), lm); d.position.set(cx0, 0.2, z); G.add(d); }
  },

  buildLots() {
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92 });
    if (!App.noPBR) { const t = new THREE.TextureLoader().load('tex/leafy_grass_albedo.jpg'); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); mat.map = t; }
    const pads = new THREE.InstancedMesh(geo, mat, Math.max(1, this.lots.length));
    pads.receiveShadow = true;
    const o = new THREE.Object3D();
    this.lots.forEach((l, i) => {
      const w = l.alongX ? l.front - 0.45 : l.depth - 0.45, d = l.alongX ? l.depth - 0.45 : l.front - 0.45;
      o.position.set(l.x, 0.35, l.z); o.scale.set(w, 0.12, d); o.rotation.set(0, 0, 0); o.updateMatrix();
      pads.setMatrixAt(i, o.matrix); pads.setColorAt(i, _c.set('#9bbf7a'));
    });
    pads.count = this.lots.length;
    pads.userData.kind = 'pads';
    this.pads = pads; this.group.add(pads);
    // Marco de selección / hover
    const ring = (color) => {
      const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
      const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true }));
      m.renderOrder = 10; m.visible = false; this.group.add(m); return m;
    };
    this.hoverBox = ring('#ffffff'); this.selBox = ring('#fff36b');
  },

  houseFor(l) {
    const inv = Store.data.lots[l.code];
    if (inv && inv.projectId === this.project.id) return inv.model || null;
    if (!this.showIllustrative || !this.project.hasLayout) return null;
    // residencial completo: cada lote con vivienda (modelo asignado por calle para dar uniformidad)
    const blockHash = hash01(l.block + (l.face[0] + ',' + l.face[1]));
    const r = hash01(l.code + 'm');
    const base = ['A', 'B', 'C'][Math.floor(blockHash * 3)];
    return r < 0.7 ? base : ['A', 'B', 'C'][Math.floor(r * 30) % 3];
  },

  // Transformación de la casa dentro del lote (frente hacia la calle)
  houseXform(l, o, d = 8) {
    const set = Math.max(0, l.depth / 2 - 2.2 - d / 2);
    o.position.set(l.x + l.face[0] * set, 0.47, l.z + l.face[1] * set);
    o.rotation.set(0, Math.atan2(l.face[0], l.face[1]), 0);
  },

  buildHouses() {
    this.houseMeshes.forEach(m => { this.group.remove(m); });
    this.houseMeshes = [];
    const models = Store.data.models;
    this.houseLots = {};   // modelo → índices de lotes
    this.lots.forEach((l, i) => { const m = this.houseFor(l); if (m) (this.houseLots[m] || (this.houseLots[m] = [])).push(i); });
    this.simple = {}; this.detail = {};
    for (const [mid, idxs] of Object.entries(this.houseLots)) {
      const model = models[mid] || { ...DEFAULT_MODELS[mid] || DEFAULT_MODELS.A, plan: PLAN_52 };
      // --- nivel lejano: volumen simple ---
      const bodyGeo = new THREE.BoxGeometry(1, 1, 1); bodyGeo.translate(0, 0.5, 0);
      const wallMat = stuccoMat('#ffffff');
      let mats;
      try {
        const imp = bakeImpostor(model);
        const fm = t => new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, envMapIntensity: 0.35 });
        mats = [fm(imp.right), fm(imp.left), wallMat, wallMat, fm(imp.front), fm(imp.back)];
      } catch (e) { console.warn('impostor', e); const faceMat = new THREE.MeshStandardMaterial({ map: facadeTexture(model), roughness: 0.9 }); mats = [faceMat, faceMat, wallMat, wallMat, faceMat, faceMat]; }
      const body = new THREE.InstancedMesh(bodyGeo, mats, idxs.length);
      let roofGeo, roofMat;
      if (model.facade.roof === 'gable') {
        roofGeo = gableGeo(1.14, 1.08);
        roofMat = [App.noPBR ? new THREE.MeshStandardMaterial({ color: model.facade.roofColor }) : pbrMat('teja', { color: '#f2e6dc' }), stuccoMat(model.facade.wall)];
        const uv = roofGeo.attributes.uv; for (let i = 6; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8 / pbrSize('teja'), uv.getY(i) * 4 / pbrSize('teja'));
      } else { roofGeo = new THREE.BoxGeometry(1.04, 0.3, 1.04); roofGeo.translate(0, 0.15, 0); const cm = new THREE.MeshStandardMaterial({ color: '#ffffff', map: concreteTex(), roughness: 0.95 }); const pm = stuccoMat(model.facade.roof === 'flat' ? model.facade.accent : '#ffffff'); roofMat = [pm, pm, cm, pm, pm, pm]; }
      const roof = new THREE.InstancedMesh(roofGeo, roofMat, idxs.length);
      body.castShadow = roof.castShadow = true; body.receiveShadow = true; body.frustumCulled = roof.frustumCulled = false;
      body.userData = { kind: 'house', map: [] }; roof.userData = { kind: 'house', map: body.userData.map };
      body.userData.gable = model.facade.roof === 'gable';
      this.group.add(body, roof); this.houseMeshes.push(body, roof);
      this.simple[mid] = { body, roof, model };
      // --- nivel cercano: casa detallada fusionada por material ---
      const tpl = detailTemplate(model);
      const dm = tpl.map(({ geo, mat }) => {
        const im = new THREE.InstancedMesh(geo, mat, idxs.length);
        im.castShadow = !mat.transparent; im.receiveShadow = true; im.count = 0; im.frustumCulled = false;
        im.userData = { kind: 'house', map: [] };
        this.group.add(im); this.houseMeshes.push(im);
        return im;
      });
      dm.forEach((im, i) => { im.userData.paint = tpl[i].paint; im.userData.roofPaint = tpl[i].roofPaint; });
      this.detail[mid] = dm;
    }
    // vida en los lotes cercanos: carros estacionados y árboles de patio
    this.life = {};
    const mk = (tpl, n) => tpl.map(({ geo, mat, paint }) => { const im = new THREE.InstancedMesh(geo, mat, n); im.castShadow = true; im.receiveShadow = true; im.count = 0; im.frustumCulled = false; im.userData = { paint }; this.group.add(im); this.houseMeshes.push(im); return im; });
    const nl = this.lots.length;
    this.life.car = mk(carTemplate(), nl); this.life.tree = mk(yardTreeTemplate(), nl);
    this._lodKey = null;
    this.updateLOD(true);
  },

  // Decide qué lotes muestran la casa detallada según la cámara
  updateLOD(force) {
    if (!this.simple) return;
    const cam = App.camera, tgt = App.siteControls?.target || new THREE.Vector3();
    const dist = cam.position.distanceTo(tgt);
    const R = this.forceDetail ? 1e9 : dist > 520 ? 0 : (App.lowEnd ? 70 : 140) * (dist < 120 ? 1 : 1.3);
    const key = [Math.round(tgt.x / 8), Math.round(tgt.z / 8), Math.round(R / 10), Math.round(Math.log2(dist + 1) * 3)].join(',');
    if (!force && key === this._lodKey) return;
    this._lodKey = key;
    const o = new THREE.Object3D(), nearAll = [];
    // la sombra del sol sigue a la cámara: más nitidez cerca, cobertura amplia lejos
    if (this.sun) {
      const half = Math.min(320, Math.max(45, dist * 0.75));
      const sc = this.sun.shadow.camera;
      sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.updateProjectionMatrix();
      this.sun.target.position.set(tgt.x, 0, tgt.z); this.sun.position.copy(this.sun.target.position).add(this.sunOffset);
      this.sun.shadow.normalBias = half < 100 ? 0.12 : 0.6; this.sun.shadow.bias = half < 100 ? -0.0004 : -0.0008;
    }
    for (const [mid, idxs] of Object.entries(this.houseLots)) {
      const S = this.simple[mid], Dm = this.detail[mid];
      const near = [], far = [];
      for (const li of idxs) { const l = this.lots[li]; (R && Math.hypot(l.x - tgt.x, l.z - tgt.z) < R ? near : far).push(li); }
      // lejanas
      S.body.userData.map.length = 0;
      far.forEach((li, k) => {
        const l = this.lots[li];
        this.houseXform(l, o); o.scale.set(Math.min(6.4, l.front - 1.2), 2.9, Math.min(8, l.depth - 4.5)); o.updateMatrix();
        S.body.setMatrixAt(k, o.matrix);
        S.body.setColorAt(k, _c.set(lotPaint(l, S.model)));
        o.position.y += 2.9; o.scale.y = S.body.userData.gable ? 1.9 : 1; o.updateMatrix(); S.roof.setMatrixAt(k, o.matrix);
        if (!S.body.userData.gable) S.roof.setColorAt(k, _c.set(lotRoof(l)));
        S.body.userData.map.push(li);
      });
      S.body.count = S.roof.count = far.length;
      S.body.instanceMatrix.needsUpdate = S.roof.instanceMatrix.needsUpdate = true;
      if (S.roof.instanceColor) S.roof.instanceColor.needsUpdate = true;
      if (S.body.instanceColor) S.body.instanceColor.needsUpdate = true;
      // cercanas
      const map = [];
      near.forEach((li, k) => {
        const l = this.lots[li];
        this.houseXform(l, o); o.scale.set(1, 1, 1); o.updateMatrix();
        _c.set(lotPaint(l, S.model));
        const rc = new THREE.Color(lotRoof(l));
        for (const im of Dm) { im.setMatrixAt(k, o.matrix); if (im.userData.paint) im.setColorAt(k, _c); else if (im.userData.roofPaint) im.setColorAt(k, rc); }
        map.push(li);
        nearAll.push(li);
      });
      for (const im of Dm) { im.count = near.length; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.userData.map = map; }
    }
    // carros (≈35 % de los lotes) frente a la casa y árboles de patio (≈55 %)
    const cars = [], trees = [];
    for (const li of nearAll) { const l = this.lots[li]; if (hash01(l.code + 'car') < 0.35) cars.push(li); if (hash01(l.code + 'tree') < 0.55) trees.push(li); }
    const place = (list, meshes, local, colorFn) => {
      const m4 = new THREE.Matrix4(), loc = new THREE.Matrix4();
      list.forEach((li, k) => {
        const l = this.lots[li];
        this.houseXform(l, o); o.scale.set(1, 1, 1); o.updateMatrix();
        loc.makeTranslation(...local(l)); m4.multiplyMatrices(o.matrix, loc);
        for (const im of meshes) { im.setMatrixAt(k, m4); if (im.userData.paint && colorFn) im.setColorAt(k, _c.set(colorFn(l))); }
      });
      for (const im of meshes) { im.count = list.length; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.userData.kind = 'life'; }
    };
    if (this.life) {
      place(cars, this.life.car, l => [hash01(l.code + 'cx') < 0.5 ? -1.6 : 1.4, 0, 4 + 2.2 + 1.6], l => CAR_PAINTS[Math.floor(hash01(l.code + 'cc') * CAR_PAINTS.length)]);
      place(trees, this.life.tree, l => [hash01(l.code + 'tx') * 4 - 2, 0, -4 - Math.max(1.2, (l.depth - 10.2) * 0.55)]);
    }
  },

  buildPins() {
    if (this.pins) { this.group.remove(this.pins); this.pins.geometry.dispose(); }
    const inv = Object.values(Store.data.lots).filter(l => l.projectId === this.project.id && this.lotIndex.has(l.code));
    this.pinLots = inv.map(l => this.lotIndex.get(l.code));
    const geo = new THREE.SphereGeometry(1.25, 14, 10);
    const stem = new THREE.CylinderGeometry(0.12, 0.12, 6, 6); stem.translate(0, -3.4, 0);
    const merged = mergeGeos([geo, stem]);
    const pins = new THREE.InstancedMesh(merged, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, emissive: '#222' }), Math.max(1, inv.length));
    const o = new THREE.Object3D();
    inv.forEach((l, k) => {
      const lot = this.lots[this.lotIndex.get(l.code)];
      o.position.set(lot.x, 11, lot.z); o.updateMatrix(); pins.setMatrixAt(k, o.matrix);
      pins.setColorAt(k, _c.set((STATUS[l.status] || STATUS.fuera).color));
    });
    pins.count = inv.length;
    pins.userData = { kind: 'pins', map: this.pinLots };
    this.pins = pins; this.group.add(pins);
  },

  buildTrees(hasLayout) {
    const rnd = mulberry(42);
    const spots = [];
    const boundary = LAYOUT.boundary;
    const [, hz] = pxToWorld(0, LAYOUT.highway.y);
    const [ax] = pxToWorld(...LAYOUT.access.from);
    const N = App.lowEnd ? 2600 : 9000;
    if (hasLayout) {
      // bosque / cafetal alrededor
      let tries = 0;
      while (spots.length < N && tries++ < N * 6) {
        // bosquetes: la mayoría de árboles nace cerca de otro (manchas de bosque y cafetal)
        let x, z;
        if (spots.length > 200 && rnd() < 0.45) { const s0 = spots[Math.floor(rnd() * spots.length)]; x = s0[0] + (rnd() - 0.5) * 34; z = s0[1] + (rnd() - 0.5) * 34; }
        else { x = (rnd() - 0.5) * 1700; z = (rnd() - 0.5) * 1500 + 60; }
        const px = x / PX + ORIGIN_PX[0], py = z / PX + ORIGIN_PX[1];
        if (pointInPoly(px, py, boundary)) continue;
        if (Math.abs(z - hz) < 14) continue;
        if (Math.abs(x - ax) < 9 && z < pxToWorld(0, 130)[1]) continue;
        // vía sur
        const t = (px - 380) / 880, yLine = 716 + t * 84; if (px > 360 && px < 1280 && Math.abs(py - yLine - 11) < 10) continue;
        // margen junto al límite (claro)
        let near = false; for (let k = 0; k < 4 && !near; k++) { const a = (k / 4) * Math.PI * 2; if (pointInPoly(px + Math.cos(a) * 6, py + Math.sin(a) * 6, boundary)) near = true; }
        if (near) continue;
        spots.push([x, z, 0.7 + rnd() * 0.9, rnd()]);
      }
      // árboles en áreas verdes
      for (const p of LAYOUT.parks) {
        const xs = p.poly.map(q => q[0]), ys = p.poly.map(q => q[1]);
        const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
        const area = (maxx - minx) * (maxy - miny);
        const n = Math.round(area / 90);
        for (let i = 0; i < n; i++) {
          const px = minx + rnd() * (maxx - minx), py = miny + rnd() * (maxy - miny);
          if (!pointInPoly(px, py, p.poly)) continue;
          if (p.club) { const d = Math.hypot(px - p.club[0], py - p.club[1]); if (d < 26 || (px < p.club[0] - 30 && px > p.club[0] - 62 && Math.abs(py - p.club[1] - 6) < 22)) continue; }
          if (p.clear && Math.hypot(px - p.clear[0], py - p.clear[1]) < p.clear[2]) continue;
          if (p.id === 'franja' && rnd() < 0.5) continue;
          const [x, z] = pxToWorld(px, py); spots.push([x, z, 0.6 + rnd() * 0.6, rnd()]);
        }
      }
    } else {
      for (let i = 0; i < 500; i++) { const a = rnd() * Math.PI * 2, r = 90 + rnd() * 500; spots.push([Math.cos(a) * r, Math.sin(a) * r, 0.7 + rnd() * 0.8, rnd()]); }
    }
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 3, 5); trunkGeo.translate(0, 1.5, 0);
    const cg = crownGeo(2.6, App.lowEnd ? 10 : 16, 3, 4.6);
    const coreGeo = new THREE.IcosahedronGeometry(1.5, 1); coreGeo.translate(0, 4.5, 0);
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#5e4838', roughness: 1 }), spots.length);
    const crowns = new THREE.InstancedMesh(cg, foliageMat(), spots.length);
    const cores = new THREE.InstancedMesh(coreGeo, new THREE.MeshStandardMaterial({ color: '#2a4620', roughness: 1 }), spots.length);
    crowns.castShadow = true; crowns.receiveShadow = true;
    const o = new THREE.Object3D();
    const palette = ['#3f6b2c', '#4d7a33', '#5b8a3a', '#355f2a', '#6a8f3d', '#2f5524'].map(c => new THREE.Color(c));
    spots.forEach(([x, z, s, r], i) => {
      o.position.set(x, 0, z); o.rotation.set(0, r * 6, 0); o.scale.set(s * 1.2, s * (1 + r * 0.5), s * 1.2); o.updateMatrix();
      trunks.setMatrixAt(i, o.matrix); crowns.setMatrixAt(i, o.matrix); cores.setMatrixAt(i, o.matrix);
      crowns.setColorAt(i, _c.set('#ffffff').lerp(palette[Math.floor(r * palette.length)], 0.35).offsetHSL(0, 0, (r - 0.5) * 0.08));
    });
    this.group.add(trunks, cores, crowns);
  },

  // Palmeras en la avenida principal, el acceso, los parques y la piscina
  buildPalms() {
    const spots = [];
    for (let py = 140; py < 485; py += 20) for (const px of [741, 755]) spots.push(pxToWorld(px + (py > 300 ? 0 : 0), py));
    for (let py = 20; py < 125; py += 22) for (const px of [737, 753]) spots.push(pxToWorld(px, py));
    const ring = (cx, cy, rx, ry, n) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; spots.push(pxToWorld(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry)); } };
    ring(787, 512, 33, 20, 12); ring(863, 443, 28, 22, 8);
    const [cx, cz] = pxToWorld(1070, 545);
    [[-14, 10], [14, 10], [-14, 30], [14, 30], [0, 34], [-24, -6], [24, -6]].forEach(([dx, dz]) => spots.push([cx + dx, cz + dz]));
    const o = new THREE.Object3D();
    [2, 5].forEach((seed, si) => {
      const mine = spots.filter((_, i) => i % 2 === si);
      palmTemplate(seed).forEach(({ geo, mat }) => {
        const im = new THREE.InstancedMesh(geo, mat, mine.length);
        mine.forEach(([x, z], k) => { const s = 0.85 + hash01(x + ',' + z) * 0.4; o.position.set(x, 0.3, z); o.rotation.set(0, hash01(z + 'r') * 6.28, 0); o.scale.setScalar(s); o.updateMatrix(); im.setMatrixAt(k, o.matrix); });
        im.castShadow = true; im.receiveShadow = true; this.group.add(im);
      });
    });
  },

  stageCenter(s) {
    const ls = this.lots.filter(l => l.stage === s);
    if (!ls.length) return null;
    let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
    ls.forEach(l => { minx = Math.min(minx, l.x); maxx = Math.max(maxx, l.x); minz = Math.min(minz, l.z); maxz = Math.max(maxz, l.z); });
    return { x: (minx + maxx) / 2, z: (minz + maxz) / 2, w: maxx - minx, d: maxz - minz };
  },

  buildLabels(project) {
    const stages = project.stages || DEFAULT_STAGES;
    const anchors = { 1: [800, 685], 2: [905, 552], 3: [735, 398], 4: [745, 280] };
    for (const st of stages) {
      let p;
      if (project.hasLayout && anchors[st.id]) { const [x, z] = pxToWorld(...anchors[st.id]); p = new THREE.Vector3(x, 14, z); }
      else { const c = this.stageCenter(st.id); if (!c) continue; p = new THREE.Vector3(c.x, 14, c.z - c.d / 2 - 6); }
      const el = document.createElement('button');
      el.className = 'stage-tag'; el.style.setProperty('--sc', st.color);
      el.textContent = st.name.toUpperCase();
      el.addEventListener('click', () => UI.selectStage(st.id));
      $('#labels').appendChild(el);
      this.labels.push({ el, p, kind: 'stage', stage: st.id });
    }
    if (project.hasLayout) {
      const extra = [[[745, 105], 'Acceso'], [[1070, 520], 'Área comunal'], [[786, 512], 'Parque central']];
      for (const [px, t] of extra) {
        const [x, z] = pxToWorld(...px);
        const el = document.createElement('div'); el.className = 'place-tag'; el.textContent = t;
        $('#labels').appendChild(el); this.labels.push({ el, p: new THREE.Vector3(x, 9, z), kind: 'place' });
      }
    }
  },

  buildOverlay(project) {
    const url = project.refUrl;
    if (!url) { this.overlay = null; return; }
    const w = IMG_SIZE[0] * PX, h = IMG_SIZE[1] * PX;
    const [cx, cz] = pxToWorld(IMG_SIZE[0] / 2, IMG_SIZE[1] / 2);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    new THREE.TextureLoader().load(url, t => { t.colorSpace = THREE.SRGBColorSpace; mat.map = t; mat.needsUpdate = true; });
    const g = new THREE.PlaneGeometry(project.hasLayout ? w : 160, project.hasLayout ? h : 107); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat);
    m.position.set(project.hasLayout ? cx : -4.5, 14, project.hasLayout ? cz : -10);
    m.renderOrder = 5; m.visible = false;
    this.overlay = m; this.group.add(m);
  },
  setOverlay(op) {
    if (!this.overlay) return;
    this.overlay.material.opacity = op; this.overlay.visible = op > 0.01;
  },

  refreshColors() {
    if (!this.pads) return;
    const stages = Object.fromEntries((this.project.stages || DEFAULT_STAGES).map(s => [s.id, s]));
    const grey = new THREE.Color('#9a9c98');
    const white = new THREE.Color('#ffffff');
    this.lots.forEach((l, i) => {
      const inv = Store.data.lots[l.code];
      if (this.colorMode === 'real') {
        _c.set('#d9efb0').lerp(new THREE.Color((stages[l.stage] || {}).color || '#ffffff'), 0.1);
      } else if (this.colorMode === 'stage') {
        _c.set((stages[l.stage] || {}).color || '#9bbf7a').lerp(white, 0.08);
      } else {
        const st = inv && inv.projectId === this.project.id ? inv.status : 'fuera';
        _c.set(STATUS[st]?.color || STATUS.fuera.color);
        if (st === 'fuera') _c.lerp(white, 0.3);
      }
      if (this.stageFilter && l.stage !== this.stageFilter) _c.lerp(grey, this.colorMode === 'real' ? 0.35 : 0.75);
      else if (this.focusBlock && l.block !== this.focusBlock) _c.lerp(grey, this.colorMode === 'real' ? 0.25 : 0.5);
      if (this.filter) { if (this.filter(l)) _c.lerp(new THREE.Color('#ffffff'), 0.15); else _c.lerp(new THREE.Color('#5f6368'), 0.72); }
      this.pads.setColorAt(i, _c);
    });
    this.pads.instanceColor.needsUpdate = true;
  },

  setColorMode(m) { this.colorMode = m; this.refreshColors(); },

  rebuildInventoryVisuals() { this.buildHouses(); this.buildPins(); this.refreshColors(); },

  pick(raycaster) {
    const r = this.pickAny(raycaster);
    return r && r.lot != null ? r.lot : -1;
  },
  // Devuelve { lot } o { amenity } según lo más cercano bajo el puntero
  pickAny(raycaster) {
    const targets = [this.pads, this.pins, ...this.houseMeshes.filter(m => m.count > 0), ...(this.amenityMeshes || [])].filter(Boolean);
    const hits = raycaster.intersectObjects(targets, false);
    for (const h of hits) {
      const ud = h.object.userData;
      if (ud.amenity) return { amenity: ud.amenity };
      if (ud.kind === 'pads') return { lot: h.instanceId };
      if (ud.map && ud.map[h.instanceId] != null) return { lot: ud.map[h.instanceId] };
    }
    return null;
  },
  blockInfo(block) {
    const ls = this.lots.filter(l => l.block === block);
    let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
    ls.forEach(l => { minx = Math.min(minx, l.x - 4); maxx = Math.max(maxx, l.x + 4); minz = Math.min(minz, l.z - 4); maxz = Math.max(maxz, l.z + 4); });
    return { lots: ls, box: { x: (minx + maxx) / 2, z: (minz + maxz) / 2, w: maxx - minx, d: maxz - minz } };
  },

  frameBox(box, l) {
    const w = (l.alongX ? l.front : l.depth) + 0.6, d = (l.alongX ? l.depth : l.front) + 0.6;
    box.position.set(l.x, 2.2, l.z); box.scale.set(w, 4, d); box.visible = true;
  },
  setHover(i) { this.hovered = i; if (i < 0) this.hoverBox.visible = false; else this.frameBox(this.hoverBox, this.lots[i]); },
  setSelected(i) { this.selected = i; if (i < 0) this.selBox.visible = false; else this.frameBox(this.selBox, this.lots[i]); },

  updateLabels(camera) {
    const v = new THREE.Vector3(), W = App.width, H = App.height;
    for (const lb of this.labels) {
      v.copy(lb.p).project(camera);
      const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      lb.el.style.display = vis ? '' : 'none';
      if (vis) lb.el.style.transform = `translate(-50%,-50%) translate(${(v.x * 0.5 + 0.5) * W}px,${(-v.y * 0.5 + 0.5) * H}px)`;
      if (lb.kind === 'stage') lb.el.classList.toggle('dim', !!(this.stageFilter && this.stageFilter !== lb.stage));
    }
  },
};

function mergeGeos(geos) {
  // fusión simple de geometrías indexadas/no indexadas (posición + normal)
  const parts = geos.map(g => g.index ? g.toNonIndexed() : g);
  const pos = [], nor = [];
  parts.forEach(g => { pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

function makeSky(top, bottom) {
  const g = new THREE.SphereGeometry(3800, 24, 12);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+0.05,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, pow(h,0.7)),1.0);\n#include <colorspace_fragment>\n}',
  });
  return new THREE.Mesh(g, m);
}

// Prisma de techo a dos aguas: base 1×1 (escalable), cumbrera a lo largo de z, altura 1
function gableGeo(sx = 1, sz = 1) {
  const x = 0.5 * sx, z = 0.5 * sz;
  const v = [
    [-x,0,-z],[x,0,-z],[0,1,-z],  [-x,0,z],[0,1,z],[x,0,z],
    [-x,0,-z],[0,1,-z],[0,1,z],  [-x,0,-z],[0,1,z],[-x,0,z],
    [x,0,-z],[x,0,z],[0,1,z],  [x,0,-z],[0,1,z],[0,1,-z],
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v.flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(v.flatMap(([px, py, pz], i) => i < 6 ? [px + .5, py] : [pz + .5, 1 - py]), 2));
  g.addGroup(6, 12, 0); g.addGroup(0, 6, 1);
  g.computeVertexNormals();
  return g;
}

function scaleUV(geo, k) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k); uv.needsUpdate = true; return geo; }

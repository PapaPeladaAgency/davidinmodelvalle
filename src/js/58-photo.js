// ============================================================================
// 58-photo.js — Modo foto: render inmobiliario desde el residencial 3D real
// Hora dorada / mediodía, montañas con bruma, vida en las calles,
// profundidad de campo y captura en alta resolución.
// ============================================================================

PBR_LIB.adoquin = { file: 'patterned_concrete_pavers', maps: ['albedo', 'normal'], size: 2.2, label: 'Adoquín de concreto' };

// Cordillera verde alrededor del proyecto (se pierde en la bruma)
function buildMountains(scene) {
  const segs = 160, rings = 6, R0 = 1500, R1 = 2900;
  const pos = [], col = [], idx = [];
  const rnd = mulberry(12);
  const ph = [rnd() * 6, rnd() * 6, rnd() * 6];
  for (let j = 0; j <= rings; j++) for (let i = 0; i <= segs; i++) {
    const a = i / segs * Math.PI * 2, t = j / rings, r = R0 + (R1 - R0) * t;
    const n = 0.55 + 0.25 * Math.sin(a * 3 + ph[0]) + 0.15 * Math.sin(a * 7 + ph[1]) + 0.08 * Math.sin(a * 17 + ph[2]);
    const h = Math.sin(t * Math.PI) * n * 420 + (t > 0.5 ? n * 120 : 0);
    pos.push(Math.cos(a) * r, h - 20, Math.sin(a) * r + 60);
    const c = new THREE.Color('#3f5f34').lerp(new THREE.Color('#5d7e48'), rnd() * 0.4).lerp(new THREE.Color('#2f4a2a'), Math.min(1, h / 500));
    col.push(c.r, c.g, c.b);
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < segs; i++) {
    const a = j * (segs + 1) + i, b = a + segs + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  scene.add(m); return m;
}

// Alumbrado público a lo largo de las calles y personas en el parque y las aceras
function buildStreetLife(G, site) {
  const lamps = [];
  for (const b of LAYOUT.blocks) {
    const [x0, z0] = pxToWorld(b.r[0], b.r[1]), [x1, z1] = pxToWorld(b.r[2], b.r[3]);
    const W = x1 - x0, D = z1 - z0;
    if (W >= D) for (let x = x0 + 6; x < x1; x += 26) { lamps.push([x, z0 - 1.9, 0]); lamps.push([x + 13, z1 + 1.9, Math.PI]); }
    else for (let z = z0 + 6; z < z1; z += 26) { lamps.push([x0 - 1.9, z, Math.PI / 2]); lamps.push([x1 + 1.9, z + 13, -Math.PI / 2]); }
  }
  const lg = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 6.5, 6), new THREE.MeshStandardMaterial({ color: '#3a3f44', metalness: 0.5, roughness: 0.5 }));
  pole.position.y = 3.25; lg.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.3), pole.material); arm.position.set(0, 6.4, 0.6); lg.add(arm);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.55), new THREE.MeshStandardMaterial({ color: '#fff7e6', emissive: '#ffd48a', emissiveIntensity: 0.4 })); head.position.set(0, 6.35, 1.2); lg.add(head);
  const tpl = groupToTemplate(lg), o = new THREE.Object3D();
  tpl.forEach(({ geo, mat }) => {
    const im = new THREE.InstancedMesh(geo, mat, lamps.length);
    lamps.forEach(([x, z, r], k) => { o.position.set(x, 0.3, z); o.rotation.set(0, r, 0); o.updateMatrix(); im.setMatrixAt(k, o.matrix); });
    im.castShadow = true; G.add(im);
  });
  site.lampMats = tpl.filter(t => t.mat.emissive && t.mat.emissiveIntensity > 0).map(t => t.mat);
  // personas: familia caminando en la acera del parque y niños en los juegos
  const person = (h, shirt, pants, skin = '#c99a74') => {
    const p = new THREE.Group();
    const legs = new THREE.Mesh(new THREE.CapsuleGeometry(h * 0.075, h * 0.38, 3, 8), new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 })); legs.position.y = h * 0.27; legs.scale.x = 1.5;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(h * 0.11, h * 0.24, 3, 8), new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 })); body.position.y = h * 0.62;
    const head = new THREE.Mesh(new THREE.SphereGeometry(h * 0.075, 10, 8), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 })); head.position.y = h * 0.89;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(h * 0.078, 10, 6, 0, Math.PI * 2, 0, 1.4), new THREE.MeshStandardMaterial({ color: '#1f1712', roughness: 0.8 })); hair.position.y = h * 0.9;
    p.add(legs, body, head, hair); p.traverse(q => { if (q.isMesh) q.castShadow = true; });
    return p;
  };
  const P = LAYOUT.parks.find(q => q.id === 'parque');
  const [px0, pz0] = pxToWorld(P.poly[0][0], P.poly[0][1]), [px1, pz1] = pxToWorld(P.poly[2][0], P.poly[2][1]);
  const people = [
    [px0 + 3.2, pz0 + 2.6, 1.72, '#2f5d8a', '#2b2b30', 0.2], [px0 + 4.1, pz0 + 2.9, 1.62, '#c8553d', '#3b3f4a', 0.2],
    [px0 + 4.9, pz0 + 2.4, 1.15, '#e9c46a', '#3a5a8a', 0.2], [px0 + 2.4, pz0 + 2.2, 1.0, '#7fb069', '#5a4a3a', 0.2],
    [px1 - 12, pz0 + 10, 1.05, '#e76f51', '#2b2b30', 1.2], [px1 - 9.5, pz0 + 12, 0.95, '#2a9d8f', '#3b3f4a', 2.4], [px1 - 13.5, pz0 + 13, 1.1, '#f4a261', '#264653', 0],
    [px1 - 7, pz1 - 5, 1.7, '#f1faee', '#457b9d', 3.0], [px1 - 6.2, pz1 - 5.3, 1.6, '#a8dadc', '#1d3557', 3.0],
  ];
  for (const [x, z, h, s, p, r] of people) { const q = person(h, s, p); q.position.set(x, 0.33, z); q.rotation.y = r; G.add(q); }
}

// ---------------- Iluminación: mediodía / hora dorada ----------------
const LIGHTING = {
  dia: { sun: [-300, 300, -170], color: '#ffeacc', int: 2.9, hemi: ['#e6f0fb', '#5a6440', 0.35], fog: ['#d3e0ea', 900, 3600], exp: 0.82, env: 0.45, lamps: 0.4, warmth: 0.02, sat: 1.12 },
  dorada: { sun: [-520, 105, 40], color: '#ff9c55', int: 3.8, hemi: ['#ffc995', '#4f4433', 0.45], fog: ['#e9d2bd', 900, 3600], exp: 0.95, env: 0.6, lamps: 1.8, warmth: 0.07, sat: 1.18 },
};
Object.assign(Site, {
  timeOfDay: 'dia',
  setTimeOfDay(k) {
    const L = LIGHTING[k] || LIGHTING.dia; this.timeOfDay = k;
    const s = this.scene;
    if (this.skyMesh) s.remove(this.skyMesh);
    this.sun.color.set(L.color); this.sun.intensity = L.int;
    this.sunOffset.set(...L.sun); this.sun.position.copy(this.sun.target.position).add(this.sunOffset);
    this.skyMesh = makeRealSky(s, App.renderer, new THREE.Vector3(...L.sun), { envIntensity: L.env, scale: 5000 });
    this.hemi.color.set(L.hemi[0]); this.hemi.groundColor.set(L.hemi[1]); this.hemi.intensity = L.hemi[2];
    s.fog.color.set(L.fog[0]); s.fog.near = L.fog[1]; s.fog.far = L.fog[2];
    if (this.clouds) this.clouds.material.color.set(k === 'dorada' ? '#ffe2c4' : '#ffffff');
    (this.lampMats || []).forEach(m => m.emissiveIntensity = L.lamps);
    App.renderer.toneMappingExposure = L.exp;
    if (App.gradeSite) { App.gradeSite.uniforms.warmth.value = L.warmth; App.gradeSite.uniforms.saturation.value = L.sat; }
    this._lodKey = null;
  },
});

// ---------------- Modo foto ----------------
const Photo = {
  open() {
    if (App.view !== 'site') App.enterSite();
    UI.closeLot(); UI.selectStage(0);
    $('#photoPanel').hidden = false; document.body.classList.add('photo');
    this.preset();
  },
  close() { $('#photoPanel').hidden = true; document.body.classList.remove('photo'); Site.forceDetail = false; Site._lodKey = null; App.dof && (App.dof.enabled = false); },
  // Toma aérea a 35° sobre todo el conjunto, mirando desde el sureste hacia el poniente iluminado
  preset(kind = 'aerea35') {
    const c = { x: -10, z: 62 };
    let pos, tgt = new THREE.Vector3(c.x, 0, c.z);
    if (kind === 'aerea35') { const d = 430, el = 35 * Math.PI / 180, az = 0.45; pos = new THREE.Vector3(c.x + Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, c.z + Math.cos(az) * Math.cos(el) * d);
      // mirar más allá del centro para que entren el horizonte, las montañas y el cielo
      tgt.set(c.x - Math.sin(az) * 260, 0, c.z - Math.cos(az) * 260); }
    else if (kind === 'parque') { const a = amenityInfo('parque').box; tgt.set(a.x, 0, a.z); pos = new THREE.Vector3(a.x + 55, 48, a.z + 70); }
    else if (kind === 'comunal') { const a = amenityInfo('comunal').box; tgt.set(a.x, 0, a.z); pos = new THREE.Vector3(a.x - 40, 55, a.z + 80); }
    else if (kind === 'calle') { const bi = Site.blockInfo('E1-M07'); const st = streetTarget(bi); pos = st.eye.clone().setY(9); tgt = st.look.clone(); }
    Site.forceDetail = true; Site._lodKey = null;
    flyCamera(App.camera, App.siteControls, pos, tgt, 1.8);
    $$('[data-shot]').forEach(b => b.setAttribute('aria-pressed', b.dataset.shot === kind));
    this.focusDist = pos.distanceTo(tgt);
  },
  async capture() {
    const btn = $('#photoCapture'); btn.disabled = true; btn.textContent = 'Generando imagen…';
    await new Promise(r => setTimeout(r, 60));
    const r = App.renderer, w = App.width, h = App.height, scale = Math.min(3, Math.max(2, 2400 / w));
    const comp = App.siteComposer;
    const prev = r.getPixelRatio();
    let url;
    try {
      document.body.classList.add('capturing');
      r.setPixelRatio(scale); r.setSize(w, h, false);
      if (comp) { comp.setPixelRatio(scale); comp.setSize(w, h); if (App.dof) { App.dof.enabled = $('#photoDof').checked; App.dof.uniforms.focus.value = this.focusDist || 400; } }
      if (App.siteGtao) App.siteGtao.enabled = true;
      Site.updateLOD(true);
      if (comp) comp.render(0.016); else r.render(Site.scene, App.camera);
      url = r.domElement.toDataURL('image/jpeg', 0.93);
    } finally {
      r.setPixelRatio(prev); r.setSize(w, h, false);
      if (comp) { comp.setPixelRatio(Math.min(devicePixelRatio, 1.5)); comp.setSize(w, h); if (App.dof) App.dof.enabled = false; }
      document.body.classList.remove('capturing');
      btn.disabled = false; btn.textContent = 'Capturar imagen';
    }
    this.showResult(url, Math.round(w * scale), Math.round(h * scale), 'Render demostrativo generado desde el modelo 3D del prototipo.', 'render');
  },
  async showResult(url, W, H, note, tag) {
    const blob = await (await fetch(url)).blob();
    const name = `valle-san-sebastian-${tag}-${Site.timeOfDay === 'dorada' ? 'hora-dorada' : 'dia'}-${new Date().toISOString().slice(0, 10)}.jpg`;
    let saved = false;
    try { const dl = window.claude && await window.claude.use('downloads'); if (dl) { await dl.save({ filename: name, data: blob }); saved = true; } } catch (e) { /* el visitante canceló o no está disponible */ }
    UI.modal('Imagen generada', `<div class="photo-result"><img src="${url}" alt="Render del residencial Valle de San Sebastián"></div>
      <p class="muted small">${saved ? 'La imagen se ofreció para descargar.' : 'Mantené presionada la imagen (o clic derecho) para guardarla.'} Resolución: ${W} × ${H} px. ${esc(note)}</p>`, 'wide');
  },
  init() {
    $('#btnPhoto').onclick = () => this.open();
    $('#photoClose').onclick = () => this.close();
    $$('[data-shot]').forEach(b => b.onclick = () => this.preset(b.dataset.shot));
    $$('[data-tod]').forEach(b => b.onclick = () => { Site.setTimeOfDay(b.dataset.tod); $$('[data-tod]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
    $('#photoCapture').onclick = () => this.capture();
  },
};

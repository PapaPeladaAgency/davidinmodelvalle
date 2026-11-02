// ============================================================================
// 35-realism.js — Materiales procedurales, cielo físico y detalles
// arquitectónicos para dar realismo a la demostración (sin archivos externos).
// ============================================================================

const RTEX = {};
function noiseCanvas(size, draw) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); return c; }
function texFrom(canvas, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}
function speckle(g, s, n, rmin, rmax, colorFn, rnd) {
  for (let i = 0; i < n; i++) { g.fillStyle = colorFn(rnd()); g.beginPath(); g.arc(rnd() * s, rnd() * s, rmin + rnd() * (rmax - rmin), 0, 6.283); g.fill(); }
}

// Repello (stucco): mapa claro con variación + relieve
function stuccoMaps() {
  if (RTEX.stucco) return RTEX.stucco;
  const rnd = mulberry(11);
  const cv = noiseCanvas(512, (g, s) => {
    g.fillStyle = '#f4f4f2'; g.fillRect(0, 0, s, s);
    speckle(g, s, 260, 20, 70, v => `rgba(${v > .5 ? 255 : 210},${v > .5 ? 255 : 205},${v > .5 ? 255 : 198},.05)`, rnd);
    speckle(g, s, 9000, 0.4, 1.4, v => `rgba(${v > .5 ? 255 : 150},${v > .5 ? 255 : 145},${v > .5 ? 255 : 140},${.08 + v * .1})`, rnd);
  });
  const bump = noiseCanvas(256, (g, s) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
    speckle(g, s, 7000, 0.5, 1.6, v => `rgba(${v > .5 ? 255 : 0},${v > .5 ? 255 : 0},${v > .5 ? 255 : 0},.18)`, rnd);
  });
  return (RTEX.stucco = { map: texFrom(cv), bump: texFrom(bump, false) });
}
// Teja de barro: canales con sombreado cilíndrico y traslapes
function tileMaps() {
  if (RTEX.tile) return RTEX.tile;
  const rnd = mulberry(5);
  const cols = 4, rows = 2, s = 512, cw = s / cols, rh = s / rows;
  const map = noiseCanvas(s, g => {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const base = new THREE.Color('#b8562f').offsetHSL((rnd() - .5) * .03, (rnd() - .5) * .1, (rnd() - .5) * .08);
      const grd = g.createLinearGradient(c * cw, 0, (c + 1) * cw, 0);
      const k = (c % 2) ? -1 : 1; // canal / cobija
      const d = base.clone().offsetHSL(0, 0, -.16 * (k > 0 ? 1 : .6)), l = base.clone().offsetHSL(0, .02, .1);
      grd.addColorStop(0, '#' + d.getHexString()); grd.addColorStop(.5, '#' + (k > 0 ? l : base).getHexString()); grd.addColorStop(1, '#' + d.getHexString());
      g.fillStyle = grd; g.fillRect(c * cw, r * rh, cw, rh);
      const sh = g.createLinearGradient(0, r * rh, 0, r * rh + 26);
      sh.addColorStop(0, 'rgba(40,15,5,.55)'); sh.addColorStop(1, 'rgba(40,15,5,0)');
      g.fillStyle = sh; g.fillRect(c * cw, r * rh, cw, 26);
      for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${rnd() > .5 ? '255,230,200' : '40,20,10'},${.05 + rnd() * .08})`; g.fillRect(c * cw + rnd() * cw, r * rh + rnd() * rh, 1 + rnd() * 3, 1 + rnd() * 3); }
    }
  });
  const bump = noiseCanvas(s, g => {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const grd = g.createLinearGradient(c * cw, 0, (c + 1) * cw, 0);
      const up = c % 2 === 0;
      grd.addColorStop(0, up ? '#333' : '#aaa'); grd.addColorStop(.5, up ? '#fff' : '#555'); grd.addColorStop(1, up ? '#333' : '#aaa');
      g.fillStyle = grd; g.fillRect(c * cw, r * rh, cw, rh);
      g.fillStyle = '#000'; g.fillRect(c * cw, r * rh, cw, 6);
    }
  });
  return (RTEX.tile = { map: texFrom(map), bump: texFrom(bump, false), size: [cols * 0.21, rows * 0.36] });
}
function simpleNoiseTex(key, base, n, alpha, light, dark, size = 256) {
  if (RTEX[key]) return RTEX[key];
  const rnd = mulberry(key.length * 7);
  const cv = noiseCanvas(size, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    speckle(g, s, n, 0.5, 2, v => v > .5 ? light.replace('A', alpha) : dark.replace('A', alpha), rnd);
  });
  return (RTEX[key] = texFrom(cv));
}
const asphaltTex = () => simpleNoiseTex('asphalt', '#55585c', 9000, .35, 'rgba(150,150,150,A)', 'rgba(20,20,22,A)');
const concreteTex = () => {
  if (RTEX.concrete) return RTEX.concrete;
  const t = simpleNoiseTex('concrete0', '#cdc8bd', 5000, .18, 'rgba(255,255,255,A)', 'rgba(90,85,75,A)', 512).clone();
  const cv = t.image; const g = cv.getContext('2d'); g.fillStyle = 'rgba(70,65,58,.45)'; g.fillRect(0, 0, 512, 3); g.fillRect(0, 0, 3, 512);
  t.needsUpdate = true; return (RTEX.concrete = t);
};
function grassTex() {
  if (RTEX.grass) return RTEX.grass;
  const rnd = mulberry(77);
  const cv = noiseCanvas(512, (g, s) => {
    g.fillStyle = '#5f8a3c'; g.fillRect(0, 0, s, s);
    speckle(g, s, 140, 20, 60, v => v > .5 ? 'rgba(120,150,60,.12)' : 'rgba(40,80,30,.14)', rnd);
    for (let i = 0; i < 26000; i++) {
      const x = rnd() * s, y = rnd() * s, h = 2 + rnd() * 5, v = rnd();
      g.strokeStyle = v > .66 ? 'rgba(150,185,80,.55)' : v > .33 ? 'rgba(70,115,40,.6)' : 'rgba(45,85,30,.6)';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * 2, y - h); g.stroke();
    }
  });
  return (RTEX.grass = texFrom(cv));
}
function blockTex() {
  if (RTEX.block) return RTEX.block;
  const st = stuccoMaps();
  const cv = noiseCanvas(512, (g, s) => {
    g.drawImage(st.map.image, 0, 0, s, s);
    g.fillStyle = 'rgba(0,0,0,.08)';
    for (let r = 0; r < 4; r++) { g.fillRect(0, r * 128, s, 2); for (let c = 0; c < 2; c++) g.fillRect(c * 256 + (r % 2) * 128, r * 128, 2, 128); }
  });
  return (RTEX.block = texFrom(cv));
}
function fabricTex() {
  if (RTEX.fabric) return RTEX.fabric;
  const cv = noiseCanvas(128, (g, s) => {
    g.fillStyle = '#e9e9e9'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < s; i += 2) { g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(i, 0, 1, s); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, i, s, 1); }
    const rnd = mulberry(9); speckle(g, s, 600, .4, 1, v => `rgba(0,0,0,${v * .06})`, rnd);
  });
  const t = texFrom(cv); t.repeat.set(4, 4); return (RTEX.fabric = t);
}

// UV en metros (para que las texturas no se estiren según el tamaño de la pieza)
function worldUV(geo, sx = 1, sy = sx, off = [0, 0, 0], swap = false) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + off[0], y = p.getY(i) + off[1], z = p.getZ(i) + off[2];
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = swap ? z : x; v = swap ? x : z; } else if (ax >= az) { u = z; v = y; } else { u = x; v = y; }
    uv.setXY(i, u / sx, v / sy);
  }
  uv.needsUpdate = true; return geo;
}
// Material de muro con repello
function stuccoMat(color, extra = {}) {
  const s = stuccoMaps();
  const m = new THREE.MeshStandardMaterial({ color, map: s.map, bumpMap: s.bump, bumpScale: 0.6, roughness: 0.96, envMapIntensity: 0.45, ...extra });
  return applyPBR(m, 'repello', { albedo: false, normal: 0.55, roughness: false });
}
// Repello exterior envejecido: zócalo con salpicadura de tierra, escurrimientos de lluvia
// y manchas suaves. El mosaico mide 2.4 m y empieza en el piso (v = 0).
function stuccoExtMaps() {
  if (RTEX.stuccoExt) return RTEX.stuccoExt;
  const rnd = mulberry(29), base = stuccoMaps().map.image;
  const cv = noiseCanvas(512, (g, s) => {
    g.drawImage(base, 0, 0, s, s);
    // manchas grandes de envejecimiento
    for (let i = 0; i < 18; i++) {
      const x = rnd() * s, y = rnd() * s, r = 40 + rnd() * 110;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rnd() > .5 ? '120,110,95' : '255,250,240'},${.035 + rnd() * .035})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // escurrimientos verticales de lluvia
    for (let i = 0; i < 26; i++) {
      const x = rnd() * s, y0 = rnd() * s * 0.6, len = 60 + rnd() * 180, w = 2 + rnd() * 7;
      const gr = g.createLinearGradient(0, y0, 0, y0 + len); gr.addColorStop(0, `rgba(95,88,78,${.05 + rnd() * .05})`); gr.addColorStop(1, 'rgba(95,88,78,0)');
      g.fillStyle = gr; g.fillRect(x, y0, w, len);
    }
    // zócalo: salpicadura de tierra en los primeros ~35 cm (parte inferior del lienzo)
    const zh = s * 0.15, gz = g.createLinearGradient(0, s, 0, s - zh);
    gz.addColorStop(0, 'rgba(105,85,60,.55)'); gz.addColorStop(0.35, 'rgba(110,92,70,.28)'); gz.addColorStop(1, 'rgba(110,92,70,0)');
    g.fillStyle = gz; g.fillRect(0, s - zh, s, zh);
    speckle(g, s, 900, 0.5, 2.2, v => `rgba(90,72,52,${.15 + v * .25})`, () => { const r = rnd(); return r; });
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(90,72,52,${.12 + rnd() * .25})`; const y = s - Math.pow(rnd(), 2.2) * zh; g.fillRect(rnd() * s, y, 1 + rnd() * 2, 1 + rnd() * 2); }
  });
  return (RTEX.stuccoExt = texFrom(cv));
}
function stuccoExtMat(color, extra = {}) {
  const m = stuccoMat(color, extra);
  m.map = stuccoExtMaps(); m.roughness = 0.97; m.envMapIntensity = 0.35;
  m.userData.paint = true;
  return m;
}
function fabricMat(color) {
  const m = new THREE.MeshStandardMaterial({ color, map: fabricTex(), roughness: 1 });
  applyPBR(m, 'tela', { normal: 0.7 });
  if (m.normalMap) m.normalMap.repeat.set(5, 5);
  return m;
}
function rbx(g, w, h, d, mat, x, y, z, r = 0.04) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.2, h / 2.2, d / 2.2)), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
}

// ---------------------------------------------------------------------------
// Cielo físico + entorno para reflejos (sin imágenes externas)
// ---------------------------------------------------------------------------
function makeRealSky(scene, renderer, sunDir, opts = {}) {
  const sky = new Sky();
  sky.scale.setScalar(opts.scale || 4000);
  const u = sky.material.uniforms;
  u.turbidity.value = 2.4; u.rayleigh.value = 1.9; u.mieCoefficient.value = 0.003; u.mieDirectionalG.value = 0.85;
  u.sunPosition.value.copy(sunDir).normalize();
  scene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const sky2 = new Sky(); sky2.scale.setScalar(1000); sky2.material.uniforms.sunPosition.value.copy(sunDir).normalize();
  Object.assign(sky2.material.uniforms.turbidity, { value: 2.4 }); sky2.material.uniforms.rayleigh.value = 1.9;
  envScene.add(sky2);
  // suelo verde para que los reflejos inferiores no sean de cielo
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshBasicMaterial({ color: '#4f6a3a' }));
  gnd.rotation.x = -Math.PI / 2; gnd.position.y = -5; envScene.add(gnd);
  const env = pmrem.fromScene(envScene, 0.02).texture;
  scene.environment = env;
  scene.environmentIntensity = opts.envIntensity ?? 0.65;
  pmrem.dispose();
  return sky;
}

// ---------------------------------------------------------------------------
// Techos detallados
// ---------------------------------------------------------------------------
function buildRealRoof(roof, W, D, H, facade, model, clip) {
  const ov = 0.55;
  const trim = new THREE.MeshStandardMaterial({ color: facade.trim, roughness: 0.6 });
  const soffit = new THREE.MeshStandardMaterial({ color: '#e9e2d4', roughness: 0.9 });
  if (facade.roof === 'gable') {
    const T = tileMaps();
    const rise = 1.35, run = W / 2, slope = rise / run;
    const len = Math.hypot(run + ov, (run + ov) * slope), ang = Math.atan(slope);
    let tileMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: T.map.clone(), bumpMap: T.bump.clone(), bumpScale: 3, roughness: 0.78 });
    [tileMat.map, tileMat.bumpMap].forEach(t => { t.needsUpdate = true; t.repeat.set(1, 1); });
    const usePBR = !App.noPBR;
    if (usePBR) tileMat = pbrMat('teja', { color: '#f2e6dc' });
    for (const side of [-1, 1]) {
      const geo = new THREE.BoxGeometry(len, 0.07, D + ov * 2);
      if (usePBR) worldUV(geo, pbrSize('teja'), pbrSize('teja'), [0, 0, 0], true); else worldUV(geo, T.size[0], T.size[1], [0, 0, 0], true);
      // la textura corre a lo largo de la pendiente: intercambiar ejes en la cara superior
      const mats = [trim, trim, tileMat, soffit, trim, trim];
      const m = new THREE.Mesh(geo, mats);
      // centro de la placa: punto medio entre alero y cumbrera
      const ex = side < 0 ? -ov : W + ov, ey = H - ov * slope;
      m.position.set((ex + W / 2) / 2, (ey + H + rise) / 2 + 0.06, D / 2);
      m.rotation.z = side < 0 ? ang : -ang;
      m.castShadow = true; m.receiveShadow = true; roof.add(m);
      // canal (canaleta) en el alero
      const gut = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.11, D + ov * 2), new THREE.MeshStandardMaterial({ color: '#dcd9d2', roughness: 0.5 }));
      gut.position.set(ex + side * 0.07, ey - 0.03, D / 2); gut.castShadow = true; roof.add(gut);
      // bajada pluvial
      const down = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, ey, 8), gut.material);
      down.position.set(side < 0 ? -0.14 : W + 0.14, ey / 2, D + 0.15); roof.add(down);
      // tablas de remate (frontis)
      for (const z of [-ov - 0.02, D + ov + 0.02]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(len + 0.06, 0.2, 0.05), trim);
        b.position.set(m.position.x, m.position.y - 0.04, z); b.rotation.z = m.rotation.z; b.castShadow = true; roof.add(b);
      }
    }
    // cumbrera
    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, D + ov * 2 + 0.05, 14), new THREE.MeshStandardMaterial({ color: '#a24a28', roughness: 0.7 }));
    ridge.rotation.x = Math.PI / 2; ridge.position.set(W / 2, H + rise + 0.1, D / 2); ridge.castShadow = true; roof.add(ridge);
    // tímpanos (triángulos de pared bajo el techo)
    const tri = new THREE.Shape(); tri.moveTo(0, 0); tri.lineTo(W + 0.18, 0); tri.lineTo(W / 2 + 0.09, rise + 0.05); tri.lineTo(0, 0);
    const tg = new THREE.ExtrudeGeometry(tri, { depth: 0.18, bevelEnabled: false });
    worldUV(tg, 2.2);
    const wm = stuccoExtMat(facade.wall);
    for (const z of [-0.09, D - 0.09]) { const t = new THREE.Mesh(tg, wm); t.position.set(-0.09, H, z); t.castShadow = true; t.receiveShadow = true; roof.add(t); }
    // ventila decorativa en el tímpano frontal
    const vent = new THREE.Mesh(new THREE.CircleGeometry(0.22, 20), new THREE.MeshStandardMaterial({ color: facade.trim }));
    vent.position.set(W / 2, H + 0.55, -0.1); vent.rotation.y = Math.PI; roof.add(vent);
  } else {
    // losa con pretil, botaguas y gárgolas
    const flat = facade.roof === 'flat';
    const slabMat = new THREE.MeshStandardMaterial({ color: '#8f9296', map: concreteTex(), roughness: 0.95 });
    slabMat.userData.roofPaint = true;
    const sg = worldUV(new THREE.BoxGeometry(W + 0.3, 0.22, D + 0.3), 2.5);
    const slab = new THREE.Mesh(sg, [stuccoMat(facade.wall), stuccoMat(facade.wall), slabMat, soffit, stuccoMat(facade.wall), stuccoMat(facade.wall)]);
    slab.position.set(W / 2, H + 0.11, D / 2); slab.castShadow = slab.receiveShadow = true; roof.add(slab);
    const ph = flat ? 0.6 : 0.42;
    const pm = stuccoMat(flat ? facade.accent : facade.wall);
    const cap = new THREE.MeshStandardMaterial({ color: '#d8d4cc', roughness: 0.8 });
    const P = (w, d, x, z) => {
      const m = new THREE.Mesh(worldUV(new THREE.BoxGeometry(w, ph, d), 2), pm); m.position.set(x, H + 0.22 + ph / 2, z); m.castShadow = true; m.receiveShadow = true; roof.add(m);
      const c = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.05, d + 0.06), cap); c.position.set(x, H + 0.22 + ph + 0.025, z); c.castShadow = true; roof.add(c);
    };
    const t = 0.16;
    P(W + 0.3, t, W / 2, -0.07); P(W + 0.3, t, W / 2, D + 0.07); P(t, D + 0.3, -0.07, D / 2); P(t, D + 0.3, W + 0.07, D / 2);
    if (flat) { // cornisa sobresaliente al frente
      const c = new THREE.Mesh(new THREE.BoxGeometry(W + 0.7, 0.12, 0.6), new THREE.MeshStandardMaterial({ color: facade.accent, roughness: 0.8 }));
      c.position.set(W / 2, H + 0.05, -0.2); c.castShadow = true; roof.add(c);
    }
    for (const x of [0.6, W - 0.6]) { const g = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.4), new THREE.MeshStandardMaterial({ color: '#9aa0a6' })); g.position.set(x, H + 0.28, D + 0.3); roof.add(g); }
    // tinaco (tanque de agua) — típico en techos planos
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 20), new THREE.MeshStandardMaterial({ color: '#2b2d30', roughness: 0.6 }));
    tank.position.set(W - 1.1, H + 0.22 + 0.55, D - 1.4); tank.castShadow = true; roof.add(tank);
  }
}

// ---------------------------------------------------------------------------
// Detalles de fachada: alféizar, balcón de hierro, porche, lámpara, número
// ---------------------------------------------------------------------------
function windowExtras(walls, alongX, fixed, oc, ow, sill, head, outward, model, clip) {
  const sillMat = new THREE.MeshStandardMaterial({ color: '#d6d0c4', roughness: 0.8, ...clip });
  const S = (lw, h, ld) => alongX ? [lw, h, ld] : [ld, h, lw];
  const P = (u, y, n) => alongX ? [oc + u, y, fixed + n * outward] : [fixed + n * outward, y, oc + u];
  const m = new THREE.Mesh(new THREE.BoxGeometry(...S(ow + 0.2, 0.05, 0.16)), sillMat);
  m.position.set(...P(0, sill - 0.04, 0.12)); m.castShadow = true; walls.add(m);
  // cortinas interiores (dan vida a la fachada y evitan el efecto de "caja vacía")
  const cur = new THREE.MeshStandardMaterial({ color: ['#efe6d8', '#e6dccb', '#d9e2e6', '#efe2d2'][Math.abs(Math.round(oc * 7)) % 4], roughness: 1, side: THREE.DoubleSide, ...clip });
  const ch = head - sill + 0.1;
  for (const sg of [-1, 1]) {
    const cw = ow * (0.22 + (Math.abs(oc * 13) % 10) / 60);
    const c = new THREE.Mesh(new THREE.BoxGeometry(...S(cw, ch, 0.02)), cur);
    c.position.set(...P(sg * (ow / 2 - cw / 2), sill + ch / 2 - 0.05, -0.14)); walls.add(c);
  }
  if (model.id === 'A' && sill > 0.5) { // balcón (reja) decorativo
    const iron = new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.45, metalness: 0.6, ...clip });
    const h = head - sill, n = Math.max(3, Math.round(ow / 0.12));
    for (let i = 0; i <= n; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(...S(0.016, h, 0.016)), iron); b.position.set(...P(-ow / 2 + i * ow / n, sill + h / 2, 0.14)); walls.add(b); }
    for (const y of [sill + 0.03, sill + h / 2, head - 0.03]) { const b = new THREE.Mesh(new THREE.BoxGeometry(...S(ow, 0.025, 0.02)), iron); b.position.set(...P(0, y, 0.14)); walls.add(b); }
  }
  if (model.id === 'B') { // marco grueso de color
    const fr = new THREE.MeshStandardMaterial({ color: model.facade.accent, roughness: 0.6, ...clip });
    const t = 0.1;
    [[0, head + t / 2, ow + 2 * t, t], [0, sill - t / 2, ow + 2 * t, t]].forEach(([u, y, w, h]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(...S(w, h, 0.12)), fr); b.position.set(...P(u, y, 0.1)); walls.add(b); });
    [-1, 1].forEach(sg => { const b = new THREE.Mesh(new THREE.BoxGeometry(...S(t, head - sill, 0.12)), fr); b.position.set(...P(sg * (ow / 2 + t / 2), (head + sill) / 2, 0.1)); walls.add(b); });
  }
}

function porch(g, W, model, colliders) {
  const f = model.facade;
  if (model.id === 'A') {
    const T = tileMaps();
    const tm = App.noPBR ? new THREE.MeshStandardMaterial({ map: T.map, bumpMap: T.bump, bumpScale: 3, roughness: 0.8 }) : pbrMat('teja', { color: '#f2e6dc' });
    const geo = App.noPBR ? worldUV(new THREE.BoxGeometry(3.2, 0.06, 1.6), T.size[0], T.size[1], [0, 0, 0], false) : worldUV(new THREE.BoxGeometry(3.2, 0.06, 1.6), pbrSize('teja'), pbrSize('teja'), [0, 0, 0], false);
    const r = new THREE.Mesh(geo, [tm, tm, tm, new THREE.MeshStandardMaterial({ color: '#7a5236' }), tm, tm]);
    r.position.set(1.55, 2.42, -0.72); r.rotation.x = -0.28; r.castShadow = true; r.receiveShadow = true; g.add(r);
    const wood = new THREE.MeshStandardMaterial({ color: '#6d4a32', roughness: 0.7 });
    for (const x of [0.15, 2.95]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.15, 0.14), wood); p.position.set(x, 1.075, -1.35); p.castShadow = true; g.add(p); colliders.push({ x0: x - 0.1, x1: x + 0.1, z0: -1.45, z1: -1.25 }); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.14, 0.14), wood); beam.position.set(1.55, 2.16, -1.35); beam.castShadow = true; g.add(beam);
  } else {
    const c = new THREE.Mesh(new THREE.BoxGeometry(model.id === 'B' ? 3.4 : 2.2, 0.14, 1.2), stuccoMat(model.id === 'B' ? f.accent : f.wall));
    c.position.set(model.id === 'B' ? 1.7 : 1.45, 2.35, -0.6); c.castShadow = true; c.receiveShadow = true; g.add(c);
  }
  // lámpara de pared y número de casa
  const lamp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.1), new THREE.MeshStandardMaterial({ color: '#222', metalness: 0.5, roughness: 0.4 }));
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.02), new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffd58a', emissiveIntensity: 0.8 }));
  glow.position.z = -0.055; lamp.add(body, glow); lamp.position.set(0.55, 1.95, -0.14); g.add(lamp);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.16), new THREE.MeshStandardMaterial({ map: numberTex(), roughness: 0.5 }));
  plate.position.set(0.55, 1.55, -0.1); plate.rotation.y = Math.PI; g.add(plate);
}
function numberTex() {
  if (RTEX.num) return RTEX.num;
  const c = noiseCanvas(128, (g) => { g.fillStyle = '#f5efe3'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#2b3f8f'; g.fillRect(4, 30, 120, 68); g.fillStyle = '#fff'; g.font = 'bold 44px Georgia'; g.textAlign = 'center'; g.fillText('12', 64, 80); });
  return (RTEX.num = texFrom(c));
}

// Árbol de copa redondeada con variación de color
// Follaje con tarjetas de hojas (técnica de los renders y videojuegos) en lugar de esferas lisas
function foliageTex() {
  if (RTEX.foliage) return RTEX.foliage;
  const rnd = mulberry(91), S = 512;
  const cv = noiseCanvas(S, g => {
    g.clearRect(0, 0, S, S);
    const greens = ['#2f5a24', '#3b6b2b', '#4a7c33', '#5a8d3b', '#6c9b45', '#2a4f20'];
    for (let i = 0; i < 1500; i++) {
      // más densidad al centro, bordes irregulares
      const a = rnd() * 6.283, r = Math.sqrt(rnd()) * S * 0.47;
      const x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r * 0.9;
      const L = 9 + rnd() * 14, Wd = L * (0.35 + rnd() * 0.15), rot = rnd() * 6.283;
      g.save(); g.translate(x, y); g.rotate(rot);
      const shade = r / (S * 0.47);
      g.fillStyle = greens[Math.min(5, Math.floor(rnd() * 4 + (1 - shade) * 0.5 + (rnd() < 0.15 ? 2 : 0)))];
      g.beginPath(); g.ellipse(0, 0, L / 2, Wd / 2, 0, 0, 6.283); g.fill();
      g.strokeStyle = 'rgba(20,40,15,.35)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L / 2, 0); g.stroke();
      g.restore();
    }
  });
  const t = texFrom(cv); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return (RTEX.foliage = t);
}
function foliageMat(color = '#ffffff') {
  return new THREE.MeshStandardMaterial({ color, map: foliageTex(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, envMapIntensity: 0.5 });
}
// Geometría de copa: tarjetas cruzadas dentro de un elipsoide, con normales esféricas (luz suave)
function crownGeo(r = 2.4, cards = 22, seed = 5, cy = 0) {
  const rnd = mulberry(seed), geos = [];
  for (let i = 0; i < cards; i++) {
    const sz = r * (0.9 + rnd() * 0.6);
    const g = new THREE.PlaneGeometry(sz, sz);
    g.rotateX(rnd() * 6.28); g.rotateY(rnd() * 6.28); g.rotateZ(rnd() * 6.28);
    const a = rnd() * 6.28, rr = Math.sqrt(rnd()) * r * 0.55;
    g.translate(Math.cos(a) * rr, (rnd() - 0.4) * r * 0.55 + cy, Math.sin(a) * rr);
    geos.push(g);
  }
  const m = mergeGeometries(geos, false);
  const p = m.attributes.position, n = m.attributes.normal, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.set(p.getX(i), (p.getY(i) - cy) * 1.2, p.getZ(i)).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
  return m;
}
function realTree(scale = 1, seed = 1) {
  const rnd = mulberry(seed);
  const t = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: '#5a4434', roughness: 1 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * scale, 0.2 * scale, 2.8 * scale, 8), bark);
  trunk.position.y = 1.4 * scale; trunk.castShadow = true; t.add(trunk);
  for (const s of [-1, 1]) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scale, 0.08 * scale, 1.4 * scale, 6), bark); br.position.set(s * 0.35 * scale, 2.7 * scale, 0); br.rotation.z = -s * 0.6; t.add(br); }
  const tint = ['#ffffff', '#e8f0d8', '#f4f7e6'][seed % 3];
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.15 * scale, 10, 8), new THREE.MeshStandardMaterial({ color: '#2c4a22', roughness: 1 }));
  core.position.y = 3.4 * scale; core.scale.y = 0.8; t.add(core);
  const crown = new THREE.Mesh(crownGeo(2.3 * scale, 26, seed * 7 + 1), foliageMat(tint));
  crown.position.y = 3.5 * scale; crown.castShadow = true; crown.receiveShadow = true; t.add(crown);
  return t;
}
function bush(w, h, color = '#4b7a34', seed = 3) {
  const g = new THREE.Group(), rnd = mulberry(seed);
  const n = Math.max(2, Math.round(w / 0.35));
  for (let i = 0; i < n; i++) {
    const r = h * (0.45 + rnd() * 0.25);
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshStandardMaterial({ color: new THREE.Color(color).offsetHSL(0, 0, (rnd() - .5) * .08), roughness: 1 }));
    m.position.set(-w / 2 + (i + .5) * w / n, r * 0.8, (rnd() - .5) * 0.15); m.scale.y = 0.85; m.castShadow = true; g.add(m);
  }
  return g;
}
// Carro sencillo estacionado
function parkedCar(color = '#8a1f24') {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.6, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.15 });
  paint.userData.paint = true;
  const glass = new THREE.MeshPhysicalMaterial({ color: '#1d2730', metalness: 0.2, roughness: 0.05 });
  rbx(g, 1.75, 0.6, 4.2, paint, 0, 0.62, 0, 0.18);
  const cab = rbx(g, 1.55, 0.55, 2.2, glass, 0, 1.15, 0.15, 0.2);
  rbx(g, 1.58, 0.06, 2.0, paint, 0, 1.43, 0.15, 0.03);
  const tire = new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.9 });
  const rim = new THREE.MeshStandardMaterial({ color: '#b8bcc0', metalness: 0.8, roughness: 0.3 });
  for (const [x, z] of [[-0.8, 1.35], [0.8, 1.35], [-0.8, -1.35], [0.8, -1.35]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 20), tire); w.rotation.z = Math.PI / 2; w.position.set(x, 0.33, z); w.castShadow = true; g.add(w);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.25, 14), rim); r.rotation.z = Math.PI / 2; r.position.set(x * 1.01, 0.33, z); g.add(r);
  }
  const lightM = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff6dd', emissiveIntensity: 0.3 });
  const tail = new THREE.MeshStandardMaterial({ color: '#a01010', emissive: '#500000' });
  for (const x of [-0.6, 0.6]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.05), lightM); h.position.set(x, 0.75, -2.1); g.add(h); const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.05), tail); t.position.set(x, 0.78, 2.1); g.add(t); }
  return g;
}
// Poste de luz con luminaria
function streetPole() {
  const g = new THREE.Group();
  const conc = new THREE.MeshStandardMaterial({ color: '#b9b5ad', roughness: 0.9 });
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 9, 10), conc); p.position.y = 4.5; p.castShadow = true; g.add(p);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.6), new THREE.MeshStandardMaterial({ color: '#777' })); arm.position.set(0, 7.6, 0.8); g.add(arm);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.6), new THREE.MeshStandardMaterial({ color: '#555', metalness: .4 })); head.position.set(0, 7.55, 1.55); g.add(head);
  const cross = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: '#555' })); cross.position.y = 8.7; g.add(cross);
  return g;
}

// ---------------------------------------------------------------------------
// Optimización: fusiona mallas estáticas con material equivalente (menos llamadas de dibujo)
// ---------------------------------------------------------------------------
function matKey(m) {
  const c = x => x ? x.getHexString() : '';
  return [m.type, c(m.color), c(m.emissive), m.emissiveIntensity, m.map?.uuid, m.bumpMap?.uuid, m.roughness, m.metalness, m.transparent, m.opacity,
    m.side, m.flatShading, (m.clippingPlanes || []).length, m.envMapIntensity, m.clearcoat, m.depthWrite].join('|');
}
function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.userData.keep) return;
    const k = matKey(o.material) + (o.castShadow ? 'S' : '') + (o.receiveShadow ? 'R' : '') + o.renderOrder;
    if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(o);
  });
  const tmp = new THREE.Matrix4();
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const geos = [];
    for (const m of list) {
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      g.clearGroups(); g.morphAttributes = {};
      g.applyMatrix4(tmp.multiplyMatrices(inv, m.matrixWorld));
      geos.push(g);
    }
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, list[0].material);
    mesh.castShadow = list[0].castShadow; mesh.receiveShadow = list[0].receiveShadow; mesh.renderOrder = list[0].renderOrder;
    list.forEach(m => m.parent.remove(m));
    root.add(mesh);
  }
  return root;
}

// Adoquín ecológico (bloques de concreto con zacate) y tierra para el corte de maqueta
function paverTex() {
  if (RTEX.paver) return RTEX.paver;
  const rnd = mulberry(19);
  const cv = noiseCanvas(512, (g, s) => {
    g.drawImage(grassTex().image, 0, 0, s, s);
    const n = 4, c = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = `rgb(${200 + rnd() * 20},${196 + rnd() * 18},${186 + rnd() * 16})`;
      g.fillRect(i * c + 6, j * c + 6, c - 12, c - 12);
      g.drawImage(grassTex().image, 0, 0, 120, 120, i * c + c / 2 - 18, j * c + c / 2 - 18, 36, 36);
    }
    speckle(g, s, 3000, .5, 1.2, v => `rgba(0,0,0,${v * .08})`, rnd);
  });
  return (RTEX.paver = texFrom(cv));
}
function soilTex() {
  if (RTEX.soil) return RTEX.soil;
  const rnd = mulberry(23);
  const cv = noiseCanvas(256, (g, s) => {
    const grd = g.createLinearGradient(0, 0, 0, s); grd.addColorStop(0, '#6d4f36'); grd.addColorStop(1, '#4a3424');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
    speckle(g, s, 2500, .5, 2.5, v => v > .5 ? 'rgba(150,120,90,.25)' : 'rgba(30,20,10,.25)', rnd);
  });
  return (RTEX.soil = texFrom(cv));
}
// Veranera (buganvilia): arbusto con flores fucsia
function veranera(w, h, seed) {
  const g = bush(w, h, '#3e6a2c', seed), rnd = mulberry(seed * 3);
  const fm = new THREE.MeshStandardMaterial({ color: '#c92f8a', roughness: 0.8 });
  const fm2 = new THREE.MeshStandardMaterial({ color: '#e04aa0', roughness: 0.8 });
  for (let i = 0; i < 70; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05 + rnd() * 0.04, 0), rnd() > .5 ? fm : fm2);
    const a = rnd() * 6.28, r = h * (0.35 + rnd() * 0.25);
    m.position.set((rnd() - .5) * w, h * 0.45 + Math.sin(a) * r * 0.8, Math.cos(a) * r * 0.6); g.add(m);
  }
  return g;
}

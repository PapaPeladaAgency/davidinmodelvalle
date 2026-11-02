// ============================================================================
// 30-house.js — Vivienda demostrativa 3D generada desde un plano JSON
// buildHouse(model, decor) → { root, walls, roof, furniture, colliders, rooms }
// El plano (model.plan) es editable desde el panel y sustituible por planos reales.
// ============================================================================

const CutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100); // recorte de muros (Dollhouse)

const ITEM_NAMES = {
  sofa: 'Sofá', armchair: 'Sillón', coffeeTable: 'Mesa de centro', tvUnit: 'Mueble de TV', rug: 'Alfombra', plant: 'Planta',
  floorLamp: 'Lámpara de pie', picture: 'Cuadro', diningTable: 'Mesa de comedor', chair: 'Silla', sideboard: 'Aparador',
  pendant: 'Lámpara colgante', counter: 'Cocineta con lavaplatos y estufa', fridge: 'Refrigeradora', toilet: 'Inodoro',
  lavabo: 'Lavamanos con espejo', shower: 'Ducha', bedDouble: 'Cama matrimonial', bedSingle: 'Cama individual',
  nightstand: 'Mesa de noche', wardrobe: 'Closet', desk: 'Escritorio',
};
const SOLID_ITEMS = new Set(['sofa', 'armchair', 'coffeeTable', 'tvUnit', 'diningTable', 'sideboard', 'counter', 'fridge', 'toilet', 'lavabo', 'bedDouble', 'bedSingle', 'nightstand', 'wardrobe', 'desk', 'shower', 'plant']);
const CLIP_ITEMS = new Set(['picture', 'pendant']);

const PALETTES = {
  vacia:       { floorKey: 'robleClaro', tileKey: 'marmolBlanco', wall: '#f1eee8', wood: '#b48a62', fabric: '#bba78e', accent: '#7d93a8', rug: '#c9b79c', bed: '#ebe6dc', metal: '#3a3d42', floor: '#c8a47a' },
  amueblada:   { floorKey: 'robleNatural', tileKey: 'pisoCeramica', wall: '#f4f2ec', wood: '#b8915f', fabric: '#cfc8bd', accent: '#5d7184', rug: '#c9b79c', bed: '#ebe6dc', metal: '#3a3d42', floor: '#bf9469' },
  moderna:     { floorKey: 'robleGris', tileKey: 'marmolBlanco', wall: '#f4f3f0', wood: '#c8a27a', fabric: '#d9d8d4', accent: '#7f8f7a', rug: '#e2dfd8', bed: '#ffffff', metal: '#1c1c1c', floor: '#c2a888' },
  minimalista: { floorKey: 'robleClaro', tileKey: 'marmolBlanco', wall: '#fbfaf8', wood: '#dcc7a6', fabric: '#e7e2d9', accent: '#b8c0b8', rug: '#efebe4', bed: '#ffffff', metal: '#a5a9ad', floor: '#dcc6a6' },
  familiar:    { floorKey: 'pisoMadera', tileKey: 'pisoCeramica', wall: '#f6e8d2', wood: '#8a5a36', fabric: '#9b5f43', accent: '#3f7d5c', rug: '#b5523b', bed: '#f1e3c8', metal: '#4a4036', floor: '#b27d4f' },
};

const TEX = {};
function canvasTex(key, draw, rep = [1, 1]) {
  if (TEX[key]) return TEX[key];
  const c = document.createElement('canvas'); c.width = c.height = 256;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 4;
  return (TEX[key] = t);
}
// Duela de madera: tablones de 18 cm, largos variables, veta y juntas (textura de 1.2 m)
function woodTex(color) {
  if (TEX['wood' + color]) return TEX['wood' + color];
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), rnd = mulberry(color.length * 31 + color.charCodeAt(2));
  const base = new THREE.Color(color), rows = 7, rh = S / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * S * 0.6;
    while (x < S) {
      const L = S * (0.45 + rnd() * 0.55);
      const col = base.clone().offsetHSL((rnd() - .5) * .015, (rnd() - .5) * .08, (rnd() - .5) * .09);
      g.fillStyle = '#' + col.getHexString(); g.fillRect(x, r * rh, L, rh);
      // veta
      for (let k = 0; k < 26; k++) {
        const y0 = r * rh + rnd() * rh, amp = 2 + rnd() * 6, ph = rnd() * 6;
        g.strokeStyle = `rgba(${rnd() > .5 ? '60,35,15' : '255,240,220'},${.04 + rnd() * .07})`; g.lineWidth = .6 + rnd() * 1.4;
        g.beginPath(); for (let t = 0; t <= 1; t += .05) { const xx = x + t * L, yy = y0 + Math.sin(t * 6 + ph) * amp * .3; t ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke();
      }
      if (rnd() > .6) { g.fillStyle = 'rgba(70,40,20,.18)'; g.beginPath(); g.ellipse(x + rnd() * L, r * rh + rh / 2, 10 + rnd() * 10, 4 + rnd() * 3, 0, 0, 6.28); g.fill(); }
      g.fillStyle = 'rgba(35,20,10,.55)'; g.fillRect(x, r * rh, 2, rh);
      x += L;
    }
    g.fillStyle = 'rgba(35,20,10,.5)'; g.fillRect(0, r * rh, S, 2);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return (TEX['wood' + color] = t);
}
// Cerámica gris clara 60×60 con ligera variación y sisa
function tileTex() {
  if (TEX.tile) return TEX.tile;
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), rnd = mulberry(4);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const col = new THREE.Color('#d9d6cf').offsetHSL(0, 0, (rnd() - .5) * .04);
    g.fillStyle = '#' + col.getHexString(); g.fillRect(i * 256, j * 256, 256, 256);
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${rnd() > .5 ? '255,255,255' : '140,135,128'},.05)`; g.beginPath(); g.arc(i * 256 + rnd() * 256, j * 256 + rnd() * 256, 10 + rnd() * 40, 0, 6.28); g.fill(); }
  }
  g.fillStyle = '#b4afa5'; for (let i = 0; i <= 2; i++) { g.fillRect(i * 256 - 2, 0, 4, S); g.fillRect(0, i * 256 - 2, S, 4); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return (TEX.tile = t);
}
function rugTex(color) {
  return canvasTex('rug' + color, g => {
    g.fillStyle = color; g.fillRect(0, 0, 256, 256);
    const rnd = mulberry(color.length);
    for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${rnd() > .5 ? '255,255,255' : '0,0,0'},.05)`; g.fillRect(rnd() * 256, rnd() * 256, 1, 2); }
    g.strokeStyle = 'rgba(255,245,230,.6)'; g.lineWidth = 5; g.strokeRect(12, 12, 232, 232);
    g.lineWidth = 2; g.strokeRect(26, 26, 204, 204);
    g.fillStyle = 'rgba(255,245,230,.4)';
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { g.save(); g.translate(56 + i * 36, 56 + j * 36); g.rotate(Math.PI / 4); g.fillRect(-5, -5, 10, 10); g.restore(); }
  });
}
// Arte abstracto para cuadros
function artTex(seed) {
  return canvasTex('art' + seed, g => {
    const rnd = mulberry(seed * 13 + 1);
    g.fillStyle = '#f3efe8'; g.fillRect(0, 0, 256, 256);
    const pal = [['#9fc5b8', '#e8c9b5', '#2f3a40', '#d7a46f'], ['#c7b8a6', '#6f8a7a', '#efe1cf', '#1f2326'], ['#b9cfd8', '#e3b7a0', '#46535a', '#f0d9a8']][seed % 3];
    for (let i = 0; i < 7; i++) { g.fillStyle = pal[i % 4]; g.globalAlpha = .55 + rnd() * .4; g.beginPath(); g.ellipse(rnd() * 256, rnd() * 256, 20 + rnd() * 80, 10 + rnd() * 50, rnd() * 3, 0, 6.28); g.fill(); }
    g.globalAlpha = 1; g.strokeStyle = pal[2]; g.lineWidth = 3; g.beginPath(); g.moveTo(rnd() * 256, 0); g.bezierCurveTo(rnd() * 256, 90, rnd() * 256, 170, rnd() * 256, 256); g.stroke();
  });
}

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, envMapIntensity: 0.6, ...o });
function bx(g, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
}
function cyl(g, rt, rb, h, mat, x, y, z, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
}

// ---------------------------------------------------------------------------
// Catálogo de muebles (origen en el centro de la huella, frente hacia +z)
// ---------------------------------------------------------------------------
const FURN = {
  sofa(p, it) {
    const g = new THREE.Group(), w = it.w || 2, f = fabricMat(p.fabric);
    rbx(g, w, 0.26, 0.85, f, 0, 0.2, 0, 0.05);
    const nseat = w > 1.2 ? 2 : 1;
    for (let i = 0; i < nseat; i++) rbx(g, (w - 0.36) / nseat - 0.02, 0.14, 0.66, f, -w / 2 + 0.18 + ((w - 0.36) / nseat) * (i + 0.5), 0.39, 0.07, 0.06);
    for (let i = 0; i < nseat; i++) rbx(g, (w - 0.36) / nseat - 0.02, 0.44, 0.18, f, -w / 2 + 0.18 + ((w - 0.36) / nseat) * (i + 0.5), 0.62, -0.3, 0.07).rotation.x = -0.12;
    rbx(g, 0.18, 0.62, 0.85, f, -w / 2 + 0.09, 0.31, 0, 0.06); rbx(g, 0.18, 0.62, 0.85, f, w / 2 - 0.09, 0.31, 0, 0.06);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => cyl(g, 0.02, 0.015, 0.08, M(p.metal), sx * (w / 2 - 0.08), 0.04, sz * 0.36, 8));
    const c = fabricMat(p.accent);
    rbx(g, 0.42, 0.38, 0.12, c, -w / 2 + 0.45, 0.64, -0.16, 0.06).rotation.x = -0.25;
    if (p.id !== 'minimalista') rbx(g, 0.42, 0.38, 0.12, c, w / 2 - 0.45, 0.64, -0.16, 0.06).rotation.x = -0.25;
    return g;
  },
  armchair(p) { return FURN.sofa(p, { w: 0.9 }); },
  coffeeTable(p) {
    const g = new THREE.Group(), w = M(p.wood);
    bx(g, 1.0, 0.05, 0.55, w, 0, 0.42, 0);
    if (p.id === 'moderna') bx(g, 0.9, 0.4, 0.45, M(p.metal), 0, 0.2, 0);
    else [[-.45, -.22], [.45, -.22], [-.45, .22], [.45, .22]].forEach(([x, z]) => bx(g, 0.05, 0.4, 0.05, w, x, 0.2, z));
    if (p.id === 'familiar') { cyl(g, 0.07, 0.05, 0.16, M('#e8d9c0'), 0.2, 0.53, 0); }
    return g;
  },
  tvUnit(p, it) {
    const g = new THREE.Group(), w = it.w || 1.6;
    bx(g, w, 0.5, 0.4, M(p.wood), 0, 0.25, 0);
    bx(g, 0.06, 0.06, 0.06, M(p.metal), 0, 0.53, -0.05);
    const tv = bx(g, 1.15, 0.66, 0.05, M('#0c0d10', { roughness: 0.3 }), 0, 0.98, -0.05);
    bx(g, 1.08, 0.6, 0.01, M('#1b2a3a', { roughness: 0.15, emissive: '#0b1a2a' }), 0, 0.98, -0.02);
    return g;
  },
  rug(p, it) {
    const g = new THREE.Group();
    const mat = p.id === 'familiar' ? new THREE.MeshStandardMaterial({ map: rugTex(p.rug), roughness: 1 }) : M(p.rug, { roughness: 1 });
    const m = bx(g, it.w || 2, 0.012, it.d || 1.5, mat, 0, 0.012, 0); m.castShadow = false;
    return g;
  },
  plant(p) {
    const g = new THREE.Group();
    cyl(g, 0.17, 0.13, 0.36, M(p.id === 'moderna' ? '#2b2b2b' : p.id === 'minimalista' ? '#e9e5de' : '#b4643e'), 0, 0.18, 0);
    const leaf = M('#3f7a3a', { flatShading: true });
    [[0, 0.75, 0, 0.32], [0.12, 0.95, 0.05, 0.22], [-0.1, 0.62, -0.06, 0.24]].forEach(([x, y, z, r]) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leaf); m.position.set(x, y, z); m.castShadow = true; g.add(m);
    });
    return g;
  },
  floorLamp(p) {
    const g = new THREE.Group();
    cyl(g, 0.16, 0.16, 0.03, M(p.metal), 0, 0.015, 0); cyl(g, 0.015, 0.015, 1.5, M(p.metal), 0, 0.77, 0);
    cyl(g, 0.14, 0.22, 0.3, M('#f5ecd8', { emissive: '#6b5b3a' }), 0, 1.55, 0);
    return g;
  },
  picture(p, it) {
    const g = new THREE.Group(), w = it.w || 1, h = w * 0.62;
    bx(g, w, h, 0.03, M(p.id === 'moderna' ? '#111' : p.wood), 0, 0, 0);
    const c = document.createElement('canvas'); c.width = 128; c.height = 80; const x = c.getContext('2d');
    const grd = x.createLinearGradient(0, 0, 0, 80); grd.addColorStop(0, '#9cc3dd'); grd.addColorStop(1, '#f4e3c3'); x.fillStyle = grd; x.fillRect(0, 0, 128, 80);
    x.fillStyle = '#4e6b3c'; x.beginPath(); x.moveTo(0, 80); x.lineTo(30, 38); x.lineTo(55, 60); x.lineTo(80, 22); x.lineTo(128, 80); x.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    bx(g, w - 0.08, h - 0.08, 0.01, new THREE.MeshStandardMaterial({ map: t }), 0, 0, 0.016);
    return g;
  },
  diningTable(p) {
    const g = new THREE.Group(), w = M(p.wood);
    bx(g, 1.2, 0.05, 0.8, w, 0, 0.74, 0);
    [[-.55, -.35], [.55, -.35], [-.55, .35], [.55, .35]].forEach(([x, z]) => bx(g, 0.06, 0.72, 0.06, p.id === 'moderna' ? M(p.metal) : w, x, 0.36, z));
    if (p.id !== 'minimalista') cyl(g, 0.12, 0.09, 0.08, M(p.accent), 0, 0.81, 0);
    return g;
  },
  chair(p) {
    const g = new THREE.Group(), w = M(p.id === 'moderna' ? p.metal : p.wood);
    bx(g, 0.42, 0.05, 0.42, p.id === 'familiar' ? M(p.fabric) : w, 0, 0.45, 0);
    bx(g, 0.42, 0.42, 0.04, w, 0, 0.68, -0.19);
    [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]].forEach(([x, z]) => bx(g, 0.035, 0.45, 0.035, w, x, 0.225, z));
    return g;
  },
  sideboard(p, it) {
    const g = new THREE.Group(), w = it.w || 1;
    bx(g, w, 0.78, 0.42, M(p.wood), 0, 0.39, 0);
    bx(g, w - 0.04, 0.005, 0.01, M('#3a3530'), 0, 0.4, 0.21);
    cyl(g, 0.06, 0.08, 0.28, M(p.accent), w * 0.3, 0.92, 0);
    return g;
  },
  pendant(p) {
    const g = new THREE.Group();
    cyl(g, 0.006, 0.006, 0.55, M('#222'), 0, 2.32, 0);
    cyl(g, 0.08, 0.26, 0.22, M(p.id === 'moderna' ? '#1b1b1b' : p.id === 'familiar' ? '#c79a56' : '#f2f2ef', { side: THREE.DoubleSide }), 0, 1.95, 0);
    return g;
  },
  counter(p, it) {
    const g = new THREE.Group(), w = it.w || 2.4;
    bx(g, w, 0.86, 0.6, M(p.id === 'moderna' ? '#2f3338' : p.id === 'familiar' ? p.wood : '#f4f3ef'), 0, 0.43, 0);
    bx(g, w + 0.02, 0.04, 0.62, M(p.id === 'moderna' ? '#e8e6e2' : '#6c6a66', { roughness: 0.35 }), 0, 0.88, 0);
    bx(g, w, 0.68, 0.34, M(p.id === 'minimalista' ? '#f4f3ef' : p.id === 'moderna' ? '#e1ddd6' : p.wood), 0, 1.86, -0.13);
    if (it.sink != null) { bx(g, 0.5, 0.02, 0.38, M('#9aa3ab', { metalness: 0.6, roughness: 0.3 }), it.sink, 0.905, 0.02); cyl(g, 0.015, 0.015, 0.28, M('#c9ced2', { metalness: 0.8, roughness: 0.2 }), it.sink, 1.04, -0.2, 8); }
    if (it.stove != null) { bx(g, 0.6, 0.02, 0.5, M('#111316', { roughness: 0.3 }), it.stove, 0.905, 0.02); [[-.14, -.1], [.14, -.1], [-.14, .12], [.14, .12]].forEach(([x, z]) => cyl(g, 0.07, 0.07, 0.012, M('#2a2b2e'), it.stove + x, 0.92, 0.02 + z)); }
    return g;
  },
  fridge(p) {
    const g = new THREE.Group();
    bx(g, 0.68, 1.75, 0.66, M(p.id === 'moderna' ? '#8c9196' : '#eef0f1', { metalness: p.id === 'moderna' ? 0.5 : 0, roughness: 0.35 }), 0, 0.875, 0);
    bx(g, 0.02, 0.5, 0.03, M('#555'), 0.26, 1.2, 0.34);
    bx(g, 0.66, 0.008, 0.01, M('#9a9a9a'), 0, 1.18, 0.335);
    return g;
  },
  toilet(p) {
    const g = new THREE.Group(), w = M('#f7f7f5', { roughness: 0.25 });
    cyl(g, 0.17, 0.15, 0.4, w, 0, 0.2, 0.05); bx(g, 0.4, 0.38, 0.18, w, 0, 0.6, -0.2);
    return g;
  },
  lavabo(p) {
    const g = new THREE.Group(), w = M('#f7f7f5', { roughness: 0.25 });
    cyl(g, 0.07, 0.09, 0.75, w, 0, 0.375, 0); bx(g, 0.5, 0.14, 0.4, w, 0, 0.82, 0.02);
    bx(g, 0.55, 0.7, 0.02, M('#cfe0ea', { metalness: 0.9, roughness: 0.05 }), 0, 1.55, -0.19);
    return g;
  },
  shower(p, it) {
    const g = new THREE.Group(), w = it.w || 1, d = it.d || 0.9;
    bx(g, w, 0.06, d, M('#e9ecee'), 0, 0.03, 0);
    const glass = new THREE.MeshStandardMaterial({ color: '#cfe6ef', transparent: true, opacity: 0.28, roughness: 0.05 });
    bx(g, 0.02, 1.95, d * 0.6, glass, w / 2, 1.0, -d * 0.2).castShadow = false;
    cyl(g, 0.12, 0.12, 0.02, M('#b8bdc1', { metalness: 0.8 }), -w / 2 + 0.2, 2.05, 0);
    return g;
  },
  bedDouble(p, it) { return FURN._bed(p, 1.45); },
  bedSingle(p) { return FURN._bed(p, 0.95); },
  _bed(p, w) {
    const g = new THREE.Group();
    bx(g, w + 0.06, 0.3, 2.02, M(p.wood), 0, 0.15, 0);
    rbx(g, w, 0.24, 1.92, fabricMat(p.bed), 0, 0.42, 0, 0.07);
    bx(g, w + 0.06, p.id === 'minimalista' ? 0.6 : 0.95, 0.07, M(p.id === 'moderna' ? p.fabric : p.wood), 0, p.id === 'minimalista' ? 0.3 : 0.48, -1.0);
    const pil = M('#ffffff', { roughness: 1 });
    const np = w > 1.2 ? 2 : 1;
    for (let i = 0; i < np; i++) rbx(g, w / np - 0.12, 0.13, 0.38, fabricMat('#ffffff'), np === 1 ? 0 : (i ? 1 : -1) * w / 4, 0.6, -0.72, 0.06);
    if (p.id !== 'minimalista') rbx(g, w + 0.06, 0.06, 1.15, fabricMat(p.id === 'familiar' ? '#c0533e' : p.accent), 0, 0.56, 0.42, 0.03);
    return g;
  },
  nightstand(p) {
    const g = new THREE.Group();
    bx(g, 0.45, 0.5, 0.4, M(p.wood), 0, 0.25, 0);
    if (p.id !== 'minimalista') { cyl(g, 0.05, 0.07, 0.04, M(p.metal), 0, 0.52, 0); cyl(g, 0.1, 0.13, 0.18, M('#f5ecd8', { emissive: '#4b3f28' }), 0, 0.68, 0); cyl(g, 0.008, 0.008, 0.15, M(p.metal), 0, 0.6, 0); }
    return g;
  },
  wardrobe(p, it) {
    const g = new THREE.Group(), w = it.w || 1.6;
    bx(g, w, 2.0, 0.58, M(p.id === 'minimalista' ? '#f2efea' : p.wood), 0, 1.0, 0);
    bx(g, 0.01, 1.9, 0.01, M('#3a3530'), 0, 1.0, 0.295);
    [-0.06, 0.06].forEach(x => bx(g, 0.02, 0.3, 0.03, M(p.metal), x, 1.05, 0.3));
    return g;
  },
  desk(p) {
    const g = new THREE.Group();
    bx(g, 1.1, 0.04, 0.55, M(p.wood), 0, 0.74, 0);
    [[-.52], [.52]].forEach(([x]) => bx(g, 0.04, 0.72, 0.5, M(p.metal), x, 0.36, 0));
    bx(g, 0.5, 0.32, 0.03, M('#111', { roughness: 0.3 }), 0, 1.0, -0.15);
    const ch = FURN.chair(p); ch.position.set(0, 0, 0.5); ch.rotation.y = Math.PI; g.add(ch);
    return g;
  },
};

// ---------------------------------------------------------------------------
// Construcción de la vivienda
// ---------------------------------------------------------------------------
function buildHouse(model, decor, opts = {}) {
  const plan = model.plan || PLAN_52;
  const W = plan.width, D = plan.depth, H = plan.height || 2.6, HC = 1.95;
  const pal = { ...PALETTES[decor] || PALETTES.amueblada, id: decor };
  const facade = model.facade || DEFAULT_MODELS.A.facade;
  const root = new THREE.Group(); root.name = 'house';
  const walls = new THREE.Group(), roof = new THREE.Group(), furniture = new THREE.Group(), floors = new THREE.Group();
  root.add(floors, walls, roof, furniture);
  const colliders = [];
  const clip = opts.clip === false ? {} : { clippingPlanes: [CutPlane], clipShadows: true };

  // Losa y pisos por ambiente
  bx(floors, W + 0.5, 0.18, D + 0.5, M('#bdb7ab'), W / 2, -0.07, D / 2).castShadow = false;
  const floorKey = pal.floorKey || 'robleNatural', tileKey = pal.tileKey || 'pisoCeramica';
  const woodMat = pbrMat(floorKey, { color: pal.id === 'familiar' ? '#e6c9a8' : '#ffffff', envMapIntensity: 0.7 });
  const tileMat = pbrMat(tileKey, { envMapIntensity: 1 });
  if (App.noPBR) { woodMat.map = woodTex(pal.floor); woodMat.color.set('#fff'); tileMat.map = tileTex(); }
  const rooms = [];
  for (const r of plan.rooms) {
    const m = bx(floors, r.w, 0.02, r.d, r.floor === 'tile' ? tileMat : woodMat, r.x + r.w / 2, 0.02, r.z + r.d / 2);
    const fs = App.noPBR ? 1.25 : pbrSize(r.floor === 'tile' ? tileKey : floorKey);
    worldUV(m.geometry, fs, fs, [r.x + r.w / 2, 0, r.z + r.d / 2]);
    m.castShadow = false;
    const hot = new THREE.Mesh(new THREE.PlaneGeometry(r.w - 0.12, r.d - 0.12), new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0, depthWrite: false }));
    hot.rotation.x = -Math.PI / 2; hot.position.set(r.x + r.w / 2, 0.05, r.z + r.d / 2); hot.userData.room = r.id;
    floors.add(hot);
    rooms.push({ ...r, area: +(r.w * r.d).toFixed(1), hot });
  }

  // Muros con aberturas
  const intMat = stuccoMat(pal.wall, { roughness: 0.92, ...clip, side: THREE.DoubleSide, bumpScale: 0.25 }); intMat.userData.interior = true;
  const extMat = stuccoExtMat(facade.wall, { ...clip, side: THREE.DoubleSide });
  const baseMat = M(pal.id === 'moderna' ? '#3a3633' : '#ece6da', { roughness: 0.6, ...clip });
  const accMat = M(facade.accent, { roughness: 0.85, ...clip, side: THREE.DoubleSide });
  const trimMat = M(facade.trim, { roughness: 0.6, ...clip });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#b9d2e2', transparent: true, opacity: 0.32, roughness: 0.03, metalness: 0.0, envMapIntensity: 2.2, ...clip, depthWrite: false });
  const doorMat = model.id === 'A' ? new THREE.MeshStandardMaterial({ map: woodTex('#7a4a2b'), roughness: 0.55, ...clip }) : M(model.id === 'B' ? '#2a2f35' : '#d7d2ca', { roughness: 0.5, ...clip });
  const trimMat2 = new THREE.MeshStandardMaterial({ color: facade.trim, roughness: 0.35, metalness: model.id === 'A' ? 0 : 0.55, ...clip });
  const intDoorMat = M(pal.id === 'moderna' ? '#3e3732' : '#e8e0d2', { ...clip });

  for (const wl of plan.walls) {
    const t = wl.ext ? 0.18 : 0.1;
    const alongX = wl.a[1] === wl.b[1];
    const len = alongX ? Math.abs(wl.b[0] - wl.a[0]) : Math.abs(wl.b[1] - wl.a[1]);
    const s0 = alongX ? Math.min(wl.a[0], wl.b[0]) : Math.min(wl.a[1], wl.b[1]);
    const fixed = alongX ? wl.a[1] : wl.a[0];
    const ext0 = wl.ext ? t / 2 : 0;
    // materiales por cara (exterior / interior)
    let mats = intMat;
    if (wl.ext) {
      const arr = [intMat, intMat, intMat, intMat, intMat, intMat];
      const wallM = (model.id === 'B' && alongX && fixed < D / 2) ? extMat : extMat;
      if (alongX) arr[fixed < D / 2 ? 5 : 4] = wallM; else arr[fixed < W / 2 ? 1 : 0] = wallM;
      arr[2] = extMat;
      mats = arr;
    }
    const piece = (a, b, y0, y1, collide) => {
      if (b - a < 0.005 || y1 - y0 < 0.005) return;
      const L = b - a, c = s0 + (a + b) / 2;
      const geo = new THREE.BoxGeometry(alongX ? L : t, y1 - y0, alongX ? t : L);
      const px = alongX ? c : fixed, py = (y0 + y1) / 2, pz = alongX ? fixed : c;
      worldUV(geo, 2.4, 2.4, [px, py, pz]);
      const m = new THREE.Mesh(geo, mats);
      m.position.set(px, py, pz);
      m.castShadow = m.receiveShadow = true; walls.add(m);
      if (y0 === 0 && !opts.neighbor) { // rodapié
        const b = new THREE.Mesh(new THREE.BoxGeometry(alongX ? L : t + 0.024, 0.09, alongX ? t + 0.024 : L), baseMat);
        b.position.set(px, 0.045, pz); b.receiveShadow = true; walls.add(b);
      }
      if (collide) colliders.push(alongX ? { x0: s0 + a, x1: s0 + b, z0: fixed - t / 2, z1: fixed + t / 2 } : { x0: fixed - t / 2, x1: fixed + t / 2, z0: s0 + a, z1: s0 + b });
    };
    const ops = (wl.open || []).slice().sort((p, q) => p.f - q.f);
    let cur = -ext0;
    for (const o of ops) {
      piece(cur, o.f, 0, H, true);
      const isDoor = o.t === 'door';
      const sill = isDoor ? 0 : (o.sill ?? 0.9), head = isDoor ? 2.1 : 2.15;
      if (!isDoor) piece(o.f, o.to, 0, sill, true);
      piece(o.f, o.to, head, H, false);
      if (!isDoor) colliders.push(alongX ? { x0: s0 + o.f, x1: s0 + o.to, z0: fixed - t / 2, z1: fixed + t / 2 } : { x0: fixed - t / 2, x1: fixed + t / 2, z0: s0 + o.f, z1: s0 + o.to });
      // marcos
      const ow = o.to - o.f, oc = s0 + (o.f + o.to) / 2, fw = 0.05, fd = t + 0.03;
      const frame = (w, h, d, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); walls.add(m); return m; };
      const P = (u, y) => alongX ? [oc + u, y, fixed] : [fixed, y, oc + u];
      const S = (lw, h, ld) => alongX ? [lw, h, ld] : [ld, h, lw];
      const fm = wl.ext ? trimMat2 : intDoorMat;
      frame(...S(ow + fw * 2, fw, fd), ...P(0, head + fw / 2), fm);
      frame(...S(fw, head - sill, fd), ...P(-ow / 2 - fw / 2, (head + sill) / 2), fm);
      frame(...S(fw, head - sill, fd), ...P(ow / 2 + fw / 2, (head + sill) / 2), fm);
      if (!isDoor) {
        frame(...S(ow + 0.1, 0.04, fd + 0.06), ...P(0, sill - 0.02), fm);
        frame(...S(ow, head - sill, 0.02), ...P(0, (head + sill) / 2), glassMat).renderOrder = 2;
        frame(...S(0.03, head - sill, 0.04), ...P(0, (head + sill) / 2), fm);
        frame(...S(ow, 0.03, 0.04), ...P(0, sill + (head - sill) * 0.62), fm);
        if (wl.ext) windowExtras(walls, alongX, fixed, oc, ow, sill, head, alongX ? (fixed < D / 2 ? -1 : 1) : (fixed < W / 2 ? -1 : 1), model, clip);
      } else {
        // hoja de puerta abierta 90° hacia el interior
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 0.04 : ow - 0.04, 2.05, alongX ? ow - 0.04 : 0.04), o.main ? doorMat : (wl.ext ? doorMat : intDoorMat));
        const inward = alongX ? (fixed < D / 2 ? 1 : -1) : (fixed < W / 2 ? 1 : -1);
        const hingeAtB = o.hinge === 'b';
        const hu = hingeAtB ? ow / 2 - 0.02 : -ow / 2 + 0.02;
        const off = inward * (t / 2 + ow / 2);
        if (alongX) leaf.position.set(oc + hu, 1.03, fixed + off); else leaf.position.set(fixed + off, 1.03, oc + hu);
        leaf.castShadow = true; walls.add(leaf);
        // manija
        const hm = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: '#c9b37a', metalness: 0.9, roughness: 0.25, ...clip }));
        hm.position.copy(leaf.position); if (alongX) { hm.position.z += inward * (ow / 2 - 0.12) * 1; hm.position.x += 0.04; } else { hm.position.x += inward * (ow / 2 - 0.12); hm.position.z += 0.04; }
        walls.add(hm);
      }
      cur = o.to;
    }
    piece(cur, len + ext0, 0, H, true);
  }
  // Acento de fachada para el modelo B (celosía de madera) y zócalo
  if (model.id === 'B') {
    for (let i = 0; i < 9; i++) bx(walls, 0.05, 2.4, 0.06, M('#8a5a36', clip), 5.85 + (i - 4) * 0.08 - 0.0, 1.25, -0.14);
  }

  // Techo + cielo falso
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M('#f7f6f2', { side: THREE.DoubleSide }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(W / 2, H - 0.01, D / 2); roof.add(ceil);
  buildRealRoof(roof, W, D, H, facade, model, clip);
  if (!opts.neighbor) {
    porch(roof, W, model, colliders);
    // lámparas de techo por ambiente
    const lampM = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4dc', emissiveIntensity: 0.9 });
    for (const r of plan.rooms) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.05, 20), lampM); l.position.set(r.x + r.w / 2, H - 0.035, r.z + r.d / 2); roof.add(l); }
  }
  roof.traverse(o => { if (o.material) { o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.transparent = true); } });

  // Mobiliario
  const furnList = opts.neighbor ? [] : buildFurniture(furniture, plan, decor, pal, colliders);
  // Muros cortados: copia sin recorte por plano, con tapa sólida (vista Casa abierta tipo maqueta)
  const wallsCut = new THREE.Group(); wallsCut.visible = false; root.add(wallsCut);
  if (!opts.neighbor) {
    const capMat = new THREE.MeshStandardMaterial({ color: '#efeeea', roughness: 0.85 });
    const unclip = mat => { const m = mat.clone(); m.clippingPlanes = null; return m; };
    const cache = new Map(); const uc = mat => { if (!cache.has(mat)) cache.set(mat, unclip(mat)); return cache.get(mat); };
    walls.updateMatrixWorld(true);
    const bb = new THREE.Box3();
    walls.children.slice().forEach(o => {
      if (!o.isMesh) return;
      bb.setFromObject(o);
      if (bb.min.y >= HC - 0.01) return;
      let mesh;
      const prm = o.geometry.parameters;
      if (bb.max.y <= HC + 0.001 || !(o.geometry.type === 'BoxGeometry')) {
        if (bb.max.y > HC + 0.001) return;
        mesh = new THREE.Mesh(o.geometry, Array.isArray(o.material) ? o.material.map(uc) : uc(o.material));
        mesh.position.copy(o.position); mesh.rotation.copy(o.rotation); mesh.scale.copy(o.scale);
      } else {
        const h = HC - bb.min.y;
        const geo = new THREE.BoxGeometry(prm.width, h, prm.depth);
        const py = bb.min.y + h / 2;
        worldUV(geo, 2.4, 2.4, [o.position.x, py, o.position.z]);
        let mats = Array.isArray(o.material) ? o.material.map(uc) : uc(o.material);
        if (Array.isArray(mats)) { mats = mats.slice(); mats[2] = capMat; } else if (o.material === walls.userData.never) {}
        mesh = new THREE.Mesh(geo, mats);
        mesh.position.set(o.position.x, py, o.position.z); mesh.rotation.copy(o.rotation);
        if (!Array.isArray(mats) && prm.height > 2) { mesh.material = [mats, mats, capMat, mats, mats, mats]; }
      }
      mesh.castShadow = o.castShadow; mesh.receiveShadow = true; mesh.renderOrder = o.renderOrder;
      wallsCut.add(mesh);
    });
  }
  mergeStatic(walls); mergeStatic(roof); mergeStatic(wallsCut);
  rooms.forEach(r => r.items = furnList.filter(f => f.room === r.id).map(f => ITEM_NAMES[f.item] || f.item));
  return { root, walls, wallsCut, roof, furniture, floors, colliders, rooms, W, D, H, HC, decor };
}

function buildFurniture(group, plan, decor, pal, colliders) {
  // retirar colisiones previas de muebles
  for (let i = colliders.length - 1; i >= 0; i--) if (colliders[i].furn) colliders.splice(i, 1);
  while (group.children.length) group.remove(group.children[0]);
  if (decor === 'vacia') return [];
  const used = [];
  for (const it of plan.furniture || []) {
    if (it.styles && !it.styles.includes(decor)) continue;
    if (decor === 'minimalista' && ['floorLamp', 'picture', 'sideboard', 'armchair'].includes(it.item) && !it.styles) continue;
    const fn = FURN[it.item]; if (!fn) continue;
    const g = fn(pal, it);
    g.position.set(it.x, it.y || 0, it.z);
    g.rotation.y = THREE.MathUtils.degToRad(it.r || 0);
    if (CLIP_ITEMS.has(it.item)) g.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.clippingPlanes = [CutPlane]; } });
    group.add(g);
    used.push(it);
    g.userData.solid = SOLID_ITEMS.has(it.item);
    if (SOLID_ITEMS.has(it.item)) {
      g.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(g);
      colliders.push({ x0: b.min.x + 0.03, x1: b.max.x - 0.03, z0: b.min.z + 0.03, z1: b.max.z - 0.03, furn: true });
    }
  }
  mergeStatic(group);
  return used;
}

// ---------------------------------------------------------------------------
// Entorno de la vivienda: lote, jardín, acera, calle, vecinos, pila
// ---------------------------------------------------------------------------
function buildHouseSurroundings(model, W, D) {
  const lot = new THREE.Group(), ctx = new THREE.Group(), g0 = new THREE.Group();
  g0.add(lot, ctx);
  let g = lot;
  const colliders = [];
  const LX0 = -1.0, LX1 = W + 1.0, LZ0 = -3.2, LZ1 = D + 6.0;
  const tex = (t, w, d, s) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(w / s, d / s); return c; };
  const flat = (w, d, mat, x, y, z, h = 0.06) => { const m = bx(g, w, h, d, mat, x, y, z); m.castShadow = false; return m; };
  const pmCache = {};
  const flatP = (w, d, key, x, y, z, h = 0.06, tint = '#ffffff', fallback) => {
    if (App.noPBR) return flat(w, d, fallback(w, d), x, y, z, h);
    const k = key + tint; const mat = pmCache[k] || (pmCache[k] = pbrMat(key, { color: tint }));
    const m = flat(w, d, mat, x, y, z, h); worldUV(m.geometry, pbrSize(key), pbrSize(key), [x, y, z]); return m;
  };
  const concM = (w, d) => new THREE.MeshStandardMaterial({ map: tex(concreteTex(), w, d, 1.0), roughness: 0.95 });
  const blockM = (w, h) => new THREE.MeshStandardMaterial({ map: tex(blockTex(), w, h, 0.8), color: '#e3ddd0', roughness: 0.95 });
  const grassM = (w, d) => new THREE.MeshStandardMaterial({ map: tex(grassTex(), w, d, 3), roughness: 1 });

  // ---------- LOTE ----------
  const paverM = (w, d) => new THREE.MeshStandardMaterial({ map: tex(paverTex(), w, d, 1.2), roughness: 0.95 });
  flatP(LX1 - LX0, LZ1 - LZ0, 'zacate', (LX0 + LX1) / 2, -0.04, (LZ0 + LZ1) / 2, 0.06, '#ffffff', grassM);
  flatP(1.2, 3.1, 'ladrilloBarro', 1.45, 0.0, -1.65, 0.08, '#ffffff', concM);
  flatP(3.4, 1.5, 'ladrilloBarro', 1.6, 0.01, -0.75, 0.1, '#ffffff', concM);
  // cochera con adoquín ecológico (zacate entre bloques)
  flatP(2.7, 3.1, 'adoquinEco', W - 1.6, 0, -1.65, 0.08, '#ffffff', paverM);
  // terraza trasera de madera con comedor exterior
  flatP(W - 0.6, 2.8, 'deck', 1.4 + (W - 0.6) / 2 - 0.2, 0.02, D + 1.4, 0.1, '#ffffff', (w, d) => new THREE.MeshStandardMaterial({ map: tex(woodTex('#9c7a5b'), w, d, 1.25), roughness: 0.75 }));
  const outT = new THREE.Group();
  rbx(outT, 1.6, 0.05, 0.85, M('#e8e6e1', { roughness: 0.3 }), 0, 0.75, 0, 0.01);
  [[-0.7, -0.35], [0.7, -0.35], [-0.7, 0.35], [0.7, 0.35]].forEach(([x, z]) => bx(outT, 0.05, 0.73, 0.05, M('#2b2b2b'), x, 0.37, z));
  [[-0.45, -0.7, 0], [0.45, -0.7, 0], [-0.45, 0.7, Math.PI], [0.45, 0.7, Math.PI]].forEach(([x, z, r]) => { const c = FURN.chair({ ...PALETTES.moderna, id: 'moderna' }); c.position.set(x, 0, z); c.rotation.y = r; outT.add(c); });
  outT.position.set(W / 2 + 1.2, 0.07, D + 1.45); g.add(outT);
  colliders.push({ x0: W / 2 + 0.3, x1: W / 2 + 2.1, z0: D + 0.9, z1: D + 2.0 });
  // muros perimetrales de bloque
  const wallSeg = (w, d, x, z, h = 1.8) => { bx(g, w, h, d, blockM(Math.max(w, d), h), x, h / 2, z); bx(g, w + 0.06, 0.05, d + 0.06, M('#cfc8ba'), x, h + 0.025, z).castShadow = false; };
  wallSeg(0.15, LZ1 - LZ0, LX0, (LZ0 + LZ1) / 2); wallSeg(0.15, LZ1 - LZ0, LX1, (LZ0 + LZ1) / 2); wallSeg(LX1 - LX0, 0.15, (LX0 + LX1) / 2, LZ1);
  colliders.push({ x0: LX0 - 0.1, x1: LX0 + 0.1, z0: LZ0, z1: LZ1 }, { x0: LX1 - 0.1, x1: LX1 + 0.1, z0: LZ0, z1: LZ1 }, { x0: LX0, x1: LX1, z0: LZ1 - 0.1, z1: LZ1 + 0.1 });
  // frente: muro bajo con verja, portón abierto
  const iron = new THREE.MeshStandardMaterial({ color: '#262626', metalness: 0.6, roughness: 0.45 });
  const fz = LZ0 + 0.1;
  const frontSeg = (x0, x1) => {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    bx(g, w, 0.6, 0.18, blockM(w, 0.6), cx, 0.3, fz);
    for (let x = x0 + 0.06; x < x1; x += 0.13) bx(g, 0.02, 1.0, 0.02, iron, x, 1.1, fz);
    bx(g, w, 0.04, 0.04, iron, cx, 1.6, fz);
    colliders.push({ x0, x1, z0: fz - 0.12, z1: fz + 0.12 });
  };
  frontSeg(LX0, 0.75); frontSeg(2.15, W - 3.0);
  for (const x of [LX0, 0.75, 2.15, W - 3.0, LX1]) bx(g, 0.3, 1.75, 0.3, blockM(0.3, 1.75), x, 0.875, fz);
  const gate = new THREE.Group();
  bx(gate, 2.6, 0.04, 0.04, iron, 1.3, 1.55, 0); bx(gate, 2.6, 0.04, 0.04, iron, 1.3, 0.12, 0);
  for (let x = 0.05; x < 2.6; x += 0.12) bx(gate, 0.02, 1.45, 0.02, iron, x, 0.83, 0);
  gate.position.set(W - 2.95, 0, fz); gate.rotation.y = -1.25; g.add(gate);
  // jardín: veraneras, setos, rocas, macetas
  const v1 = veranera(1.6, 0.9, 11); v1.position.set(-0.4, 0, -2.5); g.add(v1);
  const v2 = veranera(1.2, 1.2, 12); v2.position.set(LX0 + 0.45, 0, D + 4.8); g.add(v2);
  const b1 = bush(1.8, 0.55, '#4b7a34', 4); b1.position.set(4.25, 0, -1.9); g.add(b1);
  for (let i = 0; i < 9; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), M(['#e2525c', '#f4c242', '#f2f0ea', '#d0479a'][i % 4])); f.position.set(3.5 + i * 0.17, 0.5 + (i % 3) * 0.06, -1.65 - (i % 2) * 0.3); g.add(f); }
  const hedgeL = bush(LZ1 - D - 3.2, 0.9, '#3f6b2c', 8); hedgeL.rotation.y = Math.PI / 2; hedgeL.position.set(LX0 + 0.45, 0, D + 1.4); g.add(hedgeL);
  const rocks = new THREE.MeshStandardMaterial({ color: '#b8b3aa', roughness: 0.9, flatShading: true });
  [[3.0, -2.4, 0.22], [3.35, -2.55, 0.15], [5.2, -2.45, 0.18], [-0.2, D + 3.5, 0.25]].forEach(([x, z, r]) => { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rocks); m.position.set(x, r * 0.5, z); m.scale.y = 0.65; m.castShadow = true; g.add(m); });
  for (const [x, z] of [[0.2, -0.45], [3.0, -0.45]]) { const pot = new THREE.Group(); cyl(pot, 0.2, 0.15, 0.4, M('#b5603b'), 0, 0.2, 0, 16); leafyPlant(pot, 0, 0.38, 0, 14, 0.9, x * 10 | 0); pot.position.set(x, 0.05, z); g.add(pot); }
  // pila
  const pila = new THREE.Group();
  rbx(pila, 1.3, 0.85, 0.7, M('#c9c5bd', { roughness: 0.85 }), 0, 0.425, 0, 0.03);
  bx(pila, 0.5, 0.05, 0.55, M('#7fa9c2', { roughness: 0.15 }), -0.3, 0.84, 0);
  bx(pila, 0.55, 0.02, 0.6, M('#b9b4aa'), 0.35, 0.86, 0);
  cyl(pila, 0.015, 0.015, 0.3, M('#c9ced2', { metalness: 0.8, roughness: 0.2 }), -0.3, 1.05, -0.3, 8);
  pila.position.set(W + 0.45, 0, 5.0); pila.rotation.y = Math.PI / 2; g.add(pila);
  colliders.push({ x0: W + 0.1, x1: W + 0.8, z0: 4.35, z1: 5.65 });
  // tendedero
  [[0.4, D + 1.6], [0.4, D + 4.9]].forEach(([x, z]) => cyl(g, 0.04, 0.04, 1.9, M('#777'), x, 0.95, z, 6));
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 3.3, 4), M('#ddd')); line.rotation.x = Math.PI / 2; line.position.set(0.4, 1.85, D + 3.25); g.add(line);
  ['#3b6fb0', '#f0ece2', '#d4553f', '#e8c547'].forEach((c, i) => { const cl = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.6), new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, map: fabricTex() })); cl.position.set(0.4, 1.55, D + 3.0 + i * 0.5); cl.rotation.y = Math.PI / 2; cl.castShadow = true; g.add(cl); });
  const tr = realTree(1, 21); tr.position.set(W - 1.3, 0, D + 3.9); g.add(tr);
  const palm = palmTree(5.5, 3); palm.position.set(-0.4, 0, D + 4.9); g.add(palm);
  colliders.push({ x0: W - 1.5, x1: W - 1.1, z0: D + 3.7, z1: D + 4.1 });

  // ---------- CONTEXTO (vecindario) ----------
  g = ctx;
  flatP(220, 220, 'zacate', W / 2, -0.12, D / 2, 0.1, '#d2dcc0', (w, d) => new THREE.MeshStandardMaterial({ map: tex(grassTex(), w, d, 4), color: '#c9d8b0', roughness: 1 }));
  flatP(240, 2.2, 'acera', W / 2, -0.02, LZ0 - 1.1, 0.16, '#ffffff', concM);
  bx(g, 240, 0.2, 0.18, M('#bdb8ad', { roughness: 0.9 }), W / 2, 0.0, LZ0 - 2.25).castShadow = false;
  flatP(240, 7.5, 'asfalto', W / 2, -0.07, LZ0 - 6.0, 0.08, '#ffffff', (w, d) => new THREE.MeshStandardMaterial({ map: tex(asphaltTex(), w, d, 3), roughness: 0.9 }));
  for (let x = -60; x < 70; x += 5) flat(2.2, 0.14, M('#efeee6'), x, -0.025, LZ0 - 6.0, 0.09);
  const neighborModel = id => { const m = Store.data.models[id] || { ...DEFAULT_MODELS[id], plan: PLAN_52 }; return { ...m, plan: m.plan || PLAN_52 }; };
  [[-(W + 2.15), 'C'], [W + 2.15, 'B']].forEach(([dx, id]) => {
    const h = buildHouse(neighborModel(id), 'vacia', { clip: false, neighbor: true });
    h.root.position.x = dx; g.add(h.root);
    flatP(W + 2, D + 9.2, 'zacate', W / 2 + dx, -0.05, D / 2 + 1.4, 0.06, '#ffffff', grassM);
    flatP(2.7, 3.1, 'adoquinEco', W / 2 + dx, 0, -1.65, 0.08, '#ffffff', paverM);
  });
  const farHouse = (x, z, mid, rotY) => {
    const m = Store.data.models[mid] || DEFAULT_MODELS[mid];
    const ft = new THREE.MeshStandardMaterial({ map: facadeTexture(m) });
    const wm = stuccoMat(m.facade.wall);
    const b = new THREE.Mesh(new THREE.BoxGeometry(W, 2.7, D), [wm, wm, wm, wm, ft, ft]); b.position.set(x, 1.35, z); b.rotation.y = rotY; b.castShadow = b.receiveShadow = true; g.add(b);
    const r = m.facade.roof === 'gable' ? new THREE.Mesh(gableGeo(1, 1), M(m.facade.roofColor, { flatShading: true, side: THREE.DoubleSide })) : new THREE.Mesh(new THREE.BoxGeometry(1, 0.35, 1), stuccoMat(m.facade.wall));
    r.scale.set(W + 0.9, m.facade.roof === 'gable' ? 1.4 : 1, D + 0.9); r.position.set(x, 2.7, z); r.rotation.y = rotY; r.castShadow = true; g.add(r);
  };
  farHouse(-(W + 2.15) * 2 + W / 2, D / 2, 'A', 0); farHouse((W + 2.15) * 2 + W / 2, D / 2, 'A', 0);
  for (let i = -3; i <= 3; i++) farHouse(W / 2 + i * (W + 2.15), LZ0 - 16, ['A', 'B', 'C'][(i + 3) % 3], Math.PI);
  const car = parkedCar('#7d1d22'); car.position.set(W + 5.5, 0, LZ0 - 3.6); car.rotation.y = Math.PI / 2; g.add(car);
  const car2 = parkedCar('#cfd3d6'); car2.position.set(-12, 0, LZ0 - 8.4); car2.rotation.y = -Math.PI / 2; g.add(car2);
  [-14, 16].forEach(x => { const p = streetPole(); p.position.set(x, 0, LZ0 - 2.0); g.add(p); });
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 30, 4), M('#222')); wire.rotation.z = Math.PI / 2; wire.position.set(1, 8.62, LZ0 - 2.0); g.add(wire);
  const wire2 = wire.clone(); wire2.position.y = 8.45; g.add(wire2);
  const rnd = mulberry(3);
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, r = 30 + rnd() * 45;
    const t = realTree(1.2 + rnd() * 0.8, 100 + i);
    t.position.set(W / 2 + Math.cos(a) * r, 0, D / 2 + Math.sin(a) * r); g.add(t);
  }

  // ---------- BASE DE MAQUETA (bloque de terreno con corte) ----------
  const base = new THREE.Group(); base.visible = false;
  const soil = new THREE.MeshStandardMaterial({ map: tex(soilTex(), LX1 - LX0, 0.8, 1.2), roughness: 1 });
  const bbGeo = new THREE.BoxGeometry(LX1 - LX0 + 0.2, 0.8, LZ1 - LZ0 + 4.4);
  const topM = App.noPBR ? grassM(1, 1) : (worldUV(bbGeo, pbrSize('zacate')), pbrMat('zacate'));
  const bb = new THREE.Mesh(bbGeo, [soil, soil, topM, soil, soil, soil]);
  bb.position.set((LX0 + LX1) / 2, -0.47, (LZ0 + LZ1) / 2 - 2.1); bb.receiveShadow = true; base.add(bb);
  const sw = bx(base, LX1 - LX0 + 0.2, 0.08, 2.2, concM(LX1 - LX0, 2.2), (LX0 + LX1) / 2, -0.03, LZ0 - 1.1); sw.castShadow = false;
  const studio = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.ShadowMaterial({ opacity: 0.18 }));
  studio.rotation.x = -Math.PI / 2; studio.position.y = -0.88; studio.receiveShadow = true; base.add(studio);
  g0.add(base);

  mergeStatic(lot); mergeStatic(ctx);
  const bounds = { x0: LX0 + 0.25, x1: LX1 - 0.25, z0: LZ0 - 2.0, z1: LZ1 - 0.25 };
  return { group: g0, lot, ctx, base, colliders, bounds };
}

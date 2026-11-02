// ============================================================================
// 36-decor.js — Mobiliario con más detalle (estilo render de maqueta)
// Sobrescribe piezas del catálogo FURN conservando sus medidas y posiciones.
// ============================================================================

const _leafMat = {};
const leafMat = c => _leafMat[c] || (_leafMat[c] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, side: THREE.DoubleSide }));
function leafGeo() {
  if (leafGeo.g) return leafGeo.g;
  const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.09, 0.25, 0, 0.55); s.quadraticCurveTo(-0.09, 0.25, 0, 0);
  const g = new THREE.ShapeGeometry(s, 6);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, -y * y * 0.6); }
  g.computeVertexNormals();
  return (leafGeo.g = g);
}
function leafyPlant(g, x, y, z, n = 18, scale = 1, seed = 1) {
  const rnd = mulberry(seed), greens = ['#3e6e32', '#4b7f38', '#2f5c2a', '#5b8d40'];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(leafGeo(), leafMat(greens[i % 4]));
    const a = i / n * Math.PI * 2 + rnd() * 0.5, tilt = 0.25 + rnd() * 0.75;
    m.position.set(x, y, z); m.rotation.set(0, a, 0, 'YXZ'); m.rotateX(-tilt);
    m.scale.setScalar(scale * (0.7 + rnd() * 0.5)); m.castShadow = true; g.add(m);
  }
}

Object.assign(FURN, {
  plant(p, it) {
    const g = new THREE.Group();
    const potC = p.id === 'moderna' ? '#2b2b2b' : p.id === 'minimalista' ? '#e9e5de' : p.id === 'familiar' ? '#b4643e' : '#cfc7bb';
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.38, 24), M(potC, { roughness: 0.6 })); pot.position.y = 0.19; pot.castShadow = true; g.add(pot);
    cyl(g, 0.16, 0.16, 0.02, M('#4a3b2e', { roughness: 1 }), 0, 0.37, 0, 20);
    leafyPlant(g, 0, 0.36, 0, 20, 1.15, (it.x * 10) | 0);
    return g;
  },
  picture(p, it) {
    const g = new THREE.Group(), w = it.w || 1, h = w * 0.72;
    bx(g, w, h, 0.03, M(p.id === 'moderna' ? '#151515' : p.id === 'minimalista' ? '#e8e1d5' : p.wood, { roughness: 0.5 }), 0, 0, 0);
    bx(g, w - 0.06, h - 0.06, 0.006, M('#fbfaf6'), 0, 0, 0.016);
    bx(g, w - 0.18, h - 0.18, 0.004, new THREE.MeshStandardMaterial({ map: artTex(((it.x + it.z) * 7) | 0), roughness: 0.8 }), 0, 0, 0.02);
    return g;
  },
  pendant(p) {
    const g = new THREE.Group();
    cyl(g, 0.005, 0.005, 0.65, M('#222'), 0, 2.27, 0, 6);
    if (p.id === 'moderna' || p.id === 'minimalista' || p.id === 'amueblada') {
      // lámpara de ratán
      const shade = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12, 0, 6.283, 0, 2.3), new THREE.MeshStandardMaterial({ color: '#c79a56', wireframe: true }));
      shade.position.y = 1.86; g.add(shade);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#ffe0a8', emissiveIntensity: 1.2 }));
      bulb.position.y = 1.86; g.add(bulb);
    } else cyl(g, 0.08, 0.26, 0.22, M('#c79a56', { side: THREE.DoubleSide }), 0, 1.95, 0);
    return g;
  },
  diningTable(p) {
    const g = new THREE.Group();
    if (p.id === 'moderna' || p.id === 'minimalista') {
      const tt = cyl(g, 0.55, 0.55, 0.04, App.noPBR ? M('#f4f3ef', { roughness: 0.25 }) : pbrMat('marmolBlanco', { envMapIntensity: 1.2 }), 0, 0.75, 0, 40); worldUV(tt.geometry, 1.2);
      cyl(g, 0.12, 0.28, 0.72, M('#f4f3ef', { roughness: 0.4 }), 0, 0.36, 0, 24);
    } else {
      const w = M(p.wood, { roughness: 0.5 });
      rbx(g, 1.25, 0.05, 0.82, w, 0, 0.745, 0, 0.015);
      [[-.55, -.33], [.55, -.33], [-.55, .33], [.55, .33]].forEach(([x, z]) => bx(g, 0.06, 0.72, 0.06, w, x, 0.36, z));
    }
    cyl(g, 0.06, 0.04, 0.2, M('#e9e4da', { roughness: 0.3 }), 0.12, 0.87, 0.05, 16);
    leafyPlant(g, 0.12, 0.95, 0.05, 6, 0.35, 3);
    cyl(g, 0.14, 0.08, 0.06, M(p.accent, { roughness: 0.4 }), -0.18, 0.8, -0.06, 20);
    return g;
  },
  chair(p) {
    const g = new THREE.Group();
    const wood = M(p.id === 'moderna' ? '#6b4a33' : p.wood, { roughness: 0.55 });
    rbx(g, 0.44, 0.06, 0.42, p.id === 'familiar' ? fabricMat(p.fabric) : fabricMat('#d9cbb6'), 0, 0.46, 0, 0.025);
    // respaldo curvo
    const back = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 20, 1, true, Math.PI * 0.65, Math.PI * 0.7), new THREE.MeshStandardMaterial({ color: wood.color, roughness: 0.55, side: THREE.DoubleSide }));
    back.position.set(0, 0.75, 0.04); back.castShadow = true; g.add(back);
    [[-.18, -.17], [.18, -.17], [-.18, .17], [.18, .17]].forEach(([x, z]) => { const l = cyl(g, 0.015, 0.012, 0.45, wood, x, 0.22, z, 8); l.rotation.z = x * 0.15; });
    [[-.18, -.17], [.18, -.17]].forEach(([x, z]) => cyl(g, 0.012, 0.012, 0.3, wood, x, 0.62, z, 6));
    return g;
  },
  coffeeTable(p) {
    const g = new THREE.Group();
    const top = p.id === 'moderna' ? M('#3a3633', { roughness: 0.3 }) : M(p.wood, { roughness: 0.45 });
    rbx(g, 1.0, 0.05, 0.6, top, 0, 0.4, 0, 0.012);
    rbx(g, 0.92, 0.04, 0.52, top, 0, 0.12, 0, 0.012);
    [[-.46, -.26], [.46, -.26], [-.46, .26], [.46, .26]].forEach(([x, z]) => bx(g, 0.04, 0.4, 0.04, M(p.metal), x, 0.2, z));
    bx(g, 0.28, 0.04, 0.2, M('#2f4a6a'), -0.2, 0.445, 0.05); bx(g, 0.26, 0.035, 0.19, M('#e6dfd2'), -0.2, 0.48, 0.05);
    cyl(g, 0.11, 0.09, 0.05, M('#c9c2b5', { roughness: 0.3 }), 0.22, 0.45, -0.05, 20);
    return g;
  },
  tvUnit(p, it) {
    const g = new THREE.Group(), w = it.w || 1.6;
    rbx(g, w, 0.45, 0.42, M(p.id === 'minimalista' ? '#efebe4' : p.wood, { roughness: 0.5 }), 0, 0.27, 0, 0.015);
    for (let i = -1; i <= 1; i += 2) bx(g, 0.004, 0.36, 0.005, M('#00000000'.slice(0, 7)), i * w / 6, 0.27, 0.212);
    bx(g, 0.3, 0.012, 0.03, M(p.metal), -w / 3, 0.38, 0.215); bx(g, 0.3, 0.012, 0.03, M(p.metal), w / 3, 0.38, 0.215);
    if (p.id === 'moderna' && !App.noPBR) { // muro de mármol con iluminación LED
      const mp = bx(g, w + 0.3, 2.3, 0.04, pbrMat('marmolBlanco', { envMapIntensity: 1.2 }), 0, 1.15, -0.2); worldUV(mp.geometry, 1.4);
      bx(g, w - 0.1, 0.012, 0.02, new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#ffd9a0', emissiveIntensity: 2.2 }), 0, 0.05, 0.2);
    }
    const tv = rbx(g, 1.2, 0.69, 0.04, M('#0b0c0f', { roughness: 0.25 }), 0, 0.98, -0.06, 0.01);
    bx(g, 1.14, 0.63, 0.005, new THREE.MeshStandardMaterial({ color: '#0f1720', roughness: 0.05, metalness: 0.3 }), 0, 0.98, -0.038);
    bx(g, 0.22, 0.03, 0.12, M('#111'), 0, 0.51, -0.06);
    leafyPlant(g, w / 2 - 0.15, 0.5, 0, 7, 0.3, 9);
    bx(g, 0.2, 0.25, 0.15, M('#cfa77a'), -w / 2 + 0.2, 0.62, 0);
    return g;
  },
  sideboard(p, it) {
    const g = new THREE.Group(), w = it.w || 1;
    rbx(g, w, 0.78, 0.42, M(p.wood, { roughness: 0.5 }), 0, 0.39, 0, 0.015);
    bx(g, 0.003, 0.7, 0.005, M('#2a2420'), 0, 0.39, 0.212);
    cyl(g, 0.07, 0.09, 0.32, M(p.accent, { roughness: 0.35 }), w * 0.28, 0.94, 0);
    [0, 1, 2].forEach(i => bx(g, 0.04, 0.24 - i * 0.02, 0.18, M(['#2f4a6a', '#a8553a', '#e2d8c4'][i]), -w * 0.3 + i * 0.045, 0.9 - i * 0.01, 0));
    return g;
  },
  counter(p, it) {
    const g = new THREE.Group(), w = it.w || 2.4;
    const cab = M(p.id === 'moderna' ? '#f2f1ee' : p.id === 'familiar' ? p.wood : '#f4f3ef', { roughness: 0.45 });
    rbx(g, w, 0.84, 0.6, cab, 0, 0.42, 0, 0.01);
    const n = Math.round(w / 0.5);
    for (let i = 1; i < n; i++) bx(g, 0.004, 0.72, 0.005, M('#b9b4ab'), -w / 2 + i * w / n, 0.44, 0.301);
    for (let i = 0; i < n; i++) bx(g, 0.14, 0.012, 0.02, M('#9a9ea2', { metalness: 0.8, roughness: 0.3 }), -w / 2 + (i + 0.5) * w / n, 0.76, 0.31);
    const top = App.noPBR ? M(p.id === 'minimalista' ? '#e8e6e1' : '#3b3d40', { roughness: 0.25 }) : pbrMat(p.id === 'minimalista' || p.id === 'vacia' ? 'marmolBlanco' : 'marmolNegro', { envMapIntensity: 1.2 });
    const tm = bx(g, w + 0.02, 0.04, 0.63, top, 0, 0.86, 0.01); worldUV(tm.geometry, 1.2);
    // salpicadero de azulejo
    const bs = new THREE.MeshStandardMaterial({ map: tileTex().clone(), color: '#f2f0ea', roughness: 0.25 });
    bs.map.needsUpdate = true; bs.map.repeat.set(w / 0.3, 2);
    bx(g, w, 0.6, 0.012, bs, 0, 1.18, -0.3);
    rbx(g, w, 0.7, 0.34, cab, 0, 1.85, -0.13, 0.01);
    for (let i = 1; i < n; i++) bx(g, 0.004, 0.64, 0.005, M('#b9b4ab'), -w / 2 + i * w / n, 1.85, 0.041);
    if (it.sink != null) { bx(g, 0.5, 0.02, 0.38, M('#a3abb2', { metalness: 0.8, roughness: 0.25 }), it.sink, 0.885, 0.02); const f = cyl(g, 0.012, 0.012, 0.3, M('#c9ced2', { metalness: 0.9, roughness: 0.15 }), it.sink, 1.03, -0.2, 8); }
    if (it.stove != null) { bx(g, 0.58, 0.012, 0.5, M('#0d0e10', { roughness: 0.1 }), it.stove, 0.885, 0.02); [[-.14, -.1], [.14, -.1], [-.14, .12], [.14, .12]].forEach(([x, z]) => cyl(g, 0.08, 0.08, 0.004, M('#2a2b2e'), it.stove + x, 0.893, 0.02 + z, 24)); }
    // detalles: frutero, tabla, botellas
    cyl(g, 0.13, 0.08, 0.06, M('#d9d2c6', { roughness: 0.3 }), w / 2 - 0.3, 0.91, 0.05, 20);
    [['#e2a33a', .05], ['#c93f2f', -.04], ['#7aa33a', 0]].forEach(([c, dx], i) => { const f = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), M(c, { roughness: 0.5 })); f.position.set(w / 2 - 0.3 + dx, 0.96, 0.05 + (i - 1) * 0.03); g.add(f); });
    rbx(g, 0.35, 0.02, 0.25, M('#b88a5a'), -w / 2 + 0.35, 0.89, -0.12, 0.005).rotation.x = -1.2;
    return g;
  },
  _bed(p, w) {
    const g = new THREE.Group();
    const frame = p.id === 'minimalista' ? M('#e6dfd3') : M(p.wood, { roughness: 0.5 });
    rbx(g, w + 0.08, 0.28, 2.04, frame, 0, 0.16, 0, 0.02);
    rbx(g, w, 0.2, 1.94, fabricMat('#fbfaf7'), 0, 0.39, 0, 0.06);
    // edredón
    rbx(g, w + 0.04, 0.08, 1.5, fabricMat(p.bed), 0, 0.52, 0.22, 0.04);
    // cabecera tapizada
    rbx(g, w + 0.12, p.id === 'minimalista' ? 0.55 : 1.0, 0.09, p.id === 'familiar' ? M(p.wood) : fabricMat(p.id === 'moderna' ? '#59606a' : '#d8cdbd'), 0, p.id === 'minimalista' ? 0.45 : 0.6, -1.02, 0.04);
    const np = w > 1.2 ? 2 : 1;
    for (let i = 0; i < np; i++) { const x = np === 1 ? 0 : (i ? 1 : -1) * w / 4; rbx(g, w / np - 0.12, 0.14, 0.4, fabricMat('#ffffff'), x, 0.6, -0.75, 0.07).rotation.x = -0.35; }
    if (p.id !== 'minimalista') {
      for (let i = 0; i < np; i++) { const x = np === 1 ? 0 : (i ? 1 : -1) * w / 4.5; rbx(g, 0.34, 0.3, 0.09, fabricMat(p.accent), x, 0.68, -0.52, 0.05).rotation.x = -0.4; }
      rbx(g, w + 0.1, 0.05, 0.42, fabricMat(p.id === 'familiar' ? '#c0533e' : p.id === 'moderna' ? '#3c4148' : '#b9a58c'), 0, 0.57, 0.66, 0.02);
    }
    return g;
  },
  shower(p, it) {
    const g = new THREE.Group(), w = it.w || 1, d = it.d || 0.9;
    bx(g, w, 0.05, d, M('#e9ecee', { roughness: 0.3 }), 0, 0.025, 0);
    // azulejo en los dos muros de la ducha
    const tm = App.noPBR ? M('#f2f2ef', { roughness: 0.2 }) : pbrMat('azulejo', { roughness: 0.25 }, { roughness: false });
    const a = new THREE.Mesh(worldUV(new THREE.BoxGeometry(0.012, 2.0, d), pbrSize('azulejo')), tm); a.position.set(-w / 2 + 0.006, 1.0, 0); g.add(a);
    const b = new THREE.Mesh(worldUV(new THREE.BoxGeometry(w, 2.0, 0.012), pbrSize('azulejo')), tm); b.position.set(0, 1.0, d / 2 - 0.006); g.add(b);
    const glass = new THREE.MeshPhysicalMaterial({ color: '#d6eaf2', transparent: true, opacity: 0.22, roughness: 0.02 });
    bx(g, 0.012, 1.95, d * 0.65, glass, w / 2, 1.0, -d * 0.17).castShadow = false;
    bx(g, 0.02, 0.02, d * 0.65, M('#b8bdc1', { metalness: 0.9, roughness: 0.2 }), w / 2, 1.98, -d * 0.17);
    cyl(g, 0.11, 0.11, 0.02, M('#b8bdc1', { metalness: 0.9, roughness: 0.2 }), -w / 2 + 0.2, 2.05, 0.2);
    return g;
  },
  lavabo(p) {
    const g = new THREE.Group(), w = M('#f7f7f5', { roughness: 0.2 });
    rbx(g, 0.6, 0.5, 0.42, M(p.id === 'familiar' ? p.wood : '#e9e5dd', { roughness: 0.5 }), 0, 0.55, 0.02, 0.01);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.12, 24), w); basin.position.set(0, 0.86, 0.04); g.add(basin);
    cyl(g, 0.01, 0.01, 0.2, M('#c9ced2', { metalness: 0.9, roughness: 0.15 }), 0, 0.95, -0.12, 8);
    const mirror = new THREE.Mesh(new THREE.CircleGeometry(0.3, 40), new THREE.MeshStandardMaterial({ color: '#dfe9ee', metalness: 1, roughness: 0.03 }));
    mirror.position.set(0, 1.55, -0.185); g.add(mirror);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.015, 8, 40), M('#1f1f1f')); ring.position.copy(mirror.position); g.add(ring);
    rbx(g, 0.04, 0.4, 0.3, fabricMat('#e9dfcf'), 0.36, 0.6, 0.0, 0.015);
    return g;
  },
});

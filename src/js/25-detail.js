// ============================================================================
// 25-detail.js — Casas detalladas en el residencial (niveles de detalle)
// Cada modelo se construye una vez con buildHouse() + entorno del lote, se
// fusiona por material y se dibuja con instancias. Cerca de la cámara se ven
// casas detalladas; lejos, volúmenes simples. Así caben todas las viviendas.
// ============================================================================

function splitByGroups(geo) {
  if (!geo.groups || !geo.groups.length) return [{ geo, mi: 0 }];
  const src = geo.index ? geo.toNonIndexed() : geo;
  // con índice, los grupos cuentan índices; al desindexar cada índice pasa a ser un vértice
  return geo.groups.map(gr => {
    const g = new THREE.BufferGeometry();
    for (const [k, a] of Object.entries(src.attributes)) {
      g.setAttribute(k, new THREE.BufferAttribute(a.array.slice(gr.start * a.itemSize, (gr.start + gr.count) * a.itemSize), a.itemSize));
    }
    return { geo: g, mi: gr.materialIndex };
  });
}

// Elementos del lote alrededor de la casa (coordenadas del plano: frente z=0 hacia -z)
function lotKit(W, D) {
  const g = new THREE.Group();
  const block = stuccoMat('#e2dccf');
  const iron = new THREE.MeshStandardMaterial({ color: '#2a2a2a', metalness: 0.6, roughness: 0.45 });
  const fz = -2.1;
  const seg = (x0, x1) => {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    const b = new THREE.Mesh(worldUV(new THREE.BoxGeometry(w, 0.6, 0.16), 2.4), block); b.position.set(cx, 0.3, fz); b.castShadow = true; g.add(b);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, 0.04), iron); top.position.set(cx, 1.55, fz); g.add(top);
    for (let x = x0 + 0.08; x < x1; x += 0.16) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.95, 0.025), iron); r.position.set(x, 1.07, fz); g.add(r); }
  };
  seg(-0.55, 1.0); seg(1.9, W - 2.9);
  for (const x of [-0.55, 1.0, 1.9, W - 2.9]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.7, 0.26), block); p.position.set(x, 0.85, fz); p.castShadow = true; g.add(p); }
  for (const x of [-0.62, W + 0.62]) { const s = new THREE.Mesh(worldUV(new THREE.BoxGeometry(0.14, 1.8, D + 4.4), 2.4), block); s.position.set(x, 0.9, D / 2 + 0.1); s.castShadow = true; s.receiveShadow = true; g.add(s); }
  const paveM = App.noPBR ? new THREE.MeshStandardMaterial({ color: '#c9c3b5' }) : pbrMat('adoquinEco');
  const pv = new THREE.Mesh(worldUV(new THREE.BoxGeometry(2.6, 0.05, 2.1), pbrSize('adoquinEco')), paveM); pv.position.set(W - 1.6, 0.02, -1.05); pv.receiveShadow = true; g.add(pv);
  const pathM = App.noPBR ? new THREE.MeshStandardMaterial({ color: '#b87a55' }) : pbrMat('ladrilloBarro');
  const pa = new THREE.Mesh(worldUV(new THREE.BoxGeometry(1.0, 0.05, 2.1), pbrSize('ladrilloBarro')), pathM); pa.position.set(1.45, 0.02, -1.05); pa.receiveShadow = true; g.add(pa);
  const hedge = new THREE.MeshStandardMaterial({ color: '#4a7a33', roughness: 1 });
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), hedge); b.position.set(2.3 + i * 0.5, 0.28, -1.75); b.scale.y = 0.8; b.castShadow = true; g.add(b); }
  return g;
}

// Plantilla fusionada de un modelo: [{ geo, mat }] con la casa centrada y el frente hacia +z
// Convierte un grupo en plantilla instanciable: [{ geo, mat }] fusionada por material
function groupToTemplate(root, T = new THREE.Matrix4(), opts = {}) {
  root.updateMatrixWorld(true);
  const buckets = new Map(), tmp = new THREE.Matrix4();
  root.traverse(o => {
    if (!o.isMesh || !o.visible || o.userData.room) return;
    let p = o.parent, hidden = false; while (p) { if (p.visible === false) hidden = true; p = p.parent; }
    if (hidden) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const parts = Array.isArray(o.material) ? splitByGroups(o.geometry) : [{ geo: o.geometry, mi: 0 }];
    for (const part of parts) {
      const mat = mats[part.mi]; if (!mat) continue;
      let g = part.geo.index ? part.geo.toNonIndexed() : part.geo.clone();
      for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.clearGroups();
      g.applyMatrix4(tmp.multiplyMatrices(T, o.matrixWorld));
      const k = matKey(mat) + (mat.userData.paint ? 'P' : '') + (mat.userData.roofPaint ? 'R' : '');
      if (!buckets.has(k)) buckets.set(k, { mat, geos: [] });
      buckets.get(k).geos.push(g);
    }
  });
  const out = [];
  for (const { mat, geos } of buckets.values()) {
    const m = mat.clone();
    m.clippingPlanes = null;
    if (m.opacity >= 0.99) { m.transparent = false; m.opacity = 1; m.depthWrite = true; }
    if ((m.userData.paint || m.userData.roofPaint) && opts.paintWhite) m.color.set('#ffffff');   // el color real llega por instancia
    const geo = mergeGeometries(geos, false);
    if (geo) out.push({ geo, mat: m, paint: !!m.userData.paint, roofPaint: !!m.userData.roofPaint });
  }
  return out;
}

const _detailTpl = {};
function detailTemplate(model, kit = true) {
  const key = model.id + JSON.stringify(model.facade) + (model.plan ? model.plan.width + 'x' + model.plan.depth : '') + kit;
  if (_detailTpl[key]) return _detailTpl[key];
  const h = buildHouse(model, 'vacia', { clip: false, neighbor: true });
  porch(h.roof, h.W, model, []);
  if (kit) h.root.add(lotKit(h.W, h.D));
  h.root.remove(h.floors); h.root.remove(h.furniture);
  const fl = new THREE.Mesh(new THREE.BoxGeometry(h.W, 0.04, h.D), new THREE.MeshStandardMaterial({ color: '#cbbfae' })); fl.position.set(h.W / 2, 0.03, h.D / 2); h.root.add(fl);
  // centrar y girar 180° para que el frente mire hacia +z (convención del residencial)
  const T = new THREE.Matrix4().makeRotationY(Math.PI).multiply(new THREE.Matrix4().makeTranslation(-h.W / 2, 0, -h.D / 2));
  const out = groupToTemplate(h.root, T, { paintWhite: true });
  out.W = h.W; out.D = h.D; out.H = h.H;
  return (_detailTpl[key] = out);
}

// Fachadas "horneadas": se fotografía la casa detallada desde sus 4 lados (solo color, sin luz)
// para revestir los volúmenes lejanos con la apariencia real de cada modelo.
const _impostor = {};
function bakeImpostor(model) {
  const key = model.id + JSON.stringify(model.facade);
  if (_impostor[key]) return _impostor[key];
  const tpl = detailTemplate(model, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight('#ffffff', Math.PI));
  tpl.forEach(({ geo, mat }) => { const m = mat.clone(); m.envMap = null; m.envMapIntensity = 0; m.metalness = 0; scene.add(new THREE.Mesh(geo, m)); });
  const r = App.renderer, W = tpl.W, D = tpl.D, H = 2.9;
  const shot = (camPos, look, w, h, res = [512, 256]) => {
    const rt = new THREE.WebGLRenderTarget(res[0], res[1], { samples: 4 });
    const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h, 0, 0.1, 60);
    cam.position.copy(camPos); cam.lookAt(look); cam.position.y = 0; cam.updateMatrixWorld();
    cam.position.copy(camPos); cam.lookAt(new THREE.Vector3(look.x, camPos.y, look.z));
    const prevT = r.getRenderTarget(), prevTone = r.toneMapping, prevBg = scene.background;
    scene.background = new THREE.Color('#cfc8bb');
    r.setRenderTarget(rt); r.toneMapping = THREE.NoToneMapping; r.clear(); r.render(scene, cam);
    r.setRenderTarget(prevT); r.toneMapping = prevTone;
    rt.texture.anisotropy = 4;
    return rt.texture;
  };
  const tex = {
    front: shot(new THREE.Vector3(0, 0, 20), new THREE.Vector3(0, 0, 0), W, H),
    back: shot(new THREE.Vector3(0, 0, -20), new THREE.Vector3(0, 0, 0), W, H),
    right: shot(new THREE.Vector3(20, 0, 0), new THREE.Vector3(0, 0, 0), D, H),
    left: shot(new THREE.Vector3(-20, 0, 0), new THREE.Vector3(0, 0, 0), D, H),
  };
  return (_impostor[key] = tex);
}

// Plantillas de vida: carro estacionado y árbol de patio
const _lifeTpl = {};
function carTemplate() {
  if (_lifeTpl.car) return _lifeTpl.car;
  const g = parkedCar('#ffffff'); g.rotation.y = Math.PI / 2;
  const root = new THREE.Group(); root.add(g);
  return (_lifeTpl.car = groupToTemplate(root, new THREE.Matrix4(), { paintWhite: true }));
}
function yardTreeTemplate() {
  if (_lifeTpl.tree) return _lifeTpl.tree;
  const root = new THREE.Group(); root.add(realTree(0.8, 77));
  return (_lifeTpl.tree = groupToTemplate(root));
}
// Colores habituales de pintura exterior en residenciales salvadoreños (tonos de catálogo, no puros)
const HOUSE_PAINTS = ['#e9cf8a', '#f0b98a', '#a9d3dd', '#b9d79a', '#e39c84', '#f3eee2', '#d3c3df', '#f6d8b0', '#c5dcef', '#efe6c6', '#d9a7a0', '#c9d6b4'];
const ROOF_PAINTS = ['#a3554a', '#b0644e', '#9fa2a4', '#c8c1b4', '#8d8f91', '#a8a39a'];
function lotRoof(l) { return ROOF_PAINTS[Math.floor(hash01(l.code + 'roof') * ROOF_PAINTS.length)]; }
const CAR_PAINTS = ['#f2f2f0', '#1d1f22', '#9aa0a6', '#7d1d22', '#28406b', '#c9c3b6', '#4a5a3a', '#d8d8d8'];
function lotPaint(l, model) {
  const h = hash01(l.code + 'paint');
  return h < 0.25 ? model.facade.wall : HOUSE_PAINTS[Math.floor(hash01(l.code + 'p2') * HOUSE_PAINTS.length)];
}

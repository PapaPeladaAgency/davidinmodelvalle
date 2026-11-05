// ============================================================================
// 80-render-plus.js — Librerías gratuitas que funcionan dentro de Claude
//  · N8AO 2.0.1 (MIT): oclusión ambiental de mejor calidad que GTAO
//  · three-gpu-pathtracer 0.0.23 (MIT): render fotorrealista por trazado de rayos
// Ambas se cargan desde jsDelivr con import() dinámico: si fallan, el visor sigue
// funcionando con GTAO y con la captura normal del Modo foto.
// ============================================================================

const AOPlus = {
  engine: 'GTAO',
  async upgrade() {
    if (!App.composer || /noN8AO/.test(location.search)) return;
    let mod;
    try { mod = await import('n8ao'); } catch (e) { console.warn('N8AO no disponible, se mantiene GTAO', e); return; }
    const swap = (composer, scene, cfg) => {
      const rp = composer.passes[0], gt = composer.passes[1];
      const n8 = new mod.N8AOPass(scene, App.camera, App.width, App.height);
      Object.assign(n8.configuration, cfg, { gammaCorrection: false });
      n8.setQualityMode(App.lowEnd ? 'Low' : 'Medium');
      composer.insertPass(n8, 0); rp.enabled = false; gt.enabled = false;
      // misma interfaz que usaba GTAO: activar o desactivar la oclusión
      return { n8, get enabled() { return n8.enabled; }, set enabled(v) { n8.enabled = !!v; rp.enabled = !v; } };
    };
    try {
      App.gtao = swap(App.composer, HouseViewer.scene, { aoRadius: 0.55, distanceFalloff: 0.45, intensity: 2.4, color: new THREE.Color('#1c1a17') });
      App.siteGtao = swap(App.siteComposer, Site.scene, { aoRadius: 3.2, distanceFalloff: 1.2, intensity: 2.6 });
      this.engine = 'N8AO';
    } catch (e) { console.warn('N8AO falló al iniciar', e); }
  },
};

// ---------------------------------------------------------------------------
// Render fotorrealista progresivo (path tracing)
// ---------------------------------------------------------------------------
const PathRender = {
  active: false, preparing: false,
  target() { return App.lowEnd ? 48 : 160; },

  async start(kind = App.view === 'house' ? 'house' : 'site') {
    if (this.active || this.preparing) return;
    this.preparing = true; this.kind = kind;
    const hud = $('#ptHud'); hud.hidden = false; document.body.classList.add('pathtracing');
    this.status(t('pt.loading')); $('#ptProg').value = 0; $('#ptSave').disabled = true;
    await new Promise(r => setTimeout(r, 50));
    let mod;
    try { mod = this.mod || (this.mod = await import('three-gpu-pathtracer')); }
    catch (e) { console.warn(e); this.preparing = false; this.close(); UI.toast(t('pt.fail')); return; }
    const controls = kind === 'house' ? App.houseControls : App.siteControls;
    this.ctlWas = controls.enabled; controls.enabled = false; this.controls = controls;
    try {
      this.status(t('pt.prep')); await new Promise(r => setTimeout(r, 30));
      const src = kind === 'house' ? HouseViewer.scene : Site.scene;
      if (kind === 'site') { this.fdWas = Site.forceDetail; Site.forceDetail = true; Site.updateLOD(true); }
      const center = controls.target.clone(), dist = App.camera.position.distanceTo(center);
      const radius = kind === 'house' ? 1e9 : Math.min(560, Math.max(110, dist * 1.35));
      const scene = this.flatten(src, center, radius, App.lowEnd ? 1.2e6 : 3.5e6);
      this.envFor(kind, scene);
      const cam = App.camera.clone(); cam.updateMatrixWorld();
      const pt = new mod.WebGLPathTracer(App.renderer);
      pt.tiles.set(App.lowEnd ? 3 : 2, App.lowEnd ? 3 : 2);
      Object.assign(pt, { bounces: kind === 'house' ? 6 : 4, transmissiveBounces: 3, minSamples: 1, fadeDuration: 0, renderDelay: 0, filterGlossyFactor: 0.5, renderScale: App.lowEnd ? 0.6 : 1, dynamicLowRes: false, rasterizeScene: true });
      await new Promise(r => setTimeout(r, 30));
      pt.setScene(scene, cam);
      Object.assign(this, { pt, scene, cam, active: true, preparing: false, t0: performance.now() });
      $('#ptSave').disabled = false;
      Track.bump('pathtrace');
    } catch (e) {
      console.error('Path tracing', e); this.preparing = false; this.cleanup(); this.close(); UI.toast(t('pt.fail'));
    }
  },

  // Copia plana de la escena: instancias expandidas dentro del radio, materiales PBR estándar
  flatten(src, center, radius, budget) {
    src.updateMatrixWorld(true);
    const out = new THREE.Scene(), cache = new Map(), sigs = new Map(), cands = [];
    this.ownGeos = [];
    const skip = new Set([Site.skyMesh, Site.clouds, Site.mountains, Site.pins, HouseViewer.sky, HouseViewer.clouds].filter(Boolean));
    const visible = o => { for (let p = o; p; p = p.parent) { if (!p.visible || skip.has(p)) return false; } return true; };
    const conv = (m, col) => {
      if (!m || m.isShaderMaterial || m.isPointsMaterial || m.isSpriteMaterial || m.isLineBasicMaterial) return null;
      if (m.opacity < 0.05 || m.visible === false) return null;
      const key = m.uuid + (col ? col.getHexString() : '');
      if (cache.has(key)) return cache.get(key);
      let r = m;
      if (!(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) r = new THREE.MeshStandardMaterial({ color: m.color || 0xffffff, map: m.map || null, emissive: m.emissive || 0x000000, emissiveMap: m.emissiveMap || null, emissiveIntensity: m.emissiveIntensity ?? 1, transparent: m.transparent, opacity: m.opacity, side: m.side, roughness: 0.85, vertexColors: m.vertexColors });
      if (col) { r = r.clone(); r.color = r.color.clone().multiply(col); }
      // el trazador indexa materiales con 8 bits: se unifican los materiales idénticos
      const u = x => x ? x.uuid : '', f = x => x == null ? '' : (+x).toFixed(2);
      const sig = [r.type, r.color?.getHexString(), u(r.map), u(r.normalMap), u(r.roughnessMap), u(r.metalnessMap), u(r.alphaMap), u(r.emissiveMap), r.emissive?.getHexString(), f(r.emissiveIntensity),
        f(r.roughness), f(r.metalness), f(r.opacity), r.transparent, r.side, f(r.transmission), f(r.ior), r.vertexColors, f(r.alphaTest), f(r.normalScale?.x), f(r.clearcoat), f(r.envMapIntensity)].join('|');
      if (sigs.has(sig)) r = sigs.get(sig); else sigs.set(sig, r);
      cache.set(key, r); return r;
    };
    const tris = g => (g.index ? g.index.count : g.attributes.position.count) / 3;
    const clip = CutPlane && CutPlane.constant < 50 ? CutPlane.constant : null;
    const box = new THREE.Box3();
    src.traverse(o => {
      if (!o.isMesh || !o.geometry?.attributes?.position || !visible(o)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.every(m => !m || m.isShaderMaterial)) return;
      if (o.isInstancedMesh) {
        const n = o.count, gt = tris(o.geometry), m4 = new THREE.Matrix4(), c = new THREE.Color();
        for (let k = 0; k < n; k++) {
          o.getMatrixAt(k, m4); m4.premultiply(o.matrixWorld);
          const d = Math.hypot(m4.elements[12] - center.x, m4.elements[14] - center.z);
          if (d > radius) continue;
          let col = null; if (o.instanceColor) { o.getColorAt(k, c); col = c.clone(); }
          cands.push({ o, m4: m4.clone(), col, d, t: gt });
        }
      } else {
        if (clip != null && mats.some(m => m?.clippingPlanes?.length)) {
          box.setFromObject(o); if (box.min.y > clip) return;
          if (box.max.y > clip) {
            // el trazador no usa planos de corte: se recorta la geometría a la altura del corte
            const g = o.geometry.clone().applyMatrix4(o.matrixWorld), pa = g.attributes.position;
            for (let i = 0; i < pa.count; i++) if (pa.getY(i) > clip) pa.setY(i, clip);
            this.ownGeos.push(g);
            cands.push({ o, geo: g, m4: new THREE.Matrix4(), col: null, d: 0, t: tris(g), plain: true }); return;
          }
        }
        cands.push({ o, m4: o.matrixWorld.clone(), col: null, d: 0, t: tris(o.geometry), plain: true });
      }
    });
    // lo más cercano primero; lo que no entra en el presupuesto de triángulos se descarta
    cands.sort((a, b) => (a.plain ? -1 : 0) - (b.plain ? -1 : 0) || a.d - b.d);
    let used = 0, n = 0;
    // el trazador solo admite un material por malla: las mallas con varios materiales se dividen por grupo
    const parts = new Map();
    const split = g => {
      if (parts.has(g)) return parts.get(g);
      const list = g.groups.map(gr => {
        const sub = new THREE.BufferGeometry();
        if (g.index) { for (const k in g.attributes) sub.setAttribute(k, g.attributes[k]); sub.setIndex(Array.from(g.index.array.slice(gr.start, gr.start + gr.count))); }
        else for (const k in g.attributes) { const a = g.attributes[k]; sub.setAttribute(k, new THREE.BufferAttribute(a.array.slice(gr.start * a.itemSize, (gr.start + gr.count) * a.itemSize), a.itemSize, a.normalized)); }
        this.ownGeos.push(sub); return { geo: sub, mi: gr.materialIndex };
      });
      parts.set(g, list); return list;
    };
    const put = (geo, mat, m4) => { const mesh = new THREE.Mesh(geo, mat); mesh.matrixAutoUpdate = false; mesh.matrix.copy(m4); mesh.matrixWorld.copy(m4); out.add(mesh); n++; };
    for (const c of cands) {
      if (!c.plain && used + c.t > budget) continue;
      const geo = c.geo || c.o.geometry;
      if (Array.isArray(c.o.material)) {
        if (geo.groups.length) split(geo).forEach(({ geo: sg, mi }) => { const m = conv(c.o.material[mi], c.col); if (m) put(sg, m, c.m4); });
        else { const m = conv(c.o.material[0], c.col); if (m) put(geo, m, c.m4); }
      } else { const m = conv(c.o.material, c.col); if (!m) continue; put(geo, m, c.m4); }
      used += c.t;
    }
    this.stats = { meshes: n, tris: Math.round(used), materials: sigs.size };
    // luces: el sol (y la luz interior si está encendida)
    src.traverse(o => {
      if (!visible(o)) return;
      if (o.isDirectionalLight) { const l = new THREE.DirectionalLight(o.color, o.intensity); l.position.copy(o.getWorldPosition(new THREE.Vector3())); l.target.position.copy(o.target.getWorldPosition(new THREE.Vector3())); out.add(l, l.target); }
      else if (o.isPointLight && o.intensity > 0) { const l = new THREE.PointLight(o.color, o.intensity, o.distance, o.decay); l.position.copy(o.getWorldPosition(new THREE.Vector3())); out.add(l); }
    });
    out.updateMatrixWorld(true);
    return out;
  },

  // Fondo y luz ambiental: el cielo, las nubes y las montañas con bruma se capturan en un cubemap
  envFor(kind, scene) {
    const r = App.renderer;
    if (kind === 'house' && HouseViewer.maqueta) {
      const g = new this.mod.GradientEquirectTexture(64);
      g.topColor.set('#ffffff'); g.bottomColor.set('#cfc9bd'); g.exponent = 1.6; g.update();
      scene.environment = g; scene.environmentIntensity = 0.9; scene.background = new THREE.Color('#f3f2ee');
      this.disposables = [g]; return;
    }
    const src = kind === 'house' ? HouseViewer.scene : Site.scene;
    const keep = new Set((kind === 'house' ? [HouseViewer.sky, HouseViewer.clouds] : [Site.skyMesh, Site.clouds, Site.mountains]).filter(Boolean));
    const inKeep = o => { for (let p = o; p; p = p.parent) if (keep.has(p)) return true; return false; };
    const hidden = [];
    src.traverse(o => { if (o.isMesh && o.visible && !inKeep(o)) { hidden.push(o); o.visible = false; } });
    const rt = new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType });
    const cc = new THREE.CubeCamera(1, 20000, rt);
    cc.position.copy(App.camera.position); cc.position.y = Math.max(2, Math.min(App.camera.position.y, 60));
    const env = src.environment; src.environment = null;
    const prevTM = r.toneMapping; r.toneMapping = THREE.NoToneMapping;
    cc.update(r, src);
    r.toneMapping = prevTM; src.environment = env;
    hidden.forEach(o => o.visible = true);
    scene.background = rt.texture; scene.environment = rt.texture;
    scene.environmentIntensity = kind === 'house' ? 0.75 : 0.7; scene.backgroundIntensity = 1;
    this.disposables = [rt];
  },

  tick() {
    if (!this.active) return;
    this.pt.renderSample();
    const s = Math.floor(this.pt.samples), T = this.target();
    $('#ptProg').value = Math.min(1, s / T);
    this.status(t('pt.samples', { n: s, t: T }));
    if (s >= T) this.finish();
  },

  finish() {
    if (!this.active) return;
    this.pt.renderSample();          // el lienzo contiene el último resultado al leerlo
    const url = App.renderer.domElement.toDataURL('image/jpeg', 0.94);
    const w = App.renderer.domElement.width, h = App.renderer.domElement.height, s = Math.floor(this.pt.samples);
    this.cleanup(); this.close();
    Photo.showResult(url, w, h, t('pt.done', { n: s }), 'path-tracing');
  },

  cancel() { if (this.preparing) return; this.cleanup(); this.close(); },
  cleanup() {
    if (this.pt) { try { this.pt.dispose(); } catch (e) { } }
    (this.disposables || []).forEach(d => d.dispose && d.dispose());
    (this.ownGeos || []).forEach(g => g.dispose()); this.ownGeos = null;
    this.pt = null; this.scene = null; this.disposables = null; this.active = false;
    if (this.kind === 'site' && this.fdWas !== undefined) { Site.forceDetail = this.fdWas; Site._lodKey = null; this.fdWas = undefined; }
    if (this.controls) { this.controls.enabled = this.ctlWas; this.controls = null; }
  },
  close() { $('#ptHud').hidden = true; document.body.classList.remove('pathtracing'); },
  status(s) { $('#ptStatus').textContent = s; },
  init() {
    $('#ptSave').onclick = () => this.finish();
    $('#ptCancel').onclick = () => this.cancel();
    $('#photoPT').onclick = () => this.start('site');
    $('#hRender').onclick = () => this.start('house');
  },
};

Object.assign(I18N.es, {
  'pt.btn': 'Render fotorrealista (trazado de rayos)', 'pt.title': 'Render fotorrealista', 'pt.loading': 'Cargando el motor de trazado de rayos…',
  'pt.prep': 'Preparando la escena…', 'pt.samples': 'Muestras de luz: {n} de {t}', 'pt.save': 'Guardar ahora', 'pt.cancel': 'Cancelar',
  'pt.fail': 'Este equipo no pudo generar el render fotorrealista. Usá “Capturar imagen”.', 'pt.done': 'Render por trazado de rayos con {n} muestras de luz.',
  'pt.note': 'La imagen gana nitidez con cada muestra. Podés guardarla en cualquier momento.', 'pt.house': 'Render',
});
Object.assign(I18N.en, {
  'pt.btn': 'Photoreal render (path tracing)', 'pt.title': 'Photoreal render', 'pt.loading': 'Loading the path tracing engine…',
  'pt.prep': 'Preparing the scene…', 'pt.samples': 'Light samples: {n} of {t}', 'pt.save': 'Save now', 'pt.cancel': 'Cancel',
  'pt.fail': 'This device could not create the photoreal render. Use “Capture image”.', 'pt.done': 'Path traced render with {n} light samples.',
  'pt.note': 'The image gets sharper with every sample. You can save it at any time.', 'pt.house': 'Render',
});

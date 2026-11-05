// ============================================================================
// 90-main.js — Arranque, render loop, cámaras, interacción y navegación
// ============================================================================

const App = {
  view: 'hero', walking: false, width: innerWidth, height: innerHeight,
  lowEnd: !/[?&]hq/.test(location.search) && (matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4 || /lowend/.test(location.search)),
  project: null, layoutLots: [],

  async start() {
    this.layoutLots = generateLayoutLots();
    const canvas = $('#c'); this.canvas = canvas;
    const r = new THREE.WebGLRenderer({ canvas, antialias: !this.lowEnd, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, this.lowEnd ? 1.5 : 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.localClippingEnabled = true;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.82;
    this.renderer = r;
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.08, 6000);
    this.camera.position.set(260, 380, 620);
    this.siteControls = new OrbitControls(this.camera, canvas);
    Object.assign(this.siteControls, { enableDamping: true, dampingFactor: 0.08, maxPolarAngle: Math.PI * 0.495, minDistance: 4, maxDistance: 1100, screenSpacePanning: false });
    this.siteControls.target.set(0, 0, 60);
    this.houseControls = new OrbitControls(this.camera, canvas);
    Object.assign(this.houseControls, { enableDamping: true, dampingFactor: 0.08, enabled: false, screenSpacePanning: false });
    this.siteControls.enabled = false;

    Loader.set(15, 'load.2');
    Site.init(); HouseViewer.init(); UI.init(); Tour.init(); Photo.init(); Shell.init(); PathRender.init();
    Loader.set(35, 'load.3');
    // Posproceso (oclusión ambiental) solo en equipos de escritorio
    if (!this.lowEnd) {
      try {
        const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
        this.composer = new EffectComposer(r, rt);
        this.composer.addPass(new RenderPass(HouseViewer.scene, this.camera));
        this.gtao = new GTAOPass(HouseViewer.scene, this.camera, innerWidth, innerHeight);
        this.gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 16 });
        this.gtao.blendIntensity = 1;
        this.composer.addPass(this.gtao);
        this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.18, 0.5, 0.92));
        this.composer.addPass(new OutputPass());
        this.composer.addPass(new ShaderPass(GradeShader));
        // oclusión ambiental también en el residencial (sombras de contacto entre casas, muros y suelo)
        const rt2 = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
        this.siteComposer = new EffectComposer(r, rt2);
        this.siteComposer.addPass(new RenderPass(Site.scene, this.camera));
        this.siteGtao = new GTAOPass(Site.scene, this.camera, innerWidth, innerHeight);
        this.siteGtao.updateGtaoMaterial({ radius: 1.6, distanceExponent: 1.5, thickness: 2.5, scale: 1.2, samples: 12 });
        this.siteComposer.addPass(this.siteGtao);
        this.dof = new BokehPass(Site.scene, this.camera, { focus: 400, aperture: 0.000025, maxblur: 0.005 });
        this.dof.enabled = false; this.siteComposer.addPass(this.dof);
        this.siteComposer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.14, 0.5, 0.93));
        this.siteComposer.addPass(new OutputPass());
        this.siteComposer.addPass(this.gradeSite = new ShaderPass(GradeShader));
      } catch (e) { console.warn('Sin posproceso', e); this.composer = null; this.siteComposer = null; }
    }
    AOPlus.upgrade();
    this.bindPointer();
    addEventListener('resize', () => this.resize()); this.resize();
    $('#adminClose').addEventListener('click', () => Admin.close());
    $('#admin').addEventListener('focusout', () => setTimeout(() => { if (Admin._pending && !$('#admin').contains(document.activeElement)) { Admin._pending = false; Admin.render(); } }, 50));

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.loop());

    await Store.init(() => buildDemoSeed(this.layoutLots));
    $('#dataMode').textContent = Store.mode === 'cloud' ? 'Datos en la nube' : 'Datos locales';
    $('#btnAdmin').hidden = !Store.canEdit;
    Loader.set(85, 'load.3');
    Store.on(col => this.onData(col));
    this.onData('*');
    Loader.set(100, 'load.4');
    Shell.fillFilterOptions(); Shell.syncFavCount(); applyI18n();
    setTimeout(() => { $('#loading').hidden = true; Shell.routeHash(); Thumbs.renderAll(); }, 250);
    document.body.classList.add('ready');
    Assistant.init().catch(e => console.warn('Asistente IA', e));
    Live.init().catch(e => console.warn('En vivo', e));
  },

  onData(col) {
    if (Store.isEmpty()) {
      $('#emptyBanner').hidden = false;
      $('#emptyBanner').innerHTML = Store.canEdit
        ? `El inventario está vacío. <button class="btn small primary" id="seedNow">Cargar datos demostrativos</button>`
        : 'El inventario del prototipo aún no tiene datos. Pedí a quien administra que cargue la demostración.';
      const b = $('#seedNow'); if (b) b.onclick = async () => { b.disabled = true; await Store.loadSeed(); };
      if (!this.project) this.setProjectObj({ ...buildDemoSeed(this.layoutLots).projects[PROJECT_ID] });
      return;
    }
    $('#emptyBanner').hidden = true;
    const pid = this.project && Store.data.projects[this.project.id] ? this.project.id : (Store.data.projects[PROJECT_ID] ? PROJECT_ID : Object.keys(Store.data.projects)[0]);
    const p = Store.data.projects[pid];
    const sig = JSON.stringify([p.id, p.stages, p.refUrl, p.hasLayout]);
    if (sig !== this._projSig) { this._projSig = sig; this.setProjectObj(p); }
    else if (col === 'lots' || col === 'models' || col === '*') {
      if (!p.hasLayout) Site.build(p); else Site.rebuildInventoryVisuals();
      this.project = p;
    }
    UI.renderStageBar(); UI.renderLegend();
    if (UI.selectedLot) UI.renderLot();
    if (this.view === 'house' && col === 'models' && Store.data.models[HouseViewer.model.id]) {
      const nm = Store.data.models[HouseViewer.model.id];
      if (JSON.stringify(nm.plan) !== JSON.stringify(HouseViewer.model.plan) || JSON.stringify(nm.facade) !== JSON.stringify(HouseViewer.model.facade)) { HouseViewer.model = nm; HouseViewer.rebuild(); }
      else HouseViewer.model = nm;
      UI.syncHouseHeader();
    }
    Admin.refresh();
    $('#heroStats').innerHTML = this.heroStats();
  },

  heroStats() {
    const lots = Object.values(Store.data.lots).filter(l => l.projectId === PROJECT_ID);
    const disp = lots.filter(l => l.status === 'disponible').length;
    const from = Math.min(...lots.filter(l => l.model).map(l => l.priceLot + (Store.data.models[l.model]?.priceHome || 0)));
    return `<div><strong>4</strong><span>etapas</span></div><div><strong>${this.layoutLots.length}</strong><span>lotes en el trazado</span></div><div><strong>${disp}</strong><span>disponibles (demo)</span></div><div><strong>${isFinite(from) ? money(from) : '—'}</strong><span>casa + terreno desde (ejemplo)</span></div>`;
  },

  setProject(id) { const p = Store.data.projects[id]; if (p) { this._projSig = null; this.project = p; this.onData('*'); } },
  setProjectObj(p) {
    this.project = p;
    Site.stageFilter = 0;
    Site.build(p);
    $('#projName').textContent = p.name;
    UI.renderStageBar(); UI.renderLegend();
    if (this.view === 'site') this.overview();
  },

  resize() {
    this.width = innerWidth; this.height = innerHeight;
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height; this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setSize(this.width, this.height); this.composer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); }
    if (this.siteComposer) { this.siteComposer.setSize(this.width, this.height); this.siteComposer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); }
  },

  forward() { return new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).setY(0).normalize(); },

  // ---- navegación entre vistas ----
  enterSite() {
    this.view = 'site'; document.body.dataset.view = 'site';
    this.siteControls.enabled = true; this.houseControls.enabled = false;
    this.overview();
  },
  overview() {
    const narrow = this.width < 700;
    if (this.project && !this.project.hasLayout) { flyCamera(this.camera, this.siteControls, new THREE.Vector3(60, 140, 160), new THREE.Vector3(0, 0, 0), 1.8); return; }
    flyCamera(this.camera, this.siteControls, new THREE.Vector3(narrow ? 120 : 210, narrow ? 560 : 330, narrow ? 520 : 400), new THREE.Vector3(narrow ? -5 : 5, 0, 70), 2.2);
  },
  topView() { flyCamera(this.camera, this.siteControls, new THREE.Vector3(-20, 620, 75), new THREE.Vector3(-22, 0, 70), 1.6); },
  focusLot(code) {
    if (this.view !== 'site') { if (this.view === 'house') this.exitHouse(true); else this.enterSite(); }
    const i = Site.lotIndex.get(code); if (i == null) { UI.toast(`El lote ${code} no está en el trazado de este proyecto`); return; }
    const l = Site.lots[i];
    flyCamera(this.camera, this.siteControls, new THREE.Vector3(l.x + 26, 42, l.z + 48), new THREE.Vector3(l.x, 0, l.z), 1.5);
    UI.showLot(i);
  },
  enterHouse(code, modelId) {
    UI.closeModal();
    this._siteCam = { p: this.camera.position.clone(), t: this.siteControls.target.clone() };
    $('#fade').classList.add('on');
    setTimeout(() => {
      this.view = 'house'; document.body.dataset.view = 'house';
      this.siteControls.enabled = false; this.houseControls.enabled = true;
      const inv = Store.data.lots[code];
      HouseViewer.open(code, modelId || inv?.model || 'A', null);
      UI.syncHouseHeader();
      $('#fade').classList.remove('on');
      UI.toast('Usá “Casa abierta” para ver toda la distribución sin techo');
    }, 380);
  },
  exitHouse(quick) {
    this.setWalk(false);
    if (HouseViewer.maqueta) HouseViewer.setMaqueta(false);
    this.renderer.toneMappingExposure = 0.82;
    $('#fade').classList.add('on');
    setTimeout(() => {
      this.view = 'site'; document.body.dataset.view = 'site'; document.body.dataset.hmode = '';
      this.houseControls.enabled = false; this.siteControls.enabled = true;
      CutPlane.constant = 100;
      if (this._siteCam && !quick) { this.camera.position.copy(this._siteCam.p); this.siteControls.target.copy(this._siteCam.t); }
      this.camera.lookAt(this.siteControls.target);
      $('#fade').classList.remove('on');
      if (UI.selectedLot) UI.renderLot();
    }, 350);
  },
  setWalk(on) {
    this.walking = on; document.body.classList.toggle('walking', on);
    const fov = on ? (this.width < 700 ? 78 : 68) : 45;
    if (this.camera.fov !== fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    if (on) this.houseControls.enabled = false;
  },

  // ---- puntero: hover y selección ----
  bindPointer() {
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    let down = null;
    const setNdc = e => { const r = this.canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, this.camera); };
    this.canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    this.canvas.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      if (this.view === 'site') {
        setNdc(e); const r = Site.pickAny(ray); Site.setHover(r && r.lot != null ? r.lot : -1); this.canvas.style.cursor = r ? 'pointer' : '';
      } else if (this.view === 'house' && HouseViewer.mode === 'open') {
        setNdc(e); const id = HouseViewer.pickRoom(ray); HouseViewer.setHoverRoom(id || UI.selectedRoom); this.canvas.style.cursor = id ? 'pointer' : '';
      } else this.canvas.style.cursor = '';
    });
    this.canvas.addEventListener('pointerup', e => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || performance.now() - down.t > 600;
      down = null; if (moved) return;
      setNdc(e);
      if (this.view === 'site') { Tour.userInteracted(); const r = Site.pickAny(ray); if (r && r.lot != null) UI.showLot(r.lot); else if (r && r.amenity) UI.showAmenity(r.amenity); else UI.closeLot(); }
      else if (this.view === 'house' && HouseViewer.mode === 'open') { const id = HouseViewer.pickRoom(ray); if (id) UI.showRoomCard(id); }
    });
  },

  loop() {
    const dt = Math.min(0.1, this.clock.getDelta());
    if (PathRender.active) { PathRender.tick(); return; }
    if (PathRender.preparing) return;
    Tweens.update(dt);
    const following = Live.update(dt);
    if (Live.presenting) Live.send(false);
    if (this.view === 'house') {
      if (this.walking) HouseViewer.updateWalk(dt);
      if (this.houseControls.enabled && !following && !Tweens.list.some(t => t.tag === 'cam')) this.houseControls.update();
      if (this.composer) {
        this.gtao.enabled = CutPlane.constant >= 100 && (HouseViewer.roofK < 0.01 || HouseViewer.roofK > 0.99);
        this.composer.render(dt);
      } else this.renderer.render(HouseViewer.scene, this.camera);
      UI.updateRoomTags(this.camera);
    } else {
      if (this.view === 'hero') {
        const t = performance.now() / 1000 * 0.05;
        this.camera.position.set(Math.sin(t) * 520, 300, 70 + Math.cos(t) * 520);
        this.camera.lookAt(-10, 0, 70); this.siteControls.target.set(-10, 0, 70);
      } else if (this.siteControls.enabled && !following && !Tweens.list.some(t => t.tag === 'cam')) this.siteControls.update();
      if (this.view === 'site' && (this._lodT = (this._lodT || 0) + dt) > 0.35) { this._lodT = 0; Site.updateLOD(); }
      // la oclusión ambiental solo se aplica de cerca (desde muy alto no aporta y cuesta)
      if (this.siteComposer && this.view === 'site' && this.camera.position.distanceTo(this.siteControls.target) < 420) this.siteComposer.render(dt);
      else this.renderer.render(Site.scene, this.camera);
      Site.updateLabels(this.camera); UI.updateLotTags(this.camera);
    }
  },
};

window.__vss = { PBR_STATUS, AOPlus, PathRender, Live, Assistant, Tweens, Shell, Track, App, Store, Site, HouseViewer, UI, Admin, buildDemoSeed, generateLayoutLots };
App.start().catch(e => { console.error(e); $('#loading').innerHTML = `<p>No se pudo iniciar el visor 3D: ${esc(e.message)}</p><p class="muted">Se necesita un navegador compatible con WebGL.</p>`; });

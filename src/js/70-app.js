// ============================================================================
// 70-app.js — Experiencia de web app: navegación por pestañas, ficha de lote,
// filtros, Mi cuota, Favoritos, Contacto, apartado, cotización PDF,
// enlaces por lote y analítica del embudo.
// ============================================================================

const SHARE_BASE_DEFAULT = 'https://claude.ai/artifact/Uxh4YK6vWHo9odCUzBT7sB';
const LOAN = { down: 10, years: 20, rate: 7.5 };
const STAGE_PROGRESS_DEMO = { 1: { progress: 35, obra: 'Urbanización y primeras viviendas', eta: '2027-06' }, 2: { progress: 10, obra: 'Terracería y drenajes', eta: '2027-12' }, 3: { progress: 0, obra: 'Por iniciar', eta: '2028-06' }, 4: { progress: 0, obra: 'Por iniciar', eta: '2028-12' } };

// ---------------- Analítica del embudo ----------------
const Track = {
  counts: lsGet('vss-analytics', { visit: 0 }), _t: null, _seen: new Set(),
  bump(evt, once) {
    if (once && this._seen.has(evt)) return; this._seen.add(evt);
    this.counts[evt] = (this.counts[evt] || 0) + 1; lsSet('vss-analytics', this.counts);
    clearTimeout(this._t); this._t = setTimeout(() => this.flush(), ['contact', 'reserve', 'booking'].includes(evt) ? 300 : 15000);
  },
  async flush() {
    if (Store.mode !== 'cloud' || !Store.user) return;
    try { const uid = await Store.user.id(); await Store.db.doc(`analytics/${uid}`).set({ counts: this.counts, lang: LANG, last: Date.now() }); } catch (e) { /* sin permiso: se conserva local */ }
  },
  async loadAll() {
    if (Store.mode !== 'cloud') return [{ counts: this.counts }];
    try { const snap = await Store.db.collection('analytics').get(); return snap.docs.map(d => d.data()); } catch (e) { return []; }
  },
};

// ---------------- Miniaturas de cada modelo (render 3D real, una vez) ----------------
const Thumbs = {
  data: {}, pending: null,
  get(id) { return this.data[id] || ''; },
  async renderAll() {
    if (this.pending) return this.pending;
    this.pending = (async () => {
      await new Promise(r => setTimeout(r, 2500));   // dar tiempo a que carguen las texturas
      let r2;
      try {
        const cv = document.createElement('canvas');
        r2 = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
        r2.setSize(480, 300, false); r2.toneMapping = THREE.ACESFilmicToneMapping; r2.toneMappingExposure = 0.9; r2.shadowMap.enabled = true;
        for (const m of Object.values(Store.data.models)) {
          const scene = new THREE.Scene(); scene.background = new THREE.Color('#dfe9f1');
          scene.environment = Site.scene.environment; scene.environmentIntensity = 0.6;
          scene.add(new THREE.HemisphereLight('#eef5ff', '#7a7a5a', 0.6));
          const sun = new THREE.DirectionalLight('#fff0d8', 3); sun.position.set(-8, 12, 10); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
          Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 }); scene.add(sun);
          const g = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: '#86a65f', roughness: 1 })); g.rotation.x = -Math.PI / 2; g.receiveShadow = true; scene.add(g);
          detailTemplate({ ...m, plan: m.plan || PLAN_52 }).forEach(({ geo, mat, paint }) => { const mm = mat.clone(); if (paint) mm.color.set(m.facade.wall); const mesh = new THREE.Mesh(geo, mm); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); });
          const tree = palmTree(5, 3); tree.position.set(-5.5, 0, -3); scene.add(tree);
          const cam = new THREE.PerspectiveCamera(32, 480 / 300, 0.5, 200); cam.position.set(9.5, 5.2, 15); cam.lookAt(0, 1.6, 0);
          r2.render(scene, cam);
          this.data[m.id] = cv.toDataURL('image/jpeg', 0.85);
        }
      } catch (e) { console.warn('miniaturas', e); }
      finally { if (r2) { r2.dispose(); r2.forceContextLoss(); } }
      $$('img[data-thumb]').forEach(img => { const s = this.get(img.dataset.thumb); if (s) img.src = s; });
      return this.data;
    })();
    return this.pending;
  },
};

// ---------------- Filtros sobre el residencial ----------------
const Filters = {
  max: 0, model: '', only: false,
  active() { return !!(this.max || this.model || this.only); },
  match(l) {
    const inv = Store.data.lots[l.code];
    if (this.only && inv?.status !== 'disponible') return false;
    if (this.model && (inv?.model || Site.houseFor(l)) !== this.model) return false;
    if (this.max) { if (!inv) return false; const total = (inv.priceLot || 0) + (Store.data.models[inv.model]?.priceHome || 0); if (total > this.max) return false; }
    return true;
  },
  apply() {
    Site.filter = this.active() ? l => this.match(l) : null;
    Site.refreshColors();
    const n = this.active() ? Site.lots.filter(l => this.match(l)).length : 0;
    $('#filterCount').hidden = !this.active(); $('#filterCount').textContent = this.active() ? n : '';
    $('#fResult').textContent = this.active() ? t('f.count', { n }) : '';
  },
  sync() { $('#fMax').value = String(this.max); $('#fModel').value = this.model; $('#fOnly').checked = this.only; this.apply(); },
};

// ---------------- Shell de la app ----------------
const Shell = {
  tab: 'explore', favs: new Set(lsGet('vss-favs', [])), cmp: new Set(),

  init() {
    applyI18n();
    // menú "Más"
    const mb = $('#btnMore'), mm = $('#moreMenu');
    mb.onclick = e => { e.stopPropagation(); mm.hidden = !mm.hidden; mb.setAttribute('aria-expanded', !mm.hidden); };
    document.addEventListener('click', e => { if (!mm.hidden && !e.target.closest('.menu-wrap')) { mm.hidden = true; mb.setAttribute('aria-expanded', 'false'); } });
    mm.addEventListener('click', () => { mm.hidden = true; });
    $('#btnLang').onclick = () => this.setLang(LANG === 'es' ? 'en' : 'es');
    // pestañas
    $$('[data-tab]').forEach(b => b.onclick = () => this.openTab(b.dataset.tab));
    $('#sheetClose').onclick = () => this.openTab('explore');
    this.bindGrip();
    // filtros y capas
    const pop = (btn, el) => { btn.onclick = e => { e.stopPropagation(); const open = el.hidden; $$('.pop').forEach(p => p.hidden = true); el.hidden = !open; btn.setAttribute('aria-expanded', open); }; };
    pop($('#btnFilters'), $('#filtersPop')); pop($('#btnLayers'), $('#layersPop'));
    document.addEventListener('click', e => { if (!e.target.closest('.pop, .explore-bar')) $$('.pop').forEach(p => p.hidden = true); });
    $('#fMax').onchange = e => { Filters.max = +e.target.value; Filters.apply(); };
    $('#fModel').onchange = e => { Filters.model = e.target.value; Filters.apply(); };
    $('#fOnly').onchange = e => { Filters.only = e.target.checked; Filters.apply(); };
    $('#fClear').onclick = () => { Filters.max = 0; Filters.model = ''; Filters.only = false; Filters.sync(); };
    // vivienda: se reemplazan los botones para soltar los manejadores anteriores
    for (const id of ['hCompare', 'hFinance', 'hLead']) { const el = $('#' + id); el.replaceWith(el.cloneNode(true)); }
    $('#hReserve').onclick = () => this.openReserve(HouseViewer.lotCode);
    $('#hLead').onclick = () => { Track.bump('contact'); window.open(this.whatsLink(HouseViewer.lotCode), '_blank', 'noopener'); };
    $('#hFinance').onclick = () => { App.exitHouse(); setTimeout(() => this.openTab('quota'), 450); };
    $('#hCompare').onclick = () => { this.toggleFav(HouseViewer.lotCode); this.syncHouseFav(); };
    // WhatsApp flotante
    this.updateWhats();
    // enlaces por lote
    addEventListener('hashchange', () => this.routeHash());
    // cerrar ficha de lote abre explorar
    Track.bump('visit', true);
  },

  setLang(l) {
    LANG = l; lsSet('vss-lang', l); try { localStorage.setItem('vss-lang', l); } catch (e) { }
    applyI18n(); this.fillFilterOptions(); UI.renderStageBar(); UI.renderLegend();
    if (UI.selectedLot) UI.renderLot();
    if (this.tab !== 'explore') this.openTab(this.tab);
    if (App.view === 'house') { UI.syncHouseHeader(); UI.renderRoomTags(); }
    $('#heroStats').innerHTML = App.heroStats();
    this.updateWhats();
  },

  // ---- hoja inferior / panel lateral ----
  openTab(tab) {
    this.tab = tab;
    $$('[data-tab]').forEach(b => { if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (tab === 'explore') { $('#sheet').hidden = true; document.body.classList.remove('sheet-open'); return; }
    if (App.view !== 'site') App.enterSite();
    UI.closeLot();
    const body = $('#sheetBody');
    body.innerHTML = this['tab_' + tab]();
    this['bind_' + tab] && this['bind_' + tab]();
    $('#sheet').hidden = false; $('#sheet').classList.remove('full'); document.body.classList.add('sheet-open');
    body.scrollTop = 0;
  },
  bindGrip() {
    const g = $('#sheetGrip'), sh = $('#sheet'); let y0 = null;
    g.onclick = () => sh.classList.toggle('full');
    g.addEventListener('pointerdown', e => { y0 = e.clientY; g.setPointerCapture(e.pointerId); });
    g.addEventListener('pointerup', e => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; if (dy > 60) this.openTab('explore'); else if (dy < -40) sh.classList.add('full'); });
  },

  // ---- utilidades de precio ----
  pay(price) { return UI.calcLoan(price, LOAN.down, LOAN.years, LOAN.rate).monthly; },
  stName(st) { return t('st.' + (st || 'fuera')); },
  stChip(st) { const ic = { disponible: '●', reservado: '◐', vendido: '■', fuera: '○' }[st || 'fuera']; return `<span class="st-chip st-${st || 'fuera'}" style="--st:${STATUS[st || 'fuera'].color}">${ic} ${this.stName(st)}</span>`; },
  modelLabel(m) { return m ? `${m.name} · ${m.tagline || ''}` : ''; },

  // ---- ficha de lote (reemplaza la anterior) ----
  renderLot() {
    const code = UI.selectedLot; if (!code) return;
    const I = UI.lotInfo(code), st = I.status, m = I.model;
    const fav = this.favs.has(code);
    const shown = m || Store.data.models.A;
    Track.bump('lot_open');
    $('#lotBody').innerHTML = `
      <div class="lc-media"><img data-thumb="${esc(shown?.id || 'A')}" src="${Thumbs.get(shown?.id || 'A')}" alt="${esc(this.modelLabel(shown))}">${this.stChip(st)}
        <button class="fav-btn ${fav ? 'on' : ''}" id="lcFav" aria-pressed="${fav}" aria-label="${t(fav ? 'lot.faved' : 'lot.fav')}">${fav ? '♥' : '♡'}</button></div>
      <div class="lc-head"><span class="stage-pill" style="--sc:${esc(I.stage?.color || '#999')}">${esc(I.stage?.name || '')}</span><h2 class="lot-code">${t('lot.lot')} ${esc(code)}</h2></div>
      ${I.inv ? `<div class="lc-price"><div><span>${m ? t('lot.total') : t('lot.only')}</span><strong>${money(m ? I.priceTotal : I.priceLot)}</strong></div>
        <div class="lc-pay"><span>${t('lot.from')}</span><strong>${money(this.pay(m ? I.priceTotal : I.priceLot))}${t('lot.month')}</strong></div></div>
        <p class="example">${t('lot.example')}</p>` : `<p class="empty-note">${t('lot.nodata')}</p>`}
      <dl class="lc-facts"><div><dt>${t('lot.area')}</dt><dd>≈ ${I.area} m²</dd></div>${m ? `<div><dt>${t('lot.built')}</dt><dd>${m.area} m² · ${m.bedrooms} ${t('lot.beds')} · ${m.baths} ${t('lot.bath')}</dd></div><div><dt>${t('h.seeAs')}</dt><dd>${esc(this.modelLabel(m))}</dd></div>` : ''}</dl>
      <div class="lc-actions">
        <button class="btn primary big" id="lcView">${t('lot.view')}</button>
        <div class="lc-row">
          ${st === 'disponible' ? `<button class="btn" id="lcReserve">${t('lot.reserve')}</button>` : ''}
          <a class="btn whats" id="lcWhats" href="${esc(this.whatsLink(code))}" target="_blank" rel="noopener">${t('lot.whats')}</a>
          ${I.inv ? `<button class="btn" id="lcPdf">${t('lot.pdf')}</button>` : ''}
          <button class="btn ghost" id="lcShare">${t('lot.share')}</button>
        </div>
        ${!I.inv && Store.canEdit ? `<button class="btn ghost" id="lotAddInv">Agregar al inventario</button>` : ''}
      </div>`;
    $('#lcView').onclick = () => { Track.bump('house_enter'); App.enterHouse(code, m?.id || 'A'); };
    $('#lcFav').onclick = () => { this.toggleFav(code); this.renderLot(); };
    const r = $('#lcReserve'); if (r) r.onclick = () => this.openReserve(code);
    $('#lcWhats').onclick = () => Track.bump('contact');
    const p = $('#lcPdf'); if (p) p.onclick = () => this.quotePdf(code);
    $('#lcShare').onclick = () => this.share(code);
    const add = $('#lotAddInv'); if (add) add.onclick = () => Admin.addLotToInventory(code).then(() => UI.renderLot());
    if (!Thumbs.get('A')) Thumbs.renderAll();
  },

  // ---- favoritos ----
  toggleFav(code) {
    if (!code) return;
    if (this.favs.has(code)) this.favs.delete(code); else { this.favs.add(code); Track.bump('fav'); UI.toast(`${t('lot.faved')}: ${code}`); }
    lsSet('vss-favs', [...this.favs]); this.syncFavCount();
  },
  syncFavCount() { const n = this.favs.size; $('#favCount').hidden = !n; $('#favCount').textContent = n; },
  syncHouseFav() { const on = this.favs.has(HouseViewer.lotCode); $('#hCompare').textContent = on ? '♥' : '♡'; $('#hCompare').setAttribute('aria-pressed', on); },
  miniCard(code, extra = '') {
    const I = UI.lotInfo(code), m = I.model;
    return `<div class="mini" data-code="${esc(code)}"><img data-thumb="${esc(m?.id || 'A')}" src="${Thumbs.get(m?.id || 'A')}" alt="">
      <div class="mini-t"><b>${t('lot.lot')} ${esc(code)}</b><small>${esc(I.stage?.name || '')} · ${m ? esc(m.name) : t('lot.only')}</small>
      <span>${I.inv ? `${money(m ? I.priceTotal : I.priceLot)} · ${money(this.pay(m ? I.priceTotal : I.priceLot))}${t('lot.month')}` : ''}</span></div>${this.stChip(I.status)}${extra}</div>`;
  },
  tab_favs() {
    const list = [...this.favs].filter(c => Site.lotIndex.has(c));
    if (!list.length) return `<h2>${t('favs.title')}</h2><p class="muted">${t('favs.empty')}</p>`;
    return `<h2>${t('favs.title')}</h2><p class="small muted">${t('favs.pick')}</p>
      <div class="minis">${list.map(c => this.miniCard(c, `<label class="cmp"><input type="checkbox" data-cmp="${esc(c)}" ${this.cmp.has(c) ? 'checked' : ''}></label><button class="icon-x" data-unfav="${esc(c)}" aria-label="Quitar">×</button>`)).join('')}</div>
      <button class="btn primary" id="favCompare" ${this.cmp.size < 2 ? 'disabled' : ''}>${t('favs.compare')} (${this.cmp.size})</button>`;
  },
  bind_favs() {
    $$('.mini').forEach(el => el.addEventListener('click', e => { if (e.target.closest('input,button,label')) return; App.focusLot(el.dataset.code); this.openTab('explore'); }));
    $$('[data-unfav]').forEach(b => b.onclick = () => { this.toggleFav(b.dataset.unfav); this.cmp.delete(b.dataset.unfav); this.openTab('favs'); });
    $$('[data-cmp]').forEach(c => c.onchange = () => { if (c.checked) { if (this.cmp.size >= 3) { c.checked = false; return; } this.cmp.add(c.dataset.cmp); } else this.cmp.delete(c.dataset.cmp); this.openTab('favs'); });
    const b = $('#favCompare'); if (b) b.onclick = () => { UI.compare = new Set(this.cmp); UI.openCompare(); };
  },

  // ---- casas ----
  tab_houses() {
    const ms = Object.values(Store.data.models).sort((a, b) => a.id.localeCompare(b.id));
    const from = id => { const ls = Object.values(Store.data.lots).filter(l => l.model === id && l.status === 'disponible'); return ls.length ? Math.min(...ls.map(l => l.priceLot + (Store.data.models[id]?.priceHome || 0))) : 0; };
    return `<h2>${t('houses.title')}</h2><p class="muted">${t('houses.lead')}</p><div class="models">${ms.map(m => `
      <article class="model-card"><img data-thumb="${esc(m.id)}" src="${Thumbs.get(m.id)}" alt="${esc(this.modelLabel(m))}">
        <div class="mc-body"><h3>${esc(m.name)} <small>${esc(m.tagline || '')}</small></h3>
        <p class="small">${m.area} m² · ${m.bedrooms} ${t('lot.beds')} · ${m.baths} ${t('lot.bath')}${from(m.id) ? ` · <b>${t('houses.from')} ${money(from(m.id))}</b>` : ''}</p>
        <p class="small muted">${esc(m.description || '')}</p>
        <div class="lc-row"><button class="btn primary" data-enter="${esc(m.id)}">${t('houses.enter')}</button><button class="btn" data-lots="${esc(m.id)}">${t('houses.lots')}</button></div></div></article>`).join('')}</div>`;
  },
  bind_houses() {
    $$('[data-enter]').forEach(b => b.onclick = () => { const id = b.dataset.enter; const lot = Object.values(Store.data.lots).find(l => l.model === id && l.status === 'disponible') || Object.values(Store.data.lots).find(l => l.model === id); Track.bump('house_enter'); this.openTab('explore'); App.enterHouse(lot?.code || Site.lots[0].code, id); });
    $$('[data-lots]').forEach(b => b.onclick = () => { Filters.model = b.dataset.lots; Filters.only = true; Filters.sync(); this.openTab('explore'); App.overview(); });
    if (!Thumbs.get('A')) Thumbs.renderAll().then(() => { if (this.tab === 'houses') $$('img[data-thumb]').forEach(i => i.src = Thumbs.get(i.dataset.thumb)); });
  },

  // ---- mi cuota ----
  q: lsGet('vss-quota', { income: 1050, down: 2500, years: 25, rate: 7.5 }),
  tab_quota() {
    const q = this.q;
    return `<h2>${t('quota.title')}</h2><p class="muted">${t('quota.lead')}</p>
      <form class="form two" id="qForm">
        <label>${t('quota.income')}<input id="qIncome" type="number" min="100" step="10" value="${q.income}"></label>
        <label>${t('quota.down')}<input id="qDown" type="number" min="0" step="100" value="${q.down}"></label>
        <label>${t('quota.years')} <output id="qYearsO">${q.years} ${t('quota.years_u')}</output><input id="qYears" type="range" min="5" max="30" value="${q.years}"></label>
        <label>${t('quota.rate')}<input id="qRate" type="number" min="0" max="20" step="0.1" value="${q.rate}"></label>
      </form>
      <div class="q-out" id="qOut"></div>
      <p class="small muted">${t('quota.note')}</p>`;
  },
  bind_quota() {
    const calc = () => {
      const q = this.q = { income: +$('#qIncome').value || 0, down: +$('#qDown').value || 0, years: +$('#qYears').value, rate: +$('#qRate').value || 0 };
      lsSet('vss-quota', q); $('#qYearsO').textContent = `${q.years} ${t('quota.years_u')}`;
      const cap = q.income * 0.3, n = q.years * 12, r = q.rate / 1200;
      const loan = r ? cap * (1 - Math.pow(1 + r, -n)) / r : cap * n;
      const max = Math.max(0, loan + q.down);
      const fits = Object.values(Store.data.lots).filter(l => l.projectId === App.project.id && l.status === 'disponible' && l.model && l.priceLot + (Store.data.models[l.model]?.priceHome || 0) <= max);
      $('#qOut').innerHTML = `<div class="q-big"><div><span>${t('quota.max')}</span><strong>${money(max)}</strong></div><div><span>${t('quota.pay')}</span><strong>${money(cap)}${t('lot.month')}</strong></div></div>
        <p class="q-fit ${fits.length ? 'ok' : ''}">${t('quota.fit', { n: fits.length })}</p>
        ${fits.length ? '' : `<p class="small muted">${LANG === 'en' ? 'Try a larger down payment or a longer term.' : 'Probá con una prima mayor o un plazo más largo.'}</p>`}
        <div class="minis">${fits.slice(0, 4).map(l => this.miniCard(l.code)).join('')}</div>
        ${fits.length ? `<button class="btn primary" id="qShow">${t('quota.show')}</button>` : ''}`;
      $$('#qOut .mini').forEach(el => el.onclick = () => { this.openTab('explore'); App.focusLot(el.dataset.code); });
      const b = $('#qShow'); if (b) b.onclick = () => { Filters.max = Math.floor(max / 1000) * 1000 || max; Filters.only = true; this.fillFilterOptions(Filters.max); Filters.sync(); this.openTab('explore'); App.overview(); };
      Track.bump('quota', true);
    };
    $$('#qForm input').forEach(i => i.addEventListener('input', calc)); $('#qForm').addEventListener('submit', e => e.preventDefault()); calc();
  },

  // ---- contacto ----
  tab_contact() {
    const p = App.project, stages = p.stages || DEFAULT_STAGES;
    const prog = s => ({ ...STAGE_PROGRESS_DEMO[s.id], ...(s.progress != null ? { progress: s.progress } : {}), ...(s.obra ? { obra: s.obra } : {}), ...(s.eta ? { eta: s.eta } : {}) });
    return `<h2>${t('c.title')}</h2><p class="muted">${t('c.lead')}</p>
      <div class="advisor"><div class="av">${esc((p.advisor || 'Asesor').slice(0, 1))}</div><div><b>${esc(p.advisor || 'Equipo comercial')}</b><small>${esc(p.hours || 'Lun–Sáb · 8:00–18:00 (El Salvador)')}</small></div></div>
      <div class="lc-row"><a class="btn whats big" href="${esc(this.whatsLink())}" target="_blank" rel="noopener" id="cWhats">${t('c.whats')}</a><button class="btn primary big" id="cBook">${t('c.book')}</button></div>
      <h3>${t('c.progress')}</h3>
      <div class="progress-list">${stages.map(s => { const g = prog(s); return `<div class="prog"><div class="prog-h"><b style="--sc:${esc(s.color)}">${esc(s.name)}</b><span>${g.progress || 0}%</span></div><div class="bar"><i style="width:${g.progress || 0}%;background:${esc(s.color)}"></i></div><small>${esc(g.obra || '')}${g.eta ? ` · ${LANG === 'en' ? 'est.' : 'entrega estimada'} ${esc(g.eta)}` : ''}</small></div>`; }).join('')}</div>
      <p class="small muted">${LANG === 'en' ? 'Sample progress until the developer updates it.' : 'Avance de ejemplo hasta que el desarrollador lo actualice.'}</p>
      <h3>${t('c.abroad')}</h3>
      <ol class="steps">${['c.a1', 'c.a2', 'c.a3', 'c.a4', 'c.a5'].map(k => `<li>${t(k)}</li>`).join('')}</ol>
      <h3>${t('c.reqs')}</h3>
      <ul class="checks">${['c.r1', 'c.r2', 'c.r3', 'c.r4'].map(k => `<li>${t(k)}</li>`).join('')}</ul>`;
  },
  bind_contact() { $('#cWhats').onclick = () => Track.bump('contact'); $('#cBook').onclick = () => this.openBooking(); },

  // ---- WhatsApp ----
  whatsLink(code) {
    const num = (App.project?.whatsapp || '').replace(/\D/g, '');
    let msg = LANG === 'en' ? 'Hello, I would like information about Valle de San Sebastián.' : 'Hola, me interesa Valle de San Sebastián.';
    if (code) { const I = UI.lotInfo(code); msg += LANG === 'en' ? ` Lot ${code}` : ` Lote ${code}`; if (I.model) msg += ` · ${I.model.name}`; if (I.inv) msg += ` · ${money(I.model ? I.priceTotal : I.priceLot)} (${money(this.pay(I.model ? I.priceTotal : I.priceLot))}${t('lot.month')})`; }
    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  },
  updateWhats() { const f = $('#fabWhats'); if (f) { f.href = this.whatsLink(UI.selectedLot); f.onclick = () => Track.bump('contact'); } },

  // ---- agendar visita o videollamada ----
  openBooking(code) {
    const d = new Date(); d.setDate(d.getDate() + 3);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    UI.modal(t('book.title'), `
      <form class="form two" id="bkForm">
        <label>${t('book.type')}<select id="bkType"><option value="video">${t('book.video')}</option><option value="visita">${t('book.visit')}</option></select></label>
        <label>${t('book.date')}<input id="bkDate" type="date" value="${d.toISOString().slice(0, 10)}" required></label>
        <label>${t('book.time')}<select id="bkTime">${['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'].map(h => `<option>${h}</option>`).join('')}</select></label>
        <label>${t('book.your')} <output id="bkLocal" class="mono"></output></label>
        <label>${t('form.name')}<input id="bkName" required autocomplete="name"></label>
        <label>${t('form.phone')}<input id="bkPhone" required inputmode="tel" autocomplete="tel"></label>
        <label>${t('form.country')}<select id="bkCountry"><option>El Salvador</option><option>Estados Unidos</option><option>Canadá</option><option>España</option><option>Otro</option></select></label>
        <label>${t('form.email')}<input id="bkEmail" type="email" autocomplete="email"></label>
        <div class="full modal-actions"><span class="err" id="bkErr"></span><button class="btn primary" type="submit">${t('book.send')}</button></div>
      </form>`);
    const upd = () => {
      // El Salvador = UTC−6 todo el año
      const [hh, mm] = $('#bkTime').value.split(':').map(Number);
      const utc = Date.parse($('#bkDate').value + 'T00:00:00Z') + (hh + 6) * 3600e3 + mm * 60e3;
      $('#bkLocal').textContent = new Date(utc).toLocaleString(LANG === 'en' ? 'en-US' : 'es-SV', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit' }) + ` (${tz})`;
    };
    $('#bkTime').onchange = upd; $('#bkDate').onchange = upd; upd();
    if (tz && tz.startsWith('America/') && !tz.includes('El_Salvador')) $('#bkCountry').value = 'Estados Unidos';
    $('#bkForm').addEventListener('submit', async e => {
      e.preventDefault();
      const r = { type: 'cita', mode: $('#bkType').value, date: $('#bkDate').value, time: $('#bkTime').value + ' (SV)', localTime: $('#bkLocal').textContent, name: $('#bkName').value.trim(), phone: $('#bkPhone').value.trim(), email: $('#bkEmail').value.trim(), country: $('#bkCountry').value, lot: code || UI.selectedLot || '', projectId: App.project.id, createdAt: Date.now(), status: 'nuevo', message: '' };
      if (!r.name || !r.phone) { $('#bkErr').textContent = t('form.need'); return; }
      try { await Store.addLead(r); Track.bump('booking'); Track.bump('contact'); UI.modal(t('book.title'), `<div class="empty-state ok"><p><b>${esc(r.mode === 'video' ? t('book.video') : t('book.visit'))}</b> · ${esc(r.date)} · ${esc(r.time)}</p><p>${esc(r.localTime)}</p></div><div class="modal-actions"><button class="btn primary" data-close>OK</button></div>`); }
      catch (err) { $('#bkErr').textContent = 'No se pudo registrar.'; }
    });
  },

  // ---- apartado en línea ----
  openReserve(code) {
    if (!code) return;
    const I = UI.lotInfo(code), dep = App.project.deposit || 300;
    UI.modal(t('res.title'), `
      <div class="res-head">${this.miniCard(code)}</div>
      <p class="muted">${t('res.lead')}</p>
      <div class="q-big"><div><span>${t('res.deposit')}</span><strong>${money(dep)}</strong></div><div><span>${I.model ? t('lot.total') : t('lot.only')}</span><strong>${money(I.model ? I.priceTotal : I.priceLot)}</strong></div></div>
      <form class="form two" id="rsForm">
        <label>${t('form.name')}<input id="rsName" required autocomplete="name"></label>
        <label>${t('form.phone')}<input id="rsPhone" required inputmode="tel" autocomplete="tel"></label>
        <label>${t('form.email')}<input id="rsEmail" type="email" autocomplete="email"></label>
        <label>${t('form.country')}<select id="rsCountry"><option>El Salvador</option><option>Estados Unidos</option><option>Canadá</option><option>España</option><option>Otro</option></select></label>
        <label class="full check"><input type="checkbox" id="rsOk" required> ${t('form.ok')}</label>
        <p class="full sim-note">${t('res.payNote')}</p>
        <div class="full modal-actions"><span class="err" id="rsErr"></span><button class="btn primary" type="submit">${t('res.send')}</button></div>
      </form>`);
    $('#rsForm').addEventListener('submit', async e => {
      e.preventDefault();
      const r = { type: 'apartado', lot: code, model: I.model?.id || '', deposit: dep, price: I.model ? I.priceTotal : I.priceLot, name: $('#rsName').value.trim(), phone: $('#rsPhone').value.trim(), email: $('#rsEmail').value.trim(), country: $('#rsCountry').value, projectId: App.project.id, createdAt: Date.now(), status: 'pendiente de pago', message: '' };
      if (!r.name || !r.phone) { $('#rsErr').textContent = t('form.need'); return; }
      try { await Store.addLead(r); Track.bump('reserve'); Track.bump('contact'); UI.modal(t('res.ok'), `<div class="empty-state ok"><p><b>${t('lot.lot')} ${esc(code)}</b> · ${money(dep)}</p><p>${t('res.okText')}</p></div><div class="modal-actions"><button class="btn" id="rsPdf">${t('lot.pdf')}</button><button class="btn primary" data-close>OK</button></div>`); $('#rsPdf').onclick = () => this.quotePdf(code); }
      catch (err) { $('#rsErr').textContent = 'No se pudo registrar.'; }
    });
  },

  // ---- cotización PDF ----
  async quotePdf(code) {
    const I = UI.lotInfo(code), m = I.model, price = m ? I.priceTotal : I.priceLot;
    if (!window.jspdf) { UI.toast(t('pdf.fail')); return; }
    await Thumbs.renderAll();
    try {
      const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'letter' });
      const L = LANG === 'en', W = 216, x = 18; let y = 20;
      doc.setFillColor(43, 63, 143); doc.rect(0, 0, W, 14, 'F');
      doc.setTextColor(255); doc.setFontSize(12); doc.text('Valle de San Sebastián', x, 9.5);
      doc.setFontSize(9); doc.text(L ? 'Quote · demo prototype' : 'Cotización · prototipo demostrativo', W - x, 9.5, { align: 'right' });
      doc.setTextColor(20, 40, 58); y = 26;
      doc.setFontSize(20); doc.text(`${L ? 'Lot' : 'Lote'} ${code}`, x, y); y += 7;
      doc.setFontSize(10); doc.setTextColor(95, 107, 115);
      doc.text(`${I.stage?.name || ''} · ${m ? `${m.name} · ${m.tagline || ''}` : (L ? 'Lot only' : 'Solo terreno')} · ${new Date().toLocaleDateString(L ? 'en-US' : 'es-SV')}`, x, y); y += 6;
      const img = Thumbs.get(m?.id || 'A'); if (img) { doc.addImage(img, 'JPEG', x, y, 112, 70); }
      let ry = y + 4; const rx = x + 120;
      const row = (k, v, big) => { doc.setFontSize(9); doc.setTextColor(95, 107, 115); doc.text(k, rx, ry); doc.setFontSize(big ? 15 : 11); doc.setTextColor(20, 40, 58); doc.text(v, rx, ry + (big ? 7 : 5.5)); ry += big ? 15 : 12; };
      row(L ? 'Home + lot' : 'Casa + terreno', money(price), true);
      row(L ? 'Lot area' : 'Área del terreno', `≈ ${I.area} m²`);
      if (m) row(L ? 'Built area' : 'Construcción', `${m.area} m² · ${m.bedrooms} ${L ? 'bed' : 'hab.'} · ${m.baths} ${L ? 'bath' : 'baño'}`);
      row(L ? 'Status' : 'Estado', this.stName(I.status));
      y += 78;
      doc.setFontSize(13); doc.setTextColor(20, 40, 58); doc.text(L ? 'Illustrative financing' : 'Financiamiento ilustrativo', x, y); y += 6;
      doc.setFontSize(9.5);
      const heads = L ? ['Down payment', 'Term', 'Rate', 'Monthly payment'] : ['Prima', 'Plazo', 'Tasa', 'Cuota mensual'];
      const cols = [x, x + 50, x + 90, x + 125];
      doc.setTextColor(95, 107, 115); heads.forEach((h, i) => doc.text(h, cols.at(i), y)); y += 2; doc.setDrawColor(220); doc.line(x, y, W - x, y); y += 6;
      doc.setTextColor(20, 40, 58);
      for (const [dp, yr] of [[10, 15], [10, 20], [10, 25], [20, 20]]) {
        const c = UI.calcLoan(price, dp, yr, LOAN.rate);
        [`${dp} % · ${money(c.down)}`, `${yr} ${L ? 'years' : 'años'}`, `${LOAN.rate} %`, money2(c.monthly)].forEach((v, i) => doc.text(v, cols.at(i), y)); y += 7;
      }
      y += 4; doc.setFontSize(13); doc.text(L ? 'Next steps' : 'Próximos pasos', x, y); y += 6; doc.setFontSize(9.5);
      [L ? 'Reserve online with a deposit of ' + money(App.project.deposit || 300) : 'Apartá en línea con un depósito de ' + money(App.project.deposit || 300),
       L ? 'Book a site visit or video call with your advisor' : 'Agendá una visita o videollamada con tu asesor',
       L ? 'Get pre-qualified with the lender' : 'Precalificá con la entidad financiera'].forEach(s => { doc.text('• ' + s, x, y); y += 6; });
      y += 4; doc.setFontSize(8); doc.setTextColor(120);
      doc.text(doc.splitTextToSize(L ? 'Demo prototype. Prices, homes, lot numbers and rates are illustrative and do not constitute a commercial offer. Final terms are set by the developer and the lender.' : 'Prototipo demostrativo. Precios, viviendas, numeración de lotes y tasas son ilustrativos y no constituyen oferta comercial. Las condiciones finales las definen el desarrollador y la entidad financiera.', W - 2 * x), x, y);
      const blob = doc.output('blob');
      Track.bump('pdf');
      const name = `cotizacion-${code}.pdf`;
      let saved = false;
      try { const dl = window.claude && await window.claude.use('downloads'); if (dl) { await dl.save({ filename: name, data: blob }); saved = true; } } catch (e) { }
      this.lastPdf = blob;
      UI.toast(saved ? t('pdf.done') : t('pdf.done') + (L ? ' (download not available in this view)' : ' (la descarga no está disponible en esta vista)'));
      return blob;
    } catch (e) { console.error(e); UI.toast(t('pdf.fail')); }
  },

  // ---- compartir ----
  shareUrl(code) { return `${App.project?.shareUrl || SHARE_BASE_DEFAULT}#lote-${code}`; },
  share(code) {
    const url = this.shareUrl(code);
    const msg = (LANG === 'en' ? 'Look at this home in Valle de San Sebastián: ' : 'Mirá esta casa en Valle de San Sebastián: ') + url;
    UI.modal(t('lot.share'), `<p class="mono small share-url">${esc(url)}</p><div class="modal-actions"><button class="btn" id="shCopy">${LANG === 'en' ? 'Copy link' : 'Copiar enlace'}</button><a class="btn whats" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${t('share.whats')}</a></div>`);
    $('#shCopy').onclick = () => { navigator.clipboard?.writeText(url).then(() => UI.toast(t('share.copied'))).catch(() => { const r = document.createRange(); r.selectNodeContents($('.share-url')); getSelection().removeAllRanges(); getSelection().addRange(r); }); };
    Track.bump('share');
  },
  routeHash() {
    const h = location.hash.slice(1);
    if (h.startsWith('lote-')) { const code = h.slice(5); if (Site.lotIndex.has(code)) { App.enterSite(); setTimeout(() => App.focusLot(code), 300); } }
    else if (h === 'admin' && Store.canEdit) Admin.open();
  },

  fillFilterOptions(force) {
    const steps = [0, 35000, 40000, 42000, 44000, 46000, 50000]; if (force && !steps.includes(force)) steps.push(force); steps.sort((a, b) => a - b);
    $('#fMax').innerHTML = steps.map(v => `<option value="${v}">${v ? money(v) : t('f.any')}</option>`).join('');
    $('#fModel').innerHTML = `<option value="">${t('f.all')}</option>` + Object.values(Store.data.models).map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');
    $('#fMax').value = String(Filters.max); $('#fModel').value = Filters.model;
  },
};

// Reemplaza la ficha de lote y conecta la nueva experiencia
UI.renderLot = function () { Shell.renderLot(); Shell.updateWhats(); };
const _origShowLot = UI.showLot.bind(UI);
UI.showLot = function (i) { if (!$('#sheet').hidden) Shell.openTab('explore'); _origShowLot(i); };
const _origCloseLot = UI.closeLot.bind(UI);
UI.closeLot = function () { document.body.classList.remove('lot-open'); _origCloseLot(); };
const _showLot2 = UI.showLot; UI.showLot = function (i) { _showLot2(i); if (i >= 0) document.body.classList.add('lot-open'); };
const _origSyncHouse = UI.syncHouseHeader.bind(UI);
UI.syncHouseHeader = function () { _origSyncHouse(); Shell.syncHouseFav(); applyI18n($('#houseUI')); const r = $('#hReserve'); if (r) r.hidden = UI.lotInfo(HouseViewer.lotCode).status !== 'disponible'; };

// Barra de progreso de la carga inicial
const Loader = {
  set(p, key) { const b = $('#loadBar'); if (b) b.style.width = p + '%'; const m = $('#loadMsg'); if (m && key) { m.dataset.i18n = key; m.textContent = t(key); } },
};
THREE.DefaultLoadingManager.onProgress = (url, loaded, total) => { if (!$('#loading').hidden) Loader.set(Math.min(95, 35 + 50 * loaded / Math.max(1, total))); };

// Presentación guiada en inglés (mismos pasos, mismo comportamiento)
const TOUR_EN = [
  ['Valle de San Sebastián', 'Affordable housing community in four phases. Everything here is live: rotate, zoom or tap any home.'],
  ['Four development phases', 'Each color is a phase of the project, as in the technical plan.'],
  ['Phase 1 · first release', 'Pick a phase, a block and a camera view. The camera flies there automatically.'],
  ['The street view', 'Pedestrian view: facades, walls, gates, driveways and front gardens.'],
  ['Central park', 'Kiosk, playground, lit paths and benches. Tap the area to see its card.'],
  ['Clubhouse, pool and court', 'Spaces you can book from the platform.'],
  ['Live availability', 'Green available, amber reserved, red sold. Admin changes show instantly.'],
  ['Choose your lot', 'Each lot shows its size, home model and a sample price.'],
  ['Meet your home', '52 m² home with two bedrooms. Switch the model and the decor.'],
  ['Dollhouse view', 'No roof, the whole layout. Tap a room to see its size and walk in.'],
  ['Walk through every room', 'Walk in first person through the living room, kitchen and bedrooms.'],
  ['Financing and contact', 'Estimate your monthly payment and send a request from El Salvador or abroad.'],
];
const _tourGo = Tour.go.bind(Tour);
Tour.go = async function (i) {
  const run = _tourGo(i);
  if (LANG === 'en' && TOUR_EN[i]) { $('#tourTitle').textContent = TOUR_EN[i][0]; $('#tourText').textContent = TOUR_EN[i][1]; }
  $('#tourPrev').textContent = t('tour.prev'); $('#tourNext').textContent = i === this.steps.length - 1 ? t('tour.end') : t('tour.next'); $('#tourAuto').textContent = t('tour.auto');
  await run;
};

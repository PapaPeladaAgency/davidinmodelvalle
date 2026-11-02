// ============================================================================
// 55-explore.js — Exploración por etapa → manzana, encuadres de cámara,
// etiquetas de lote, fichas de áreas comunes con reserva y presentación guiada
// ============================================================================

const Frame = {
  // Ubica la cámara sobre un objetivo {x, z, w, d} con un tipo de encuadre
  go(t, kind = 'aerea', dur = 1.6) {
    const c = App.siteControls, cam = App.camera;
    c.autoRotate = false;
    const s = Math.max(t.w || 30, (t.d || 30) * 1.15, 26);
    let pos, tgt = new THREE.Vector3(t.x, 0, t.z);
    if (kind === 'aerea') pos = new THREE.Vector3(t.x + s * 0.35, s * 0.95 + 30, t.z + s * 0.9 + 20);
    else if (kind === 'tres4') pos = new THREE.Vector3(t.x + s * 0.55, s * 0.42 + 14, t.z + s * 0.7 + 12);
    else if (kind === 'cenital') pos = new THREE.Vector3(t.x, s * 1.25 + 45, t.z + 0.5);
    else if (kind === 'calle' && t.eye) { pos = t.eye.clone(); tgt = t.look.clone(); }
    else if (kind === 'calle') { pos = new THREE.Vector3(t.x - (t.w || 20) * 0.32, 1.7, t.z + (t.d || 20) / 2 + 3.6); tgt = new THREE.Vector3(t.x + (t.w || 20) * 0.1, 2.2, t.z); }
    else if (kind === 'orbita') { pos = new THREE.Vector3(t.x + s * 0.6, s * 0.5 + 18, t.z + s * 0.6 + 14); }
    flyCamera(cam, c, pos, tgt, dur, () => { if (kind === 'orbita') { c.autoRotate = true; c.autoRotateSpeed = 0.7; } });
    Frame.last = { t, kind };
  },
  KINDS: [['aerea', 'Aérea'], ['tres4', 'Perspectiva'], ['cenital', 'Cenital'], ['calle', 'A nivel de calle'], ['orbita', 'Órbita 360°']],
};

Object.assign(UI, {
  explore: { stage: 0, block: null },

  // Reemplaza la selección de etapa: abre el explorador de la etapa
  selectStage(id) {
    Site.stageFilter = id; Site.focusBlock = null; this.explore = { stage: id, block: null };
    Site.refreshColors(); this.renderStageBar(); this.clearLotTags();
    if (!id) { this.closeExplorer(); App.overview(); return; }
    const c = Site.stageCenter(id); if (!c) return;
    Frame.go({ x: c.x, z: c.z, w: c.w, d: c.d }, 'aerea');
    this.renderExplorer();
  },
  selectBlock(block, kind = 'tres4') {
    Site.focusBlock = block; this.explore.block = block;
    Site.refreshColors();
    const bi = Site.blockInfo(block);
    Frame.go(kind === 'calle' ? streetTarget(bi) : bi.box, kind);
    this.renderExplorer(); this.makeLotTags(bi.lots);
  },
  frameCurrent(kind) {
    if (this.explore.block) { const bi = Site.blockInfo(this.explore.block); Frame.go(kind === 'calle' ? streetTarget(bi) : bi.box, kind); }
    else if (this.explore.stage) { const c = Site.stageCenter(this.explore.stage); Frame.go({ x: c.x, z: c.z, w: c.w, d: c.d }, kind); }
    else Frame.go({ x: -10, z: 70, w: 330, d: 260 }, kind);
    $$('[data-frame]').forEach(b => b.setAttribute('aria-pressed', b.dataset.frame === kind));
  },
  renderExplorer() {
    const box = $('#explorer'), st = (App.project.stages || DEFAULT_STAGES).find(s => s.id === this.explore.stage);
    if (!st) return this.closeExplorer();
    const inv = Store.data.lots;
    const blocks = [...new Set(Site.lots.filter(l => l.stage === st.id).map(l => l.block))];
    const stats = b => { const ls = Site.lots.filter(l => l.block === b); return { n: ls.length, d: ls.filter(l => inv[l.code]?.status === 'disponible').length }; };
    box.innerHTML = `
      <div class="ex-head"><nav class="crumbs"><button data-crumb="0">Residencial</button><span>›</span><button data-crumb="1" style="--sc:${esc(st.color)}">${esc(st.name)}</button>${this.explore.block ? `<span>›</span><b>Manzana ${esc(this.explore.block.split('-M')[1])}</b>` : ''}</nav>
        <button class="icon-btn" id="exClose" aria-label="Cerrar explorador">×</button></div>
      <p class="small muted">${esc(st.desc || '')}</p>
      <h4>Encuadre</h4>
      <div class="chips">${Frame.KINDS.map(([k, t]) => `<button class="chip" data-frame="${k}">${t}</button>`).join('')}</div>
      <h4>Manzanas de ${esc(st.name)}</h4>
      <div class="blocks">${blocks.map(b => { const x = stats(b); return `<button class="blk ${this.explore.block === b ? 'on' : ''}" data-block="${b}"><b>Manzana ${b.split('-M')[1]}</b><small>${x.n} lotes${x.d ? ` · <span class="ok">${x.d} disp.</span>` : ''}</small></button>`; }).join('')}</div>
      ${this.explore.block ? `<p class="small muted">Tocá un número de lote en el mapa para ver su ficha.</p>` : ''}`;
    box.hidden = false; document.body.classList.add('exploring');
    $('#exClose').onclick = () => this.selectStage(0);
    $$('[data-crumb]').forEach(b => b.onclick = () => b.dataset.crumb === '0' ? this.selectStage(0) : this.selectStage(st.id));
    $$('[data-frame]').forEach(b => b.onclick = () => this.frameCurrent(b.dataset.frame));
    $$('[data-block]').forEach(b => b.onclick = () => this.selectBlock(b.dataset.block));
  },
  closeExplorer() { $('#explorer').hidden = true; document.body.classList.remove('exploring'); },

  // ---- etiquetas de número de lote ----
  makeLotTags(lots) {
    this.clearLotTags();
    const inv = Store.data.lots, box = $('#lotTags');
    this.lotTags = lots.map(l => {
      const st = inv[l.code]?.status || 'fuera';
      const b = document.createElement('button'); b.className = 'lot-tag'; b.style.setProperty('--st', STATUS[st].color);
      b.textContent = 'L' + l.code.split('-L')[1]; b.title = `Lote ${l.code} · ${STATUS[st].label}`;
      b.onclick = () => UI.showLot(Site.lotIndex.get(l.code));
      box.appendChild(b);
      return { el: b, p: new THREE.Vector3(l.x, 5.5, l.z) };
    });
  },
  clearLotTags() { $('#lotTags').innerHTML = ''; this.lotTags = []; },
  updateLotTags(camera) {
    if (!this.lotTags?.length) return;
    const v = new THREE.Vector3(), far = camera.position.distanceTo(App.siteControls.target) > 260;
    const low = camera.position.y < 25;
    for (const t of this.lotTags) {
      v.copy(t.p).project(camera);
      const vis = !far && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 && (!low || camera.position.distanceTo(t.p) < 45);
      t.el.style.display = vis ? '' : 'none';
      if (vis) t.el.style.transform = `translate(-50%,-50%) translate(${(v.x * 0.5 + 0.5) * App.width}px,${(-v.y * 0.5 + 0.5) * App.height}px)`;
    }
  },

  // ---- áreas comunes ----
  showAmenity(id) {
    const a = amenityInfo(id); if (!a) return;
    this.selectedLot = null; Site.setSelected(-1);
    $('#lotBody').innerHTML = `
      <div class="lot-head"><span class="stage-pill" style="--sc:#5f9a45">${esc(a.type)}</span><span class="status-pill" style="--st:#16a34a">Área común</span></div>
      <h2 class="lot-code">${esc(a.name)}</h2>
      <p class="small">${esc(a.desc)}</p>
      <dl class="facts"><div><dt>Área aproximada</dt><dd>≈ ${a.area.toLocaleString('es-SV')} m² <em>referencial</em></dd></div><div><dt>Horario</dt><dd>${esc(a.hours)} <em>ilustrativo</em></dd></div></dl>
      <h4 class="sub">Equipamiento representado</h4>
      <ul class="equip">${a.equip.map(e => `<li>${esc(e)}</li>`).join('')}</ul>
      <h4 class="sub">Encuadre</h4>
      <div class="chips">${Frame.KINDS.map(([k, t]) => `<button class="chip" data-aframe="${k}">${t}</button>`).join('')}</div>
      <div class="lot-actions">${a.reservable.length ? a.reservable.map(r => `<button class="btn ${r === a.reservable[0] ? 'primary' : ''}" data-reserve="${esc(r)}">Reservar ${esc(r.toLowerCase())}</button>`).join('') : ''}
        <p class="example">Equipamiento y horarios ilustrativos, sujetos al diseño aprobado.</p></div>`;
    $('#lotPanel').hidden = false; requestAnimationFrame(() => $('#lotPanel').classList.add('open'));
    $$('[data-aframe]').forEach(b => b.onclick = () => { Frame.go(a.box, b.dataset.aframe); $$('[data-aframe]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
    $$('[data-reserve]').forEach(b => b.onclick = () => this.openReservation(a, b.dataset.reserve));
    Frame.go(a.box, 'tres4');
  },
  openReservation(a, space) {
    const today = new Date(); today.setDate(today.getDate() + 7);
    const d = today.toISOString().slice(0, 10);
    this.modal(`Reservar: ${space}`, `
      <p class="muted">${esc(a.name)} · reserva de prueba que queda registrada en Administración → Interesados.</p>
      <form id="resForm" class="form two">
        <label>Fecha<input id="rDate" type="date" value="${d}" required></label>
        <label>Horario<select id="rTime"><option>8:00 – 12:00</option><option>13:00 – 17:00</option><option>17:00 – 20:00</option></select></label>
        <label>Nombre<input id="rName" required autocomplete="name"></label>
        <label>Teléfono / WhatsApp<input id="rPhone" required inputmode="tel"></label>
        <label>Número de personas<input id="rPeople" type="number" min="1" max="150" value="20"></label>
        <label>Lote de residencia (si aplica)<input id="rLot" class="mono" placeholder="E1-M07-L05"></label>
        <label class="full">Motivo<textarea id="rMsg" rows="2" placeholder="Cumpleaños, reunión de vecinos…"></textarea></label>
        <div class="full modal-actions"><span id="resErr" class="err"></span><button class="btn primary" type="submit">Confirmar reserva de prueba</button></div>
      </form>`);
    $('#resForm').addEventListener('submit', async e => {
      e.preventDefault();
      const r = { type: 'reserva', amenity: a.id, space, projectId: App.project.id, createdAt: Date.now(), status: 'nuevo',
        date: $('#rDate').value, time: $('#rTime').value, name: $('#rName').value.trim(), phone: $('#rPhone').value.trim(),
        people: +$('#rPeople').value, lot: $('#rLot').value.trim(), message: $('#rMsg').value.trim(), country: '—', email: '' };
      if (!r.name || !r.phone) { $('#resErr').textContent = 'Escribí tu nombre y un teléfono.'; return; }
      try { await Store.addLead(r); this.modal('Reserva registrada', `<div class="empty-state ok"><p><b>${esc(space)}</b> · ${esc(r.date)} · ${esc(r.time)}</p><p>Quedó registrada como reserva de prueba en Administración → Interesados.</p></div><div class="modal-actions"><button class="btn primary" data-close>Seguir explorando</button></div>`); }
      catch (err) { $('#resErr').textContent = 'No se pudo registrar: tu acceso podría ser de solo lectura.'; }
    });
  },
});

// ============================================================================
// Presentación guiada: pasos sobre la aplicación en vivo (no es un video).
// Cada paso deja la app en un estado real; el cliente puede interactuar siempre.
// ============================================================================
const Tour = {
  i: -1, auto: false, timer: null,
  steps: [
    { t: 'Valle de San Sebastián', d: 'Residencial de vivienda de interés social en cuatro etapas. Todo lo que ves es navegable: girá, acercate o tocá cualquier casa.',
      run: async () => { await Tour.site(); Site.setColorMode('real'); UI.syncColorMode(); UI.selectStage(0); Frame.go({ x: -10, z: 70, w: 330, d: 260 }, 'orbita', 2.2); } },
    { t: 'Cuatro etapas de desarrollo', d: 'Cada color identifica una etapa del proyecto, tal como en el planteamiento técnico.',
      run: async () => { await Tour.site(); Site.setColorMode('stage'); UI.syncColorMode(); UI.selectStage(0); App.overview(); } },
    { t: 'Etapa 1 · primera fase', d: 'Seleccioná una etapa, elegí una manzana y un encuadre. La cámara se acerca automáticamente.',
      run: async () => { await Tour.site(); Site.setColorMode('real'); UI.syncColorMode(); UI.selectStage(1); } },
    { t: 'Así se ve la calle', d: 'Vista a nivel de peatón: fachadas, muros, portones, cocheras y jardines frontales.',
      run: async () => { await Tour.site(); UI.selectStage(1); await Tour.wait(300); UI.selectBlock('E1-M07', 'calle'); } },
    { t: 'Parque central', d: 'Quiosco, juegos infantiles, senderos iluminados y bancas. Tocá el área para ver su ficha.',
      run: async () => { await Tour.site(); UI.selectStage(0); UI.showAmenity('parque'); } },
    { t: 'Casa comunal, piscina y cancha', d: 'Espacios reservables desde la plataforma: salón, cancha y piscina.',
      run: async () => { await Tour.site(); UI.showAmenity('comunal'); await Tour.wait(1800); Frame.go(amenityInfo('comunal').box, 'orbita', 1.2); } },
    { t: 'Disponibilidad en tiempo real', d: 'Verde disponible, ámbar reservado, rojo vendido. Los cambios del panel administrativo se reflejan al instante.',
      run: async () => { await Tour.site(); UI.closeLot(); Site.setColorMode('status'); UI.syncColorMode(); UI.selectStage(0); App.overview(); } },
    { t: 'Elegí tu terreno', d: 'Cada lote muestra su área, el modelo de vivienda y un precio de ejemplo.',
      run: async () => { await Tour.site(); Site.setColorMode('real'); UI.syncColorMode(); App.focusLot(Tour.featured()); } },
    { t: 'Conocé tu casa', d: 'Vivienda de 52 m² con dos habitaciones. Podés cambiar el modelo y la decoración.',
      run: async () => { if (App.view !== 'house') { App.enterHouse(Tour.featured(), Store.data.lots[Tour.featured()]?.model || 'A'); await Tour.wait(900); } HouseViewer.setMaqueta(false); HouseViewer.setMode('exterior'); } },
    { t: 'Vista maqueta', d: 'Sin techo, con toda la distribución interior. Tocá un ambiente para ver sus medidas y entrar.',
      run: async () => { await Tour.house(); HouseViewer.setMaqueta(true); HouseViewer.setMode('open'); } },
    { t: 'Recorré cada ambiente', d: 'Caminá en primera persona por la sala, la cocina y las habitaciones.',
      run: async () => { await Tour.house(); HouseViewer.enterRoom('sala'); } },
    { t: 'Financiamiento y contacto', d: 'Simulá la cuota mensual y enviá una solicitud desde El Salvador o desde el exterior.',
      run: async () => { await Tour.house(); HouseViewer.setMode('exterior'); await Tour.wait(600); UI.openFinance(Tour.featured()); } },
  ],
  featured() { const f = Object.values(Store.data.lots).find(l => l.status === 'disponible' && l.model && l.stage === 1) || Object.values(Store.data.lots)[0]; return f?.code || Site.lots[0].code; },
  wait: ms => new Promise(r => setTimeout(r, ms)),
  async site() { UI.closeModal(); UI.closeLot(); if (App.view === 'house') { App.exitHouse(true); await Tour.wait(500); } if (App.view !== 'site') { App.enterSite(); await Tour.wait(200); } },
  async house() { UI.closeModal(); if (App.view !== 'house') { App.enterHouse(Tour.featured(), Store.data.lots[Tour.featured()]?.model || 'A'); await Tour.wait(900); } },
  start() { this.i = -1; $('#tour').hidden = false; document.body.classList.add('touring'); this.go(0); },
  stop() { this.i = -1; this.setAuto(false); $('#tour').hidden = true; document.body.classList.remove('touring'); App.siteControls.autoRotate = false; },
  async go(i) {
    if (i < 0 || i >= this.steps.length) return;
    this.i = i; const s = this.steps[i];
    $('#tourStep').textContent = `${i + 1} / ${this.steps.length}`;
    $('#tourTitle').textContent = s.t; $('#tourText').textContent = s.d;
    $('#tourPrev').disabled = i === 0; $('#tourNext').textContent = i === this.steps.length - 1 ? 'Finalizar' : 'Siguiente';
    $('#tourDots').innerHTML = this.steps.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
    try { await s.run(); } catch (e) { console.warn('tour', e); }
    this.schedule();
  },
  next() { if (this.i >= this.steps.length - 1) { this.stop(); UI.toast('Presentación finalizada. Seguí explorando libremente.'); } else this.go(this.i + 1); },
  prev() { this.go(this.i - 1); },
  setAuto(on) { this.auto = on; $('#tourAuto') && $('#tourAuto').setAttribute('aria-pressed', on); this.schedule(); },
  schedule() { clearTimeout(this.timer); if (this.auto && this.i >= 0) this.timer = setTimeout(() => this.next(), 8500); },
  userInteracted() { if (this.auto) { this.setAuto(false); UI.toast('Avance automático en pausa: seguí con “Siguiente” cuando quieras.'); } },
  init() {
    $('#btnTour').onclick = () => this.start();
    $('#tourNext').onclick = () => this.next(); $('#tourPrev').onclick = () => this.prev();
    $('#tourExit').onclick = () => this.stop(); $('#tourAuto').onclick = () => this.setAuto(!this.auto);
    App.canvas.addEventListener('pointerdown', () => this.userInteracted());
    App.siteControls.addEventListener('start', () => { App.siteControls.autoRotate = false; });
  },
};

// Punto de vista peatonal: en la calle, frente a la fila de casas, mirando a lo largo de la calle
function streetTarget(bi) {
  const ls = bi.lots; if (!ls.length) return bi.box;
  const f = ls[ls.length - 1].face, row = ls.filter(l => l.face[0] === f[0] && l.face[1] === f[1]);
  const along = [Math.abs(f[1]), Math.abs(f[0])];
  let mx = 0, mz = 0; row.forEach(l => { mx += l.x; mz += l.z; }); mx /= row.length; mz /= row.length;
  const span = row.reduce((m, l) => Math.max(m, Math.abs((l.x - mx) * along[0] + (l.z - mz) * along[1])), 0);
  const dep = row[0].depth;
  const fx = mx + f[0] * (dep / 2 + 3.2), fz = mz + f[1] * (dep / 2 + 3.2);
  const k = -Math.min(span, 30) * 0.8;
  const eye = new THREE.Vector3(fx + along[0] * k, 1.7, fz + along[1] * k);
  const look = new THREE.Vector3(mx + f[0] * (dep / 2 - 3) + along[0] * Math.min(span, 30) * 0.3, 2.4, mz + f[1] * (dep / 2 - 3) + along[1] * Math.min(span, 30) * 0.3);
  return { ...bi.box, eye, look };
}

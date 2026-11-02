// ============================================================================
// 50-ui.js — Interfaz del visitante: etapas, ficha de lote, vivienda,
// comparación, financiamiento, solicitud de información y plano original
// ============================================================================

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
const money2 = n => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }

const UI = {
  selectedLot: null, selectedRoom: null, compare: new Set(lsGet('vss-compare', [])),

  init() {
    $('#cta').addEventListener('click', () => App.enterSite());
    $('#heroPlano').addEventListener('click', () => this.openPlano());
    $('#btnPlano').addEventListener('click', () => this.openPlano());
    $('#btnCompare').addEventListener('click', () => this.openCompare());
    $('#btnAdmin').addEventListener('click', () => Admin.open());
    $('#btnHome').addEventListener('click', () => App.overview());
    $$('[data-color-mode]').forEach(b => b.addEventListener('click', () => {
      Site.setColorMode(b.dataset.colorMode);
      $$('[data-color-mode]').forEach(x => x.setAttribute('aria-pressed', x === b));
      this.renderLegend();
    }));
    $('#illus').addEventListener('change', e => { Site.showIllustrative = e.target.checked; Site.buildHouses(); });
    $('#overlayRange').addEventListener('input', e => Site.setOverlay(e.target.value / 100));
    $('#lotClose').addEventListener('click', () => this.closeLot());
    // vivienda
    $('#backToSite').addEventListener('click', () => App.exitHouse());
    $$('[data-hmode]').forEach(b => b.addEventListener('click', () => {
      const m = b.dataset.hmode;
      if (m === 'walk') { HouseViewer.mode === 'walk' ? null : (HouseViewer.mode === 'open' && this.selectedRoom ? HouseViewer.enterRoom(this.selectedRoom) : HouseViewer.enterFront()); }
      else HouseViewer.setMode(m);
    }));
    $('#decorChips').innerHTML = DECOR_STYLES.map(d => `<button class="chip" data-decor="${d.id}">${d.name}</button>`).join('');
    $$('[data-decor]').forEach(b => b.addEventListener('click', () => { HouseViewer.setDecor(b.dataset.decor); this.syncDecor(); this.toast(`Decoración: ${b.textContent}`); }));
    $('#modelSelect').addEventListener('change', e => { HouseViewer.model = Store.data.models[e.target.value]; HouseViewer.decor = HouseViewer.model.style || HouseViewer.decor; HouseViewer.rebuild(); HouseViewer.setMode(HouseViewer.mode === 'walk' ? 'exterior' : HouseViewer.mode); this.syncHouseHeader(); });
    $('#roomClose').addEventListener('click', () => this.closeRoom());
    $$('[data-maq]').forEach(b => b.addEventListener('click', () => { const on = b.dataset.maq === '1'; if (on && HouseViewer.mode === 'walk') HouseViewer.setMode('open'); HouseViewer.setMaqueta(on); }));
    $('#roomEnter').addEventListener('click', () => { if (this.selectedRoom) { HouseViewer.enterRoom(this.selectedRoom); this.closeRoom(); } });
    $('#exitOutside').addEventListener('click', () => HouseViewer.exitOutside());
    $('#walkOpen').addEventListener('click', () => HouseViewer.setMode('open'));
    $('#hFinance').addEventListener('click', () => this.openFinance(HouseViewer.lotCode));
    $('#hLead').addEventListener('click', () => this.openLead(HouseViewer.lotCode));
    $('#hCompare').addEventListener('click', () => { this.toggleCompare(HouseViewer.lotCode); });
    // modales
    document.addEventListener('click', e => { const c = e.target.closest('[data-close]'); if (c) this.closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) this.closeModal(); });
    this.renderLegend();
    this.updateCompareBadge();
  },

  // ---- etapas ----
  renderStageBar() {
    const p = App.project; if (!p) return;
    const stages = p.stages || DEFAULT_STAGES;
    const inv = Object.values(Store.data.lots).filter(l => l.projectId === p.id);
    $('#stageBar').innerHTML = `<button class="stage-btn" data-stage="0" aria-pressed="${!Site.stageFilter}"><span>${LANG === 'en' ? 'Whole project' : 'Todo el proyecto'}</span><small>${inv.length} ${LANG === 'en' ? 'lots with data' : 'lotes con datos'}</small></button>` +
      stages.map(s => {
        const n = inv.filter(l => l.stage === s.id && l.status === 'disponible').length;
        return `<button class="stage-btn" data-stage="${s.id}" style="--sc:${esc(s.color)}" aria-pressed="${Site.stageFilter === s.id}"><i></i><span>${esc(s.name)}</span><small>${n} ${LANG === 'en' ? 'available' : 'disponible' + (n === 1 ? '' : 's')}</small></button>`;
      }).join('');
    $$('#stageBar [data-stage]').forEach(b => b.addEventListener('click', () => this.selectStage(+b.dataset.stage)));
  },
  selectStage(id) {
    Site.stageFilter = id; Site.refreshColors(); this.renderStageBar();
    if (!id) { App.overview(); return; }
    const c = Site.stageCenter(id); if (!c) return;
    const span = Math.max(c.w, c.d * 1.3, 60);
    flyCamera(App.camera, App.siteControls, new THREE.Vector3(c.x + span * 0.35, span * 1.05 + 30, c.z + span * 0.95 + 20), new THREE.Vector3(c.x, 0, c.z), 1.6);
    const st = (App.project.stages || DEFAULT_STAGES).find(s => s.id === id);
    this.toast(`${st.name}: ${st.desc || ''}`.slice(0, 140));
  },

  renderLegend() {
    const L = $('#legend');
    if (Site.colorMode === 'stage' || Site.colorMode === 'real') {
      const st = (App.project?.stages || DEFAULT_STAGES);
      const en = LANG === 'en';
      L.innerHTML = `<b>${Site.colorMode === 'real' ? (en ? 'Realistic view · phases' : 'Vista realista · etapas') : (en ? 'Lot color: phase' : 'Color del terreno: etapa')}</b>` + st.map(s => `<span><i style="background:${esc(s.color)}"></i>${esc(s.name)}</span>`).join('') +
        `<b class="sep">${en ? 'Marker: availability' : 'Marcador: disponibilidad'}</b>` + Object.entries(STATUS).filter(([k]) => k !== 'fuera').map(([k, v]) => `<span><i class="dot" style="background:${v.color}"></i>${t('st.' + k)}</span>`).join('');
    } else {
      L.innerHTML = `<b>${LANG === 'en' ? 'Lot color: availability' : 'Color del terreno: disponibilidad'}</b>` + Object.entries(STATUS).map(([k, v]) => `<span><i style="background:${v.color}"></i>${t('st.' + k)}</span>`).join('');
    }
  },

  // ---- ficha de lote ----
  lotInfo(code) {
    const geo = Site.lots[Site.lotIndex.get(code)];
    const inv = Store.data.lots[code];
    const project = App.project;
    const stage = (project.stages || DEFAULT_STAGES).find(s => s.id === (inv?.stage || geo?.stage));
    // dentro de la vivienda, el modelo que se está viendo define el precio de la casa
    const model = App.view === 'house' && HouseViewer.lotCode === code ? HouseViewer.model : (inv?.model ? Store.data.models[inv.model] : null);
    const status = inv ? inv.status : 'fuera';
    const priceLot = inv?.priceLot || 0;
    const priceTotal = priceLot + (model?.priceHome || 0);
    return { code, geo, inv, stage, model, status, priceLot, priceTotal, area: inv?.area || geo?.area };
  },

  showLot(i) {
    if (i < 0) return this.closeLot();
    const l = Site.lots[i]; Site.setSelected(i);
    this.selectedLot = l.code;
    this.renderLot();
    $('#lotPanel').hidden = false;
    requestAnimationFrame(() => $('#lotPanel').classList.add('open'));
  },
  renderLot() {
    const code = this.selectedLot; if (!code) return;
    const I = this.lotInfo(code);
    const st = STATUS[I.status];
    const hasData = !!I.inv;
    const canBuy = I.status === 'disponible';
    $('#lotBody').innerHTML = `
      <div class="lot-head">
        <span class="stage-pill" style="--sc:${esc(I.stage?.color || '#999')}">${esc(I.stage?.name || '')}</span>
        <span class="status-pill" style="--st:${st.color}">${st.label}</span>
      </div>
      <h2 class="lot-code">Lote ${esc(code)}</h2>
      <p class="muted small">Numeración provisional del prototipo · no corresponde a números oficiales</p>
      <dl class="facts">
        <div><dt>Área del terreno</dt><dd>≈ ${I.area} m² <em>referencial</em></dd></div>
        <div><dt>Frente × fondo</dt><dd>≈ ${I.geo ? I.geo.front.toFixed(1) + ' × ' + I.geo.depth.toFixed(1) + ' m' : '—'}</dd></div>
        <div><dt>Vivienda</dt><dd>${I.model ? `${esc(I.model.name)} · ${esc(I.model.tagline || '')}` : 'Sin vivienda asignada'}</dd></div>
        ${I.model ? `<div><dt>Construcción</dt><dd>${I.model.area} m² · ${I.model.bedrooms} hab. · ${I.model.baths} baño</dd></div>` : ''}
      </dl>
      ${hasData ? `
      <div class="prices">
        <div><span>Solo terreno</span><strong>${money(I.priceLot)}</strong></div>
        ${I.model ? `<div class="main"><span>Terreno + vivienda</span><strong>${money(I.priceTotal)}</strong></div>` : ''}
        <p class="example">Precios de ejemplo para el prototipo. No constituyen oferta comercial.</p>
      </div>` : `<div class="empty-note">Este terreno aún no tiene información comercial. ${Store.canEdit ? 'Podés agregarlo al inventario desde Administración.' : ''}</div>`}
      ${I.inv?.notes ? `<p class="notes">${esc(I.inv.notes)}</p>` : ''}
      ${I.model && !I.model.approved ? `<p class="badge-demo">Modelo demostrativo · pendiente de aprobación</p>` : ''}
      <div class="lot-actions">
        <button class="btn primary" id="lotEnter">${I.model ? 'Entrar a la casa' : 'Ver con Modelo A (vista previa)'}</button>
        <div class="row">
          <button class="btn" id="lotFinance" ${hasData ? '' : 'disabled'}>Simular financiamiento</button>
          <button class="btn" id="lotCompare" ${hasData ? '' : 'disabled'}>${this.compare.has(code) ? 'Quitar de comparación' : 'Comparar'}</button>
        </div>
        <button class="btn ghost" id="lotLead">${canBuy ? 'Solicitar información' : 'Consultar disponibilidad similar'}</button>
        ${!hasData && Store.canEdit ? `<button class="btn ghost" id="lotAddInv">Agregar al inventario</button>` : ''}
      </div>`;
    $('#lotEnter').onclick = () => App.enterHouse(code, I.model?.id || 'A');
    $('#lotFinance').onclick = () => this.openFinance(code);
    $('#lotCompare').onclick = () => { this.toggleCompare(code); this.renderLot(); };
    $('#lotLead').onclick = () => this.openLead(code);
    const add = $('#lotAddInv'); if (add) add.onclick = () => Admin.addLotToInventory(code).then(() => this.renderLot());
  },
  closeLot() {
    $('#lotPanel').classList.remove('open'); Site.setSelected(-1); this.selectedLot = null;
    setTimeout(() => { if (!this.selectedLot) $('#lotPanel').hidden = true; }, 260);
  },

  // ---- vivienda ----
  syncHouseHeader() {
    const I = this.lotInfo(HouseViewer.lotCode);
    const m = HouseViewer.model;
    $('#houseTitle').textContent = `${m.name} · ${m.tagline || ''}`;
    $('#houseSub').textContent = `Lote ${HouseViewer.lotCode} · ${I.stage?.name || ''} · ${m.area} m² · ${I.inv ? 'Desde ' + money(I.priceLot + (m.priceHome || 0)) + ' (ejemplo)' : 'sin precio'}`;
    $('#modelSelect').innerHTML = Object.values(Store.data.models).filter(x => !x.projectId || x.projectId === App.project.id || true)
      .map(x => `<option value="${esc(x.id)}" ${x.id === m.id ? 'selected' : ''}>${esc(x.name)} · ${esc(x.tagline || '')}</option>`).join('');
    $('#hCompare').textContent = this.compare.has(HouseViewer.lotCode) ? 'En comparación ✓' : 'Comparar';
    this.syncDecor();
  },
  syncColorMode() { $$('[data-color-mode]').forEach(x => x.setAttribute('aria-pressed', x.dataset.colorMode === Site.colorMode)); this.renderLegend(); },
  syncMaqueta() { $$('[data-maq]').forEach(b => b.setAttribute('aria-pressed', (b.dataset.maq === '1') === HouseViewer.maqueta)); },
  syncDecor() { $$('[data-decor]').forEach(b => b.setAttribute('aria-pressed', b.dataset.decor === HouseViewer.decor)); },

  houseModeChanged(mode) {
    $$('[data-hmode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.hmode === mode));
    document.body.dataset.hmode = mode;
    $('#walkHud').hidden = mode !== 'walk';
    $('#roomTags').hidden = mode !== 'open';
    $('#openHint').hidden = mode !== 'open';
    if (mode !== 'open') this.closeRoom();
  },

  renderRoomTags() {
    const box = $('#roomTags'); box.innerHTML = '';
    if (!HouseViewer.house) return;
    this.roomTags = HouseViewer.house.rooms.map(r => {
      const b = document.createElement('button'); b.className = 'room-tag';
      b.innerHTML = `${esc(r.name)}<small>${r.area} m²</small>`;
      b.onclick = () => this.showRoomCard(r.id);
      box.appendChild(b);
      return { el: b, p: new THREE.Vector3(r.x + r.w / 2, 0.6, r.z + r.d / 2) };
    });
    $('#roomJump').innerHTML = HouseViewer.house.rooms.map(r => `<button class="chip" data-jump="${r.id}">${esc(r.name)}</button>`).join('');
    $$('[data-jump]').forEach(b => b.onclick = () => HouseViewer.enterRoom(b.dataset.jump));
  },
  updateRoomTags(camera) {
    if (!this.roomTags || HouseViewer.mode !== 'open') return;
    const v = new THREE.Vector3();
    for (const t of this.roomTags) {
      v.copy(t.p).project(camera);
      t.el.style.transform = `translate(-50%,-50%) translate(${(v.x * 0.5 + 0.5) * App.width}px,${(-v.y * 0.5 + 0.5) * App.height}px)`;
    }
  },
  showRoomCard(id) {
    const r = HouseViewer.house.rooms.find(q => q.id === id); if (!r) return;
    this.selectedRoom = id; HouseViewer.hoverRoom = null; HouseViewer.setHoverRoom(id);
    $('#roomCard').hidden = false;
    $('#roomName').textContent = r.name;
    $('#roomFacts').innerHTML = `<div><dt>Superficie aprox.</dt><dd>${r.area} m²</dd></div><div><dt>Dimensiones de referencia</dt><dd>${r.w.toFixed(2)} × ${r.d.toFixed(2)} m</dd></div><div><dt>Piso</dt><dd>${r.floor === 'tile' ? 'Cerámica' : 'Piso tipo madera'}</dd></div>`;
    $('#roomItems').innerHTML = r.items?.length ? [...new Set(r.items)].map(i => `<li>${esc(i)}${r.items.filter(x => x === i).length > 1 ? ` ×${r.items.filter(x => x === i).length}` : ''}</li>`).join('') : '<li class="muted">Sin mobiliario representado</li>';
    // acercar la cámara hacia el ambiente
    const c = new THREE.Vector3(r.x + r.w / 2, 0.3, r.z + r.d / 2);
    const off = App.camera.position.clone().sub(App.houseControls.target).setLength(9);
    off.y = Math.max(off.y, 6.5);
    flyCamera(App.camera, App.houseControls, c.clone().add(off), c, 0.9);
  },
  closeRoom() { $('#roomCard').hidden = true; this.selectedRoom = null; if (HouseViewer.house) HouseViewer.setHoverRoom(null); },
  setWalkRoom(name) { const el = $('#walkRoom'); if (el.textContent !== name) el.textContent = name; },

  // ---- comparación ----
  toggleCompare(code) {
    if (this.compare.has(code)) this.compare.delete(code);
    else { if (this.compare.size >= 3) { this.toast('Podés comparar hasta 3 opciones. Quitá una primero.'); return; } this.compare.add(code); this.toast(`Lote ${code} agregado a la comparación`); }
    lsSet('vss-compare', [...this.compare]); this.updateCompareBadge();
    if (App.view === 'house') this.syncHouseHeader();
  },
  updateCompareBadge() { $('#compareCount').textContent = this.compare.size; $('#compareCount').hidden = !this.compare.size; },
  openCompare() {
    const codes = [...this.compare].filter(c => Site.lotIndex.has(c));
    if (!codes.length) {
      this.modal('Comparar opciones', `<div class="empty-state"><p>Aún no agregaste opciones.</p><p class="muted">Seleccioná un terreno en el mapa y presioná <b>Comparar</b>. Podés comparar hasta 3.</p></div>`);
      return;
    }
    const rows = codes.map(c => this.lotInfo(c));
    const fin = I => this.calcLoan(I.priceTotal || I.priceLot, 10, 20, 7.5);
    const row = (label, f) => `<tr><th>${label}</th>${rows.map(I => `<td>${f(I)}</td>`).join('')}</tr>`;
    this.modal('Comparar opciones', `
      <div class="table-wrap"><table class="compare">
        <thead><tr><th></th>${rows.map(I => `<th><span class="stage-pill" style="--sc:${esc(I.stage?.color)}">${esc(I.stage?.name)}</span><div class="mono">${esc(I.code)}</div></th>`).join('')}</tr></thead>
        <tbody>
          ${row('Estado', I => `<span class="status-pill" style="--st:${STATUS[I.status].color}">${STATUS[I.status].label}</span>`)}
          ${row('Vivienda', I => I.model ? `${esc(I.model.name)}<br><small>${esc(I.model.tagline)}</small>` : '—')}
          ${row('Terreno', I => `≈ ${I.area} m²`)}
          ${row('Construcción', I => I.model ? `${I.model.area} m²` : '—')}
          ${row('Precio terreno', I => money(I.priceLot))}
          ${row('Terreno + vivienda', I => I.model ? `<b>${money(I.priceTotal)}</b>` : '—')}
          ${row('Cuota estimada*', I => money2(fin(I).monthly) + '/mes')}
          <tr><th></th>${rows.map(I => `<td class="cmp-actions"><button class="btn small primary" data-cmp-enter="${esc(I.code)}">Ver casa</button><button class="btn small ghost" data-cmp-remove="${esc(I.code)}">Quitar</button></td>`).join('')}</tr>
        </tbody></table></div>
      <p class="muted small">* Ejemplo: prima 10 %, 20 años, tasa anual ilustrativa 7.5 %. Precios de ejemplo.</p>`);
    $$('[data-cmp-enter]').forEach(b => b.onclick = () => { const I = this.lotInfo(b.dataset.cmpEnter); this.closeModal(); App.enterHouse(I.code, I.model?.id || 'A'); });
    $$('[data-cmp-remove]').forEach(b => b.onclick = () => { this.toggleCompare(b.dataset.cmpRemove); this.openCompare(); });
  },

  // ---- financiamiento ----
  calcLoan(price, downPct, years, rate) {
    const down = price * downPct / 100, P = price - down, n = years * 12, r = rate / 100 / 12;
    const monthly = r ? P * r / (1 - Math.pow(1 + r, -n)) : P / n;
    return { down, P, n, monthly, total: monthly * n + down, interest: monthly * n - P };
  },
  openFinance(code) {
    const I = this.lotInfo(code);
    const price = I.priceTotal || I.priceLot || 30000;
    this.modal('Simulación de precio y financiamiento', `
      <p class="muted">Lote <b class="mono">${esc(code)}</b> · ${esc(I.model ? I.model.name + ' — ' + I.model.tagline : 'Solo terreno')}</p>
      <div class="fin">
        <form id="finForm" class="form">
          <label>Precio (ejemplo, USD)<input id="fPrice" type="number" min="1000" step="100" value="${price}"></label>
          <label>Prima <output id="oDown">10 %</output><input id="fDown" type="range" min="0" max="40" step="1" value="10"></label>
          <label>Plazo <output id="oYears">20 años</output><input id="fYears" type="range" min="5" max="30" step="1" value="20"></label>
          <label>Tasa anual ilustrativa (%)<input id="fRate" type="number" min="0" max="20" step="0.1" value="7.5"></label>
          <label>Ingreso familiar mensual (opcional)<input id="fIncome" type="number" min="0" step="10" placeholder="Ej. 900"></label>
        </form>
        <div class="fin-out" id="finOut"></div>
      </div>
      <p class="muted small">Simulación ilustrativa con fórmula de cuota nivelada. No considera seguros, comisiones ni requisitos de instituciones financieras. Las tasas y condiciones reales deben consultarse con la entidad que otorgue el crédito.</p>
      <div class="modal-actions"><button class="btn primary" id="finLead">Solicitar información con esta simulación</button></div>`);
    const calc = () => {
      const p = +$('#fPrice').value || 0, d = +$('#fDown').value, y = +$('#fYears').value, r = +$('#fRate').value || 0;
      $('#oDown').textContent = d + ' %'; $('#oYears').textContent = y + ' años';
      const L = this.calcLoan(p, d, y, r); const inc = +$('#fIncome').value || 0;
      const ratio = inc ? L.monthly / inc : null;
      this.lastSim = { price: p, downPct: d, years: y, rate: r, monthly: +L.monthly.toFixed(2) };
      $('#finOut').innerHTML = `
        <div class="big"><span>Cuota mensual estimada</span><strong>${money2(L.monthly)}</strong></div>
        <dl class="facts">
          <div><dt>Prima</dt><dd>${money2(L.down)}</dd></div>
          <div><dt>Monto a financiar</dt><dd>${money2(L.P)}</dd></div>
          <div><dt>Número de cuotas</dt><dd>${L.n}</dd></div>
          <div><dt>Intereses totales</dt><dd>${money2(L.interest)}</dd></div>
          <div><dt>Costo total estimado</dt><dd>${money2(L.total)}</dd></div>
          <div><dt>Ingreso sugerido (cuota ≤ 30 %)</dt><dd>${money2(L.monthly / 0.3)}</dd></div>
        </dl>
        ${ratio != null ? `<div class="ratio ${ratio > 0.3 ? 'warn' : 'ok'}">La cuota representa el ${(ratio * 100).toFixed(0)} % del ingreso indicado.</div>` : ''}`;
    };
    $$('#finForm input').forEach(i => i.addEventListener('input', calc)); calc();
    $('#finForm').addEventListener('submit', e => e.preventDefault());
    $('#finLead').onclick = () => this.openLead(code, this.lastSim);
  },

  // ---- solicitud de información ----
  openLead(code, sim) {
    const I = this.lotInfo(code);
    this.modal('Solicitar información', `
      <p class="muted">Solicitud de prueba: queda registrada en el panel de Administración del prototipo.</p>
      <form id="leadForm" class="form two">
        <label>Nombre completo<input id="lName" required autocomplete="name"></label>
        <label>Teléfono / WhatsApp<input id="lPhone" required inputmode="tel" autocomplete="tel" placeholder="+503 7000 0000"></label>
        <label>Correo electrónico<input id="lEmail" type="email" autocomplete="email"></label>
        <label>País de residencia<select id="lCountry"><option>El Salvador</option><option>Estados Unidos</option><option>Canadá</option><option>España</option><option>Otro</option></select></label>
        <label>Lote de interés<input id="lLot" value="${esc(code || '')}" class="mono"></label>
        <label>Vivienda<select id="lModel"><option value="">Solo terreno</option>${Object.values(Store.data.models).map(m => `<option value="${esc(m.id)}" ${I.model?.id === m.id ? 'selected' : ''}>${esc(m.name)} · ${esc(m.tagline || '')}</option>`).join('')}</select></label>
        <label>Medio de contacto preferido<select id="lPref"><option>WhatsApp</option><option>Llamada</option><option>Correo</option><option>Videollamada</option></select></label>
        <label>Horario preferido<select id="lTime"><option>Mañana</option><option>Tarde</option><option>Noche</option><option>Fin de semana</option></select></label>
        <label class="full">Mensaje<textarea id="lMsg" rows="3" placeholder="Quiero conocer requisitos y opciones de financiamiento."></textarea></label>
        ${sim ? `<p class="full sim-note">Se adjunta la simulación: precio ${money(sim.price)}, prima ${sim.downPct} %, ${sim.years} años, cuota ${money2(sim.monthly)}/mes.</p>` : ''}
        <label class="full check"><input type="checkbox" id="lOk" required> Acepto que mis datos se usen solo para esta prueba del prototipo.</label>
        <div class="full modal-actions"><span id="leadErr" class="err" role="alert"></span><button class="btn primary" type="submit">Enviar solicitud</button></div>
      </form>`);
    $('#leadForm').addEventListener('submit', async e => {
      e.preventDefault();
      const lead = {
        projectId: App.project.id, createdAt: Date.now(), status: 'nuevo',
        name: $('#lName').value.trim(), phone: $('#lPhone').value.trim(), email: $('#lEmail').value.trim(),
        country: $('#lCountry').value, lot: $('#lLot').value.trim(), model: $('#lModel').value,
        pref: $('#lPref').value, time: $('#lTime').value, message: $('#lMsg').value.trim(), sim: sim || null,
      };
      if (!lead.name || !lead.phone) { $('#leadErr').textContent = 'Escribí tu nombre y un teléfono de contacto.'; return; }
      try {
        await Store.addLead(lead);
        this.modal('Solicitud registrada', `<div class="empty-state ok"><p><b>Gracias, ${esc(lead.name.split(' ')[0])}.</b></p><p>Tu solicitud de prueba quedó registrada en Administración → Interesados.</p><p class="muted small">En la versión final aquí se notificaría al equipo comercial.</p></div><div class="modal-actions"><button class="btn primary" data-close>Seguir explorando</button></div>`);
      } catch (err) {
        $('#leadErr').textContent = 'No se pudo registrar. Tu acceso a este prototipo podría ser solo de lectura; pedí acceso de colaborador.';
      }
    });
  },

  // ---- plano original ----
  openPlano() {
    const url = App.project?.refUrl || 'plano-original.jpg';
    this.modal('Plano original de referencia', `
      <div class="plano-tools">
        <div class="seg" role="group" aria-label="Vista">
          <button class="chip" data-pv="2d" aria-pressed="true">Referencia 2D</button>
          <button class="chip" data-pv="3d">Superponer sobre el 3D</button>
        </div>
      </div>
      <div class="plano-img"><img src="${esc(url)}" alt="Imagen de referencia del trabajo técnico de ${esc(App.project?.name || 'Valle de San Sebastián')}"></div>
      <p class="muted small">Referencia gráfica de trabajo técnico. No sustituye levantamientos topográficos, catastrales ni planos autorizados. El residencial 3D es una interpretación demostrativa.</p>`, 'wide');
    $$('[data-pv]').forEach(b => b.onclick = () => {
      if (b.dataset.pv === '3d') {
        this.closeModal();
        if (App.view !== 'site') App.enterSite();
        $('#overlayRange').value = 60; Site.setOverlay(0.6);
        App.topView();
        this.toast('Plano superpuesto al 60 %. Ajustalo con el control “Plano”.');
      }
    });
  },

  // ---- utilidades ----
  modal(title, html, size) {
    const m = $('#modal');
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = html;
    $('#modalBox').className = 'modal-box' + (size ? ' ' + size : '');
    m.hidden = false;
    const f = $('#modalBody input, #modalBody button'); f && setTimeout(() => f.focus(), 30);
  },
  closeModal() { $('#modal').hidden = true; $('#modalBody').innerHTML = ''; },
  toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('show'), 3200);
  },
};

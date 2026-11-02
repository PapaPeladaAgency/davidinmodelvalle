// ============================================================================
// 60-admin.js — Panel administrativo del prototipo
// Lotes · Etapas · Modelos · Interesados · Proyectos · Referencia y datos
// ============================================================================

const Admin = {
  tab: 'resumen', filters: { stage: 0, status: '', q: '' },

  open(tab) {
    if (tab) this.tab = tab;
    $('#admin').hidden = false;
    document.body.classList.add('admin-open');
    this.render();
  },
  close() { $('#admin').hidden = true; document.body.classList.remove('admin-open'); },

  ro() { return Store.mode === 'cloud' && !Store.canEdit; },

  // re-render seguro: no interrumpe si el usuario está escribiendo en el panel
  refresh() {
    if ($('#admin').hidden) return;
    const a = document.activeElement;
    if (a && $('#admin').contains(a) && a.matches('input,textarea,select')) { this._pending = true; return; }
    this.render();
  },

  render() {
    const tabs = [['resumen', 'Resumen'], ['lotes', 'Lotes'], ['etapas', 'Etapas'], ['modelos', 'Modelos de casa'], ['interesados', 'Interesados'], ['proyectos', 'Proyectos'], ['materiales', 'Materiales'], ['referencia', 'Referencia y datos']];
    $('#adminTabs').innerHTML = tabs.map(([k, t]) => `<button role="tab" aria-selected="${this.tab === k}" data-atab="${k}">${t}${k === 'interesados' ? ` <span class="count">${this.leads().filter(l => l.status === 'nuevo').length || ''}</span>` : ''}</button>`).join('');
    $$('[data-atab]').forEach(b => b.onclick = () => { this.tab = b.dataset.atab; this.render(); });
    $('#adminMode').innerHTML = Store.mode === 'cloud'
      ? `<span class="dot ok"></span>Datos compartidos en la nube${this.ro() ? ' · solo lectura' : ''}`
      : `<span class="dot warn"></span>Datos guardados en este navegador`;
    const body = $('#adminBody');
    body.innerHTML = this['tab_' + this.tab]();
    this['bind_' + this.tab] && this['bind_' + this.tab]();
    if (this.ro()) $$('#adminBody input, #adminBody select, #adminBody textarea, #adminBody button[data-write]').forEach(e => e.disabled = true);
  },

  projectLots() { return Object.entries(Store.data.lots).filter(([, l]) => l.projectId === App.project.id).map(([id, l]) => ({ id, ...l })); },
  leads() { return Object.entries(Store.data.leads).map(([id, l]) => ({ id, ...l })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); },
  stages() { return App.project.stages || DEFAULT_STAGES; },

  // ---------------- Resumen ----------------
  tab_resumen() {
    const lots = this.projectLots(), leads = this.leads().filter(l => l.projectId === App.project.id);
    const c = s => lots.filter(l => l.status === s).length;
    const value = lots.filter(l => l.status !== 'fuera').reduce((a, l) => a + (l.priceLot || 0) + (Store.data.models[l.model]?.priceHome || 0), 0);
    const sold = lots.filter(l => l.status === 'vendido').reduce((a, l) => a + (l.priceLot || 0) + (Store.data.models[l.model]?.priceHome || 0), 0);
    const totalLayout = App.project.hasLayout ? App.layoutLots.length : lots.length;
    const tiles = [
      ['Lotes en el trazado', totalLayout, 'Numeración provisional'],
      ['Lotes con datos comerciales', lots.length, `${Math.round(lots.length / Math.max(1, totalLayout) * 100)} % del trazado`],
      ['Disponibles', c('disponible'), ''], ['Reservados', c('reservado'), ''], ['Vendidos', c('vendido'), ''],
      ['Interesados', leads.length, `${leads.filter(l => l.status === 'nuevo').length} nuevos`],
      ['Valor del inventario', money(value), 'Precios de ejemplo'], ['Valor vendido', money(sold), 'Precios de ejemplo'],
    ];
    const bars = this.stages().map(s => {
      const ls = lots.filter(l => l.stage === s.id), n = Math.max(1, ls.length);
      const seg = ['disponible', 'reservado', 'vendido', 'fuera'].map(k => { const v = ls.filter(l => l.status === k).length; return v ? `<i style="width:${v / n * 100}%;background:${STATUS[k].color}" title="${STATUS[k].label}: ${v}"></i>` : ''; }).join('');
      return `<div class="sbar"><span><b style="--sc:${esc(s.color)}"></b>${esc(s.name)}</span><div class="track">${seg || '<em>sin lotes</em>'}</div><small>${ls.length}</small></div>`;
    }).join('');
    const byCountry = {}; leads.forEach(l => byCountry[l.country] = (byCountry[l.country] || 0) + 1);
    return `
      <div class="tiles">${tiles.map(([k, v, s]) => `<div class="tile"><span>${k}</span><strong>${v}</strong>${s ? `<small>${s}</small>` : ''}</div>`).join('')}</div>
      <div class="cols">
        <section class="card"><h3>Disponibilidad por etapa</h3>${bars}
          <div class="legend-inline">${Object.entries(STATUS).map(([k, v]) => `<span><i style="background:${v.color}"></i>${v.label}</span>`).join('')}</div></section>
        <section class="card"><h3>Embudo de la web app</h3><div id="funnel"><p class="muted small">Cargando…</p></div></section>
        <section class="card"><h3>Interesados por país de residencia</h3>${Object.keys(byCountry).length ? Object.entries(byCountry).map(([k, v]) => `<div class="kv"><span>${esc(k)}</span><b>${v}</b></div>`).join('') : '<p class="muted">Aún no hay solicitudes. Enviá una desde la ficha de un lote para probar el flujo.</p>'}
          <h3 class="mt">Últimas solicitudes</h3>${leads.slice(0, 4).map(l => `<div class="kv"><span>${esc(l.name)} · <span class="mono">${esc(l.lot)}</span></span><small>${new Date(l.createdAt).toLocaleString('es-SV')}</small></div>`).join('') || '<p class="muted">—</p>'}
        </section>
      </div>`;
  },

  bind_resumen() {
    Track.loadAll().then(rows => {
      const sum = k => rows.reduce((a, r) => a + ((r.counts || {})[k] ? 1 : 0), 0);
      const steps = [['visit', 'Visitaron'], ['lot_open', 'Abrieron un lote'], ['house_enter', 'Entraron a una casa'], ['quota', 'Calcularon su cuota'], ['contact', 'Contactaron'], ['reserve', 'Pidieron apartar']];
      const n0 = Math.max(1, sum('visit'));
      const el = $('#funnel'); if (!el) return;
      el.innerHTML = steps.map(([k, label]) => { const n = sum(k); return `<div class="sbar"><span>${label}</span><div class="track"><i style="width:${Math.round(n / n0 * 100)}%;background:var(--anil)"></i></div><small>${n}</small></div>`; }).join('') +
        `<p class="muted small">Visitantes únicos por paso${Store.mode === 'cloud' ? '' : ' (solo este navegador en modo local)'}.</p>`;
    });
  },
  exportCsv() {
    const leads = this.leads();
    const cols = ['createdAt', 'type', 'status', 'name', 'phone', 'email', 'country', 'lot', 'model', 'deposit', 'date', 'time', 'space', 'message'];
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.join(',')].concat(leads.map(l => cols.map(c => q(c === 'createdAt' ? new Date(l.createdAt).toISOString() : l[c])).join(','))).join('\n');
    (async () => { try { const dl = await window.claude?.use('downloads'); if (dl) { await dl.save({ filename: 'interesados-valle-san-sebastian.csv', data: csv }); return; } } catch (e) { }
      UI.modal('Exportación CSV', `<p class="muted small">La descarga no está disponible en esta vista. Copiá el texto:</p><textarea class="json" rows="12" readonly>${esc(csv)}</textarea>`); })();
  },

  // ---------------- Lotes ----------------
  tab_lotes() {
    const f = this.filters;
    let lots = this.projectLots().sort((a, b) => a.code.localeCompare(b.code));
    if (f.stage) lots = lots.filter(l => l.stage === f.stage);
    if (f.status) lots = lots.filter(l => l.status === f.status);
    if (f.q) lots = lots.filter(l => (l.code + ' ' + (l.notes || '')).toLowerCase().includes(f.q.toLowerCase()));
    const models = Object.values(Store.data.models);
    const inInv = new Set(this.projectLots().map(l => l.code));
    const blocks = App.project.hasLayout ? [...new Set(App.layoutLots.map(l => l.block))] : [];
    return `
      <div class="toolbar">
        <label>Etapa<select id="fStage"><option value="0">Todas</option>${this.stages().map(s => `<option value="${s.id}" ${f.stage === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
        <label>Estado<select id="fStatus"><option value="">Todos</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
        <label class="grow">Buscar<input id="fQ" value="${esc(f.q)}" placeholder="Código o nota"></label>
      </div>
      <div class="table-wrap"><table class="admin-table">
        <thead><tr><th>Lote</th><th>Etapa</th><th>Estado</th><th>Precio terreno (ej.)</th><th>Modelo de casa</th><th>Total (ej.)</th><th>Notas</th><th></th></tr></thead>
        <tbody>${lots.map(l => `<tr data-lot="${esc(l.id)}">
          <td class="mono">${esc(l.code)}</td>
          <td><span class="stage-pill" style="--sc:${esc((this.stages().find(s => s.id === l.stage) || {}).color)}">${l.stage}</span></td>
          <td><select data-f="status" aria-label="Estado">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${l.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></td>
          <td><input data-f="priceLot" type="number" step="100" min="0" value="${l.priceLot || 0}" aria-label="Precio"></td>
          <td><select data-f="model" aria-label="Modelo"><option value="">Sin vivienda</option>${models.map(m => `<option value="${esc(m.id)}" ${l.model === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></td>
          <td class="mono">${money((l.priceLot || 0) + (Store.data.models[l.model]?.priceHome || 0))}</td>
          <td><input data-f="notes" value="${esc(l.notes || '')}" aria-label="Notas"></td>
          <td class="actions"><button class="btn small" data-goto="${esc(l.code)}">Ver</button><button class="btn small ghost" data-write data-del="${esc(l.id)}">Quitar</button></td>
        </tr>`).join('') || `<tr><td colspan="8" class="muted">No hay lotes con estos filtros.</td></tr>`}</tbody>
      </table></div>
      <section class="card mt">
        <h3>Agregar terrenos al inventario</h3>
        ${App.project.hasLayout ? `
        <p class="muted small">Elegí un lote del trazado (también podés tocarlo en el mapa y usar “Agregar al inventario”). Para ampliar el inventario por bloques, agregá una manzana completa.</p>
        <div class="toolbar">
          <label>Manzana<select id="addBlock">${blocks.map(b => `<option>${b}</option>`).join('')}</select></label>
          <label>Lote<select id="addLot"></select></label>
          <button class="btn primary" data-write id="addOne">Agregar lote</button>
          <button class="btn" data-write id="addBlockAll">Agregar manzana completa</button>
        </div>` : `
        <p class="muted small">Este proyecto aún no tiene trazado 3D. Los lotes se ubican en una cuadrícula demostrativa.</p>
        <div class="toolbar">
          <label>Código<input id="newCode" placeholder="E1-M01-L01"></label>
          <label>Etapa<select id="newStage">${this.stages().map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label>
          <label>Área (m²)<input id="newArea" type="number" value="120"></label>
          <button class="btn primary" data-write id="addManual">Agregar terreno</button>
        </div>`}
        <p class="muted small">${inInv.size} de ${App.project.hasLayout ? App.layoutLots.length : inInv.size} lotes tienen información comercial.</p>
      </section>`;
  },
  bind_lotes() {
    $('#fStage').onchange = e => { this.filters.stage = +e.target.value; this.render(); };
    $('#fStatus').onchange = e => { this.filters.status = e.target.value; this.render(); };
    $('#fQ').oninput = e => { this.filters.q = e.target.value; clearTimeout(this._q); this._q = setTimeout(() => { this.render(); $('#fQ').focus(); const v = $('#fQ').value; $('#fQ').setSelectionRange(v.length, v.length); }, 250); };
    $$('[data-lot] [data-f]').forEach(inp => inp.addEventListener('change', async () => {
      const id = inp.closest('[data-lot]').dataset.lot;
      let v = inp.value; if (inp.type === 'number') v = +v; if (inp.dataset.f === 'model') v = v || null;
      await this.save('lots', id, { [inp.dataset.f]: v });
      inp.blur();
    }));
    $$('[data-del]').forEach(b => b.onclick = () => this.confirmInline(b, '¿Quitar del inventario?', () => Store.remove('lots', b.dataset.del).then(() => UI.toast('Lote quitado del inventario'))));
    $$('[data-goto]').forEach(b => b.onclick = () => { this.close(); App.focusLot(b.dataset.goto); });
    const inInv = new Set(this.projectLots().map(l => l.code));
    const fill = () => {
      const blk = $('#addBlock')?.value; if (!blk) return;
      const opts = App.layoutLots.filter(l => l.block === blk && !inInv.has(l.code));
      $('#addLot').innerHTML = opts.map(l => `<option>${l.code}</option>`).join('') || '<option value="">Todos agregados</option>';
    };
    if ($('#addBlock')) {
      $('#addBlock').onchange = fill; fill();
      $('#addOne').onclick = () => { const c = $('#addLot').value; if (c) this.addLotToInventory(c); };
      $('#addBlockAll').onclick = async () => {
        const blk = $('#addBlock').value;
        const list = App.layoutLots.filter(l => l.block === blk && !inInv.has(l.code));
        UI.toast(`Agregando ${list.length} lotes…`);
        for (const l of list) await this.addLotToInventory(l.code, true);
        UI.toast(`Manzana ${blk}: ${list.length} lotes agregados`);
      };
    }
    if ($('#addManual')) $('#addManual').onclick = async () => {
      const code = $('#newCode').value.trim().toUpperCase(); if (!code) return UI.toast('Escribí un código para el terreno');
      await this.save('lots', code, { projectId: App.project.id, code, stage: +$('#newStage').value, area: +$('#newArea').value, status: 'disponible', priceLot: 12000, model: null, notes: 'Terreno agregado desde el panel.' });
      UI.toast(`Terreno ${code} agregado`);
    };
  },
  async addLotToInventory(code, quiet) {
    const g = App.layoutLots.find(l => l.code === code) || Site.lots[Site.lotIndex.get(code)];
    if (!g) return;
    const priceLot = Math.round((9500 + g.area * 28 + (4 - g.stage) * 600) / 100) * 100;
    await this.save('lots', code, { projectId: App.project.id, code, stage: g.stage, status: 'disponible', priceLot, model: null, notes: 'Agregado desde el panel. Precio de ejemplo.' });
    if (!quiet) UI.toast(`Lote ${code} agregado al inventario`);
  },

  // ---------------- Etapas ----------------
  tab_etapas() {
    return `<p class="muted">Los colores de etapa identifican el desarrollo del proyecto y son independientes de la disponibilidad comercial.</p>
      <div class="grid-cards">${this.stages().map((s, i) => `
        <section class="card" data-stage-i="${i}">
          <div class="card-head"><input type="color" data-sf="color" value="${esc(s.color)}" aria-label="Color"><input data-sf="name" value="${esc(s.name)}" aria-label="Nombre" class="title-input"></div>
          <label>Descripción<textarea data-sf="desc" rows="3">${esc(s.desc || '')}</textarea></label>
          <label class="check"><input type="checkbox" data-sf="selling" ${s.selling !== false ? 'checked' : ''}> En comercialización</label>
          <div class="form two"><label>Avance de obra (%)<input type="number" min="0" max="100" data-sf="progress" value="${s.progress ?? (STAGE_PROGRESS_DEMO[s.id]?.progress ?? 0)}"></label><label>Entrega estimada<input type="month" data-sf="eta" value="${esc(s.eta || STAGE_PROGRESS_DEMO[s.id]?.eta || '')}"></label>
          <label class="full">Fase de obra<input data-sf="obra" value="${esc(s.obra || STAGE_PROGRESS_DEMO[s.id]?.obra || '')}"></label></div>
          <p class="muted small">${this.projectLots().filter(l => l.stage === s.id).length} lotes con datos · ${App.project.hasLayout ? App.layoutLots.filter(l => l.stage === s.id).length + ' en el trazado' : ''}</p>
        </section>`).join('')}</div>
      <div class="modal-actions"><button class="btn" data-write id="addStage">Agregar etapa</button><button class="btn primary" data-write id="saveStages">Guardar etapas</button></div>`;
  },
  bind_etapas() {
    const collect = () => $$('[data-stage-i]').map((c, i) => ({ ...this.stages()[i], name: $('[data-sf=name]', c).value, color: $('[data-sf=color]', c).value, desc: $('[data-sf=desc]', c).value, selling: $('[data-sf=selling]', c).checked, progress: +$('[data-sf=progress]', c).value, eta: $('[data-sf=eta]', c).value, obra: $('[data-sf=obra]', c).value }));
    $('#saveStages').onclick = async () => { await this.save('projects', App.project.id, { stages: collect() }); UI.toast('Etapas guardadas'); };
    $('#addStage').onclick = async () => {
      const st = collect(); const id = Math.max(0, ...st.map(s => s.id)) + 1;
      st.push({ id, name: `Etapa ${id}`, color: '#9b8ad6', desc: 'Nueva etapa (pendiente de trazado).', selling: false });
      await this.save('projects', App.project.id, { stages: st }); UI.toast(`Etapa ${id} creada`);
    };
  },

  // ---------------- Modelos ----------------
  tab_modelos() {
    const ms = Object.values(Store.data.models).sort((a, b) => a.id.localeCompare(b.id));
    return `<p class="muted">Modelos demostrativos. Cada uno se genera desde un plano en formato JSON (ambientes, muros, aberturas y mobiliario), que puede sustituirse por la distribución autorizada sin cambiar el visor.</p>
      <div class="grid-cards">${ms.map(m => `
      <section class="card" data-model="${esc(m.id)}">
        <div class="card-head"><span class="mono id">${esc(m.id)}</span><input data-mf="name" value="${esc(m.name)}" class="title-input" aria-label="Nombre"></div>
        <div class="form two">
          <label>Descripción corta<input data-mf="tagline" value="${esc(m.tagline || '')}"></label>
          <label>Decoración predeterminada<select data-mf="style">${DECOR_STYLES.map(d => `<option value="${d.id}" ${m.style === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}</select></label>
          <label>Área (m²)<input data-mf="area" type="number" step="0.5" value="${m.area}"></label>
          <label>Precio vivienda (ej.)<input data-mf="priceHome" type="number" step="100" value="${m.priceHome}"></label>
          <label>Habitaciones<input data-mf="bedrooms" type="number" value="${m.bedrooms}"></label>
          <label>Baños<input data-mf="baths" type="number" value="${m.baths}"></label>
          <label>Techo<select data-mf="facade.roof">${[['gable', 'Dos aguas'], ['flat', 'Plano con pretil'], ['shed', 'Inclinado oculto']].map(([k, t]) => `<option value="${k}" ${m.facade?.roof === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <div class="swatches">${[['wall', 'Fachada'], ['accent', 'Acento'], ['trim', 'Marcos'], ['roofColor', 'Techo']].map(([k, t]) => `<label>${t}<input type="color" data-mf="facade.${k}" value="${esc(m.facade?.[k] || '#cccccc')}"></label>`).join('')}</div>
          <label class="full">Descripción<textarea data-mf="description" rows="2">${esc(m.description || '')}</textarea></label>
          <label class="full check"><input type="checkbox" data-mf="approved" ${m.approved ? 'checked' : ''}> Aprobado para comercialización</label>
        </div>
        <details><summary>Plano (JSON) — ${(m.plan?.rooms || []).length} ambientes, ${(m.plan?.walls || []).length} muros, ${(m.plan?.furniture || []).length} muebles</summary>
          <textarea class="json" data-plan rows="12" spellcheck="false">${esc(JSON.stringify(m.plan || PLAN_52, null, 1))}</textarea>
          <div class="row"><button class="btn small" data-write data-plan-save>Validar y guardar plano</button><button class="btn small ghost" data-write data-plan-reset>Restaurar plano demostrativo</button><span class="err" data-plan-err></span></div>
        </details>
        <div class="row mt"><button class="btn primary small" data-write data-model-save>Guardar</button><button class="btn small" data-model-view>Ver en 3D</button>
          <span class="muted small">${this.projectLots().filter(l => l.model === m.id).length} lotes asociados</span></div>
      </section>`).join('')}</div>
      <div class="modal-actions"><button class="btn" data-write id="addModel">Crear modelo (copia del Modelo A)</button></div>`;
  },
  bind_modelos() {
    $$('[data-model]').forEach(card => {
      const id = card.dataset.model;
      $('[data-model-save]', card).onclick = async () => {
        const m = JSON.parse(JSON.stringify(Store.data.models[id]));
        $$('[data-mf]', card).forEach(i => {
          let v = i.type === 'checkbox' ? i.checked : i.type === 'number' ? +i.value : i.value;
          const k = i.dataset.mf;
          if (k.startsWith('facade.')) { m.facade = m.facade || {}; m.facade[k.slice(7)] = v; } else m[k] = v;
        });
        await this.save('models', id, m, true); UI.toast(`${m.name} guardado`);
      };
      $('[data-model-view]', card).onclick = () => { this.close(); const lot = this.projectLots().find(l => l.model === id); App.enterHouse(lot?.code || (Site.lots[0]?.code), id); };
      $('[data-plan-save]', card).onclick = async () => {
        const err = $('[data-plan-err]', card);
        try {
          const plan = JSON.parse($('[data-plan]', card).value);
          if (!(plan.width > 0 && plan.depth > 0 && Array.isArray(plan.rooms) && Array.isArray(plan.walls))) throw new Error('Faltan width, depth, rooms o walls.');
          plan.rooms.forEach(r => { if (!(r.id && r.name && r.w > 0 && r.d > 0)) throw new Error(`Ambiente inválido: ${JSON.stringify(r).slice(0, 60)}`); });
          await this.save('models', id, { plan }); err.textContent = ''; UI.toast('Plano guardado. Se usará al abrir la vivienda.');
        } catch (e) { err.textContent = 'JSON no válido: ' + e.message; }
      };
      $('[data-plan-reset]', card).onclick = async () => { await this.save('models', id, { plan: JSON.parse(JSON.stringify(PLAN_52)) }); UI.toast('Plano demostrativo restaurado'); };
    });
    $('#addModel').onclick = async () => {
      const ids = Object.keys(Store.data.models); let n = 'D'; for (const c of 'DEFGHIJKLMNOPQRSTUVWXYZ') if (!ids.includes(c)) { n = c; break; }
      const base = JSON.parse(JSON.stringify(Store.data.models.A || { ...DEFAULT_MODELS.A, plan: PLAN_52 }));
      await this.save('models', n, { ...base, id: n, name: `Modelo ${n}`, tagline: 'Nuevo modelo', approved: false }, true);
      UI.toast(`Modelo ${n} creado`);
    };
  },

  // ---------------- Interesados ----------------
  tab_interesados() {
    if (Store.mode === 'cloud' && !Store.canEdit) return `<p class="muted">Solo quienes administran el prototipo pueden ver las solicitudes.</p>`;
    const leads = this.leads();
    if (!leads.length) return `<div class="empty-state"><p>Aún no hay solicitudes de información.</p><p class="muted">Seleccioná un lote en el mapa → <b>Solicitar información</b>. La solicitud aparecerá aquí.</p></div>`;
    return `<div class="toolbar"><button class="btn" id="leadsCsv">Exportar CSV</button><span class="muted small">${leads.length} registros · solicitudes, citas, apartados y reservas</span></div><div class="table-wrap"><table class="admin-table">
      <thead><tr><th>Fecha</th><th>Nombre</th><th>Contacto</th><th>Reside en</th><th>Lote / vivienda</th><th>Simulación</th><th>Mensaje</th><th>Estado</th><th></th></tr></thead>
      <tbody>${leads.map(l => `<tr data-lead="${esc(l.id)}">
        <td><small>${new Date(l.createdAt).toLocaleString('es-SV')}</small></td>
        <td><b>${esc(l.name)}</b></td>
        <td><small>${esc(l.phone)}<br>${esc(l.email)}<br>Prefiere: ${esc(l.pref)} · ${esc(l.time || '')}</small></td>
        <td>${esc(l.country)}</td>
        <td class="mono">${l.type === 'apartado' ? `<b>Apartado</b><br><button class="linkish" data-goto="${esc(l.lot)}">${esc(l.lot)}</button><br><small>Depósito ${money(l.deposit)}</small>${l.status !== 'confirmado' ? `<br><button class="btn small" data-write data-confirm="${esc(l.id)}" data-lot="${esc(l.lot)}">Confirmar apartado</button>` : ''}` : l.type === 'cita' ? `<b>${l.mode === 'video' ? 'Videollamada' : 'Visita'}</b><br><small>${esc(l.date)} · ${esc(l.time)}<br>${esc(l.localTime || '')}</small>` : l.type === 'reserva' ? `<b>Reserva</b><br><small>${esc(l.space)} · ${esc(l.date)} · ${esc(l.time)} · ${l.people || ''} pers.</small>` : `<button class="linkish" data-goto="${esc(l.lot)}">${esc(l.lot)}</button><br><small>${esc(Store.data.models[l.model]?.name || 'Solo terreno')}</small>`}</td>
        <td><small>${l.sim ? `${money(l.sim.price)} · ${l.sim.years} años<br>${money2(l.sim.monthly)}/mes` : '—'}</small></td>
        <td><small>${esc(l.message || '')}</small></td>
        <td><select data-lf="status">${['nuevo', 'contactado', 'en seguimiento', 'pendiente de pago', 'confirmado', 'cerrado'].map(s => `<option ${l.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
        <td><button class="btn small ghost" data-write data-ldel="${esc(l.id)}">Eliminar</button></td>
      </tr>`).join('')}</tbody></table></div>`;
  },
  bind_interesados() {
    $$('[data-lf]').forEach(s => s.onchange = () => Store.setLeadStatus(s.closest('[data-lead]').dataset.lead, { status: s.value }).then(() => UI.toast('Estado actualizado')).catch(() => UI.toast('No se pudo guardar el estado')));
    $$('[data-confirm]').forEach(b => b.onclick = async () => { await Store.setLeadStatus(b.dataset.confirm, { status: 'confirmado' }); await this.save('lots', b.dataset.lot, { status: 'reservado' }); UI.toast(`Lote ${b.dataset.lot} marcado como apartado`); });
    const csv = $('#leadsCsv'); if (csv) csv.onclick = () => this.exportCsv();
    $$('[data-ldel]').forEach(b => b.onclick = () => this.confirmInline(b, '¿Eliminar solicitud?', () => Store.setLeadStatus(b.dataset.ldel, { deleted: true })));
    $$('[data-goto]').forEach(b => b.onclick = () => { this.close(); App.focusLot(b.dataset.goto); });
  },

  // ---------------- Proyectos ----------------
  tab_proyectos() {
    const ps = Object.values(Store.data.projects);
    return `<div class="grid-cards">${ps.map(p => `
      <section class="card ${p.id === App.project.id ? 'current' : ''}">
        <h3>${esc(p.name)}</h3><p class="muted small">${esc(p.location || '')}</p><p class="small">${esc(p.description || '')}</p>
        <p class="small">${(p.stages || []).length} etapas · ${Object.values(Store.data.lots).filter(l => l.projectId === p.id).length} lotes con datos · ${p.hasLayout ? 'Trazado 3D interpretado' : 'Trazado 3D pendiente'}</p>
        ${p.id === App.project.id ? '<span class="badge">Proyecto activo</span>' : `<button class="btn small" data-proj="${esc(p.id)}">Abrir este proyecto</button>`}
      </section>`).join('')}</div>
      <section class="card mt"><h3>Configuración comercial de ${esc(App.project.name)}</h3>
        <div class="form two">
          <label>WhatsApp del equipo (con código de país)<input id="cfgWhats" inputmode="tel" placeholder="50370000000" value="${esc(App.project.whatsapp || '')}"></label>
          <label>Nombre del asesor o equipo<input id="cfgAdvisor" value="${esc(App.project.advisor || '')}" placeholder="Equipo comercial"></label>
          <label>Horario de atención<input id="cfgHours" value="${esc(App.project.hours || '')}" placeholder="Lun–Sáb · 8:00–18:00 (El Salvador)"></label>
          <label>Depósito de apartado (USD)<input id="cfgDeposit" type="number" min="0" step="50" value="${App.project.deposit || 300}"></label>
          <label class="full">Enlace público para compartir lotes<input id="cfgShare" value="${esc(App.project.shareUrl || SHARE_BASE_DEFAULT)}"></label>
        </div>
        <p class="muted small">Sin número, el botón de WhatsApp deja que la persona elija a quién escribir.</p>
        <div class="modal-actions"><button class="btn primary" data-write id="cfgSave">Guardar configuración</button></div>
      </section>
      <section class="card mt"><h3>Crear proyecto residencial</h3>
        <div class="form two">
          <label>Nombre<input id="pName" placeholder="Residencial …"></label>
          <label>Ubicación<input id="pLoc" placeholder="Municipio, departamento"></label>
          <label class="full">Descripción<textarea id="pDesc" rows="2"></textarea></label>
          <label>Número de etapas<input id="pStages" type="number" min="1" max="8" value="2"></label>
        </div>
        <p class="muted small">El nuevo proyecto se crea con sus etapas y puede recibir lotes e imagen de referencia. El trazado 3D detallado se incorpora cuando exista el levantamiento.</p>
        <div class="modal-actions"><button class="btn primary" data-write id="pCreate">Crear proyecto</button></div>
      </section>`;
  },
  bind_proyectos() {
    $$('[data-proj]').forEach(b => b.onclick = () => { App.setProject(b.dataset.proj); this.render(); });
    $('#cfgSave').onclick = async () => { await this.save('projects', App.project.id, { whatsapp: $('#cfgWhats').value.replace(/\D/g, ''), advisor: $('#cfgAdvisor').value.trim(), hours: $('#cfgHours').value.trim(), deposit: +$('#cfgDeposit').value || 0, shareUrl: $('#cfgShare').value.trim() }); UI.toast('Configuración guardada'); Shell.updateWhats(); };
    $('#pCreate').onclick = async () => {
      const name = $('#pName').value.trim(); if (!name) return UI.toast('Escribí el nombre del proyecto');
      const id = name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'proyecto';
      const colors = ['#86c35a', '#6aa8de', '#eec244', '#ec8f80', '#9b8ad6', '#4fb3a9', '#d98bc2', '#c9a46a'];
      const n = Math.max(1, Math.min(8, +$('#pStages').value || 1));
      await this.save('projects', id, { id, name, location: $('#pLoc').value.trim(), description: $('#pDesc').value.trim(), hasLayout: false, refUrl: null, createdAt: Date.now(),
        stages: Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Etapa ${i + 1}`, color: colors[i], desc: '', selling: true })) }, true);
      UI.toast(`Proyecto “${name}” creado`);
    };
  },

  // ---------------- Materiales (texturas PBR) ----------------
  tab_materiales() {
    const rows = Object.entries(PBR_LIB).map(([k, d]) => {
      const img = d.maps.includes('albedo') ? `tex/${d.file}_albedo.jpg` : `tex/${d.file}_normal.jpg`;
      return `<section class="card mat-card"><img src="${img}" alt="${esc(d.label)}" loading="lazy"><div><h3>${esc(d.label)}</h3>
        <p class="small mono">${esc(d.file)}</p><p class="small muted">Mapas: ${d.maps.map(m => ({ albedo: 'color', normal: 'relieve (normal)', roughness: 'rugosidad' })[m]).join(' · ')} · 1 repetición ≈ ${d.size} m</p></div></section>`;
    }).join('');
    return `<p class="muted">Texturas PBR reales de <b>Poly Haven</b> (licencia CC0: uso comercial libre, sin atribución obligatoria), convertidas a JPG de 512 px para que la experiencia cargue rápido en teléfonos. Se aplican en metros reales sobre pisos, muros, techos y exteriores.</p>
      <div class="grid-cards mats">${rows}</div>
      <section class="card"><h3>Para producción</h3><p class="small">Reemplazar por las texturas de los acabados reales (muestras del fabricante o fotos calibradas) en 1K–2K, comprimidas en KTX2, y renders o recorridos de alta calidad generados con planos aprobados.</p></section>`;
  },

  // ---------------- Referencia y datos ----------------
  tab_referencia() {
    const p = App.project;
    return `<div class="cols">
      <section class="card"><h3>Imagen de referencia del proyecto</h3>
        ${p.refUrl ? `<img class="ref-thumb" src="${esc(p.refUrl)}" alt="Referencia actual">` : '<p class="muted">Sin imagen de referencia.</p>'}
        <label class="mt">Cargar nueva imagen (JPG o PNG)<input type="file" id="refFile" accept="image/png,image/jpeg,image/webp" data-write></label>
        <p class="muted small">Se mostrará en “Ver plano original” y como capa superpuesta en el 3D. ${Store.mode === 'local' ? 'En modo local, imágenes de hasta 2 MB.' : ''}</p>
        <span class="err" id="refErr"></span>
        ${p.id === PROJECT_ID && p.refUrl !== 'plano-original.jpg' ? '<button class="btn small" data-write id="refRestore">Restaurar referencia original</button>' : ''}
      </section>
      <section class="card"><h3>Datos del prototipo</h3>
        <p class="small">Modo: <b>${Store.mode === 'cloud' ? 'nube compartida' : 'navegador local'}</b>. ${Store.mode === 'cloud' ? 'Los cambios se ven para todas las personas con acceso.' : 'Los cambios se guardan solo en este navegador.'}</p>
        <button class="btn" id="exportBtn">Ver exportación JSON</button>
        <textarea id="exportBox" class="json mt" rows="8" hidden readonly></textarea>
        <h3 class="mt">Restaurar demostración</h3>
        <p class="muted small">Vuelve a escribir el proyecto, los 3 modelos y los lotes demostrativos (no borra interesados ni lotes agregados).</p>
        <button class="btn ghost" data-write id="seedBtn">Restaurar datos demostrativos</button>
      </section></div>
      <section class="card"><h3>Elementos provisionales y qué se necesita para producción</h3>
        <div class="table-wrap"><table class="admin-table"><thead><tr><th>Elemento</th><th>Estado en el prototipo</th><th>Información real necesaria</th></tr></thead><tbody>
        ${[
          ['Trazado del residencial', 'Interpretado a mano desde la imagen de referencia (escala supuesta 0.7 m/px).', 'Levantamiento topográfico digital y plano de lotificación (DWG/DXF o GeoJSON).'],
          ['Numeración de lotes', 'Provisional: E{etapa}-M{manzana}-L{lote}.', 'Cuadro oficial de lotes con áreas, colindancias y números catastrales.'],
          ['Áreas y medidas de terrenos', 'Calculadas del trazado aproximado (referenciales).', 'Áreas oficiales por lote.'],
          ['Precios', 'Ejemplos generados por fórmula.', 'Cuadro de valores de venta (lote y lote + vivienda).'],
          ['Vivienda de 52 m²', 'Distribución demostrativa en JSON (7 ambientes).', 'Planos arquitectónicos autorizados.'],
          ['Modelos A, B y C', 'Variantes de fachada y decoración ilustrativas, sin aprobación.', 'Diseños de vivienda aprobados (tipologías).'],
          ['Mobiliario y decoración', 'Ilustrativo; no incluido en la venta.', 'Opciones definitivas, si se ofrecerán paquetes.'],
          ['Financiamiento', 'Cuota nivelada con tasa ilustrativa.', 'Condiciones de las entidades financieras participantes.'],
          ['Áreas verdes, casa comunal, acceso', 'Ubicación aproximada según la imagen.', 'Plano de urbanización y equipamiento autorizado.'],
          ['Entorno (volcanes, bosque, calles vecinas)', 'Paisaje genérico.', 'Ortofoto o modelo de terreno, si se desea realismo.'],
        ].map(r => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}
        </tbody></table></div>
      </section>`;
  },
  bind_referencia() {
    $('#refFile').onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      const err = $('#refErr'); err.textContent = '';
      try {
        let url = null, assetId = null;
        const assets = Store.mode === 'cloud' && window.claude ? await window.claude.use('assets') : null;
        if (assets) { const r = await assets.upload(file); url = r.url; assetId = r.id; }
        else {
          if (file.size > 2 * 1024 * 1024) { err.textContent = 'La imagen supera 2 MB. Reducila e intentá de nuevo.'; return; }
          url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
        }
        await this.save('projects', App.project.id, { refUrl: url, refAssetId: assetId });
        UI.toast('Imagen de referencia actualizada');
      } catch (x) { err.textContent = 'No se pudo cargar la imagen: ' + (x.message || x.code || 'error'); }
    };
    const rr = $('#refRestore'); if (rr) rr.onclick = () => this.save('projects', PROJECT_ID, { refUrl: 'plano-original.jpg', refAssetId: null });
    $('#exportBtn').onclick = () => { const b = $('#exportBox'); b.hidden = false; b.value = JSON.stringify({ exportedAt: new Date().toISOString(), ...Store.data }, null, 1); b.select(); };
    $('#seedBtn').onclick = e => this.confirmInline(e.target, '¿Restaurar demostración?', async () => { await Store.loadSeed(); UI.toast('Datos demostrativos restaurados'); });
  },

  // ---------------- utilidades ----------------
  async save(col, id, patch, replace) {
    try {
      if (replace) await Store.set(col, id, { ...patch, updatedAt: Date.now() });
      else await Store.update(col, id, patch);
    } catch (e) {
      console.error(e);
      UI.toast('No se pudo guardar: tu acceso podría ser de solo lectura.');
    }
  },
  confirmInline(btn, q, fn) {
    if (btn.dataset.confirming) { delete btn.dataset.confirming; fn(); return; }
    const old = btn.textContent; btn.dataset.confirming = '1'; btn.textContent = q + ' Sí'; btn.classList.add('danger');
    setTimeout(() => { if (btn.isConnected && btn.dataset.confirming) { delete btn.dataset.confirming; btn.textContent = old; btn.classList.remove('danger'); } }, 3500);
  },
};

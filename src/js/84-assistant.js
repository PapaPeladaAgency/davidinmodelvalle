// ============================================================================
// 84-assistant.js — Asistente con IA (capacidad «sample» de Claude)
// Responde dudas del comprador con el inventario real del prototipo mediante
// herramientas de la página: buscar lotes, ver un lote, comparar modelos,
// calcular la cuota y mover la cámara del 3D hacia lo que recomienda.
// ============================================================================

const Assistant = {
  sample: null, turns: [], busy: false, ctl: null,

  async init() {
    const c = window.claude; if (!c || typeof c.use !== 'function') return;
    const s = await c.use('sample'); if (!s) return;
    this.sample = s;
    $('#fabAI').hidden = false; $('#btnAI').hidden = false;
    $('#fabAI').onclick = () => this.open(); $('#btnAI').onclick = () => this.open();
    $('#aiClose').onclick = () => this.close();
    $('#aiStop').onclick = () => this.ctl?.abort();
    $('#aiForm').onsubmit = e => { e.preventDefault(); const v = $('#aiInput').value.trim(); if (v) { $('#aiInput').value = ''; this.ask(v); } };
    $('#aiChips').onclick = e => { const b = e.target.closest('button[data-q]'); if (b) this.ask(b.textContent); };
    $('#aiLog').onclick = e => { const b = e.target.closest('[data-ai-lot]'); if (b) { App.focusLot(b.dataset.aiLot); if (innerWidth < 700) this.close(); } };
  },
  open() {
    $('#aiPanel').hidden = false; document.body.classList.add('ai-open');
    if (!this.turns.length) this.renderChips();
    setTimeout(() => $('#aiInput').focus(), 50);
    Track.bump('ai', true);
  },
  close() { $('#aiPanel').hidden = true; document.body.classList.remove('ai-open'); },
  renderChips() {
    const qs = LANG === 'en' ? ['What can I buy with a $900 monthly income?', 'Show me available lots near the central park', 'What is the difference between models A, B and C?', 'How do I reserve a lot?']
      : ['¿Qué puedo comprar con un ingreso de $900 al mes?', 'Mostrame lotes disponibles cerca del parque central', '¿Qué diferencia hay entre los modelos A, B y C?', '¿Cómo aparto un lote?'];
    $('#aiChips').innerHTML = qs.map(q => `<button class="chip" type="button" data-q>${esc(q)}</button>`).join('');
  },

  // ---- datos que el asistente puede consultar ----
  lots() { return Object.values(Store.data.lots).filter(l => l.projectId === (App.project?.id || PROJECT_ID)); },
  row(code) {
    const I = UI.lotInfo(code), price = I.model ? I.priceTotal : I.priceLot;
    const geo = I.geo, park = amenityInfo('parque')?.box;
    return {
      codigo: code, etapa: I.stage?.name || null, estado: STATUS[I.status]?.label || I.status, modelo: I.model ? `${I.model.name} (${I.model.tagline})` : 'solo terreno',
      terreno_m2: I.area ? Math.round(I.area) : null, construccion_m2: I.model?.area || null, precio_terreno: I.priceLot, precio_total: price,
      cuota_mensual_ejemplo: Math.round(UI.calcLoan(price, LOAN.down, LOAN.years, LOAN.rate).monthly),
      distancia_parque_m: geo && park ? Math.round(Math.hypot(geo.x - park.x, geo.z - park.z)) : null,
    };
  },
  tools() {
    const S = { type: 'string' }, N = { type: 'number' };
    return [
      { name: 'buscar_lotes', description: 'Busca lotes del inventario demostrativo. Devuelve el total que cumple y hasta `limite` lotes ordenados (por precio o por cercanía al parque central) con etapa, estado, modelo, precios y cuota mensual de ejemplo.',
        inputSchema: { type: 'object', properties: { etapa: { type: 'integer', description: '1 a 4' }, estado: { type: 'string', enum: ['disponible', 'reservado', 'vendido'] }, modelo: { type: 'string', enum: ['A', 'B', 'C', 'terreno'] }, precio_max: N, cuota_max: N, orden: { type: 'string', enum: ['precio', 'cerca_parque'] }, limite: { type: 'integer' } } },
        execute: (q) => {
          let L = this.lots();
          if (q.etapa) L = L.filter(l => +l.stage === +q.etapa);
          if (q.estado) L = L.filter(l => l.status === q.estado);
          if (q.modelo) L = L.filter(l => q.modelo === 'terreno' ? !l.model : l.model === q.modelo);
          let rows = L.map(l => this.row(l.code));
          if (q.precio_max) rows = rows.filter(r => r.precio_total <= q.precio_max);
          if (q.cuota_max) rows = rows.filter(r => r.cuota_mensual_ejemplo <= q.cuota_max);
          rows.sort(q.orden === 'cerca_parque' ? (a, b) => (a.distancia_parque_m ?? 1e9) - (b.distancia_parque_m ?? 1e9) : (a, b) => a.precio_total - b.precio_total);
          return { total: rows.length, lotes: rows.slice(0, Math.min(10, q.limite || 6)) };
        } },
      { name: 'ver_lote', description: 'Detalle de un lote por su código (por ejemplo E1-M07-L05).', inputSchema: { type: 'object', properties: { codigo: S }, required: ['codigo'] },
        execute: ({ codigo }) => { const c = String(codigo || '').toUpperCase(); if (!Store.data.lots[c]) throw new Error('No existe el lote ' + c); return this.row(c); } },
      { name: 'modelos', description: 'Lista los modelos de vivienda con precio, área, dormitorios, baños y descripción.',
        execute: () => Object.values(Store.data.models).map(m => ({ id: m.id, nombre: m.name, tipo: m.tagline, precio_vivienda: m.priceHome, area_m2: m.area, dormitorios: m.bedrooms, banos: m.baths, techo: m.facade?.roof, descripcion: m.description })) },
      { name: 'calcular_cuota', description: 'Calcula la cuota mensual estimada de un crédito de ejemplo. Por defecto prima 10 %, 20 años y tasa anual ilustrativa 7.5 %.',
        inputSchema: { type: 'object', properties: { precio: N, prima_pct: N, anios: N, tasa_anual: N }, required: ['precio'] },
        execute: ({ precio, prima_pct = LOAN.down, anios = LOAN.years, tasa_anual = LOAN.rate }) => { const c = UI.calcLoan(+precio, +prima_pct, +anios, +tasa_anual); return { cuota_mensual: Math.round(c.monthly * 100) / 100, prima: Math.round(c.down), monto_financiado: Math.round(c.P), ingreso_sugerido_aprox: Math.round(c.monthly / 0.3) }; } },
      { name: 'areas_comunes', description: 'Lista las áreas comunes del residencial (id, nombre, equipamiento, horario).',
        execute: () => Object.entries(AMENITIES).map(([id, a]) => ({ id, nombre: a.name, tipo: a.type, descripcion: a.desc, equipamiento: a.equip, horario: a.hours })) },
      { name: 'mostrar_en_3d', description: 'Mueve la cámara del modelo 3D para mostrarle al visitante un lote (codigo) o un área común (area). Usalo cuando recomiendes algo concreto.',
        inputSchema: { type: 'object', properties: { codigo: S, area: S } },
        execute: ({ codigo, area }) => {
          if (codigo) { const c = String(codigo).toUpperCase(); if (!Site.lotIndex.has(c)) throw new Error('Lote no encontrado'); App.focusLot(c); return { ok: true, mostrando: c }; }
          if (area && AMENITIES[area]) { if (App.view !== 'site') App.enterSite(); UI.showAmenity(area); const ai = amenityInfo(area); if (ai) Frame.go(ai.box, 'tres4', 1.2); return { ok: true, mostrando: area }; }
          throw new Error('Indicá un código de lote o un id de área común');
        } },
      { name: 'ver_casa_por_dentro', description: 'Abre la vivienda de un lote en la vista de maqueta abierta (dollhouse) para que el visitante vea la distribución.',
        inputSchema: { type: 'object', properties: { codigo: S, modelo: { type: 'string', enum: ['A', 'B', 'C'] } }, required: ['codigo'] },
        execute: ({ codigo, modelo }) => { const c = String(codigo).toUpperCase(); if (!Site.lotIndex.has(c)) throw new Error('Lote no encontrado'); this.close(); App.enterHouse(c, modelo || Store.data.lots[c]?.model || 'A'); setTimeout(() => HouseViewer.setMode('open'), 1400); return { ok: true }; } },
    ];
  },
  rules() {
    const p = App.project || {}, st = (p.stages || DEFAULT_STAGES).map(s => `${s.id}: ${s.name} — ${s.desc}`).join('\n');
    return `Sos el asistente comercial virtual de "${p.name || 'Valle de San Sebastián'}", un residencial de vivienda de interés social en El Salvador, dentro de un prototipo 3D demostrativo.
Respondé en ${LANG === 'en' ? 'inglés' : 'español salvadoreño cordial (voseo)'}; breve (máximo 120 palabras), concreto y amable. Usá viñetas cortas cuando listes opciones.
Reglas:
- Todos los precios, lotes, cuotas y planos son DEMOSTRATIVOS; decilo una vez cuando des cifras.
- Nunca inventes datos: consultá las herramientas para lotes, precios, modelos, cuotas y áreas comunes.
- Cuando recomiendes un lote o área concreta, llamá a mostrar_en_3d para que el visitante lo vea.
- Escribí los códigos de lote exactos (formato E1-M07-L05).
- No pidas ni guardes datos personales. Para apartar, agendar cita o hablar con una persona, indicá los botones "Apartar en línea", "Agendar cita" o WhatsApp${p.hours ? ` (horario: ${p.hours})` : ''}. Depósito de apartado de ejemplo: $${p.deposit || 300}.
- Un crédito de ejemplo usa prima ${LOAN.down} %, ${LOAN.years} años y tasa ilustrativa ${LOAN.rate} %; la cuota sugerida no debería pasar del 30 % del ingreso familiar.
Etapas:\n${st}
Contexto actual del visitante: vista ${App.view}${UI.selectedLot ? `, mirando el lote ${UI.selectedLot}` : ''}${App.view === 'house' ? `, dentro de la casa del lote ${HouseViewer.lotCode} (${HouseViewer.model?.name})` : ''}.`;
  },

  async ask(text) {
    if (this.busy || !this.sample) return;
    this.busy = true; $('#aiChips').innerHTML = '';
    this.turns.push({ role: 'user', content: text });
    this.bubble('user', text);
    const out = this.bubble('ai', t('ai.thinking')); out.classList.add('pending');
    $('#aiStop').hidden = false; $('#aiSend').disabled = true;
    this.ctl = new AbortController();
    const turns = this.turns.slice(-12);
    try {
      const { text: answer } = await this.sample([{ role: 'user', content: this.rules() }, { role: 'assistant', content: LANG === 'en' ? 'Understood.' : 'Entendido.' }, ...turns], {
        cache: false, modelTier: 'quick', signal: this.ctl.signal, tools: this.tools().map(tl => ({ ...tl, execute: (inp, ctx) => { this.note(out, tl.name); return tl.execute(inp || {}, ctx); } })),
        onText: ({ text }) => { out.classList.remove('pending'); out.innerHTML = this.md(text); this.scroll(); },
      });
      out.classList.remove('pending'); out.innerHTML = this.md(answer);
      this.turns.push({ role: 'assistant', content: answer });
      Track.bump('ai_q');
    } catch (e) {
      this.turns.pop();
      out.classList.remove('pending');
      if (e && e.text) out.innerHTML = this.md(e.text); else out.remove();
      if (e?.code !== 'cancelled') this.bubble('sys', t('ai.err.' + (['not_granted', 'rate_limited'].includes(e?.code) ? e.code : 'other')));
    } finally {
      this.busy = false; $('#aiStop').hidden = true; $('#aiSend').disabled = false; this.scroll();
    }
  },
  note(el, name) { if (el.classList.contains('pending')) el.textContent = t('ai.tool.' + name); },
  bubble(who, text) {
    const d = document.createElement('div'); d.className = 'ai-msg ' + who;
    if (who === 'user' || who === 'sys') d.textContent = text; else d.innerHTML = this.md(text);
    $('#aiLog').append(d); this.scroll(); return d;
  },
  scroll() { const l = $('#aiLog'); l.scrollTop = l.scrollHeight; },
  // markdown mínimo y seguro: negritas, viñetas, saltos de línea y códigos de lote clicables
  md(s) {
    let h = esc(s || '');
    h = h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    h = h.replace(/\b(E[1-4]-M\d{2}-L\d{2})\b/g, (m) => Site.lotIndex.has(m) ? `<button type="button" class="ai-lot" data-ai-lot="${m}">${m}</button>` : m);
    const lines = h.split('\n'); let html = '', inList = false;
    for (const ln of lines) {
      const m = ln.match(/^\s*[-•*]\s+(.*)/);
      if (m) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${m[1]}</li>`; }
      else { if (inList) { html += '</ul>'; inList = false; } if (ln.trim()) html += `<p>${ln}</p>`; }
    }
    return html + (inList ? '</ul>' : '');
  },
};

Object.assign(I18N.es, {
  'ai.btn': 'Asistente con IA', 'ai.title': 'Asistente con IA', 'ai.sub': 'Pregunta por lotes, precios, cuotas o áreas comunes. Responde con el inventario demostrativo.',
  'ai.ph': 'Escribí tu pregunta…', 'ai.send': 'Enviar', 'ai.stop': 'Detener', 'ai.thinking': 'Pensando…',
  'ai.err.not_granted': 'El asistente necesita tu permiso para usar Claude. Podés activarlo desde el menú de permisos del artefacto.',
  'ai.err.rate_limited': 'Hay muchas consultas seguidas. Esperá un momento y volvé a preguntar.', 'ai.err.other': 'No se pudo obtener respuesta. Probá de nuevo.',
  'ai.tool.buscar_lotes': 'Buscando lotes en el inventario…', 'ai.tool.ver_lote': 'Revisando el lote…', 'ai.tool.modelos': 'Consultando los modelos…',
  'ai.tool.calcular_cuota': 'Calculando la cuota…', 'ai.tool.areas_comunes': 'Consultando áreas comunes…', 'ai.tool.mostrar_en_3d': 'Mostrándolo en el 3D…', 'ai.tool.ver_casa_por_dentro': 'Abriendo la casa…',
  'ai.disc': 'Respuestas generadas con IA sobre datos demostrativos. Confirmá todo con un asesor.',
});
Object.assign(I18N.en, {
  'ai.btn': 'AI assistant', 'ai.title': 'AI assistant', 'ai.sub': 'Ask about lots, prices, payments or amenities. Answers use the demo inventory.',
  'ai.ph': 'Type your question…', 'ai.send': 'Send', 'ai.stop': 'Stop', 'ai.thinking': 'Thinking…',
  'ai.err.not_granted': 'The assistant needs your permission to use Claude. You can allow it from the artifact permissions menu.',
  'ai.err.rate_limited': 'Too many questions in a row. Wait a moment and ask again.', 'ai.err.other': 'Could not get an answer. Try again.',
  'ai.tool.buscar_lotes': 'Searching the inventory…', 'ai.tool.ver_lote': 'Checking the lot…', 'ai.tool.modelos': 'Checking the models…',
  'ai.tool.calcular_cuota': 'Calculating the payment…', 'ai.tool.areas_comunes': 'Checking amenities…', 'ai.tool.mostrar_en_3d': 'Showing it in 3D…', 'ai.tool.ver_casa_por_dentro': 'Opening the house…',
  'ai.disc': 'AI-generated answers on demo data. Confirm everything with an advisor.',
});

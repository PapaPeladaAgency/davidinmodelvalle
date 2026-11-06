// ============================================================================
// 95-motion.js — Transiciones editoriales: título por palabras, contador de
// carga, cortina entre vistas, etiquetas numeradas en las hojas y conteo de cifras.
// Todo respeta prefers-reduced-motion (el CSS anula animaciones).
// ============================================================================
const Motion = {
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,

  split(el) {
    if (!el || el.dataset.split) return;
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true"><span style="--i:${i}">${esc(w)}</span></span>`).join(' ');
    el.dataset.split = '1';
  },

  // número grande de la pantalla de carga, sincronizado con la barra
  hookLoader() {
    const pct = $('#loadPct'); if (!pct || typeof Loader === 'undefined') return;
    let shown = 0, target = 0, raf = 0;
    const step = () => {
      shown += (target - shown) * 0.18; if (Math.abs(target - shown) < 0.5) shown = target;
      pct.textContent = String(Math.round(shown)).padStart(2, '0');
      raf = shown !== target ? requestAnimationFrame(step) : 0;
    };
    const orig = Loader.set.bind(Loader);
    Loader.set = (p, key) => { orig(p, key); target = Math.max(target, Math.min(100, Math.round(p))); if (!raf) raf = requestAnimationFrame(step); };
    // salida: una cortina blanca con el número sube y deja ver el residencial
    const load = $('#loading');
    new MutationObserver(() => {
      if (!load.hidden || this.reduced) return;
      const ex = document.createElement('div');
      ex.className = 'loading leaving'; ex.setAttribute('aria-hidden', 'true');
      ex.innerHTML = '<div class="load-card"><div class="load-num">100<small>%</small></div></div>';
      document.body.appendChild(ex);
      const drop = () => ex.isConnected && ex.parentNode.removeChild(ex);
      ex.addEventListener('animationend', drop, { once: true });
      setTimeout(drop, 1500);
    }).observe(load, { attributes: true, attributeFilter: ['hidden'] });
  },

  // cortina negra: entra desde abajo y sale hacia arriba
  hookCurtain() {
    const f = $('#fade'); if (!f) return;
    let was = false;
    new MutationObserver(() => {
      const on = f.classList.contains('on');
      if (on === was) return; // solo actuar en cambios reales de 'on' (cambiar 'out' también dispara el observador)
      was = on;
      // classList.remove reescribe el atributo aunque la clase no esté: verificar antes para no entrar en bucle
      if (on) { if (f.classList.contains('out')) f.classList.remove('out'); return; }
      if (this.reduced) return;
      f.classList.add('out'); clearTimeout(f._t);
      f._t = setTimeout(() => { if (f.classList.contains('out')) f.classList.remove('out'); }, 750);
    }).observe(f, { attributes: true, attributeFilter: ['class'] });
    const mark = f.querySelector('.fade-mark');
    const ent = App.enterHouse.bind(App), ext = App.exitHouse.bind(App);
    App.enterHouse = (code, model) => { if (mark) mark.textContent = `${t('lot.lot')} ${code}`; return ent(code, model); };
    App.exitHouse = quick => { if (mark) mark.textContent = 'Valle de San Sebastián'; return ext(quick); };
  },

  // etiqueta "02 / Casas" sobre cada hoja; sin cascada al refrescar la misma pestaña
  hookSheet() {
    if (typeof Shell === 'undefined') return;
    const orig = Shell.openTab.bind(Shell);
    Shell.openTab = tab => {
      const body = $('#sheetBody');
      body.classList.toggle('still', tab === Shell.tab && !$('#sheet').hidden);
      orig(tab);
      if (tab === 'explore') return;
      const btns = $$('#tabbar [data-tab]'), i = btns.findIndex(b => b.dataset.tab === tab);
      const label = btns[i]?.querySelector('span')?.textContent || '';
      if (!body.querySelector(':scope > .kicker')) body.insertAdjacentHTML('afterbegin', `<p class="kicker">${String(i + 1).padStart(2, '0')} / ${esc(label)}</p>`);
    };
  },

  // cifras de la portada cuentan hacia arriba la primera vez
  countUp(root) {
    if (this.reduced || this._counted) return;
    const els = [...root.querySelectorAll('strong')].filter(s => /^\d+$/.test(s.textContent.trim()));
    if (!els.length) return;
    this._counted = true;
    els.forEach(s => {
      const to = +s.textContent, t0 = performance.now() + 500, d = 1400;
      s.textContent = '0';
      const tick = now => { const k = Math.min(1, Math.max(0, (now - t0) / d)); s.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 4)))); if (k < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
  },

  // en la portada el proyecto se encuadra a un lado del texto (desplazando la vista de la cámara),
  // y vuelve al centro con suavidad al entrar
  heroFrame() {
    const cam = App.camera; if (!cam) return;
    let k = 0, raf = 0;
    const target = () => (document.body.dataset.view ? 0 : 1);
    const apply = () => {
      const w = App.width, h = App.height, wide = w > 760;
      if (k < 0.002) { if (cam.view && cam.view.enabled) cam.clearViewOffset(); return; }
      cam.setViewOffset(w, h, wide ? -w * 0.2 * k : 0, wide ? 0 : h * 0.2 * k, w, h);
    };
    const step = () => {
      const t = target(); k += (t - k) * (this.reduced ? 1 : 0.06); if (Math.abs(t - k) < 0.002) k = t;
      apply(); raf = k !== t ? requestAnimationFrame(step) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(step); };
    k = 1; apply();
    new MutationObserver(kick).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });
    const rs = App.resize.bind(App); App.resize = () => { rs(); apply(); };
  },

  init() {
    this.split($('.hero h1.split'));
    const frame = () => (App.camera && App.width ? this.heroFrame() : setTimeout(frame, 150)); frame();
    this.hookLoader();
    this.hookCurtain();
    this.hookSheet();
    const hs = $('#heroStats');
    if (hs) new MutationObserver(() => { if (!document.body.dataset.view) this.countUp(hs); }).observe(hs, { childList: true });
  },
};
Motion.init();

// ============================================================================
// 10-store.js — Capa de datos persistente
// Nube: capacidad `db` de claude.ai (compartida entre usuarios del artefacto).
// Respaldo: localStorage del navegador cuando la nube no está disponible.
// Colecciones: projects, lots, models, leads. Misma forma en ambos modos.
// ============================================================================

const COLLECTIONS = ['projects', 'lots', 'models', 'leads'];
const LOCAL_KEY = 'vss-prototipo-v1';

const Store = {
  mode: 'starting',       // 'cloud' | 'local'
  canEdit: true,
  data: { projects: {}, lots: {}, models: {}, leads: {} },
  loaded: { projects: false, lots: false, models: false, leads: false },
  listeners: new Set(),
  db: null,
  _t: null,

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit(col) {
    clearTimeout(this._t);
    this._t = setTimeout(() => this.listeners.forEach(fn => { try { fn(col); } catch (e) { console.error(e); } }), 30);
  },

  async init(seedFn) {
    this.seedFn = seedFn;
    let db = null, user = null;
    try {
      if (window.claude && typeof window.claude.use === 'function') {
        [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      }
    } catch (e) { db = null; }
    if (db) {
      this.mode = 'cloud';
      this.db = db;
      this.user = user;
      try { this.canEdit = user ? !!(await user.canEdit()) : false; } catch (e) { this.canEdit = false; }
      await this._subscribeCloud();
    } else {
      this.mode = 'local';
      this.canEdit = true;
      this._loadLocal();
    }
    this.emit('*');
  },

  _subscribeCloud() {
    return new Promise(resolve => {
      let pending = COLLECTIONS.length;
      const done = (col) => { if (!this.loaded[col]) { this.loaded[col] = true; if (--pending === 0) resolve(); } };
      const timer = setTimeout(resolve, 10000);
      for (const col of COLLECTIONS) {
        if (col === 'leads') { if (this.canEdit) this._subscribeLeads(() => done(col)); else done(col); continue; }
        this.db.collection(col).onSnapshot(snap => {
          const map = {};
          snap.docs.forEach(d => { map[d.id] = d.data(); });
          this.data[col] = map;
          done(col);
          this.emit(col);
          if (pending === 0) clearTimeout(timer);
        }, err => { console.warn('db', col, err); done(col); });
      }
    });
  },

  // Solicitudes: cada visitante escribe solo su documento leads/<suId> (lista de solicitudes);
  // el estado que asigna la administración vive aparte en leadStatus/<id>.
  _subscribeLeads(done) {
    let raw = {}, status = {}, n = 0;
    const merge = () => {
      const map = {};
      for (const [owner, d] of Object.entries(raw)) for (const it of (d.items || [])) {
        const st = status[it.id] || {};
        if (st.deleted) continue;
        map[it.id] = { ...it, owner, status: st.status || it.status || 'nuevo' };
      }
      this.data.leads = map; this.emit('leads');
    };
    const once = () => { if (++n === 2) done(); };
    this.db.collection('leads').onSnapshot(snap => { raw = {}; snap.docs.forEach(d => raw[d.id] = d.data()); merge(); once(); }, e => { console.warn('leads', e); once(); });
    this.db.collection('leadStatus').onSnapshot(snap => { status = {}; snap.docs.forEach(d => status[d.id] = d.data()); merge(); once(); }, e => { console.warn('leadStatus', e); once(); });
  },
  async addLead(lead) {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    if (this.mode !== 'cloud') { this.data.leads[id] = { ...lead, id }; this._saveLocal(); this.emit('leads'); return id; }
    const uid = await this.user.id();
    const ref = this.db.doc(`leads/${uid}`);
    const cur = await ref.get();
    const items = (cur.exists && cur.data().items) || [];
    await ref.set({ items: [...items, { ...lead, id }].slice(-50) });
    return id;
  },
  async setLeadStatus(id, patch) {
    if (this.mode !== 'cloud') {
      if (patch.deleted) delete this.data.leads[id]; else this.data.leads[id] = { ...this.data.leads[id], ...patch };
      this._saveLocal(); this.emit('leads'); return;
    }
    const cur = (await this.db.doc(`leadStatus/${id}`).get());
    await this.db.doc(`leadStatus/${id}`).set({ ...(cur.exists ? cur.data() : {}), ...patch, updatedAt: Date.now() });
  },

  _loadLocal() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); } catch (e) { saved = null; }
    if (saved && saved.projects && Object.keys(saved.projects).length) {
      this.data = { projects: {}, lots: {}, models: {}, leads: {}, ...saved };
    } else {
      const seed = this.seedFn();
      this.data = { ...seed, leads: {} };
      this._saveLocal();
    }
    COLLECTIONS.forEach(c => this.loaded[c] = true);
  },
  _saveLocal() {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(this.data)); } catch (e) { /* almacenamiento bloqueado */ }
  },

  isEmpty() { return !Object.keys(this.data.projects).length; },

  async set(col, id, obj) {
    if (this.mode === 'cloud') { await this.db.doc(`${col}/${id}`).set(obj); }
    else { this.data[col][id] = obj; this._saveLocal(); this.emit(col); }
  },
  async update(col, id, patch) {
    const cur = this.data[col][id] || {};
    const next = { ...cur, ...patch, updatedAt: Date.now() };
    if (this.mode === 'cloud') {
      this.data[col][id] = next; this.emit(col);   // optimista
      await this.db.doc(`${col}/${id}`).set(next);
    } else { this.data[col][id] = next; this._saveLocal(); this.emit(col); }
  },
  async remove(col, id) {
    if (this.mode === 'cloud') { await this.db.doc(`${col}/${id}`).delete(); }
    else { delete this.data[col][id]; this._saveLocal(); this.emit(col); }
  },
  async add(col, obj) {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    if (this.mode === 'cloud') { await this.db.doc(`${col}/${id}`).set(obj); }
    else { this.data[col][id] = obj; this._saveLocal(); this.emit(col); }
    return id;
  },
  async loadSeed() {
    const seed = this.seedFn();
    for (const col of ['projects', 'models', 'lots']) {
      for (const [id, obj] of Object.entries(seed[col])) {
        if (this.mode === 'cloud') await this.db.doc(`${col}/${id}`).set(obj);
        else this.data[col][id] = obj;
      }
    }
    if (this.mode === 'local') { this._saveLocal(); this.emit('*'); }
  },
};

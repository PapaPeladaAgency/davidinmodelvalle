// Prueba de los plugins: N8AO, path tracing (sitio y casa), asistente IA y presentación en vivo con un window.claude simulado
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const DIST = '/home/user/valle-san-sebastian/dist', NM = __dirname + '/npm/node_modules';
const OUT = __dirname + '/shots/p-';
const PK = { 'three@0.165.0/': 'three', 'postprocessing@6.36.0/': 'postprocessing', 'n8ao@2.0.1/': 'n8ao', 'three-mesh-bvh@0.8.3/': 'three-mesh-bvh', 'three-gpu-pathtracer@0.0.23/': 'three-gpu-pathtracer' };
const MOCK = `
window.__roomBus = [];
const listeners = {}; let peersFn = null;
window.claude = { use: async (n) => {
  if (n === 'sample') { const f = async (input, opts) => {
      window.__sampleInput = input;
      const tools = opts.tools; const r1 = await tools.find(t => t.name === 'buscar_lotes').execute({ estado: 'disponible', orden: 'cerca_parque', limite: 3 }, {});
      await tools.find(t => t.name === 'mostrar_en_3d').execute({ codigo: r1.lotes[0].codigo }, {});
      const txt = 'Encontré **' + r1.total + '** lotes disponibles. Los más cercanos al parque:\\n' + r1.lotes.map(l => '- ' + l.codigo + ' · ' + l.modelo + ' · $' + l.precio_total).join('\\n') + '\\nPrecios demostrativos.';
      opts.onText && opts.onText({ text: txt, delta: txt }); return { text: txt, truncated: false }; };
    f.json = async () => ({}); return f; }
  if (n === 'room') return { emit: async (topic, data) => { window.__roomBus.push({ topic, data }); }, on: (topic, fn) => { listeners[topic] = fn; return () => {}; },
    presence: async () => {}, peers: () => [], onPeers: (fn) => { peersFn = fn; return () => {}; } };
  if (n === 'user') return { canEdit: async () => true, isOwner: async () => true, id: async () => 'u1', profiles: async ids => Object.fromEntries(ids.map(i => [i, { id: i, name: 'Cliente Demo' }])) };
  return null; } };
window.__roomDeliver = (topic, data) => listeners[topic] && listeners[topic]({ topic, data, peer: 'peerX', by: 'u2', isMe: false, sameTab: false, kind: 'viewer', guest: true });
window.__peers = (p) => peersFn && peersFn(p);
`;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1100, height: 700 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text().slice(0, 300)); });
  await p.addInitScript(MOCK);
  await p.route('**/*', async r => { const u = r.request().url();
    for (const [k, d] of Object.entries(PK)) if (u.includes(k)) return r.fulfill({ body: fs.readFileSync(path.join(NM, d, u.split(k)[1])), contentType: 'application/javascript' });
    if (u.includes('jspdf/2.5.1/jspdf.umd.min.js')) return r.fulfill({ body: fs.readFileSync(path.join(NM, 'jspdf/dist/jspdf.umd.min.js')), contentType: 'application/javascript' });
    if (u.startsWith('http://local/')) { const rel = u.slice(13).split('?')[0].split('#')[0] || 'index.html'; if (rel === 'index.html') return r.fulfill({ body: '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(path.join(DIST, 'index.html'), 'utf8') + '</body></html>', contentType: 'text/html' }); return r.fulfill({ body: fs.readFileSync(path.join(DIST, rel)) }); }
    return r.abort(); });
  const q = process.argv[2] || '';
  await p.goto('http://local/index.html?' + q); await p.evaluate(() => { try { localStorage.setItem('vss-lang', 'es'); } catch (e) {} }); await p.reload(); await p.waitForTimeout(12000);
  const ev = f => p.evaluate(f);
  const settle = async (ms = 1500) => { await p.waitForTimeout(800); await p.waitForFunction(() => window.__vss.Tweens.list.length === 0, null, { timeout: 300000, polling: 500 }); await p.waitForTimeout(ms); };
  const shot = async n => { await p.screenshot({ path: OUT + n + '.png', timeout: 300000 }); console.log('shot', n); };
  console.log('AO', await ev(() => window.__vss.AOPlus.engine));
  await p.click('#cta'); await settle(2000);
  await ev(() => window.__vss.App.focusLot('E1-M07-L05')); await settle(3000); await shot('01-n8ao');
  // asistente
  await ev(() => window.__vss.UI.closeLot()); await p.click('#fabAI'); await p.waitForTimeout(400); await shot('02-ai-open');
  await p.click('#aiChips button:nth-child(2)'); await p.waitForTimeout(4000); await settle(1500); await shot('03-ai-answer');
  console.log('ai log', await ev(() => document.querySelector('#aiLog').innerText.slice(0, 300)));
  await p.click('#aiClose');
  // en vivo: presentador
  await p.click('#btnMore'); await p.click('#btnLive'); await p.waitForTimeout(1500);
  await ev(() => window.__peers({ peers: [{ peer: 'peerX', by: 'u2', isMe: false, sameTab: false, kind: 'viewer', guest: true, presence: { lot: 'E1-M07-L05', following: true } }], joined: [{ peer: 'peerX' }], left: [], updated: [] }));
  await p.waitForTimeout(800); await shot('04-presenting');
  const sent = await ev(() => window.__roomBus.filter(m => m.topic === 'cam').length); console.log('cam msgs', sent);
  const st = await ev(() => window.__roomBus.filter(m => m.topic === 'cam').pop().data);
  await p.click('#liveStop');
  // en vivo: seguidor recibe un estado distinto
  await ev(() => window.__roomDeliver('cam', { v: 'site', p: [-60, 70, 140], t: [-40, 0, 90], q: [0, 0, 0, 1], lot: 'E2-M03-L04', tod: 'dorada', house: null, ts: Date.now() }));
  await p.waitForTimeout(4000); await shot('05-following');
  console.log('follow lot', await ev(() => window.__vss.UI.selectedLot), 'cam', await ev(() => window.__vss.App.camera.position.toArray().map(Math.round)));
  await ev(() => { const b = document.querySelector('#liveFollow'); b && b.click(); window.__vss.Live.leaderGone(); });
  // path tracing del sitio
  await ev(() => { window.__vss.Site.setTimeOfDay('dia'); window.__vss.UI.closeLot(); });
  await ev(() => window.__vss.App.focusLot('E1-M07-L05')); await settle(1500); await ev(() => window.__vss.UI.closeLot());
  await ev(() => { window.__vss.PathRender.target = () => 6; window.__vss.PathRender.start('site'); });
  await p.waitForFunction(() => !window.__vss.PathRender.active && !window.__vss.PathRender.preparing, null, { timeout: 600000, polling: 1000 });
  console.log('pt stats', JSON.stringify(await ev(() => window.__vss.PathRender.stats)));
  await p.waitForTimeout(1500); await shot('06-pt-site');
  await ev(() => window.__vss.UI.closeModal());
  // path tracing de la casa abierta en maqueta
  await ev(() => window.__vss.App.enterHouse('E1-M07-L05', 'A')); await p.waitForTimeout(2500); await settle(1000);
  await ev(() => { window.__vss.HouseViewer.setMaqueta(true); window.__vss.HouseViewer.setMode('open'); }); await settle(2500);
  await shot('07-house-raster');
  await ev(() => window.__vss.PathRender.start('house'));
  await p.waitForFunction(() => !window.__vss.PathRender.active && !window.__vss.PathRender.preparing, null, { timeout: 600000, polling: 1000 });
  console.log('pt house', JSON.stringify(await ev(() => window.__vss.PathRender.stats)));
  await p.waitForTimeout(1500); await shot('08-pt-house');
  console.log('presenter state sample', JSON.stringify(st).slice(0, 200));
  console.log('ERRORS', errs.filter(e => !/GPU stall|WebGL-|swiftshader|Automatic fallback/i.test(e)).slice(0, 20).join('\n'));
  await b.close();
})();

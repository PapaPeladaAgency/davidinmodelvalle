const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const DIST = '../dist', NM = __dirname + '/npm/node_modules/three', OUT = __dirname + '/shots/y-';
const Q = process.env.Q || '';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1100, height: 690 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.text().slice(0, 300)); });
  await p.route('**/*', async r => { const u = r.request().url();
    if (u.includes('three@0.165.0/')) return r.fulfill({ body: fs.readFileSync(path.join(NM, u.split('three@0.165.0/')[1])), contentType: 'application/javascript' });
    if (u.startsWith('http://local/')) { const rel = u.slice(13).split('?')[0] || 'index.html'; if (rel === 'index.html') return r.fulfill({ body: '<!doctype html><html><head><meta charset=utf8><style>[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(path.join(DIST, 'index.html'), 'utf8') + '</body></html>', contentType: 'text/html' }); return r.fulfill({ body: fs.readFileSync(path.join(DIST, rel)) }); }
    return r.abort(); });
  await p.goto('http://local/index.html' + Q); await p.waitForTimeout(8000);
  const settle = async (ms = 4000) => { await p.waitForTimeout(1500); await p.waitForFunction(() => window.__vss.Tweens.list.length === 0, null, { timeout: 400000, polling: 1000 }); await p.waitForTimeout(ms); };
  const shot = async n => { console.log('shot', n, await p.evaluate(() => { const r = window.__vss.App.renderer.info.render; return r.calls + ' calls ' + (r.triangles / 1000 | 0) + 'k tris'; })); await p.screenshot({ path: OUT + n + '.png', timeout: 400000 }); };
  const ev = f => p.evaluate(f);
  const steps = (process.argv[2] || 'over,block,calle,far,house').split(',');
  for (const s of steps) {
    if (s === 'over') { await ev(() => window.__vss.App.enterSite()); await settle(); }
    if (s === 'block') { await ev(() => { window.__vss.UI.selectStage(1); window.__vss.UI.selectBlock('E1-M08', 'tres4'); }); await settle(); }
    if (s === 'calle') { await ev(() => window.__vss.UI.frameCurrent('calle')); await settle(); }
    if (s === 'far') { await ev(() => window.__vss.UI.frameCurrent('aerea')); await settle(); }
    if (s === 'house') { await ev(() => window.__vss.App.enterHouse('E1-M07-L05', 'A')); await settle(6000); }
    if (s === 'open') { await ev(() => { window.__vss.HouseViewer.setDecor('moderna'); window.__vss.UI.syncDecor(); window.__vss.HouseViewer.setMode('open'); }); await settle(6000); }
    if (s === 'open2') { await ev(() => { const V = window.__vss, c = V.App.camera, t = V.App.houseControls.target; c.position.set(t.x + 6.5, 9.5, t.z + 7.5); c.lookAt(t); }); await settle(4000); }
    if (s === 'sala') { await ev(() => window.__vss.HouseViewer.enterRoom('sala')); await settle(6000); }
    await shot(s);
  }
  console.log([...new Set(errs)].filter(e => !e.includes('ERR_FAILED')).slice(0, 12).join('\n') || 'no errors');
  await b.close();
})();

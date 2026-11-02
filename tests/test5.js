const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const DIST = '../dist', NM = __dirname + '/npm/node_modules/three', OUT = __dirname + '/shots/x-';
const mobile = process.argv[2] === 'm';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 800 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await p.route('**/*', async r => { const u = r.request().url();
    if (u.includes('three@0.165.0/')) return r.fulfill({ body: fs.readFileSync(path.join(NM, u.split('three@0.165.0/')[1])), contentType: 'application/javascript' }); if (u.includes('jspdf/2.5.1')) return r.fulfill({ body: fs.readFileSync(__dirname + '/npm/node_modules/jspdf/dist/jspdf.umd.min.js'), contentType: 'application/javascript' });
    if (u.startsWith('http://local/')) { const rel = u.slice(13).split('?')[0] || 'index.html'; if (rel === 'index.html') return r.fulfill({ body: '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(path.join(DIST, 'index.html'), 'utf8') + '</body></html>', contentType: 'text/html' }); return r.fulfill({ body: fs.readFileSync(path.join(DIST, rel)) }); }
    return r.abort(); });
  await p.goto('http://local/index.html?lowend'); await p.waitForTimeout(6000);
  const settle = async (ms = 2500) => { await p.waitForTimeout(1200); await p.waitForFunction(() => window.__vss.Tweens.list.length === 0, null, { timeout: 300000, polling: 500 }); await p.waitForTimeout(ms); };
  const tag = mobile ? 'm-' : '';
  const shot = async n => { console.log('shot', n, await p.evaluate(() => { const r = window.__vss.App.renderer.info.render; return r.calls + ' calls ' + (r.triangles / 1000 | 0) + 'k tris'; })); await p.screenshot({ path: OUT + tag + n + '.png', timeout: 240000 }); };
  const ev = f => p.evaluate(f);
  await ev(() => window.__vss.App.enterSite()); await settle(); await shot('01-overview');
  await ev(() => window.__vss.UI.selectStage(1)); await settle(); await shot('02-stage1');
  await ev(() => window.__vss.UI.selectBlock('E1-M07')); await settle(); await shot('03-block');
  await ev(() => window.__vss.UI.frameCurrent('calle')); await settle(); await shot('04-calle');
  await ev(() => window.__vss.UI.selectStage(0)); await ev(() => window.__vss.UI.showAmenity('parque')); await settle(); await shot('05-parque');
  await ev(() => window.__vss.UI.showAmenity('comunal')); await settle(); await shot('06-comunal');
  await p.click('[data-reserve]'); await p.fill('#rName', 'Ana Prueba'); await p.fill('#rPhone', '7000-0000'); await p.click('#resForm button[type=submit]'); await p.waitForTimeout(800); await shot('07-reserva');
  await ev(() => window.__vss.UI.closeModal());
  await p.click('#btnMore'); await p.click('#btnTour'); await settle(); await shot('08-tour1');
  for (let i = 2; i <= 12; i++) { await p.click('#tourNext'); await settle(1500); if ([4, 6, 7, 9, 10, 12].includes(i)) await shot('09-tour' + i); }
  console.log('leads', await ev(() => Object.values(window.__vss.Store.data.leads).map(l => l.type || 'info').join(',')));
  console.log([...new Set(errs)].filter(e => !e.includes('ERR_FAILED')).slice(0, 12).join('\n') || 'no errors');
  await b.close();
})();

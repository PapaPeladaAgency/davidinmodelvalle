const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const DIST = '../dist', NM = __dirname + '/npm/node_modules/three', OUT = __dirname + '/shots/p-';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1100, height: 640 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.text().slice(0, 300)); });
  await p.route('**/*', async r => { const u = r.request().url();
    if (u.includes('three@0.165.0/')) return r.fulfill({ body: fs.readFileSync(path.join(NM, u.split('three@0.165.0/')[1])), contentType: 'application/javascript' });
    if (u.startsWith('http://local/')) { const rel = u.slice(13).split('?')[0] || 'index.html'; if (rel === 'index.html') return r.fulfill({ body: '<!doctype html><html><head><meta charset=utf8><style>[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(path.join(DIST, 'index.html'), 'utf8') + '</body></html>', contentType: 'text/html' }); return r.fulfill({ body: fs.readFileSync(path.join(DIST, rel)) }); }
    return r.abort(); });
  await p.goto('http://local/index.html'); await p.waitForTimeout(8000);
  const settle = async (ms = 5000) => { await p.waitForTimeout(1500); await p.waitForFunction(() => window.__vss.Tweens.list.length === 0, null, { timeout: 600000, polling: 1000 }); await p.waitForTimeout(ms); };
  const ev = f => p.evaluate(f);
  await ev(() => window.__vss.App.enterSite()); await settle(2000);
  await p.click('#btnPhoto'); await settle(); await p.screenshot({ path: OUT + 'dia.png', timeout: 600000 });
  await p.click('[data-tod="dorada"]'); await settle(4000); await p.screenshot({ path: OUT + 'dorada.png', timeout: 600000 });
  await p.click('#photoCapture');
  await p.waitForSelector('.photo-result img', { timeout: 900000 });
  const src = await p.$eval('.photo-result img', i => i.src);
  fs.writeFileSync(OUT + 'capture.jpg', Buffer.from(src.split(',')[1], 'base64'));
  console.log('capture bytes', fs.statSync(OUT + 'capture.jpg').size);
  
  console.log([...new Set(errs)].filter(e => !e.includes('ERR_FAILED')).slice(0, 12).join('\n') || 'no errors');
  await b.close();
})();

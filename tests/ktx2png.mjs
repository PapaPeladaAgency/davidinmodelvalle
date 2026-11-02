import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const dir = process.argv[2], out = process.argv[3];
const BASIS = require('./basis.cjs');
const wasmBinary = fs.readFileSync('./npm/node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm');
const M = await BASIS({ wasmBinary });
M.initializeBasis();
const files = process.argv.slice(4);
for (const f of files) {
  const data = new Uint8Array(fs.readFileSync(f));
  const k = new M.KTX2File(data);
  if (!k.isValid()) { console.log('invalid', f); continue; }
  const w = k.getWidth(), h = k.getHeight();
  k.startTranscoding();
  const fmt = 13; // cTFRGBA32
  const size = k.getImageTranscodedSizeInBytes(0, 0, 0, fmt);
  const dst = new Uint8Array(size);
  const ok = k.transcodeImage(dst, 0, 0, 0, fmt, 0, -1, -1);
  k.close(); k.delete();
  const o = path.join(out, path.basename(f).replace('.ktx2', '.rgba'));
  fs.writeFileSync(o, dst); console.log(ok ? 'ok' : 'FAIL', o, w, h);
}

// ============================================================================
// 34-pbr.js — Biblioteca de texturas PBR reales (Poly Haven, licencia CC0)
// Archivos en tex/<nombre>_<mapa>.jpg, 512 px, convertidos desde KTX2.
// size = metros que cubre una repetición de la textura (para UV en metros).
// Si un archivo no carga, el material conserva su textura procedural.
// ============================================================================

const PBR_LIB = {
  pisoMadera:   { file: 'laminate_floor_02',       maps: ['albedo', 'normal', 'roughness'], size: 1.8, label: 'Piso laminado de roble' },
  pisoCeramica:{ file: 'marble_01',               maps: ['albedo', 'normal', 'roughness'], size: 1.6, label: 'Cerámica tipo mármol beige' },
  azulejo:      { file: 'long_white_tiles',        maps: ['albedo', 'normal'],              size: 0.9, label: 'Azulejo blanco de baño' },
  repello:      { file: 'white_plaster_02',        maps: ['normal', 'roughness'],           size: 2.4, label: 'Relieve de repello' },
  teja:         { file: 'clay_roof_tiles_02',      maps: ['albedo', 'normal', 'roughness'], size: 2.0, label: 'Teja de barro' },
  deck:         { file: 'wood_floor_deck',         maps: ['albedo', 'normal'],              size: 2.0, label: 'Terraza de madera' },
  zacate:       { file: 'leafy_grass',             maps: ['albedo', 'normal'],              size: 2.6, label: 'Zacate' },
  adoquinEco:   { file: 'grass_concrete_pavement', maps: ['albedo', 'normal'],              size: 1.6, label: 'Adoquín ecológico' },
  acera:        { file: 'concrete_pavement',       maps: ['albedo', 'normal'],              size: 2.4, label: 'Acera de concreto' },
  asfalto:      { file: 'asphalt_02',              maps: ['albedo', 'normal'],              size: 4.0, label: 'Asfalto' },
  ladrilloBarro:{ file: 'patio_tiles',             maps: ['albedo', 'normal'],              size: 1.8, label: 'Ladrillo de barro' },
  maderaMueble: { file: 'kitchen_wood',            maps: ['albedo', 'normal'],              size: 1.0, label: 'Madera de mueble' },
  robleClaro:   { file: 'WoodFloor039',            maps: ['albedo', 'normal', 'roughness'], size: 1.6, label: 'Duela de roble claro', src: 'ambientCG' },
  robleNatural: { file: 'WoodFloor040',            maps: ['albedo', 'normal', 'roughness'], size: 1.6, label: 'Duela de roble natural', src: 'ambientCG' },
  robleGris:    { file: 'WoodFloor051',            maps: ['albedo', 'normal', 'roughness'], size: 1.4, label: 'Duela de roble lavado', src: 'ambientCG' },
  marmolBlanco: { file: 'Marble001',               maps: ['albedo', 'normal', 'roughness'], size: 1.4, label: 'Mármol blanco veteado', src: 'ambientCG' },
  marmolNegro:  { file: 'Marble016',               maps: ['albedo', 'normal', 'roughness'], size: 1.2, label: 'Granito negro', src: 'ambientCG' },
  tela:         { file: 'denim_fabric_03',         maps: ['normal'],                        size: 0.35, label: 'Tejido (relieve)' },
};
const _pbrTex = {};
const PBR_STATUS = { ok: 0, failed: 0 };
function pbrTex(key, map) {
  const id = key + ':' + map;
  if (_pbrTex[id] !== undefined) return _pbrTex[id];
  const def = PBR_LIB[key];
  if (!def || !def.maps.includes(map)) return (_pbrTex[id] = null);
  const t = new THREE.TextureLoader().load(`tex/${def.file}_${map}.jpg`, () => { PBR_STATUS.ok++; }, undefined, () => { PBR_STATUS.failed++; t.userData.failed = true; });
  if (map === 'albedo') t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return (_pbrTex[id] = t);
}
// Aplica los mapas de una entrada de la biblioteca a un material existente.
// opts.albedo=false conserva el color/mapa propio y solo agrega relieve.
function applyPBR(mat, key, opts = {}) {
  const def = PBR_LIB[key]; if (!def || App.noPBR) return mat;
  if (opts.albedo !== false && def.maps.includes('albedo')) { mat.map = pbrTex(key, 'albedo'); }
  if (def.maps.includes('normal')) { mat.normalMap = pbrTex(key, 'normal'); mat.normalScale = new THREE.Vector2(opts.normal ?? 1, opts.normal ?? 1); mat.bumpMap = null; }
  if (def.maps.includes('roughness') && opts.roughness !== false) { mat.roughnessMap = pbrTex(key, 'roughness'); mat.roughness = opts.roughnessMul ?? 1; }
  mat.needsUpdate = true;
  return mat;
}
function pbrMat(key, extra = {}, opts = {}) {
  return applyPBR(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, ...extra }), key, opts);
}
const pbrSize = key => PBR_LIB[key]?.size || 1;

// ============================================================================
// 00-data.js — Trazado aproximado, catálogo demostrativo y semilla de datos
// Todo lo de este archivo es ILUSTRATIVO. El trazado se interpretó a partir de
// la imagen "plano-original.jpg" (1536 × 1024 px). Para producción, sustituir
// LAYOUT por datos topográficos/catastrales validados (mismo formato).
// ============================================================================

const PROJECT_ID = 'vss';
const PX = 0.7;               // metros aproximados por píxel de la referencia (supuesto demostrativo)
const ORIGIN_PX = [800, 450]; // píxel que se vuelve el origen del mundo 3D
const IMG_SIZE = [1536, 1024];
const pxToWorld = (px, py) => [(px - ORIGIN_PX[0]) * PX, (py - ORIGIN_PX[1]) * PX];

const STATUS = {
  disponible: { label: 'Disponible', color: '#16a34a' },
  reservado:  { label: 'Reservado',  color: '#f59e0b' },
  vendido:    { label: 'Vendido',    color: '#dc2626' },
  fuera:      { label: 'Fuera de comercialización', color: '#8b9099' },
};

const DEFAULT_STAGES = [
  { id: 1, name: 'Etapa 1', color: '#86c35a', desc: 'Sección inferior del plano. Primera etapa a desarrollar (según Opción 2 de la referencia).', selling: true },
  { id: 2, name: 'Etapa 2', color: '#6aa8de', desc: 'Sector central y hacia la derecha.', selling: true },
  { id: 3, name: 'Etapa 3', color: '#eec244', desc: 'Sección intermedia superior.', selling: true },
  { id: 4, name: 'Etapa 4', color: '#ec8f80', desc: 'Parte superior del proyecto, junto al acceso vial.', selling: true },
];

// Polígono límite aproximado (px de la imagen de referencia)
const LAYOUT = {
  boundary: [[685,125],[805,125],[826,408],[995,408],[997,470],[1075,470],[1160,590],[1160,768],[690,728],[430,702],[430,558],[588,552],[598,482],[642,330]],
  // Manzanas: [x0,y0,x1,y1] en px + etapa. Los lotes se generan dentro de cada manzana.
  blocks: [
    // Etapa 4 — parte superior de la "lengua" norte
    { s: 4, r: [697,150,742,192] }, { s: 4, r: [754,150,800,192] },
    { s: 4, r: [690,200,742,245] }, { s: 4, r: [754,200,802,245] },
    { s: 4, r: [680,253,742,305] }, { s: 4, r: [754,253,806,305] },
    // Etapa 3 — sección intermedia superior
    { s: 3, r: [672,315,742,360] }, { s: 3, r: [754,315,810,360] },
    { s: 3, r: [662,368,742,420] }, { s: 3, r: [754,368,814,420] },
    { s: 3, r: [650,428,742,478] }, { s: 3, r: [754,428,818,478] },
    // Etapa 2 — sector central y derecho
    { s: 2, r: [690,490,742,590] }, { s: 2, r: [752,542,822,590] },
    { s: 2, r: [902,418,990,466] },
    { s: 2, r: [832,478,996,528] }, { s: 2, r: [832,536,996,590] },
    // Etapa 1 — sección inferior
    { s: 1, r: [606,490,680,532] }, { s: 1, r: [606,540,680,588] },
    { s: 1, r: [438,566,586,600] },
    { s: 1, r: [438,608,498,694] }, { s: 1, r: [506,608,586,700] }, { s: 1, r: [594,598,682,706] },
    { s: 1, r: [692,606,1150,640] },
    { s: 1, r: [692,648,760,724] }, { s: 1, r: [768,648,860,732] }, { s: 1, r: [868,648,960,740] },
    { s: 1, r: [968,648,1060,748] }, { s: 1, r: [1068,648,1150,756] },
  ],
  // Áreas verdes y equipamiento (px)
  parks: [
    { id: 'parque', name: 'Parque central', poly: [[752,490],[822,490],[822,535],[752,535]], clear: [787,512,22] },
    { id: 'verdeNorte', name: 'Área verde norte', poly: [[832,418],[894,418],[894,468],[832,468]], clear: [863,443,14] },
    { id: 'comunal', name: 'Área comunal y bosque', poly: [[1002,478],[1072,478],[1150,592],[1150,598],[1002,598]], club: [1070,545] },
    { id: 'franja', name: 'Franja verde', poly: [[692,594],[996,594],[996,602],[692,602]] },
    { id: 'talud', name: 'Talud verde poniente', poly: [[600,330],[640,330],[648,425],[604,478]] },
  ],
  access: { from: [745,125], to: [745,-20], gate: [745,132] },
  highway: { y: 40 },
};

// ---------------------------------------------------------------------------
// Plano demostrativo de la vivienda de 52 m² (x = ancho, z = fondo; frente en z=0)
// Editable como JSON desde el panel. Sustituible por planos autorizados.
// ---------------------------------------------------------------------------
const PLAN_52 = {
  width: 6.5, depth: 8, height: 2.6,
  rooms: [
    { id: 'sala',     name: 'Sala',                 x: 0,    z: 0,   w: 3.4,  d: 3.6, floor: 'wood' },
    { id: 'comedor',  name: 'Comedor',              x: 3.4,  z: 0,   w: 3.1,  d: 3.6, floor: 'wood' },
    { id: 'cocina',   name: 'Cocina',               x: 4.0,  z: 3.6, w: 2.5,  d: 1.8, floor: 'tile' },
    { id: 'pasillo',  name: 'Pasillo',              x: 2.0,  z: 3.6, w: 2.0,  d: 1.8, floor: 'wood' },
    { id: 'bano',     name: 'Baño',                 x: 0,    z: 3.6, w: 2.0,  d: 1.8, floor: 'tile' },
    { id: 'hab1',     name: 'Habitación principal', x: 0,    z: 5.4, w: 3.15, d: 2.6, floor: 'wood' },
    { id: 'hab2',     name: 'Habitación 2',         x: 3.15, z: 5.4, w: 3.35, d: 2.6, floor: 'wood' },
  ],
  // Muros: a→b eje alineado. open: aberturas a lo largo del muro (distancia desde a).
  walls: [
    { a: [0,0],   b: [6.5,0], ext: true, open: [ {t:'door', f:1.0, to:1.9, main:true}, {t:'win', f:2.3, to:3.1}, {t:'win', f:4.4, to:5.8} ] },
    { a: [6.5,0], b: [6.5,8], ext: true, open: [ {t:'win', f:0.8, to:2.2}, {t:'door', f:3.75, to:4.55}, {t:'win', f:6.2, to:7.4} ] },
    { a: [0,8],   b: [6.5,8], ext: true, open: [ {t:'win', f:0.9, to:2.1, sill:1.5}, {t:'win', f:4.6, to:5.6, sill:1.2} ] },
    { a: [0,0],   b: [0,8],   ext: true, open: [ {t:'win', f:4.6, to:5.2, sill:1.6}, {t:'win', f:6.2, to:7.4} ] },
    { a: [0,3.6], b: [2.0,3.6] },
    { a: [2.0,3.6], b: [2.0,5.4], open: [ {t:'door', f:0.4, to:1.15, hinge:'b'} ] },
    { a: [4.0,3.6], b: [4.0,5.4] },
    { a: [0,5.4], b: [6.5,5.4], open: [ {t:'door', f:2.08, to:2.84}, {t:'door', f:3.22, to:3.98} ] },
    { a: [3.15,5.4], b: [3.15,8] },
  ],
  // Mobiliario ilustrativo: posición del centro (m), rotación (grados; 0 = frente mirando +z).
  // styles: lista de decoraciones donde aparece (vacío = en todas las amuebladas).
  furniture: [
    { room:'sala', item:'rug', x:1.55, z:1.9, w:2.2, d:1.7 },
    { room:'sala', item:'sofa', x:0.48, z:1.9, r:90, w:2.0 },
    { room:'sala', item:'coffeeTable', x:1.55, z:1.9 },
    { room:'sala', item:'armchair', x:1.6, z:3.12, r:180, styles:['amueblada','familiar','moderna'] },
    { room:'sala', item:'tvUnit', x:3.18, z:1.9, r:-90, w:1.6 },
    { room:'sala', item:'plant', x:0.35, z:0.35 },
    { room:'sala', item:'floorLamp', x:0.3, z:3.3, styles:['amueblada','familiar','moderna'] },
    { room:'sala', item:'picture', x:0.03, z:1.9, r:90, y:1.55, w:1.1, styles:['familiar','moderna','amueblada'] },
    { room:'comedor', item:'diningTable', x:4.9, z:1.75 },
    { room:'comedor', item:'chair', x:4.55, z:1.12, r:0 }, { room:'comedor', item:'chair', x:5.25, z:1.12, r:0 },
    { room:'comedor', item:'chair', x:4.55, z:2.38, r:180 }, { room:'comedor', item:'chair', x:5.25, z:2.38, r:180 },
    { room:'comedor', item:'sideboard', x:6.28, z:3.0, r:-90, w:1.0, styles:['amueblada','familiar','moderna'] },
    { room:'comedor', item:'pendant', x:4.9, z:1.75 },
    { room:'comedor', item:'plant', x:3.75, z:0.35, styles:['familiar','minimalista'] },
    { room:'cocina', item:'counter', x:5.25, z:5.1, r:180, w:2.5, sink:0.55, stove:-0.7 },
    { room:'cocina', item:'fridge', x:4.36, z:3.98, r:90 },
    { room:'bano', item:'toilet', x:0.36, z:4.05, r:90 },
    { room:'bano', item:'lavabo', x:1.2, z:3.83, r:0 },
    { room:'bano', item:'shower', x:0.5, z:4.95, w:1.0, d:0.9 },
    { room:'hab1', item:'bedDouble', x:1.5, z:7.03, r:180 },
    { room:'hab1', item:'nightstand', x:0.45, z:7.75, r:180 }, { room:'hab1', item:'nightstand', x:2.55, z:7.75, r:180 },
    { room:'hab1', item:'wardrobe', x:0.98, z:5.72, r:0, w:1.8 },
    { room:'hab1', item:'rug', x:1.5, z:6.25, w:1.6, d:0.8, styles:['familiar','moderna','amueblada'] },
    { room:'hab1', item:'picture', x:1.5, z:7.97, r:180, y:1.75, w:0.9, styles:['familiar','moderna'] },
    { room:'hab2', item:'bedSingle', x:6.03, z:6.98, r:180 },
    { room:'hab2', item:'bedSingle', x:4.55, z:6.98, r:180, styles:['familiar','amueblada'] },
    { room:'hab2', item:'desk', x:3.75, z:7.6, r:180, styles:['moderna','minimalista'] },
    { room:'hab2', item:'nightstand', x:5.3, z:7.75, r:180, styles:['familiar','amueblada'] },
    { room:'hab2', item:'wardrobe', x:4.95, z:5.72, r:0, w:1.4 },
    { room:'hab2', item:'plant', x:3.45, z:5.75, styles:['moderna','minimalista','familiar'] },
  ],
};

const DECOR_STYLES = [
  { id: 'vacia',       name: 'Vacía' },
  { id: 'amueblada',   name: 'Amueblada' },
  { id: 'moderna',     name: 'Moderna' },
  { id: 'minimalista', name: 'Minimalista' },
  { id: 'familiar',    name: 'Familiar' },
];

const DEFAULT_MODELS = {
  A: { id:'A', name:'Modelo A', tagline:'Casa familiar', style:'familiar', area:52, bedrooms:2, baths:1, priceHome:27500,
       approved:false, description:'Distribución práctica, fachada sencilla con techo a dos aguas y teja, decoración familiar.',
       facade:{ wall:'#f2dcc1', accent:'#c9895b', trim:'#6d4a32', roof:'gable', roofColor:'#b4552f' } },
  B: { id:'B', name:'Modelo B', tagline:'Casa contemporánea', style:'moderna', area:52, bedrooms:2, baths:1, priceHome:29900,
       approved:false, description:'Misma superficie. Volumen de techo plano con pretil, fachada bicolor y celosía de madera.',
       facade:{ wall:'#e9e6e1', accent:'#3c4a57', trim:'#2a2f35', roof:'flat', roofColor:'#5d646c' } },
  C: { id:'C', name:'Modelo C', tagline:'Casa minimalista', style:'minimalista', area:52, bedrooms:2, baths:1, priceHome:28700,
       approved:false, description:'Misma superficie. Volumen blanco, techo inclinado oculto, ventanales y decoración sencilla.',
       facade:{ wall:'#fbfaf7', accent:'#c8c2b8', trim:'#7b7f84', roof:'shed', roofColor:'#9aa0a6' } },
};

// ---------------------------------------------------------------------------
// Generación de lotes provisional a partir de las manzanas
// Código provisional: E{etapa}-M{manzana}-L{lote}. NO son números oficiales.
// ---------------------------------------------------------------------------
function generateLayoutLots() {
  const lots = [];
  const blockCount = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const b of LAYOUT.blocks) {
    blockCount[b.s]++;
    const [x0, z0] = pxToWorld(b.r[0], b.r[1]);
    const [x1, z1] = pxToWorld(b.r[2], b.r[3]);
    const W = x1 - x0, D = z1 - z0;
    const alongX = W >= D;
    const L = alongX ? W : D, S = alongX ? D : W;
    const rows = S >= 22 ? 2 : 1;
    const depth = S / rows;
    const n = Math.max(1, Math.floor(L / 7));
    const f = L / n;
    let k = 0;
    const mz = `E${b.s}-M${String(blockCount[b.s]).padStart(2, '0')}`;
    for (let row = 0; row < rows; row++) {
      for (let i = 0; i < n; i++) {
        k++;
        const u = (i + 0.5) * f;          // a lo largo
        const v = (row + 0.5) * depth;    // a lo ancho
        const cx = alongX ? x0 + u : x0 + v;
        const cz = alongX ? z0 + v : z0 + u;
        // El frente mira hacia la calle más cercana (exterior de la manzana)
        let face; // dirección del frente (vector unitario en XZ)
        if (alongX) face = row === 0 ? [0, -1] : [0, 1];
        else face = row === 0 ? [-1, 0] : [1, 0];
        if (rows === 1) face = alongX ? [0, -1] : [-1, 0];
        lots.push({
          code: `${mz}-L${String(k).padStart(2, '0')}`, stage: b.s, block: mz,
          x: cx, z: cz, front: f, depth, alongX, face,
          area: Math.round(f * depth),
        });
      }
    }
  }
  return lots;
}

// Semilla demostrativa: ~26 lotes con información comercial de ejemplo
function buildDemoSeed(layoutLots) {
  const pick = {
    1: ['E1-M07-L05','E1-M07-L06','E1-M07-L07','E1-M07-L30','E1-M08-L03','E1-M09-L04','E1-M01-L03','E1-M04-L02','E1-M10-L06'],
    2: ['E2-M01-L03','E2-M01-L09','E2-M04-L06','E2-M04-L07','E2-M05-L12','E2-M03-L04','E2-M02-L05'],
    3: ['E3-M01-L03','E3-M03-L05','E3-M05-L04','E3-M06-L10','E3-M04-L02'],
    4: ['E4-M01-L02','E4-M03-L04','E4-M05-L03','E4-M06-L06','E4-M04-L09'],
  };
  const statuses = ['disponible','disponible','reservado','disponible','vendido','disponible','reservado','disponible','vendido'];
  const modelsCycle = ['A','B','C','A','C','B'];
  const byCode = new Map(layoutLots.map(l => [l.code, l]));
  const lots = {};
  let i = 0;
  for (const s of [1,2,3,4]) {
    for (let code of pick[s]) {
      let l = byCode.get(code);
      if (!l) { // si el código no existe en el trazado, tomar el siguiente lote de esa etapa
        l = layoutLots.filter(x => x.stage === s && !lots[x.code])[i * 3 % 20];
        code = l.code;
      }
      const model = s === 4 && i % 3 === 0 ? null : modelsCycle[i % modelsCycle.length];
      const priceLot = Math.round((9500 + l.area * 28 + (4 - s) * 600) / 100) * 100;
      lots[code] = {
        projectId: PROJECT_ID, code, stage: s, status: statuses[i % statuses.length],
        priceLot, model, featured: true,
        notes: model ? 'Vivienda demostrativa asociada. Precio de ejemplo.' : 'Terreno demostrativo sin vivienda asignada.',
        updatedAt: Date.now(),
      };
      i++;
    }
  }
  const models = {};
  for (const [k, m] of Object.entries(DEFAULT_MODELS)) models[k] = { ...m, plan: JSON.parse(JSON.stringify(PLAN_52)), projectId: PROJECT_ID };
  const projects = {
    [PROJECT_ID]: {
      id: PROJECT_ID, name: 'Valle de San Sebastián', location: 'El Salvador (ubicación por confirmar)',
      description: 'Proyecto de vivienda de interés social en 4 etapas. Trazado aproximado interpretado de la referencia gráfica de trabajo técnico.',
      stages: DEFAULT_STAGES, hasLayout: true, refUrl: 'plano-original.jpg', refAssetId: null, createdAt: Date.now(),
    },
  };
  return { projects, lots, models };
}

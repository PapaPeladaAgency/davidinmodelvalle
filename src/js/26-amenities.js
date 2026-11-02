// ============================================================================
// 26-amenities.js — Áreas comunes funcionales (ilustrativas)
// Parque central, área comunal con piscina y cancha, gimnasio al aire libre,
// senderos. Cada pieza es seleccionable y abre su ficha con encuadres y reserva.
// ============================================================================

const AMENITIES = {
  parque: {
    name: 'Parque central', type: 'Recreación',
    desc: 'Corazón del residencial, entre las etapas 1, 2 y 3. Espacio familiar con sombra, juegos y quiosco para actividades comunitarias.',
    equip: ['Quiosco para eventos', 'Juegos infantiles: columpios y resbaladero', 'Senderos peatonales iluminados', 'Bancas y basureros', 'Árboles de sombra'],
    hours: '6:00 a 21:00', reservable: ['Quiosco'],
  },
  comunal: {
    name: 'Casa comunal, piscina y cancha', type: 'Equipamiento',
    desc: 'Área comunal junto al bosque conservado: salón de usos múltiples, piscina familiar con terraza y cancha multiuso.',
    equip: ['Salón de usos múltiples', 'Piscina familiar con terraza', 'Cancha multiuso (baloncesto y fútbol rápido)', 'Mesas de picnic con sombrilla', 'Bosque conservado con senderos'],
    hours: '7:00 a 20:00', reservable: ['Salón comunal', 'Cancha multiuso', 'Área de piscina'],
  },
  verdeNorte: {
    name: 'Área verde norte', type: 'Recreación',
    desc: 'Plaza verde junto a la Etapa 2 con gimnasio al aire libre y bancas.',
    equip: ['Gimnasio al aire libre', 'Sendero circular', 'Bancas', 'Árboles de sombra'],
    hours: '5:00 a 21:00', reservable: [],
  },
  franja: {
    name: 'Franja verde', type: 'Área verde',
    desc: 'Corredor arborizado que separa las etapas 1 y 2.',
    equip: ['Arborización', 'Sendero peatonal'], hours: 'Libre acceso', reservable: [],
  },
  talud: {
    name: 'Talud verde poniente', type: 'Protección ambiental',
    desc: 'Zona verde de protección en el borde poniente del proyecto.',
    equip: ['Vegetación de protección de taludes'], hours: '—', reservable: [],
  },
};

function amenityInfo(id) {
  const p = LAYOUT.parks.find(q => q.id === id); if (!p) return null;
  const pts = p.poly.map(q => pxToWorld(...q));
  let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length]; a += x1 * z2 - x2 * z1; }
  const xs = pts.map(q => q[0]), zs = pts.map(q => q[1]);
  const box = { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2, w: Math.max(...xs) - Math.min(...xs), d: Math.max(...zs) - Math.min(...zs) };
  if (p.club) { const [cx, cz] = pxToWorld(...p.club); box.x = cx - 12; box.z = cz; box.w = 70; box.d = 60; }
  return { ...AMENITIES[id], id, area: Math.round(Math.abs(a) / 2), box };
}

function buildAmenities(G, site) {
  const conc = App.noPBR ? new THREE.MeshStandardMaterial({ color: '#d6d1c6' }) : pbrMat('acera');
  const brick = App.noPBR ? new THREE.MeshStandardMaterial({ color: '#b87a55' }) : pbrMat('ladrilloBarro');
  const wood = new THREE.MeshStandardMaterial({ color: '#7a5236', roughness: 0.7 });
  const metal = new THREE.MeshStandardMaterial({ color: '#3b4046', metalness: 0.6, roughness: 0.4 });
  const yellow = new THREE.MeshStandardMaterial({ color: '#e8b631', roughness: 0.5 });
  const red = new THREE.MeshStandardMaterial({ color: '#c8432f', roughness: 0.5 });
  const blue = new THREE.MeshStandardMaterial({ color: '#2f6fb0', roughness: 0.5 });
  const lampHead = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#ffe6b0', emissiveIntensity: 0.6 });
  const grp = {};
  const box = (id, w, h, d, mat, x, y, z, uvs) => {
    const geo = new THREE.BoxGeometry(w, h, d); if (uvs) worldUV(geo, uvs, uvs, [x, y, z]);
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = h > 0.3; m.receiveShadow = true; m.userData.amenity = id;
    (grp[id] || (grp[id] = new THREE.Group())).add(m); return m;
  };
  const cy = (id, rt, rb, h, mat, x, y, z, seg = 12) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; m.userData.amenity = id;
    (grp[id] || (grp[id] = new THREE.Group())).add(m); return m;
  };
  const bench = (id, x, z, rot) => {
    const g = new THREE.Group();
    [[-0.7], [0.7]].forEach(([dx]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.45), metal); l.position.set(dx, 0.22, 0); g.add(l); });
    const s = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.45), wood); s.position.y = 0.46; g.add(s);
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.05), wood); b.position.set(0, 0.7, -0.22); g.add(b);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.amenity = id; } });
    g.position.set(x, 0.32, z); g.rotation.y = rot; (grp[id] || (grp[id] = new THREE.Group())).add(g);
  };
  const lamp = (id, x, z) => { cy(id, 0.06, 0.08, 4, metal, x, 2.3, z, 8); const h = cy(id, 0.25, 0.12, 0.3, lampHead, x, 4.35, z, 10); h.castShadow = false; };

  // ---------- Parque central ----------
  {
    const id = 'parque', P = LAYOUT.parks.find(q => q.id === id);
    const [x0, z0] = pxToWorld(P.poly[0][0], P.poly[0][1]), [x1, z1] = pxToWorld(P.poly[2][0], P.poly[2][1]);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0, y = 0.33;
    // sendero perimetral y cruz
    box(id, W - 6, 0.06, 2, conc, cx, y, z0 + 3, 2.4); box(id, W - 6, 0.06, 2, conc, cx, y, z1 - 3, 2.4);
    box(id, 2, 0.06, D - 6, conc, x0 + 3, y, cz, 2.4); box(id, 2, 0.06, D - 6, conc, x1 - 3, y, cz, 2.4);
    box(id, W - 8, 0.06, 1.6, brick, cx, y + 0.01, cz, 1.8); box(id, 1.6, 0.06, D - 8, brick, cx, y + 0.01, cz, 1.8);
    // quiosco octogonal
    const kf = cy(id, 5, 5.2, 0.4, brick, cx, y + 0.2, cz, 8); kf.receiveShadow = true;
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; cy(id, 0.15, 0.15, 3, new THREE.MeshStandardMaterial({ color: '#f1ece2' }), cx + Math.cos(a) * 4.5, y + 1.9, cz + Math.sin(a) * 4.5, 8); }
    const kroof = new THREE.Mesh(new THREE.ConeGeometry(6, 2.4, 8), App.noPBR ? red : pbrMat('teja', { color: '#f2e6dc' }));
    kroof.position.set(cx, y + 4.6, cz); kroof.rotation.y = Math.PI / 8; kroof.castShadow = true; kroof.userData.amenity = id; grp[id].add(kroof);
    // juegos infantiles
    const px = cx + W * 0.28, pz = cz - D * 0.2;
    const rubber = new THREE.MeshStandardMaterial({ color: '#3f8f6b', roughness: 0.95 });
    box(id, 12, 0.05, 8, rubber, px, y + 0.02, pz);
    [-2.2, 2.2].forEach(dx => [-0.9, 0.9].forEach(dz => { const p = cy(id, 0.07, 0.07, 2.6, yellow, px - 3 + dx, y + 1.25, pz + dz * 0.7, 8); p.rotation.x = dz * 0.25; }));
    const beam = cy(id, 0.08, 0.08, 4.6, yellow, px - 3, y + 2.5, pz, 8); beam.rotation.z = Math.PI / 2;
    [-1, 1].forEach(sx => { box(id, 0.5, 0.05, 0.25, red, px - 3 + sx, y + 0.6, pz); [-0.2, 0.2].forEach(dx => cy(id, 0.01, 0.01, 1.9, metal, px - 3 + sx + dx, y + 1.55, pz, 4)); });
    box(id, 1.4, 0.1, 1.4, blue, px + 2.5, y + 1.8, pz + 1);
    [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]].forEach(([dx, dz]) => cy(id, 0.06, 0.06, 1.8, blue, px + 2.5 + dx, y + 0.9, pz + 1 + dz, 8));
    const slide = box(id, 0.8, 0.06, 3.2, red, px + 2.5, y + 1.0, pz - 1.4); slide.rotation.x = -0.55;
    // bancas y luminarias
    [[x0 + 6, z0 + 5, 0], [cx - 10, z0 + 5, 0], [cx + 10, z1 - 5, Math.PI], [x1 - 6, z1 - 5, Math.PI], [x0 + 5, cz + 6, Math.PI / 2], [x1 - 5, cz - 6, -Math.PI / 2]].forEach(([x, z, r]) => bench(id, x, z, r));
    [[x0 + 3, z0 + 3], [x1 - 3, z0 + 3], [x0 + 3, z1 - 3], [x1 - 3, z1 - 3], [cx, z0 + 3], [cx, z1 - 3]].forEach(([x, z]) => lamp(id, x, z));
  }

  // ---------- Área verde norte: gimnasio al aire libre ----------
  {
    const id = 'verdeNorte', P = LAYOUT.parks.find(q => q.id === id);
    const [x0, z0] = pxToWorld(P.poly[0][0], P.poly[0][1]), [x1, z1] = pxToWorld(P.poly[2][0], P.poly[2][1]);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, y = 0.33;
    const ring = new THREE.Mesh(new THREE.RingGeometry(9, 11, 40), conc); ring.rotation.x = -Math.PI / 2; ring.position.set(cx, y + 0.02, cz); ring.receiveShadow = true; ring.userData.amenity = id; (grp[id] || (grp[id] = new THREE.Group())).add(ring);
    box(id, 10, 0.05, 6, new THREE.MeshStandardMaterial({ color: '#3f8f6b', roughness: 0.95 }), cx, y + 0.02, cz);
    for (let i = 0; i < 4; i++) {
      const gx = cx - 3.6 + i * 2.4;
      cy(id, 0.06, 0.06, 2.2, metal, gx - 0.6, y + 1.1, cz, 8); cy(id, 0.06, 0.06, 2.2, metal, gx + 0.6, y + 1.1, cz, 8);
      const bar = cy(id, 0.04, 0.04, 1.3, [yellow, blue, red, yellow][i], gx, y + 2.1 - i * 0.3, cz, 8); bar.rotation.z = Math.PI / 2;
    }
    [[cx - 7, cz + 7, Math.PI], [cx + 7, cz - 7, 0]].forEach(([x, z, r]) => bench(id, x, z, r));
    [[cx - 10, cz], [cx + 10, cz]].forEach(([x, z]) => lamp(id, x, z));
  }

  // ---------- Área comunal: salón, piscina, cancha ----------
  {
    const id = 'comunal', P = LAYOUT.parks.find(q => q.id === id);
    const [cx, cz] = pxToWorld(...P.club), y = 0.3;
    const wall = stuccoMat('#f1e9dc');
    // salón comunal con techo de teja y corredor
    const b = box(id, 18, 3.6, 11, wall, cx, y + 1.8, cz, 2.4);
    const rg = gableGeo(1, 1); const uv = rg.attributes.uv; for (let i = 6; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 13 / pbrSize('teja'), uv.getY(i) * 8 / pbrSize('teja'));
    const roof = new THREE.Mesh(rg, [App.noPBR ? red : pbrMat('teja', { color: '#f2e6dc' }), wall]);
    roof.rotation.y = Math.PI / 2; roof.scale.set(13, 2.6, 20); roof.position.set(cx, y + 3.6, cz); roof.castShadow = true; roof.userData.amenity = id; grp[id].add(roof);
    for (let i = 0; i < 6; i++) cy(id, 0.18, 0.2, 3.4, new THREE.MeshStandardMaterial({ color: '#f6f1e8' }), cx - 8 + i * 3.2, y + 1.7, cz + 7, 12);
    box(id, 19, 0.15, 3.2, brick, cx, y + 0.08, cz + 7, 1.8);
    const glass = new THREE.MeshPhysicalMaterial({ color: '#9ec0d4', roughness: 0.05, metalness: 0.1, envMapIntensity: 2 });
    for (let i = 0; i < 4; i++) box(id, 2.4, 1.8, 0.05, glass, cx - 6 + i * 4, y + 1.7, cz + 5.53);
    // piscina con terraza
    const pzc = cz + 20;
    box(id, 22, 0.3, 14, brick, cx, y + 0.15, pzc, 1.8);
    const water = new THREE.MeshPhysicalMaterial({ color: '#3fb4d8', roughness: 0.05, metalness: 0, transmission: 0, envMapIntensity: 1.6, clearcoat: 1 });
    const pool = box(id, 14, 0.12, 7, water, cx, y + 0.32, pzc); pool.castShadow = false;
    const edge = new THREE.MeshStandardMaterial({ color: '#efece6' });
    box(id, 14.6, 0.14, 0.3, edge, cx, y + 0.35, pzc - 3.65); box(id, 14.6, 0.14, 0.3, edge, cx, y + 0.35, pzc + 3.65);
    box(id, 0.3, 0.14, 7.6, edge, cx - 7.15, y + 0.35, pzc); box(id, 0.3, 0.14, 7.6, edge, cx + 7.15, y + 0.35, pzc);
    for (let i = 0; i < 4; i++) { const l = box(id, 0.7, 0.12, 1.9, new THREE.MeshStandardMaterial({ color: '#f4f2ec' }), cx - 6 + i * 4, y + 0.55, pzc + 5.6); l.rotation.x = -0.2; }
    [-1, 1].forEach(s => { cy(id, 0.05, 0.05, 2.4, metal, cx + s * 9, y + 1.4, pzc - 5, 6); const u = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.6, 10), new THREE.MeshStandardMaterial({ color: '#f2efe6', side: THREE.DoubleSide })); u.position.set(cx + s * 9, y + 2.7, pzc - 5); u.castShadow = true; u.userData.amenity = id; grp[id].add(u); });
    // cancha multiuso
    const kx = cx - 32, kz = cz + 4;
    box(id, 16, 0.12, 28, new THREE.MeshStandardMaterial({ color: '#4a7f9a', roughness: 0.6 }), kx, y + 0.06, kz);
    box(id, 13, 0.13, 24, new THREE.MeshStandardMaterial({ color: '#2f6a86', roughness: 0.6 }), kx, y + 0.07, kz);
    const line = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    [[13, 0.12, 0, -12], [13, 0.12, 0, 12], [13, 0.12, 0, 0], [0.12, 24, -6.5, 0], [0.12, 24, 6.5, 0]].forEach(([w, d, dx, dz]) => box(id, w, 0.14, d, line, kx + dx, y + 0.075, kz + dz));
    const cc = new THREE.Mesh(new THREE.RingGeometry(1.7, 1.82, 40), line); cc.rotation.x = -Math.PI / 2; cc.position.set(kx, y + 0.16, kz); grp[id].add(cc);
    [-1, 1].forEach(s => {
      cy(id, 0.08, 0.08, 3.4, metal, kx, y + 1.7, kz + s * 13.2, 8);
      box(id, 1.8, 1.05, 0.05, new THREE.MeshStandardMaterial({ color: '#ffffff' }), kx, y + 3.3, kz + s * 12.9);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.02, 6, 16), red); rim.rotation.x = Math.PI / 2; rim.position.set(kx, y + 3.05, kz + s * 12.6); grp[id].add(rim);
    });
    // malla perimetral de la cancha
    const mesh = new THREE.MeshStandardMaterial({ color: '#4c5a50', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    box(id, 16, 3, 0.03, mesh, kx, y + 1.5, kz - 14); box(id, 16, 3, 0.03, mesh, kx, y + 1.5, kz + 14);
    // mesas de picnic
    for (let i = 0; i < 3; i++) { const tx = cx + 18, tz = cz - 10 + i * 8; box(id, 2, 0.08, 0.9, wood, tx, y + 0.75, tz); box(id, 2, 0.06, 0.3, wood, tx, y + 0.45, tz - 0.7); box(id, 2, 0.06, 0.3, wood, tx, y + 0.45, tz + 0.7); cy(id, 0.04, 0.04, 2.4, metal, tx, y + 1.2, tz, 6); const u = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.5, 10), new THREE.MeshStandardMaterial({ color: ['#c8432f', '#2f6fb0', '#e8b631'][i], side: THREE.DoubleSide })); u.position.set(tx, y + 2.5, tz); u.castShadow = true; u.userData.amenity = id; grp[id].add(u); }
    // sendero del bosque
    for (let i = 0; i < 9; i++) box(id, 2, 0.05, 6, brick, cx + 30 + Math.sin(i) * 4, y + 0.03, cz - 24 + i * 6, 1.8);
    [[cx - 12, cz + 7], [cx + 12, cz + 7], [cx - 10, pzc + 8], [cx + 10, pzc + 8], [kx - 9, kz], [kx + 9, kz]].forEach(([x, z]) => lamp(id, x, z));
  }

  // ---------- Franja verde: sendero ----------
  {
    const id = 'franja', P = LAYOUT.parks.find(q => q.id === id);
    const [x0, z0] = pxToWorld(P.poly[0][0], P.poly[0][1]), [x1, z1] = pxToWorld(P.poly[2][0], P.poly[2][1]);
    box(id, x1 - x0 - 4, 0.05, 1.6, conc, (x0 + x1) / 2, 0.34, (z0 + z1) / 2, 2.4);
  }

  site.amenityMeshes = [];
  for (const g of Object.values(grp)) {
    mergeStatic(g);
    g.traverse(o => { if (o.isMesh) { o.userData.amenity = o.userData.amenity || Object.keys(grp).find(k => grp[k] === g); } });
    G.add(g);
  }
  for (const [k, g] of Object.entries(grp)) g.traverse(o => { if (o.isMesh) { o.userData.amenity = k; site.amenityMeshes.push(o); } });
  G.traverse(o => { if (o.isMesh && o.userData.amenity && !site.amenityMeshes.includes(o)) site.amenityMeshes.push(o); });
}

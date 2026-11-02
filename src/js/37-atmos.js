// ============================================================================
// 37-atmos.js — Atmósfera fotográfica: nubes, corrección de color, palmeras
// ============================================================================

// Capa de nubes: cúpula con textura procedural de cúmulos suaves
function makeClouds(radius = 2600, seed = 4) {
  const rnd = mulberry(seed);
  const cv = noiseCanvas(1024, (g, s) => {
    g.clearRect(0, 0, s, s);
    for (let c = 0; c < 26; c++) {
      const cx = rnd() * s, cy = s * (0.55 + rnd() * 0.33), w = 60 + rnd() * 160;
      for (let k = 0; k < 26; k++) {
        const x = cx + (rnd() - 0.5) * w * 1.6, y = cy + (rnd() - 0.5) * w * 0.35, r = w * (0.18 + rnd() * 0.3);
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(0.6, 'rgba(250,250,252,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
  });
  const t = texFrom(cv); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  const geo = new THREE.SphereGeometry(radius, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false, side: THREE.BackSide, opacity: 0.9 }));
  m.renderOrder = -1;
  return m;
}

// Corrección de color tipo fotografía de arquitectura (se aplica después del tonemapping)
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, contrast: { value: 1.07 }, saturation: { value: 1.12 }, warmth: { value: 0.02 }, vignette: { value: 0.22 }, lift: { value: 0.012 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float contrast, saturation, warmth, vignette, lift; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      col = (col - 0.5) * contrast + 0.5 + lift;
      col += vec3(warmth, warmth * 0.4, -warmth) * smoothstep(0.4, 1.0, l);
      vec2 d = vUv - 0.5; col *= 1.0 - vignette * dot(d, d) * 1.6;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};

// Palmera: tronco curvo anillado y hojas en abanico con transparencia
function frondTex() {
  if (RTEX.frond) return RTEX.frond;
  const cv = noiseCanvas(512, (g, s) => {
    g.clearRect(0, 0, s, s);
    const rnd = mulberry(8);
    g.strokeStyle = '#5b6b2e'; g.lineWidth = 6; g.beginPath(); g.moveTo(s / 2, s); g.lineTo(s / 2, 0); g.stroke();
    for (let y = 8; y < s; y += 7) {
      const t = y / s, len = Math.sin(t * Math.PI) * s * 0.46 + 10;
      for (const sd of [-1, 1]) {
        g.strokeStyle = ['#3f6b2a', '#4c7a32', '#5a8a3a', '#36602a'][Math.floor(rnd() * 4)];
        g.lineWidth = 3.2; g.beginPath(); g.moveTo(s / 2, y); g.quadraticCurveTo(s / 2 + sd * len * 0.6, y + 18, s / 2 + sd * len, y + 40 + rnd() * 10); g.stroke();
      }
    }
  });
  const t = texFrom(cv); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return (RTEX.frond = t);
}
function palmTree(h = 7, seed = 2) {
  const rnd = mulberry(seed), g = new THREE.Group();
  const lean = (rnd() - 0.5) * 1.6;
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean * 0.3, h * 0.35, 0), new THREE.Vector3(lean * 0.8, h * 0.7, 0), new THREE.Vector3(lean, h, 0)]);
  const ring = noiseCanvas(64, (c, s) => { c.fillStyle = '#8a7a63'; c.fillRect(0, 0, s, s); for (let y = 0; y < s; y += 8) { c.fillStyle = 'rgba(60,45,30,.45)'; c.fillRect(0, y, s, 2); } });
  const rt = texFrom(ring); rt.repeat.set(1, h * 2.5);
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.16, 8, false), new THREE.MeshStandardMaterial({ map: rt, roughness: 1 }));
  trunk.castShadow = true; g.add(trunk);
  const top = curve.getPoint(1);
  const fm = new THREE.MeshStandardMaterial({ map: frondTex(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.85, envMapIntensity: 0.5 });
  const n = 11;
  for (let i = 0; i < n; i++) {
    const L = 2.6 + rnd() * 0.8;
    const geo = new THREE.PlaneGeometry(1.5, L, 1, 6);
    // curvar la hoja hacia abajo
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) { const y = p.getY(k) + L / 2; p.setY(k, y); p.setZ(k, -Math.pow(y / L, 2) * L * 0.55); }
    geo.computeVertexNormals();
    const f = new THREE.Mesh(geo, fm);
    f.position.copy(top); f.rotation.order = 'YXZ'; f.rotation.y = i / n * Math.PI * 2 + rnd() * 0.3; f.rotation.x = -0.95 - rnd() * 0.45;
    f.castShadow = true; g.add(f);
  }
  const coco = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshStandardMaterial({ color: '#4d5a2a' })); coco.position.copy(top).add(new THREE.Vector3(0, -0.25, 0)); g.add(coco);
  return g;
}
const _palmTpl = {};
function palmTemplate(seed = 2) { return _palmTpl[seed] || (_palmTpl[seed] = groupToTemplate((() => { const r = new THREE.Group(); r.add(palmTree(7, seed)); return r; })())); }

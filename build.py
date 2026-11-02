#!/usr/bin/env python3
"""Ensambla src/ en un solo dist/index.html (página del artefacto)."""
import glob, os
ROOT = os.path.dirname(os.path.abspath(__file__))
read = lambda p: open(os.path.join(ROOT, p), encoding='utf-8').read()
js = '\n'.join(read(os.path.relpath(p, ROOT)) for p in sorted(glob.glob(os.path.join(ROOT, 'src/js/*.js'))))
THREE = 'https://cdn.jsdelivr.net/npm/three@0.165.0'
html = f'''<title>Valle de San Sebastián</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Mono:wght@400;600&display=swap">
<style>
{read('src/styles.css')}
</style>
{read('src/body.html')}
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script type="importmap">{{"imports":{{"three":"{THREE}/build/three.module.min.js","three/addons/":"{THREE}/examples/jsm/"}}}}</script>
<script type="module">
import * as THREE from 'three';
import {{ OrbitControls }} from 'three/addons/controls/OrbitControls.js';
import {{ Sky }} from 'three/addons/objects/Sky.js';
import {{ RoundedBoxGeometry }} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {{ EffectComposer }} from 'three/addons/postprocessing/EffectComposer.js';
import {{ RenderPass }} from 'three/addons/postprocessing/RenderPass.js';
import {{ GTAOPass }} from 'three/addons/postprocessing/GTAOPass.js';
import {{ OutputPass }} from 'three/addons/postprocessing/OutputPass.js';
import {{ ShaderPass }} from 'three/addons/postprocessing/ShaderPass.js';
import {{ UnrealBloomPass }} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {{ BokehPass }} from 'three/addons/postprocessing/BokehPass.js';
import {{ mergeGeometries }} from 'three/addons/utils/BufferGeometryUtils.js';
{js}
</script>
'''
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
open(os.path.join(ROOT, 'dist/index.html'), 'w', encoding='utf-8').write(html)
print('dist/index.html', len(html) // 1024, 'KB')

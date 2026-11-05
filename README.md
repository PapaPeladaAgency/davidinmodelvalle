# Valle de San Sebastián — Web app inmobiliaria 3D

Prototipo funcional de comercialización de vivienda: residencial en 3D con las 4 etapas del plano, casas detalladas,
maqueta tipo dollhouse, recorrido en primera persona, Modo foto, Mi cuota, favoritos, WhatsApp, citas, apartado en línea,
cotización PDF, inglés y panel administrativo con embudo de ventas.

- Versión publicada: https://claude.ai/artifact/Uxh4YK6vWHo9odCUzBT7sB (privada)
- Construir: `python3 build.py` → genera `dist/index.html` (una sola página) junto a `dist/tex/` y `dist/plano-original.jpg`
- Texturas: Poly Haven y ambientCG (CC0), ver `docs/TEXTURAS.md`
- Instalación como app en dominio propio: `pwa/README.md`


Prototipo funcional (no versión final). Todo el contenido es **demostrativo**: trazado, numeración de lotes, áreas, precios, viviendas y mobiliario.

## Estructura

```
src/js/05-i18n.js     Textos de la interfaz en español e inglés
src/js/00-data.js     Trazado aproximado (LAYOUT), plano de la vivienda de 52 m² (PLAN_52), modelos A/B/C, semilla demo
src/js/10-store.js    Persistencia: base de datos compartida del artefacto (db) o localStorage como respaldo
src/js/20-site.js     Residencial 3D: terreno, calles, manzanas, lotes (instanciados), casas, árboles, plano superpuesto
src/js/30-house.js    Vivienda generada desde JSON: muros con aberturas, pisos, techo, catálogo de muebles, entorno
src/js/40-viewer.js   Visor: Casa completa / Casa abierta (Dollhouse, plano de corte) / Recorrer interior (colisiones)
src/js/50-ui.js       Interfaz del visitante: etapas, ficha de lote, comparación, financiamiento, solicitud, plano original
src/js/60-admin.js    Panel administrativo
src/js/80-render-plus.js  N8AO y render por trazado de rayos
src/js/82-live.js     Presentación en vivo compartida
src/js/84-assistant.js  Asistente con IA
src/js/90-main.js     Arranque, cámaras, interacción, navegación
build.py              Ensambla todo en dist/index.html
dist/plano-original.jpg  Imagen de referencia entregada
```

## Plugins gratuitos que funcionan dentro de Claude

| Plugin | Archivo | Qué hace |
|---|---|---|
| N8AO 2.0.1 + postprocessing 6.36.0 (MIT) | `src/js/80-render-plus.js` | Oclusión ambiental de mayor calidad que GTAO, en escritorio. Si no carga, se mantiene GTAO. |
| three-gpu-pathtracer 0.0.23 + three-mesh-bvh 0.8.3 (MIT) | `src/js/80-render-plus.js` | Render fotorrealista progresivo (trazado de rayos) desde el Modo foto y desde la casa (botón «Render»). |
| Capacidad `room` de Claude | `src/js/82-live.js` | Presentación en vivo: quien edita el artefacto presenta y los demás ven su cámara, lote, casa y luz. Cada visitante puede explorar por su cuenta. |
| Capacidad `sample` de Claude | `src/js/84-assistant.js` | Asistente con IA que consulta el inventario con herramientas (buscar lotes, cuota, modelos, áreas) y mueve la cámara del 3D. Usa la cuenta de Claude de quien pregunta. |

Las librerías se cargan con `import()` dinámico desde jsDelivr (versiones fijadas en `build.py`), así que un fallo de red no rompe el visor.

## Datos (colecciones)

- `projects/{id}`: nombre, ubicación, etapas `[{id,name,color,desc,selling}]`, `refUrl`, `hasLayout`
- `lots/{código}`: `projectId, code, stage, status (disponible|reservado|vendido|fuera), priceLot, model, notes`
- `models/{id}`: nombre, precio de vivienda, fachada, `plan` (JSON de ambientes, muros, aberturas, mobiliario), `approved`
- `leads/{id}`: solicitudes de información con simulación adjunta

## Cómo pasar a producción sin rehacer el visor

| Reemplazar | Dónde |
|---|---|
| Trazado aproximado → topografía / lotificación oficial | `LAYOUT` (mismo formato: polígono límite, manzanas, áreas verdes) o geometría por lote en `lots` |
| Lotes ficticios → inventario real | colección `lots` (panel → Lotes, o carga masiva) |
| Precios de ejemplo → precios oficiales | `priceLot` por lote y `priceHome` por modelo |
| Distribución provisional → planos autorizados | `models/{id}.plan` (editable en panel → Modelos → Plano JSON) |
| Casas procedurales → modelos arquitectónicos (glTF) | Agregar un cargador glTF en `buildHouse` cuando `model.glbUrl` exista (requiere alojar los archivos) |
| Imagen de referencia → plano de urbanización | panel → Referencia y datos |

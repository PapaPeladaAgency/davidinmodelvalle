# Texturas para maquetas digitales — investigación y uso en el prototipo

## Qué usan los estudios de visualización arquitectónica
Los renders tipo "maqueta" (dollhouse) usan **materiales PBR** (Physically Based Rendering). Cada material se compone de varios mapas:

| Mapa | Para qué sirve |
|---|---|
| Color (albedo / base color) | Color del material sin sombras ni brillos |
| Normal | Relieve fino (juntas, veta, grano del repello) sin agregar geometría |
| Rugosidad (roughness) | Qué tan mate o brillante es cada punto |
| Oclusión ambiental (AO) | Sombras de contacto en hendiduras |
| Desplazamiento / altura | Relieve real (solo en render offline, costoso en web) |
| Metálico | Partes metálicas (herrajes, perfiles de aluminio) |

Además del material: iluminación con cielo HDR/físico, sombras suaves, oclusión ambiental y
texturas aplicadas **a escala real** (metros), no estiradas por pieza.

## Bibliotecas gratuitas con licencia CC0 (uso comercial sin atribución)
- **Poly Haven** — polyhaven.com (texturas, HDRI y modelos; CC0).
- **ambientCG** — ambientcg.com (más de 2 000 materiales; CC0).
- **cgbookcase**, **ShareTextures**, **TextureCan** — CC0 según sus sitios.
- Precaución: FreePBR no es CC0 (uso comercial con pago).

## Formato recomendado para web/móvil
- 512 px–1K para teléfonos de gama media; 2K solo en escritorio.
- Compresión KTX2 (Basis Universal) reduce memoria de video. Este prototipo usa JPG de 512 px porque
  el visor de artefactos puede bloquear el decodificador WebAssembly de KTX2.

## Set incorporado al prototipo (`dist/tex/`, Poly Haven, CC0)
| Uso | Textura | Mapas | Escala |
|---|---|---|---|
| Piso de ambientes | laminate_floor_02 | color, normal, rugosidad | 1.8 m |
| Cocina y baño | marble_01 | color, normal, rugosidad | 1.6 m |
| Ducha | long_white_tiles | color, normal | 0.9 m |
| Relieve de repello (muros) | white_plaster_02 | normal, rugosidad | 2.4 m |
| Techo de teja (Modelo A y porche) | clay_roof_tiles_02 | color, normal, rugosidad | 2.0 m |
| Terraza | wood_floor_deck | color, normal | 2.0 m |
| Jardín | leafy_grass | color, normal | 2.6 m |
| Cochera (adoquín ecológico) | grass_concrete_pavement | color, normal | 1.6 m |
| Acera | concrete_pavement | color, normal | 2.4 m |
| Calle | asphalt_02 | color, normal | 4.0 m |
| Porche y caminamiento (ladrillo de barro) | patio_tiles | color, normal | 1.8 m |
| Madera de muebles | kitchen_wood | color, normal | 1.0 m |
| Relieve de telas | denim_fabric_03 | normal | 0.35 m |

Fuente técnica: repositorio CC0 "Papyszoo/CC0-Public-Domain-Textures" (espejo de Poly Haven en KTX2 512 px),
convertido a JPG con el transcodificador Basis incluido en three.js.

## Cómo agregar o cambiar una textura
1. Copiar `tex/<nombre>_albedo.jpg`, `_normal.jpg`, `_roughness.jpg` a `dist/tex/`.
2. Registrar la entrada en `PBR_LIB` (`src/js/34-pbr.js`) con su tamaño real en metros.
3. Usar `pbrMat('<clave>')` en el material y `worldUV(geometría, pbrSize('<clave>'))` en la pieza.

## Para la versión final
Usar las texturas de los acabados reales del proyecto (fichas del fabricante o fotografías calibradas),
1K–2K comprimidas en KTX2, y complementar con renders de alta calidad desde los planos aprobados.

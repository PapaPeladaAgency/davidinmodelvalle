// ============================================================================
// 05-i18n.js — Textos de la interfaz del comprador en español e inglés
// El panel administrativo se mantiene en español.
// ============================================================================

const I18N = {
  es: {
    'brand.sub': 'Vivienda en El Salvador',
    'menu.more': 'Más', 'menu.tour': 'Presentación guiada', 'menu.plano': 'Ver plano original', 'menu.photo': 'Modo foto', 'menu.admin': 'Administración', 'menu.lang': 'English',
    'hero.eyebrow': 'Vivienda de interés social · El Salvador',
    'hero.lede': 'Elegí tu casa como si estuvieras ahí. Recorré el residencial en 3D, entrá a tu casa, calculá tu cuota y apartá tu lote desde el celular, estés donde estés.',
    'hero.cta': 'Explorá Valle de San Sebastián en 3D', 'hero.plano': 'Ver plano original',
    'hero.p1': 'Ves exactamente lo que comprás', 'hero.p2': 'Sabés si te alcanza antes de llamar', 'hero.p3': 'Comprás sin viajar',
    'hero.disc': 'Prototipo demostrativo. Trazado, viviendas, numeración de lotes y precios son ilustrativos.',
    'load.1': 'Preparando el residencial…', 'load.2': 'Plantando árboles y palmeras…', 'load.3': 'Construyendo las casas…', 'load.4': 'Listo',
    'tab.explore': 'Explorar', 'tab.houses': 'Casas', 'tab.quota': 'Mi cuota', 'tab.favs': 'Favoritos', 'tab.contact': 'Contacto',
    'f.filters': 'Filtros', 'f.layers': 'Capas', 'f.max': 'Precio máximo', 'f.any': 'Cualquiera', 'f.model': 'Modelo', 'f.all': 'Todos', 'f.only': 'Solo disponibles', 'f.clear': 'Quitar filtros', 'f.count': '{n} lotes coinciden',
    'st.disponible': 'Disponible', 'st.reservado': 'Apartado', 'st.vendido': 'Vendido', 'st.fuera': 'Sin información',
    'lot.lot': 'Lote', 'lot.total': 'Casa + terreno', 'lot.only': 'Solo terreno', 'lot.from': 'Cuota desde', 'lot.month': '/mes', 'lot.area': 'Terreno', 'lot.built': 'Construcción', 'lot.beds': 'hab.', 'lot.bath': 'baño',
    'lot.view': 'Ver casa en 3D', 'lot.reserve': 'Apartar', 'lot.whats': 'WhatsApp', 'lot.pdf': 'Cotización PDF', 'lot.share': 'Compartir', 'lot.fav': 'Guardar', 'lot.faved': 'Guardado', 'lot.example': 'Precios de ejemplo. No constituyen oferta comercial.', 'lot.nodata': 'Este terreno aún no tiene información comercial.', 'lot.similar': 'Consultar lotes similares',
    'houses.title': 'Modelos de casa', 'houses.lead': 'Mismos 52 m², tres estilos. Entrá, quitale el techo y recorrela.', 'houses.from': 'desde', 'houses.enter': 'Ver en 3D', 'houses.lots': 'Ver lotes',
    'quota.title': '¿Cuánto me alcanza?', 'quota.lead': 'Ingresá tu ingreso familiar y tu prima. Te mostramos los lotes que encajan.', 'quota.income': 'Ingreso familiar mensual (USD)', 'quota.down': 'Prima disponible (USD)', 'quota.years': 'Plazo', 'quota.rate': 'Tasa anual ilustrativa (%)', 'quota.max': 'Precio máximo recomendado', 'quota.pay': 'Cuota estimada', 'quota.fit': '{n} viviendas disponibles te alcanzan', 'quota.show': 'Ver en el mapa', 'quota.note': 'Cuota ≤ 30 % del ingreso. Simulación ilustrativa; las condiciones reales las define la entidad financiera.', 'quota.years_u': 'años',
    'favs.title': 'Tus favoritos', 'favs.empty': 'Aún no guardaste lotes. Tocá ♡ en la ficha de un lote.', 'favs.compare': 'Comparar seleccionados', 'favs.pick': 'Elegí hasta 3 para comparar',
    'c.title': 'Hablemos', 'c.lead': 'Un asesor te acompaña por WhatsApp o videollamada, en tu horario.', 'c.whats': 'Escribir por WhatsApp', 'c.book': 'Agendar visita o videollamada', 'c.progress': 'Avance de obra', 'c.abroad': 'Comprar desde el exterior', 'c.reqs': 'Requisitos (ilustrativos)',
    'c.a1': 'Elegí tu lote y tu modelo en la app', 'c.a2': 'Agendá una videollamada con tu asesor', 'c.a3': 'Apartá en línea con un depósito', 'c.a4': 'Firmá documentos de forma digital o con un apoderado', 'c.a5': 'Seguí el avance de obra desde tu teléfono',
    'c.r1': 'Documento de identidad (DUI o pasaporte)', 'c.r2': 'Constancia de ingresos o remesas', 'c.r3': 'Prima o depósito de apartado', 'c.r4': 'Precalificación con la entidad financiera',
    'book.title': 'Agendar', 'book.type': 'Tipo', 'book.visit': 'Visita al proyecto', 'book.video': 'Videollamada', 'book.date': 'Fecha', 'book.time': 'Hora (El Salvador)', 'book.your': 'En tu zona horaria', 'book.send': 'Confirmar cita',
    'res.title': 'Apartar lote', 'res.lead': 'Separá este lote con un depósito. Queda registrado y un asesor te confirma.', 'res.deposit': 'Depósito de apartado (ejemplo)', 'res.send': 'Solicitar apartado', 'res.payNote': 'Demostración: en la versión final aquí se paga con tarjeta mediante la pasarela del desarrollador.', 'res.ok': 'Solicitud de apartado registrada', 'res.okText': 'Un asesor te confirmará el apartado. Estado: pendiente de pago.',
    'form.name': 'Nombre completo', 'form.phone': 'Teléfono / WhatsApp', 'form.email': 'Correo electrónico', 'form.country': 'País de residencia', 'form.msg': 'Mensaje', 'form.ok': 'Acepto que mis datos se usen solo para esta prueba del prototipo.', 'form.need': 'Escribí tu nombre y un teléfono.',
    'share.copied': 'Enlace copiado', 'share.whats': 'Compartir por WhatsApp',
    'h.back': '← Volver', 'h.full': 'Casa completa', 'h.fullS': 'Exterior con techo', 'h.open': 'Casa abierta', 'h.openS': 'Vista maqueta', 'h.walk': 'Recorrer', 'h.walkS': 'Primera persona', 'h.decor': 'Decoración ilustrativa', 'h.env': 'Entorno', 'h.nb': 'Vecindario', 'h.maq': 'Maqueta', 'h.seeAs': 'Ver como',
    'pdf.done': 'Cotización generada', 'pdf.fail': 'No se pudo generar el PDF',
    'tour.next': 'Siguiente', 'tour.prev': 'Anterior', 'tour.end': 'Finalizar', 'tour.auto': 'Avance automático', 'tour.live': 'La aplicación sigue activa: podés tocar, girar o entrar en cualquier momento.',
  },
  en: {
    'brand.sub': 'Homes in El Salvador',
    'menu.more': 'More', 'menu.tour': 'Guided presentation', 'menu.plano': 'Original site plan', 'menu.photo': 'Photo mode', 'menu.admin': 'Admin panel', 'menu.lang': 'Español',
    'hero.eyebrow': 'Affordable housing · El Salvador',
    'hero.lede': 'Choose your home as if you were there. Explore the community in 3D, walk into your house, check your monthly payment and reserve your lot from your phone, wherever you are.',
    'hero.cta': 'Explore Valle de San Sebastián in 3D', 'hero.plano': 'Original site plan',
    'hero.p1': 'See exactly what you buy', 'hero.p2': 'Know if you can afford it first', 'hero.p3': 'Buy without traveling',
    'hero.disc': 'Demo prototype. Layout, homes, lot numbers and prices are illustrative.',
    'load.1': 'Preparing the community…', 'load.2': 'Planting trees and palms…', 'load.3': 'Building the homes…', 'load.4': 'Ready',
    'tab.explore': 'Explore', 'tab.houses': 'Homes', 'tab.quota': 'Payment', 'tab.favs': 'Saved', 'tab.contact': 'Contact',
    'f.filters': 'Filters', 'f.layers': 'Layers', 'f.max': 'Max price', 'f.any': 'Any', 'f.model': 'Model', 'f.all': 'All', 'f.only': 'Available only', 'f.clear': 'Clear filters', 'f.count': '{n} lots match',
    'st.disponible': 'Available', 'st.reservado': 'Reserved', 'st.vendido': 'Sold', 'st.fuera': 'No information',
    'lot.lot': 'Lot', 'lot.total': 'Home + lot', 'lot.only': 'Lot only', 'lot.from': 'Payments from', 'lot.month': '/mo', 'lot.area': 'Lot', 'lot.built': 'Built area', 'lot.beds': 'bed', 'lot.bath': 'bath',
    'lot.view': 'View home in 3D', 'lot.reserve': 'Reserve', 'lot.whats': 'WhatsApp', 'lot.pdf': 'PDF quote', 'lot.share': 'Share', 'lot.fav': 'Save', 'lot.faved': 'Saved', 'lot.example': 'Sample prices. Not a commercial offer.', 'lot.nodata': 'This lot has no sales information yet.', 'lot.similar': 'Ask about similar lots',
    'houses.title': 'Home models', 'houses.lead': 'Same 52 m², three styles. Walk in, lift the roof and look around.', 'houses.from': 'from', 'houses.enter': 'View in 3D', 'houses.lots': 'See lots',
    'quota.title': 'What can I afford?', 'quota.lead': 'Enter your household income and down payment. We show the lots that fit.', 'quota.income': 'Monthly household income (USD)', 'quota.down': 'Available down payment (USD)', 'quota.years': 'Term', 'quota.rate': 'Illustrative annual rate (%)', 'quota.max': 'Recommended max price', 'quota.pay': 'Estimated payment', 'quota.fit': '{n} available homes fit your budget', 'quota.show': 'Show on map', 'quota.note': 'Payment ≤ 30 % of income. Illustrative only; real terms are set by the lender.', 'quota.years_u': 'years',
    'favs.title': 'Your saved lots', 'favs.empty': 'No saved lots yet. Tap ♡ on a lot card.', 'favs.compare': 'Compare selected', 'favs.pick': 'Pick up to 3 to compare',
    'c.title': "Let's talk", 'c.lead': 'An advisor helps you on WhatsApp or video call, on your schedule.', 'c.whats': 'Message on WhatsApp', 'c.book': 'Book a visit or video call', 'c.progress': 'Construction progress', 'c.abroad': 'Buying from abroad', 'c.reqs': 'Requirements (illustrative)',
    'c.a1': 'Pick your lot and model in the app', 'c.a2': 'Book a video call with your advisor', 'c.a3': 'Reserve online with a deposit', 'c.a4': 'Sign documents digitally or through a representative', 'c.a5': 'Follow construction from your phone',
    'c.r1': 'ID (DUI or passport)', 'c.r2': 'Proof of income or remittances', 'c.r3': 'Down payment or reservation deposit', 'c.r4': 'Pre-qualification with the lender',
    'book.title': 'Book', 'book.type': 'Type', 'book.visit': 'Site visit', 'book.video': 'Video call', 'book.date': 'Date', 'book.time': 'Time (El Salvador)', 'book.your': 'In your time zone', 'book.send': 'Confirm booking',
    'res.title': 'Reserve lot', 'res.lead': 'Hold this lot with a deposit. It is recorded and an advisor confirms it.', 'res.deposit': 'Reservation deposit (sample)', 'res.send': 'Request reservation', 'res.payNote': 'Demo: in the final version you pay here by card through the developer’s payment gateway.', 'res.ok': 'Reservation request recorded', 'res.okText': 'An advisor will confirm your reservation. Status: payment pending.',
    'form.name': 'Full name', 'form.phone': 'Phone / WhatsApp', 'form.email': 'Email', 'form.country': 'Country of residence', 'form.msg': 'Message', 'form.ok': 'I agree my data is used only for this prototype test.', 'form.need': 'Enter your name and a phone number.',
    'share.copied': 'Link copied', 'share.whats': 'Share on WhatsApp',
    'h.back': '← Back', 'h.full': 'Full house', 'h.fullS': 'Exterior with roof', 'h.open': 'Open house', 'h.openS': 'Dollhouse view', 'h.walk': 'Walk', 'h.walkS': 'First person', 'h.decor': 'Illustrative decor', 'h.env': 'Setting', 'h.nb': 'Neighborhood', 'h.maq': 'Model', 'h.seeAs': 'View as',
    'pdf.done': 'Quote generated', 'pdf.fail': 'Could not generate the PDF',
    'tour.next': 'Next', 'tour.prev': 'Back', 'tour.end': 'Finish', 'tour.auto': 'Auto-advance', 'tour.live': 'The app stays live: tap, rotate or walk in at any time.',
  },
};
let LANG = (() => { try { return localStorage.getItem('vss-lang') || ((navigator.language || 'es').startsWith('en') ? 'en' : 'es'); } catch (e) { return 'es'; } })();
function t(k, vars) { let s = (I18N[LANG] && I18N[LANG][k]) || I18N.es[k] || k; if (vars) for (const [a, b] of Object.entries(vars)) s = s.replace('{' + a + '}', b); return s; }
function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.documentElement.lang = LANG;
}

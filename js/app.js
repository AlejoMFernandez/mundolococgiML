/* =========================================================
   Mercado Mundoloco · app (v6 — estructura tipo marketplace)
   Vistas: inicio · explorar · detalle · publicar · mis publicaciones
   ========================================================= */
(function () {
  'use strict';
  const C = window.ML_CONFIG || {};
  const DB = window.DB;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const TZ = 'America/Argentina/Buenos_Aires';
  const MAX = C.MAX_FOTOS || 6;

  const CATS = [
    { id: 'todo', label: 'Todo', icon: 'layout-grid' },
    { id: 'tecnologia', label: 'Tecnología', icon: 'laptop' },
    { id: 'audio', label: 'Audio y foto', icon: 'headphones' },
    { id: 'gaming', label: 'Gaming', icon: 'gamepad-2' },
    { id: 'muebles', label: 'Muebles', icon: 'armchair' },
    { id: 'hogar', label: 'Hogar y cocina', icon: 'coffee' },
    { id: 'deportes', label: 'Deportes', icon: 'bike' },
    { id: 'libros', label: 'Libros y cómics', icon: 'book-open' },
    { id: 'ropa', label: 'Ropa', icon: 'shirt' },
    { id: 'otros', label: 'Otros', icon: 'package' }
  ];
  const catOf = (id) => CATS.find((c) => c.id === id) || CATS[CATS.length - 1];
  const ESTADOS = ['nuevo', 'como nuevo', 'usado'];
  const SORTS = [
    { value: 'new', label: 'Más recientes', icon: 'clock' },
    { value: 'low', label: 'Menor precio', icon: 'arrow-up-narrow-wide' },
    { value: 'high', label: 'Mayor precio', icon: 'arrow-down-wide-narrow' },
    { value: 'save', label: 'Más ahorro vs. nuevo', icon: 'trending-down' }
  ];
  const F0 = () => ({ q: '', cat: 'todo', sort: 'new', free: false, swap: false, cond: '', sold: false });

  const S = { user: null, profile: null, products: [], blue: null, f: F0(), view: '', mineTab: 'activas', formLive: null };

  /* ---------------- utils ---------------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => Math.round(n).toLocaleString('es-AR');
  const fARS = (n) => '$ ' + num(n);
  const fUSD = (n) => 'US$ ' + num(n);
  const fmt = (n, cur) => (cur === 'USD' ? fUSD(n) : fARS(n));
  const rate = () => (S.blue && S.blue.venta) || null;
  const toARS = (n, cur) => (n == null ? null : cur === 'USD' ? (rate() ? n * rate() : null) : n);
  const toUSD = (n, cur) => (n == null ? null : cur === 'USD' ? n : (rate() ? n / rate() : null));
  const digits = (s) => String(s || '').replace(/\D/g, '');
  const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
  const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const icons = () => { if (window.lucide) lucide.createIcons({ attrs: { 'stroke-width': 1.8 } }); };
  const isDesk = () => matchMedia('(min-width:861px)').matches;

  const swapOnly = (p) => p.trueque === 'solo';
  const acceptsSwap = (p) => p.trueque === 'si' || p.trueque === 'solo';
  const isFree = (p) => !(+p.precio > 0) && !swapOnly(p);
  const qty = (p) => (p.cantidad == null ? 1 : +p.cantidad);
  const waIcon = '<span class="wa-ico" aria-hidden="true"></span>';

  function savings(p) {
    if (!p.ml_precio || swapOnly(p)) return null;
    const a = toARS(+p.precio || 0, p.moneda), b = toARS(+p.ml_precio, p.ml_moneda || 'ARS');
    if (a == null || b == null || b <= 0) return null;
    const diff = b - a;
    return { pct: Math.round((diff / b) * 100), diff, nuevoARS: b };
  }
  function ago(iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 3600) return 'hace ' + Math.max(1, Math.round(s / 60)) + ' min';
    if (s < 86400) return 'hace ' + Math.round(s / 3600) + ' h';
    const d = Math.round(s / 86400);
    return d === 1 ? 'ayer' : 'hace ' + d + ' días';
  }
  function waLink(phone, text) {
    let d = digits(phone);
    if (d.startsWith('00')) d = d.slice(2);
    if (d.startsWith('0')) d = d.slice(1);
    if (!d.startsWith('54')) d = '549' + d;
    else if (!d.startsWith('549') && d.length === 12) d = '549' + d.slice(2);
    return 'https://wa.me/' + d + '?text=' + encodeURIComponent(text);
  }
  let toastT;
  function toast(msg, kind) {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast on ' + (kind || '');
    clearTimeout(toastT); toastT = setTimeout(() => (t.className = 'toast'), 3200);
  }
  function go(hash) { if (location.hash === hash || (hash === '#/' && !location.hash)) render(); else location.hash = hash; }

  /* ---------------- dólar blue ---------------- */
  const BLUE_KEY = 'mml_blue';
  function fmtWhen(iso) {
    const d = new Date(iso); if (isNaN(d)) return '';
    return d.toLocaleDateString('es-AR', { timeZone: TZ, day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('es-AR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: true });
  }
  function paintBlue() {
    const b = S.blue, btn = $('#blue');
    btn.classList.toggle('stale', !!(b && b.stale));
    btn.classList.toggle('none', !b);
    $('#blueVal').textContent = b ? fARS(b.venta) : '—';
    $('#blueTime').textContent = b ? '· act. ' + fmtWhen(b.fecha) : '· sin datos';
    $('#bluePop').innerHTML = b
      ? `<b>Dólar blue</b><div class="bp-row"><span>Compra</span><span>${fARS(b.compra)}</span></div><div class="bp-row"><span>Venta</span><span>${fARS(b.venta)}</span></div>
         <p>Usamos el valor de <b>venta</b> para convertir todos los precios. Última actualización: ${fmtWhen(b.fecha)} hs.</p>
         <p class="bp-src">Fuente: ${esc(b.src)}${b.stale ? ' · no pudimos actualizar, mostramos el último valor guardado' : ''}</p>`
      : '<p>No pudimos traer la cotización. Los precios se muestran sin conversión.</p>';
  }
  async function fetchBlue() {
    const tries = [
      async () => { const j = await (await fetch('https://dolarapi.com/v1/dolares/blue', { cache: 'no-store' })).json(); return { venta: +j.venta, compra: +j.compra, fecha: j.fechaActualizacion, src: 'DolarAPI.com' }; },
      async () => { const j = await (await fetch('https://api.bluelytics.com.ar/v2/latest', { cache: 'no-store' })).json(); return { venta: +j.blue.value_sell, compra: +j.blue.value_buy, fecha: j.last_update, src: 'Bluelytics' }; }
    ];
    for (const t of tries) {
      try { const b = await t(); if (b.venta > 0) { try { localStorage.setItem(BLUE_KEY, JSON.stringify(b)); } catch (e) {} return b; } } catch (e) { /* siguiente */ }
    }
    return null;
  }
  function onRateChange() { paintBlue(); if (S.view === 'form') { if (S.formLive) S.formLive(); } else render(); }
  async function loadBlue() {
    if (!S.blue) { try { const c = JSON.parse(localStorage.getItem(BLUE_KEY)); if (c) S.blue = Object.assign(c, { stale: true }); } catch (e) {} }
    paintBlue();
    const b = await fetchBlue();
    if (b) S.blue = b; else if (S.blue) S.blue.stale = true;
    onRateChange();
  }

  /* ---------------- bloques de UI ---------------- */
  function thumb(p, cls) {
    const c = catOf(p.categoria);
    return p.fotos && p.fotos.length
      ? `<img class="${cls || ''}" src="${esc(p.fotos[0])}" alt="${esc(p.titulo)}" loading="lazy">`
      : `<div class="ph ${cls || ''}" data-cat="${esc(c.id)}"><i data-lucide="${c.icon}"></i></div>`;
  }
  function badge(p) {
    if (p.status === 'reservado') return '<span class="badge b-res">Reservado</span>';
    if (p.status === 'vendido') return '<span class="badge b-sold">Vendido</span>';
    if (isFree(p)) return '<span class="badge b-free">Gratis</span>';
    if (swapOnly(p)) return '<span class="badge b-swap">Trueque</span>';
    return '';
  }
  function altPrice(p) {
    const alt = p.moneda === 'USD' ? toARS(p.precio, 'USD') : toUSD(p.precio, 'ARS');
    return alt == null ? '' : '≈ ' + (p.moneda === 'USD' ? fARS(alt) : fUSD(alt));
  }
  function priceHTML(p, big) {
    const cls = big ? ' big' : '';
    if (isFree(p)) return `<div class="pr${cls}"><span class="pr-main is-free">Gratis</span></div><p class="pr-alt">Se regala 🎁</p>`;
    if (swapOnly(p)) return `<div class="pr${cls}"><span class="pr-main is-swap">Trueque</span></div><p class="pr-alt">Se cambia por otra cosa</p>`;
    const s = savings(p);
    const old = s && s.pct > 0 ? `<p class="pr-old"><s>${fmt(p.ml_precio, p.ml_moneda || 'ARS')}</s> nuevo</p>` : '';
    const alt = altPrice(p);
    return `${old}<div class="pr${cls}"><span class="pr-main">${fmt(p.precio, p.moneda)}</span>${qty(p) > 1 ? '<span class="pr-cu">c/u</span>' : ''}${s && s.pct > 0 ? `<span class="pr-off">${s.pct}% OFF</span>` : ''}</div>${alt ? `<p class="pr-alt">${alt}</p>` : ''}`;
  }
  function cardHTML(p, i) {
    const meta = [cap(p.estado), qty(p) > 1 && p.status !== 'vendido' ? `${qty(p)} disponibles` : ''].filter(Boolean).join(' · ');
    return `<a class="pc ${p.status !== 'disponible' ? 'is-' + p.status : ''}" href="#/p/${esc(p.id)}" style="--i:${Math.min(i || 0, 12)}">
      <div class="pc-img">${thumb(p)}${badge(p)}</div>
      <div class="pc-body">
        <h3 class="pc-title">${esc(p.titulo)}</h3>
        ${priceHTML(p)}
        ${p.trueque === 'si' ? '<p class="pc-swap"><i data-lucide="repeat"></i> Acepta trueque</p>' : ''}
        <p class="pc-meta">${esc(meta)}</p>
      </div>
    </a>`;
  }
  const emptyBox = (icon, title, text, cta) => `<div class="empty"><span class="empty-ico"><i data-lucide="${icon}"></i></span><h3>${title}</h3><p>${text}</p>${cta || ''}</div>`;
  const ctaPub = (label) => `<a href="#/publicar" class="btn-primary"><i data-lucide="plus"></i> ${label || 'Publicar algo'}</a>`;

  /* ---------------- filtros ---------------- */
  const avail = () => S.products.filter((p) => p.status !== 'vendido');
  const rank = (p) => (p.status === 'vendido' ? 2 : p.status === 'reservado' ? 1 : 0);
  function applyFilters(list, f, skip) {
    if (!f.sold) list = list.filter((p) => p.status !== 'vendido');
    if (skip !== 'cat' && f.cat !== 'todo') list = list.filter((p) => p.categoria === f.cat);
    if (f.free) list = list.filter(isFree);
    if (f.swap) list = list.filter(acceptsSwap);
    if (f.cond) list = list.filter((p) => p.estado === f.cond);
    if (f.q) { const q = norm(f.q); list = list.filter((p) => norm(p.titulo + ' ' + (p.descripcion || '') + ' ' + (p.vendedor_nombre || '') + ' ' + catOf(p.categoria).label).includes(q)); }
    return list;
  }
  function sortList(list, sort) {
    const price = (p) => (swapOnly(p) ? Infinity : toARS(+p.precio || 0, p.moneda) || 0);
    const sv = (p) => (savings(p) || { pct: -999 }).pct;
    const fns = {
      new: (a, b) => b.created_at.localeCompare(a.created_at),
      low: (a, b) => price(a) - price(b),
      high: (a, b) => (price(b) === Infinity ? -1 : price(a) === Infinity ? 1 : price(b) - price(a)),
      save: (a, b) => sv(b) - sv(a)
    };
    return list.slice().sort((a, b) => rank(a) - rank(b) || fns[sort](a, b));
  }
  const activeCount = () => ['free', 'swap', 'sold'].filter((k) => S.f[k]).length + (S.f.cat !== 'todo' ? 1 : 0) + (S.f.cond ? 1 : 0);
  function setFilter(patch) {
    Object.assign(S.f, patch);
    if (S.view !== 'explore') go('#/explorar'); else render();
    if (!$('#sheet').hidden && $('#sheetCard').dataset.kind === 'filters') renderFilterSheet();
  }

  /* ---------------- vistas ---------------- */
  function render() {
    const h = location.hash.replace(/^#\/?/, '');
    const [r, id] = h.split('/');
    const v = $('#view');
    S.formLive = null;
    if (r === 'p' && id) { S.view = 'detail'; viewDetail(decodeURIComponent(id)); }
    else if (r === 'explorar') { S.view = 'explore'; v.innerHTML = viewExplore(); }
    else if (r === 'mis') { S.view = 'mine'; v.innerHTML = viewMine(); }
    else if (r === 'publicar' || r === 'editar') { S.view = 'form'; viewForm(r === 'editar' ? decodeURIComponent(id || '') : null); }
    else { S.view = 'home'; v.innerHTML = viewHome(); }
    document.body.dataset.view = S.view;
    $$('#tabbar [data-tab]').forEach((t) => t.classList.toggle('on', t.dataset.tab === ({ home: 'home', explore: 'explore', mine: 'mine', form: 'pub' }[S.view] || '')));
    if (S.view !== 'detail' && S.view !== 'form') { bindCarousels(); icons(); }
  }

  /* ---- inicio ---- */
  function viewHome() {
    const av = avail();
    const active = S.products.filter((p) => p.status === 'disponible');
    const sv = active.map(savings).filter((x) => x && x.pct > 0 && x.pct < 100);
    const avg = sv.length ? Math.round(sv.reduce((a, b) => a + b.pct, 0) / sv.length) : 0;
    const count = (id) => av.filter((p) => p.categoria === id).length;

    const hero = `<section class="hero">
      <div class="hero-txt">
        <p class="kicker"><span class="dot"></span> Mercado interno · Mundoloco CGI</p>
        <h1>Lo que ya no usás, le sirve a tu <em class="mirror">compañero.</em></h1>
        <p class="hero-sub">Comprá, vendé, regalá o cambiá cosas con la gente del estudio.</p>
        <div class="hero-cta"><a href="#/publicar" class="btn-cielo"><i data-lucide="plus"></i> Publicar algo</a><a href="#/explorar" class="btn-ghost-w">Ver todo</a></div>
      </div>
      <div class="hero-stats">
        <div class="hs"><b>${active.length}</b><span>${active.length === 1 ? 'publicación activa' : 'publicaciones activas'}</span></div>
        <div class="hs"><b>${avg ? avg + '%' : '—'}</b><span>más barato que nuevo, en promedio</span></div>
        <div class="hs"><b>${rate() ? fARS(rate()) : '—'}</b><span>dólar blue de hoy</span></div>
      </div>
    </section>`;

    const cats = `<section class="sec">
      <div class="sec-h"><h2>Categorías</h2></div>
      <div class="cats">${CATS.slice(1).map((c) => { const n = count(c.id); return `<button type="button" class="cat ${n ? '' : 'is-empty'}" data-fcat="${c.id}"><span class="cat-ico"><i data-lucide="${c.icon}"></i></span><span class="cat-l">${c.label}</span><span class="cat-n">${n}</span></button>`; }).join('')}</div>
    </section>`;

    if (!S.products.length) {
      return `<div class="wrap home">${hero}${cats}${emptyBox('sparkles', 'El Mercado está recién abierto', 'Todavía no hay nada publicado. ¿Tenés algo que ya no usás? Sé el primero.', ctaPub())}</div>`;
    }
    const byNew = sortList(av, 'new');
    const grid = `<section class="sec">
      <div class="sec-h"><h2>Todas las publicaciones <span class="sec-n">${av.length}</span></h2><a class="sec-more" href="#/explorar">Filtrar y ordenar <i data-lucide="chevron-right"></i></a></div>
      <div class="grid">${byNew.map(cardHTML).join('')}</div>
    </section>`;
    return `<div class="wrap home">${hero}${cats}${grid}</div>`;
  }
  function carousel(title, icon, items, more, tone) {
    return `<section class="sec car-sec ${tone || ''}">
      <div class="sec-h"><h2><span class="sec-ico"><i data-lucide="${icon}"></i></span>${title}</h2><button type="button" class="sec-more" data-more="${more}">Ver todos <i data-lucide="chevron-right"></i></button></div>
      <div class="car">
        <button type="button" class="car-btn prev" aria-label="Anteriores"><i data-lucide="chevron-left"></i></button>
        <div class="car-track">${items.map(cardHTML).join('')}</div>
        <button type="button" class="car-btn next" aria-label="Siguientes"><i data-lucide="chevron-right"></i></button>
      </div>
    </section>`;
  }
  function bindCarousels() {
    $$('.car').forEach((c) => {
      const t = $('.car-track', c);
      const upd = () => { $('.prev', c).disabled = t.scrollLeft < 8; $('.next', c).disabled = t.scrollLeft + t.clientWidth > t.scrollWidth - 8; };
      $('.prev', c).onclick = () => t.scrollBy({ left: -t.clientWidth * 0.85, behavior: 'smooth' });
      $('.next', c).onclick = () => t.scrollBy({ left: t.clientWidth * 0.85, behavior: 'smooth' });
      t.addEventListener('scroll', upd, { passive: true }); upd();
    });
  }

  /* ---- explorar ---- */
  function filtersPanel() {
    const base = applyFilters(S.products, S.f, 'cat');
    const n = (id) => (id === 'todo' ? base.length : base.filter((p) => p.categoria === id).length);
    const tog = (k, label, icon) => `<button type="button" class="fp-tog ${S.f[k] ? 'on' : ''}" data-ftoggle="${k}" aria-pressed="${S.f[k]}"><span class="sw"></span><i data-lucide="${icon}"></i>${label}</button>`;
    return `<div class="fp">
      <div class="fp-g"><h4>Categorías</h4>
        ${CATS.map((c) => `<button type="button" class="fp-cat ${S.f.cat === c.id ? 'on' : ''} ${n(c.id) ? '' : 'is-empty'}" data-fcat="${c.id}"><i data-lucide="${c.icon}"></i><span>${c.id === 'todo' ? 'Todas' : c.label}</span><b>${n(c.id)}</b></button>`).join('')}
      </div>
      <div class="fp-g"><h4>Tipo de publicación</h4>
        ${tog('free', 'Se regala', 'gift')}
        ${tog('swap', 'Acepta trueque', 'repeat')}
      </div>
      <div class="fp-g"><h4>Condición</h4>
        <div class="fp-cond">${[['', 'Todas'], ...ESTADOS.map((e) => [e, cap(e)])].map(([v, l]) => `<button type="button" class="${S.f.cond === v ? 'on' : ''}" data-fcond="${v}">${l}</button>`).join('')}</div>
      </div>
      <div class="fp-g"><h4>Otros</h4>${tog('sold', 'Mostrar vendidos', 'archive')}</div>
      ${activeCount() || S.f.q ? '<button type="button" class="fp-clear" data-fclear><i data-lucide="x"></i> Limpiar filtros</button>' : ''}
    </div>`;
  }
  function chipsActive() {
    const ch = [];
    if (S.f.q) ch.push(['q', `“${esc(S.f.q)}”`]);
    if (S.f.cat !== 'todo') ch.push(['cat', catOf(S.f.cat).label]);
    if (S.f.free) ch.push(['free', 'Se regala']);
    if (S.f.swap) ch.push(['swap', 'Acepta trueque']);
    if (S.f.cond) ch.push(['cond', cap(S.f.cond)]);
    if (S.f.sold) ch.push(['sold', 'Con vendidos']);
    return ch.length ? `<div class="chips-on">${ch.map(([k, l]) => `<button type="button" class="chip-on" data-chip="${k}">${l} <i data-lucide="x"></i></button>`).join('')}${ch.length > 1 ? '<button type="button" class="chip-clear" data-fclear>Limpiar todo</button>' : ''}</div>` : '';
  }
  function viewExplore() {
    const list = sortList(applyFilters(S.products, S.f), S.f.sort);
    const title = S.f.q ? `Resultados para “${esc(S.f.q)}”` : S.f.cat !== 'todo' ? catOf(S.f.cat).label : S.f.free ? 'Se regalan' : S.f.swap ? 'Para trueque' : 'Todas las publicaciones';
    const sortL = SORTS.find((s) => s.value === S.f.sort).label;
    const n = activeCount();
    const empty = S.f.free && !list.length
      ? emptyBox('gift', 'Nadie está regalando nada acá (todavía)', '¿Tenés algo que ya no usás y querés que le sirva a alguien? Publicalo como regalo.', ctaPub('Regalar algo'))
      : S.f.swap && !list.length
      ? emptyBox('repeat', 'Nadie ofrece trueque acá (todavía)', '¿Querés cambiar algo por otra cosa? Publicalo y elegí trueque.', ctaPub())
      : emptyBox('search-x', 'No encontramos nada', 'Probá con otra palabra o sacá algún filtro. ¿Lo tenés vos? Publicalo.', '<button type="button" class="btn-ghost" data-fclear>Limpiar filtros</button>');
    return `<div class="wrap explore">
      <nav class="crumbs"><a href="#/" data-home>Inicio</a><i data-lucide="chevron-right"></i><span>Explorar</span></nav>
      <div class="ex-grid">
        <aside class="side" aria-label="Filtros">${filtersPanel()}</aside>
        <section class="res">
          <div class="res-h">
            <div><h1>${title}</h1><p class="res-n">${list.length} ${list.length === 1 ? 'resultado' : 'resultados'}</p></div>
            <div class="res-tools">
              <button type="button" class="tool m-only" id="openFilters"><i data-lucide="sliders-horizontal"></i> Filtrar${n ? ` <b>${n}</b>` : ''}</button>
              <button type="button" class="tool" id="sortBtn" aria-haspopup="listbox"><span class="d-only">Ordenar por</span> <b>${sortL}</b> <i data-lucide="chevron-down"></i></button>
            </div>
          </div>
          <div class="quick m-only">
            <button type="button" class="qchip ${S.f.cat !== 'todo' ? 'on' : ''}" id="qCat"><i data-lucide="${catOf(S.f.cat).icon}"></i> ${S.f.cat === 'todo' ? 'Categoría' : catOf(S.f.cat).label} <i data-lucide="chevron-down"></i></button>
            <button type="button" class="qchip ${S.f.free ? 'on' : ''}" data-ftoggle="free"><i data-lucide="gift"></i> Gratis</button>
            <button type="button" class="qchip ${S.f.swap ? 'on' : ''}" data-ftoggle="swap"><i data-lucide="repeat"></i> Trueque</button>
          </div>
          ${chipsActive()}
          ${list.length ? `<div class="grid">${list.map(cardHTML).join('')}</div>` : empty}
        </section>
      </div>
    </div>`;
  }
  function renderFilterSheet() {
    const list = applyFilters(S.products, S.f);
    openSheet(`<div class="sh-h"><h3>Filtros</h3><button type="button" class="btn-icon" data-close aria-label="Cerrar"><i data-lucide="x"></i></button></div>
      <div class="sh-b">${filtersPanel()}</div>
      <div class="sh-f"><button type="button" class="btn-primary wide" data-close>Ver ${list.length} ${list.length === 1 ? 'resultado' : 'resultados'}</button></div>`, 'filters');
  }

  /* ---- detalle ---- */
  async function viewDetail(id) {
    const v = $('#view');
    const p = S.products.find((x) => x.id === id);
    if (!p) { v.innerHTML = `<div class="wrap">${emptyBox('search-x', 'Esa publicación ya no existe', 'Puede que la hayan borrado.', '<a href="#/" class="btn-primary" data-home>Volver al inicio</a>')}</div>`; icons(); return; }
    const own = S.user && p.user_id === S.user.id;
    const s = savings(p);
    const c = catOf(p.categoria);
    const fotos = p.fotos && p.fotos.length ? p.fotos : null;
    const sold = p.status === 'vendido';

    const gallery = fotos
      ? `<div class="gal">
          ${fotos.length > 1 ? `<div class="gal-thumbs">${fotos.map((f, i) => `<button type="button" class="${i ? '' : 'on'}" data-i="${i}" aria-label="Foto ${i + 1}"><img src="${esc(f)}" alt=""></button>`).join('')}</div>` : ''}
          <div class="gal-main"><div class="gal-track" id="galTrack">${fotos.map((f, i) => `<img src="${esc(f)}" alt="${esc(p.titulo)} — foto ${i + 1}">`).join('')}</div>${badge(p)}${fotos.length > 1 ? `<span class="gal-n" id="galN">1/${fotos.length}</span>` : ''}</div>
        </div>`
      : `<div class="gal"><div class="gal-main">${thumb(p, 'ph-big')}${badge(p)}</div></div>`;

    const facts = [];
    if (qty(p) > 1 && !sold) facts.push(`<li><i data-lucide="layers"></i><span><b>${qty(p)} unidades</b> disponibles</span></li>`);
    if (p.ml_url || p.ml_precio) facts.push(`<li><i data-lucide="tag"></i><span>Nuevo en Mercado Libre: <b>${p.ml_precio ? fmt(p.ml_precio, p.ml_moneda || 'ARS') : 'ver precio'}</b>${p.ml_url ? ` <a href="${esc(p.ml_url)}" target="_blank" rel="noopener">Ver publicación <i data-lucide="arrow-up-right"></i></a>` : ''}</span></li>`);
    if (s && s.pct > 0) facts.push(`<li class="good"><i data-lucide="piggy-bank"></i><span>Te ahorrás <b>${fARS(s.diff)}</b> ${isFree(p) ? '¡lo regala!' : 'vs. comprarlo nuevo'}</span></li>`);
    if (acceptsSwap(p)) facts.push(`<li class="swap"><i data-lucide="repeat"></i><span><b>${swapOnly(p) ? 'Solo trueque' : 'También acepta trueque'}</b>${p.trueque_nota ? ` · Le interesa: ${esc(p.trueque_nota)}` : ''}</span></li>`);

    let cta = '';
    if (own) {
      cta = `<div class="owner">
        <p class="owner-t"><i data-lucide="badge-check"></i> Es tu publicación</p>
        <a class="btn-primary wide" href="#/editar/${esc(p.id)}"><i data-lucide="pencil"></i> Editar publicación</a>
        <div class="seg seg-status" role="group" aria-label="Estado">${['disponible', 'reservado', 'vendido'].map((st) => `<button type="button" data-st="${st}" class="${p.status === st ? 'on' : ''}">${cap(st)}</button>`).join('')}</div>
        ${!sold ? `<div class="stock"><span>Unidades disponibles</span><div class="stepper"><button type="button" id="qtyMinus" aria-label="Una menos"><i data-lucide="minus"></i></button><b id="qtyVal">${qty(p)}</b><button type="button" id="qtyPlus" aria-label="Una más"><i data-lucide="plus"></i></button></div></div>` : ''}
        <button type="button" class="btn-text danger" id="delBtn"><i data-lucide="trash-2"></i> Eliminar</button>
      </div>`;
    } else if (sold) {
      cta = `<button type="button" class="btn-wa" disabled>${isFree(p) ? 'Ya se lo llevaron' : 'Ya se vendió'}</button>`;
    } else {
      const label = swapOnly(p) ? 'Ofrecer trueque por WhatsApp' : 'Me interesa por WhatsApp';
      cta = S.user
        ? `<a class="btn-wa" id="waBtn" href="#" target="_blank" rel="noopener" aria-disabled="true">${waIcon} ${label}</a>
           ${p.trueque === 'si' ? `<a class="btn-swap" id="swapBtn" href="#" target="_blank" rel="noopener" aria-disabled="true"><i data-lucide="repeat"></i> Proponer un trueque</a>` : ''}
           ${p.status === 'reservado' ? '<p class="cta-note">Está reservado: podés escribir igual por si se cae.</p>' : ''}`
        : `<button type="button" class="btn-wa" data-walogin>${waIcon} ${label}</button>
           <p class="cta-note">Ingresá con tu cuenta del Mercado para ver el contacto. Es un toque.</p>`;
    }

    const status = p.status === 'reservado' ? '<p class="bb-status res"><i data-lucide="clock"></i> Reservado por alguien del equipo</p>' : sold ? '<p class="bb-status sold"><i data-lucide="archive"></i> Esta publicación ya se cerró</p>' : '';
    const specs = [
      ['Categoría', c.label], ['Condición', cap(p.estado)], ['Unidades', sold ? '—' : qty(p)],
      ['Tipo', isFree(p) ? 'Se regala' : swapOnly(p) ? 'Solo trueque' : p.trueque === 'si' ? 'Venta · acepta trueque' : 'Venta'],
      ...(!isFree(p) && !swapOnly(p) ? [['Publicado en', p.moneda === 'USD' ? 'Dólares (se convierte al blue)' : 'Pesos']] : []),
      ['Vendedor', p.vendedor_nombre || '—'], ['Publicado', ago(p.created_at)]
    ];
    const related = sortList(avail().filter((x) => x.id !== p.id && (x.categoria === p.categoria || x.user_id === p.user_id)), 'new').slice(0, 12);

    v.innerHTML = `<div class="wrap det">
      <nav class="crumbs"><a href="#/" data-home>Inicio</a><i data-lucide="chevron-right"></i><button type="button" data-fcat="${c.id}">${c.label}</button><i data-lucide="chevron-right"></i><span>${esc(p.titulo)}</span></nav>
      <div class="det-grid">
        <div class="det-gal">${gallery}</div>
        <aside class="buybox">
          <p class="bb-meta">${esc(cap(p.estado))} <span>|</span> Publicado ${ago(p.created_at)}</p>
          <h1>${esc(p.titulo)}</h1>
          ${status}
          <div class="bb-price">${priceHTML(p, true)}</div>
          ${altPrice(p) && !isFree(p) && !swapOnly(p) ? `<p class="bb-rate">Al dólar blue de hoy (${fARS(rate())})</p>` : ''}
          ${facts.length ? `<ul class="bb-facts">${facts.join('')}</ul>` : ''}
          <div class="bb-cta">${cta}</div>
          <div class="bb-seller">
            <span class="av">${esc(initials(p.vendedor_nombre))}</span>
            <div><b>${esc(p.vendedor_nombre || 'Compañero/a')}</b><span>Equipo Mundoloco</span></div>
            <button type="button" class="btn-icon" id="shareBtn" aria-label="Compartir"><i data-lucide="share-2"></i></button>
          </div>
        </aside>
        <div class="det-info">
          ${p.descripcion ? `<section class="box"><h2>Descripción</h2><p class="desc">${esc(p.descripcion).replace(/\n/g, '<br>')}</p></section>` : ''}
          <section class="box"><h2>Características</h2><table class="specs">${specs.map(([k, val]) => `<tr><th>${k}</th><td>${esc(val)}</td></tr>`).join('')}</table></section>
        </div>
      </div>
      ${related.length ? carousel('También te puede interesar', 'sparkles', related, 'cat:' + p.categoria) : ''}
    </div>
    ${!own && !sold ? `<div class="buybar"><div class="buybar-p">${isFree(p) ? '<b class="is-free">Gratis</b>' : swapOnly(p) ? '<b class="is-swap">Trueque</b>' : `<b>${fmt(p.precio, p.moneda)}</b>${altPrice(p) ? `<span>${altPrice(p)}</span>` : ''}`}</div>${S.user ? `<a class="btn-wa sm" id="waBtn2" href="#" target="_blank" rel="noopener" aria-disabled="true">${waIcon} ${swapOnly(p) ? 'Ofrecer' : 'Me interesa'}</a>` : `<button type="button" class="btn-wa sm" data-walogin>${waIcon} ${swapOnly(p) ? 'Ofrecer' : 'Me interesa'}</button>`}</div>` : ''}`;
    icons(); bindCarousels();

    // galería
    const track = $('#galTrack');
    if (track && fotos && fotos.length > 1) {
      const thumbs = $$('.gal-thumbs button');
      const setOn = (i) => { thumbs.forEach((b, j) => b.classList.toggle('on', i === j)); if ($('#galN')) $('#galN').textContent = `${i + 1}/${fotos.length}`; };
      track.addEventListener('scroll', () => setOn(Math.round(track.scrollLeft / track.clientWidth)), { passive: true });
      thumbs.forEach((b) => { const f = () => track.scrollTo({ left: track.clientWidth * +b.dataset.i, behavior: 'smooth' }); b.onclick = f; b.onmouseenter = () => isDesk() && f(); });
    }
    $('#shareBtn').onclick = async () => {
      const url = location.href.split('#')[0] + '#/p/' + p.id;
      if (navigator.share) { try { await navigator.share({ title: p.titulo, text: `${p.titulo} en el Mercado Mundoloco`, url }); } catch (e) {} }
      else { try { await navigator.clipboard.writeText(url); toast('Link copiado'); } catch (e) { prompt('Copiá el link:', url); } }
    };
    $$('[data-walogin]').forEach((b) => (b.onclick = () => openAuth('login', render, `Ingresá para escribirle a ${firstName(p.vendedor_nombre)}. Si es tu primera vez, creá tu cuenta en 30 segundos.`)));

    if (own) {
      $$('.seg-status button').forEach((b) => (b.onclick = async () => {
        const st = b.dataset.st;
        try {
          const patch = { status: st }; if (st === 'disponible' && qty(p) < 1) patch.cantidad = 1;
          await DB.patch(p.id, patch); Object.assign(p, patch);
          toast(st === 'vendido' ? '¡Felicitaciones por la venta!' : 'Estado actualizado', 'ok'); render();
        } catch (e) { toast(e.message, 'err'); }
      }));
      const setQty = async (n) => {
        if (n < 1) return confirmDialog('¿Se fue la última?', 'La publicación queda marcada como vendida.', 'Marcar vendida', async () => {
          try { await DB.patch(p.id, { cantidad: 0, status: 'vendido' }); p.cantidad = 0; p.status = 'vendido'; toast('¡Se vendió todo!', 'ok'); render(); } catch (e) { toast(e.message, 'err'); }
        });
        try { await DB.patch(p.id, { cantidad: n }); p.cantidad = n; $('#qtyVal').textContent = n; toast(n === 1 ? 'Queda 1 unidad' : `Quedan ${n} unidades`); } catch (e) { toast(e.message, 'err'); }
      };
      if ($('#qtyMinus')) { $('#qtyMinus').onclick = () => setQty(qty(p) - 1); $('#qtyPlus').onclick = () => setQty(Math.min(99, qty(p) + 1)); }
      $('#delBtn').onclick = () => confirmDialog('¿Eliminar esta publicación?', 'No se puede deshacer. Si ya la vendiste, mejor marcala como vendida.', 'Eliminar', async () => {
        try { await DB.deleteProduct(p.id); S.products = S.products.filter((x) => x.id !== p.id); toast('Publicación eliminada'); go('#/mis'); } catch (e) { toast(e.message, 'err'); }
      });
    }

    if (S.user && !own && !sold) {
      const contact = await DB.getContact(p.user_id).catch(() => null);
      if (S.view !== 'detail' || !$('#waBtn')) return;
      if (contact && contact.whatsapp) {
        const me = firstName(S.profile && S.profile.nombre);
        const hola = `¡Hola ${firstName(contact.nombre)}! 👋${me ? ' Soy ' + me + '.' : ''}`;
        const link = `${location.href.split('#')[0]}#/p/${p.id}`;
        const cuerpo = isFree(p) ? `Me copa “${p.titulo}” que estás regalando en el Mercado, ¿todavía está? 🙌`
          : swapOnly(p) ? `Vi que ofrecés “${p.titulo}” para trueque en el Mercado. ¿Qué buscás a cambio? Yo te puedo ofrecer: `
          : `Me interesa “${p.titulo}” que subiste al Mercado, ¿todavía está?`;
        const main = waLink(contact.whatsapp, `${hola} ${cuerpo}\n${link}`);
        ['#waBtn', '#waBtn2'].forEach((sel) => { const b = $(sel); if (b) { b.href = main; b.removeAttribute('aria-disabled'); } });
        const sb = $('#swapBtn');
        if (sb) { sb.href = waLink(contact.whatsapp, `${hola} Me interesa “${p.titulo}” que subiste al Mercado. ¿Te copa un trueque? Te puedo ofrecer: \n${link}`); sb.removeAttribute('aria-disabled'); }
      } else {
        $('.bb-cta').innerHTML = `<p class="cta-note">${esc(firstName(p.vendedor_nombre))} todavía no cargó su WhatsApp. Buscalo/a en la oficina 🙂</p>`;
        if ($('.buybar')) $('.buybar').remove();
      }
    }
  }

  /* ---- mis publicaciones ---- */
  function viewMine() {
    if (!S.user) {
      setTimeout(() => openAuth('login', render, 'Ingresá para ver y administrar tus publicaciones.'));
      return `<div class="wrap">${emptyBox('package', 'Tus publicaciones', 'Ingresá para ver lo que publicaste.', '<button type="button" class="btn-primary" data-login>Ingresar</button>')}</div>`;
    }
    const mine = sortList(S.products.filter((p) => p.user_id === S.user.id), 'new');
    const act = mine.filter((p) => p.status !== 'vendido'), sold = mine.filter((p) => p.status === 'vendido');
    const list = S.mineTab === 'vendidas' ? sold : act;
    const row = (p) => {
      const st = p.status;
      const price = isFree(p) ? 'Gratis' : swapOnly(p) ? 'Trueque' : fmt(p.precio, p.moneda) + (qty(p) > 1 ? ' c/u' : '');
      return `<div class="mrow">
        <a class="mrow-img" href="#/p/${esc(p.id)}">${thumb(p)}</a>
        <div class="mrow-main">
          <a class="mrow-t" href="#/p/${esc(p.id)}">${esc(p.titulo)}</a>
          <p class="mrow-p">${price}</p>
          <p class="mrow-meta"><span class="pill pill-${st}">${cap(st)}</span>${st !== 'vendido' && qty(p) > 1 ? `<span>${qty(p)} disponibles</span>` : ''}<span>${ago(p.created_at)}</span></p>
        </div>
        <div class="mrow-act">
          <a class="btn-sm" href="#/editar/${esc(p.id)}"><i data-lucide="pencil"></i><span>Editar</span></a>
          ${st === 'vendido'
            ? `<button type="button" class="btn-sm" data-mst="disponible" data-id="${esc(p.id)}"><i data-lucide="rotate-ccw"></i><span>Republicar</span></button>`
            : `<button type="button" class="btn-sm" data-mst="${st === 'reservado' ? 'disponible' : 'reservado'}" data-id="${esc(p.id)}"><i data-lucide="${st === 'reservado' ? 'circle-check' : 'clock'}"></i><span>${st === 'reservado' ? 'Disponible' : 'Reservar'}</span></button>
               <button type="button" class="btn-sm ok" data-mst="vendido" data-id="${esc(p.id)}"><i data-lucide="check"></i><span>Vendida</span></button>`}
        </div>
      </div>`;
    };
    return `<div class="wrap mine">
      <nav class="crumbs"><a href="#/" data-home>Inicio</a><i data-lucide="chevron-right"></i><span>Mis publicaciones</span></nav>
      <div class="page-h"><h1>Mis publicaciones</h1><a href="#/publicar" class="btn-primary sm d-only"><i data-lucide="plus"></i> Publicar</a></div>
      <div class="tabs" role="tablist">
        <button type="button" role="tab" class="${S.mineTab === 'activas' ? 'on' : ''}" data-mtab="activas">Activas <b>${act.length}</b></button>
        <button type="button" role="tab" class="${S.mineTab === 'vendidas' ? 'on' : ''}" data-mtab="vendidas">Vendidas <b>${sold.length}</b></button>
      </div>
      ${list.length ? `<div class="mlist">${list.map(row).join('')}</div>`
        : S.mineTab === 'vendidas' ? emptyBox('archive', 'Todavía no cerraste ninguna', 'Cuando marques algo como vendido aparece acá.', '')
        : emptyBox('package-open', 'No tenés nada publicado', 'Sacale una foto a eso que ya no usás y en un minuto está online.', ctaPub())}
    </div>`;
  }

  /* ---- publicar / editar (3 pasos) ---- */
  function moneyInput(name, val) { return `<input name="${name}" inputmode="numeric" autocomplete="off" value="${val ? num(val) : ''}" placeholder="0" class="money">`; }
  function viewForm(id) {
    const v = $('#view');
    if (!S.user) {
      v.innerHTML = `<div class="wrap">${emptyBox('plus', 'Publicá en el Mercado', 'Para publicar necesitás una cuenta, así te pueden escribir por WhatsApp.', '<button type="button" class="btn-primary" data-login="signup">Crear cuenta o ingresar</button>')}</div>`;
      icons(); setTimeout(() => openAuth('signup', render, 'Para publicar necesitás una cuenta (así te pueden escribir).'));
      return;
    }
    const p = id ? S.products.find((x) => x.id === id) : null;
    if (id && (!p || p.user_id !== S.user.id)) { toast('No podés editar esa publicación'); go('#/'); return; }
    const d = p || { moneda: 'ARS', ml_moneda: 'ARS', estado: 'usado', categoria: '', trueque: 'no', cantidad: 1 };
    const val = {
      categoria: d.categoria, estado: d.estado,
      tipo: p ? (isFree(p) ? 'gratis' : swapOnly(p) ? 'trueque' : 'venta') : 'venta',
      moneda: d.moneda === 'USD' ? 'USD' : 'ARS', ml_moneda: d.ml_moneda || 'ARS', alsoSwap: d.trueque === 'si'
    };
    let photos = (d.fotos || []).map((u) => ({ url: u }));
    let step = 1; const visited = new Set([1]); if (p) [2, 3].forEach((n) => visited.add(n));

    v.innerHTML = `<div class="wrap pub">
      <nav class="crumbs"><a href="#/" data-home>Inicio</a><i data-lucide="chevron-right"></i><span>${p ? 'Editar publicación' : 'Publicar'}</span></nav>
      <div class="pub-h"><h1>${p ? 'Editar publicación' : '¿Qué vas a publicar?'}</h1><p>${p ? 'Cambiá lo que quieras y guardá.' : 'Tres pasos cortos y está online para todo el estudio.'}</p></div>
      <ol class="steps" id="steps">${['Producto', 'Precio', 'Detalles'].map((t, i) => `<li><button type="button" data-step="${i + 1}"><span class="st-n">${i + 1}</span><span class="st-t">${t}</span></button></li>`).join('')}</ol>
      <div class="pub-grid">
        <form id="pf" class="pub-form" novalidate>
          <section class="pstep" data-step="1">
            <h2>Producto</h2>
            <div class="fld"><span>Fotos <em>La primera es la portada · hasta ${MAX}</em></span><div class="photos" id="photos"></div><input type="file" id="fileIn" accept="image/*" multiple hidden></div>
            <label class="fld"><span>Título</span><input name="titulo" maxlength="80" value="${esc(d.titulo || '')}" placeholder="Ej: Monitor Dell 27 pulgadas 4K"><small>Marca, modelo y lo más importante. Así lo encuentran en el buscador.</small></label>
            <div class="fld"><span>Categoría</span><div class="pick" id="pickCat">${CATS.slice(1).map((c) => `<button type="button" data-v="${c.id}" class="${d.categoria === c.id ? 'on' : ''}"><i data-lucide="${c.icon}"></i>${c.label}</button>`).join('')}</div></div>
            <div class="fld"><span>Condición</span><div class="seg" id="pickEstado">${ESTADOS.map((e) => `<button type="button" data-v="${e}" class="${d.estado === e ? 'on' : ''}">${cap(e)}</button>`).join('')}</div></div>
          </section>

          <section class="pstep" data-step="2" hidden>
            <h2>Precio y condiciones</h2>
            <div class="fld"><span>¿Cómo lo querés publicar?</span>
              <div class="tipo" id="pickTipo">
                <button type="button" data-v="venta"><i data-lucide="tag"></i><b>Vender</b><span>Con precio en $ o US$</span></button>
                <button type="button" data-v="gratis"><i data-lucide="gift"></i><b>Regalar</b><span>Gratis para un compañero</span></button>
                <button type="button" data-v="trueque"><i data-lucide="repeat"></i><b>Solo trueque</b><span>Lo cambiás por otra cosa</span></button>
              </div>
            </div>
            <div id="ventaBox">
              <div class="fld"><span>Precio</span>
                <div class="money-row"><div class="cur" id="curP">${['ARS', 'USD'].map((c) => `<button type="button" data-v="${c}" class="${val.moneda === c ? 'on' : ''}">${c === 'ARS' ? '$' : 'US$'}</button>`).join('')}</div>${moneyInput('precio', p && !isFree(p) && !swapOnly(p) ? d.precio : null)}</div>
                <small id="convP"></small>
              </div>
              <button type="button" class="switch ${val.alsoSwap ? 'on' : ''}" id="alsoSwap" aria-pressed="${val.alsoSwap}"><span class="sw"></span><span><b>También acepto trueque</b><small>Te pueden ofrecer otra cosa a cambio</small></span></button>
            </div>
            <p class="tipo-note" id="tipoNote"></p>
            <label class="fld" id="swapNote"><span>¿Qué te interesaría a cambio? <em>Opcional</em></span><input name="trueque_nota" maxlength="120" value="${esc(d.trueque_nota || '')}" placeholder="Ej: un monitor, auriculares, lo que tengas…"></label>
            <div class="fld fld-row"><span>Unidades disponibles<em>Si tenés varias iguales</em></span>
              <div class="stepper big"><button type="button" id="fQtyMinus" aria-label="Una menos"><i data-lucide="minus"></i></button><input name="cantidad" inputmode="numeric" value="${Math.max(1, qty(d))}" aria-label="Unidades"><button type="button" id="fQtyPlus" aria-label="Una más"><i data-lucide="plus"></i></button></div>
            </div>
          </section>

          <section class="pstep" data-step="3" hidden>
            <h2>Detalles <em>Opcionales, pero ayudan a vender</em></h2>
            <div class="ml-box">
              <h3><i data-lucide="tag"></i> ¿Cuánto sale nuevo?</h3>
              <p class="hint">Buscalo en Mercado Libre, pegá el link y el precio. Le mostramos al comprador cuánto se ahorra.</p>
              <button type="button" class="btn-ml" id="mlSearch"><i data-lucide="search"></i><span class="btn-ml-t">Buscar “<span id="mlQ">${esc(d.titulo || 'tu producto')}</span>” en Mercado Libre</span><i data-lucide="arrow-up-right"></i></button>
              <label class="fld"><span>Link de la publicación</span><input name="ml_url" type="url" inputmode="url" value="${esc(d.ml_url || '')}" placeholder="https://articulo.mercadolibre.com.ar/…"></label>
              <div class="fld"><span>Precio nuevo</span><div class="money-row"><div class="cur" id="curML">${['ARS', 'USD'].map((c) => `<button type="button" data-v="${c}" class="${val.ml_moneda === c ? 'on' : ''}">${c === 'ARS' ? '$' : 'US$'}</button>`).join('')}</div>${moneyInput('ml_precio', d.ml_precio)}</div></div>
              <div class="save-prev" id="savePrev" hidden></div>
            </div>
            <label class="fld"><span>Descripción</span><textarea name="descripcion" rows="5" maxlength="1200" placeholder="Estado, qué incluye, dónde se retira…">${esc(d.descripcion || '')}</textarea></label>
          </section>

          <div class="pub-nav">
            <p class="form-err" id="pfErr" role="alert"></p>
            <div class="pub-nav-btns">
              <button type="button" class="btn-ghost" id="pfBack">Atrás</button>
              <button type="button" class="btn-primary" id="pfNext">Siguiente <i data-lucide="arrow-right"></i></button>
              <button type="submit" class="btn-primary" id="pfBtn" hidden>${p ? 'Guardar cambios' : 'Publicar'}</button>
            </div>
          </div>
        </form>
        <aside class="pub-prev"><p class="pub-prev-t"><i data-lucide="eye"></i> Así lo van a ver</p><div id="prevCard" class="prev-card"></div><p class="hint">Fijate que el título y la foto se entiendan de un vistazo.</p></aside>
      </div>
    </div>`;

    const f = $('#pf');
    const parse = (n) => { const x = digits(f[n].value); return x ? +x : null; };
    const pick = (sel, key, after) => $$(sel + ' button').forEach((b) => (b.onclick = () => { val[key] = b.dataset.v; $$(sel + ' button').forEach((x) => x.classList.toggle('on', x === b)); after && after(); }));
    pick('#pickCat', 'categoria', live); pick('#pickEstado', 'estado', live); pick('#pickTipo', 'tipo', live); pick('#curP', 'moneda', live); pick('#curML', 'ml_moneda', live);
    $$('#pickTipo button').forEach((b) => b.classList.toggle('on', b.dataset.v === val.tipo));
    $('#alsoSwap').onclick = () => { val.alsoSwap = !val.alsoSwap; $('#alsoSwap').classList.toggle('on', val.alsoSwap); $('#alsoSwap').setAttribute('aria-pressed', val.alsoSwap); live(); };
    $$('.money', f).forEach((i) => i.addEventListener('input', () => { const x = digits(i.value); i.value = x ? num(+x) : ''; live(); }));
    const qIn = f.cantidad, clampQ = (n) => Math.max(1, Math.min(99, n || 1));
    qIn.addEventListener('input', () => { qIn.value = digits(qIn.value).slice(0, 2); live(); });
    qIn.addEventListener('blur', () => { qIn.value = clampQ(+qIn.value); live(); });
    $('#fQtyMinus').onclick = () => { qIn.value = clampQ(+qIn.value - 1); live(); };
    $('#fQtyPlus').onclick = () => { qIn.value = clampQ(+qIn.value + 1); live(); };
    f.titulo.addEventListener('input', () => { $('#mlQ').textContent = f.titulo.value.trim() || 'tu producto'; live(); });
    f.trueque_nota.addEventListener('input', live);
    $('#mlSearch').onclick = () => {
      const q = norm(f.titulo.value.trim()).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (!q) { toast('Primero escribí el título'); return; }
      window.open('https://listado.mercadolibre.com.ar/' + q, '_blank', 'noopener');
    };

    function current() {
      const tipo = val.tipo;
      return {
        titulo: f.titulo.value.trim(), categoria: val.categoria || 'otros', estado: val.estado,
        precio: tipo === 'venta' ? (parse('precio') || 0) : 0, moneda: tipo === 'venta' ? val.moneda : 'ARS',
        cantidad: clampQ(+digits(qIn.value)), trueque: tipo === 'trueque' ? 'solo' : tipo === 'venta' && val.alsoSwap ? 'si' : 'no',
        trueque_nota: f.trueque_nota.value.trim(), ml_url: f.ml_url.value.trim(), ml_precio: parse('ml_precio'), ml_moneda: val.ml_moneda,
        descripcion: f.descripcion.value.trim()
      };
    }
    function live() {
      const t = val.tipo, cur = current();
      $('#ventaBox').hidden = t !== 'venta';
      $('#swapNote').hidden = !(t === 'trueque' || (t === 'venta' && val.alsoSwap));
      $('#tipoNote').innerHTML = t === 'gratis' ? '🎁 Se publica como <b>regalo</b>. El que lo quiera te escribe por WhatsApp.' : t === 'trueque' ? '🔄 Se publica <b>sin precio</b>, solo para cambiar por otra cosa.' : '';
      $('#tipoNote').hidden = t === 'venta';
      const pr = cur.precio;
      $('#convP').innerHTML = t === 'venta' && pr && rate() ? (val.moneda === 'USD' ? `≈ ${fARS(pr * rate())} al blue de hoy (${fARS(rate())})` : `≈ ${fUSD(pr / rate())} al blue de hoy (${fARS(rate())})`) : val.moneda === 'USD' ? 'El precio en pesos se actualiza solo con el blue.' : '';
      const sp = $('#savePrev'), mp = cur.ml_precio;
      if (mp && t !== 'trueque' && (pr || t === 'gratis')) {
        const s = savings({ precio: pr, moneda: cur.moneda, ml_precio: mp, ml_moneda: val.ml_moneda });
        sp.hidden = !s;
        if (s) {
          sp.innerHTML = t === 'gratis' ? `<i data-lucide="gift"></i> El que se lo lleve se ahorra <b>${fARS(s.diff)}</b>. ¡Buena onda!`
            : s.pct > 0 ? `<i data-lucide="sparkles"></i> Tu precio es <b>${s.pct}% menos</b> que nuevo: el comprador se ahorra <b>${fARS(s.diff)}</b>.`
            : `<i data-lucide="alert-triangle"></i> Tu precio está ${s.pct === 0 ? 'igual que' : 'por encima de'} nuevo. Quizás te conviene bajarlo.`;
          sp.className = 'save-prev ' + (s.pct > 0 ? 'good' : 'warn');
        }
      } else sp.hidden = true;
      // vista previa
      const fake = Object.assign({ id: 'preview', status: 'disponible', created_at: new Date().toISOString(), vendedor_nombre: S.profile && S.profile.nombre }, cur,
        { titulo: cur.titulo || 'Título de tu publicación', fotos: photos.length ? [photos[0].preview || photos[0].url] : [], categoria: val.categoria || 'otros' });
      $('#prevCard').innerHTML = cardHTML(fake).replace(/href="[^"]*"/, 'href="#" tabindex="-1" onclick="return false"');
      icons();
    }
    S.formLive = live;

    function showStep(n) {
      step = n; visited.add(n);
      $$('.pstep', f).forEach((s) => (s.hidden = +s.dataset.step !== n));
      $$('#steps button').forEach((b) => { const k = +b.dataset.step; b.parentElement.className = k === n ? 'on' : visited.has(k) ? 'done' : ''; b.disabled = !visited.has(k); });
      $('#pfBack').hidden = n === 1; $('#pfNext').hidden = n === 3; $('#pfBtn').hidden = n !== 3;
      $('#pfErr').textContent = '';
      f.dataset.step = n; $('.pub-grid').dataset.step = n;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function check(n) {
      const cur = current(), err = $('#pfErr');
      const fail = (m) => { err.textContent = m; return false; };
      if (n >= 1) {
        if (cur.titulo.length < 3) { if (step !== 1) showStep(1); f.titulo.focus(); return fail('Ponele un título (mínimo 3 letras).'); }
        if (!val.categoria) { if (step !== 1) showStep(1); return fail('Elegí una categoría.'); }
      }
      if (n >= 2 && val.tipo === 'venta' && !cur.precio) { if (step !== 2) showStep(2); f.precio.focus(); return fail('Poné un precio, o elegí “Regalar” o “Solo trueque”.'); }
      if (n >= 3 && cur.ml_url && !/mercadoli(b|v)re\.com|meli\.la/i.test(cur.ml_url)) return fail('El link tiene que ser de Mercado Libre.');
      return true;
    }
    $('#pfNext').onclick = () => { if (check(step)) showStep(step + 1); };
    $('#pfBack').onclick = () => showStep(Math.max(1, step - 1));
    $$('#steps button').forEach((b) => (b.onclick = () => { const k = +b.dataset.step; if (k < step || check(k - 1)) showStep(k); }));

    // fotos
    function renderPhotos() {
      const box = $('#photos');
      box.innerHTML = photos.map((ph, i) => `<div class="ph-item ${i === 0 ? 'cover' : ''}">
          <img src="${esc(ph.preview || ph.url)}" alt="Foto ${i + 1}">
          ${i === 0 ? '<span class="ph-badge">Portada</span>' : `<button type="button" class="ph-cover" data-i="${i}">Portada</button>`}
          <button type="button" class="ph-del" data-i="${i}" aria-label="Quitar foto"><i data-lucide="x"></i></button>
        </div>`).join('') +
        (photos.length < MAX ? `<button type="button" class="ph-add" id="phAdd"><i data-lucide="camera"></i><span>${photos.length ? 'Agregar' : 'Subir fotos'}</span><small>${photos.length}/${MAX}</small></button>` : '');
      $$('.ph-del', box).forEach((b) => (b.onclick = () => { const r = photos.splice(+b.dataset.i, 1)[0]; if (r.preview) URL.revokeObjectURL(r.preview); renderPhotos(); }));
      $$('.ph-cover', box).forEach((b) => (b.onclick = () => { const [x] = photos.splice(+b.dataset.i, 1); photos.unshift(x); renderPhotos(); }));
      if ($('#phAdd')) $('#phAdd').onclick = () => $('#fileIn').click();
      icons(); live();
    }
    function addFiles(files) {
      const imgs = Array.from(files).filter((x) => /^image\//.test(x.type));
      const room = MAX - photos.length;
      imgs.slice(0, room).forEach((file) => photos.push({ file, preview: URL.createObjectURL(file) }));
      if (imgs.length > room) toast(`Máximo ${MAX} fotos`);
      renderPhotos();
    }
    $('#fileIn').onchange = (e) => { addFiles(e.target.files); e.target.value = ''; };
    const zone = $('#photos');
    ['dragover', 'dragenter'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('drag'); }));
    zone.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));

    f.onsubmit = async (e) => {
      e.preventDefault();
      if (!check(3)) return;
      const cur = current();
      let mlUrl = cur.ml_url; if (mlUrl && !/^https?:\/\//i.test(mlUrl)) mlUrl = 'https://' + mlUrl;
      const btn = $('#pfBtn'); btn.disabled = true; btn.classList.add('loading');
      try {
        const urls = [];
        for (let i = 0; i < photos.length; i++) {
          const ph = photos[i];
          if (ph.file) { btn.textContent = `Subiendo fotos ${i + 1}/${photos.length}…`; ph.url = await DB.uploadPhoto(ph.file, S.user.id); delete ph.file; }
          urls.push(ph.url);
        }
        btn.textContent = 'Guardando…';
        const row = {
          titulo: cur.titulo, categoria: cur.categoria, estado: cur.estado, precio: cur.precio, moneda: cur.moneda,
          cantidad: cur.cantidad, trueque: cur.trueque, trueque_nota: cur.trueque === 'no' ? '' : cur.trueque_nota,
          ml_url: mlUrl || null, ml_precio: cur.ml_precio || null, ml_moneda: cur.ml_moneda,
          descripcion: cur.descripcion, fotos: urls,
          vendedor_nombre: (S.profile && S.profile.nombre) || S.user.email.split('@')[0]
        };
        if (p) row.id = p.id; else row.user_id = S.user.id;
        const saved = await DB.saveProduct(row);
        await loadProducts(true);
        toast(p ? 'Cambios guardados' : val.tipo === 'gratis' ? '¡Publicado! Alguien se va a poner contento 🎁' : '¡Publicado! Ya lo ven todos en el estudio 🎉', 'ok');
        location.hash = '#/p/' + saved.id;
      } catch (ex) { $('#pfErr').textContent = ex.message; }
      finally { if (document.body.contains(btn)) { btn.disabled = false; btn.classList.remove('loading'); btn.textContent = p ? 'Guardar cambios' : 'Publicar'; } }
    };

    renderPhotos(); showStep(1); icons();
  }

  /* ---------------- capas ---------------- */
  function openSheet(html, kind) {
    const card = $('#sheetCard'); card.dataset.kind = kind || ''; card.innerHTML = html;
    $('#sheet').hidden = false; document.body.classList.add('locked'); icons();
  }
  function closeSheet() { $('#sheet').hidden = true; if ($('#dialog').hidden) document.body.classList.remove('locked'); }
  function openDialog(html) {
    $('#dialogCard').innerHTML = html; $('#dialog').hidden = false; document.body.classList.add('locked'); icons();
    const f = $('#dialogCard input'); if (f && isDesk()) f.focus();
  }
  function closeDialog() { $('#dialog').hidden = true; if ($('#sheet').hidden) document.body.classList.remove('locked'); }
  $('#sheet').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeSheet(); });
  $('#dialog').addEventListener('click', (e) => { if (e.target.closest('[data-dclose]')) closeDialog(); });

  // menú desplegable genérico (ordenar / categoría)
  function openMenu(anchor, title, opts, current, onPick) {
    const menu = $('#ddMenu');
    menu.innerHTML = `<p class="dd-title">${title}</p>` + opts.map((o) => `<button type="button" role="option" aria-selected="${o.value === current}" class="dd-opt ${o.value === current ? 'on' : ''} ${o.count === 0 ? 'is-empty' : ''}" data-v="${o.value}">
        <span class="dd-ico"><i data-lucide="${o.icon}"></i></span><span class="dd-lbl">${o.label}</span>${o.count != null ? `<span class="dd-n">${o.count}</span>` : ''}${o.value === current ? '<i data-lucide="check" class="dd-check"></i>' : ''}</button>`).join('');
    $$('.dd-opt', menu).forEach((b) => (b.onclick = () => { closeMenu(); onPick(b.dataset.v); }));
    $('#ddLayer').hidden = false;
    if (isDesk()) {
      const r = anchor.getBoundingClientRect();
      menu.style.left = Math.max(12, Math.min(r.right - 300, innerWidth - 312)) + 'px';
      menu.style.top = (r.bottom + 8) + 'px';
    } else { menu.style.left = ''; menu.style.top = ''; document.body.classList.add('locked'); }
    icons();
    ($('.dd-opt.on', menu) || $('.dd-opt', menu)).focus({ preventScroll: true });
  }
  function closeMenu() { if ($('#ddLayer').hidden) return; $('#ddLayer').hidden = true; if ($('#sheet').hidden && $('#dialog').hidden) document.body.classList.remove('locked'); }
  $('#ddLayer').addEventListener('click', (e) => { if (e.target.closest('[data-ddclose]')) closeMenu(); });
  $('#ddMenu').addEventListener('keydown', (e) => {
    const o = $$('.dd-opt', $('#ddMenu')); const i = o.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); o[Math.min(o.length - 1, i + 1)].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); o[Math.max(0, i - 1)].focus(); }
  });
  window.addEventListener('resize', closeMenu);
  window.addEventListener('scroll', () => { if (isDesk()) closeMenu(); }, { passive: true });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#ddLayer').hidden) return closeMenu();
    if (!$('#dialog').hidden) return closeDialog();
    if (!$('#sheet').hidden) return closeSheet();
  });

  function confirmDialog(title, text, okLabel, onOk) {
    openDialog(`<div class="dlg"><h3>${esc(title)}</h3><p class="dlg-sub">${esc(text)}</p>
      <div class="dlg-actions"><button type="button" class="btn-ghost" data-dclose>Cancelar</button><button type="button" class="btn-primary danger" id="okBtn">${esc(okLabel)}</button></div></div>`);
    $('#okBtn').onclick = async () => { closeDialog(); await onOk(); };
  }

  /* ---------------- clicks delegados ---------------- */
  document.addEventListener('click', async (e) => {
    const el = (sel) => e.target.closest(sel);
    let x;
    if ((x = el('[data-home]'))) { S.f = F0(); $('#q').value = ''; closeSheet(); if (location.hash === '#/' || !location.hash) { e.preventDefault(); render(); window.scrollTo(0, 0); } return; }
    if ((x = el('[data-fcat]'))) { closeSheet(); return setFilter({ cat: x.dataset.fcat }); }
    if ((x = el('[data-ftoggle]'))) { const k = x.dataset.ftoggle; return setFilter({ [k]: !S.f[k] }); }
    if ((x = el('[data-fcond]'))) return setFilter({ cond: x.dataset.fcond });
    if ((x = el('[data-fclear]'))) { S.f = Object.assign(F0(), { sort: S.f.sort }); $('#q').value = ''; return setFilter({}); }
    if ((x = el('[data-chip]'))) { const k = x.dataset.chip; const patch = { q: { q: '' }, cat: { cat: 'todo' }, cond: { cond: '' } }[k] || { [k]: false }; if (k === 'q') $('#q').value = ''; return setFilter(patch); }
    if ((x = el('[data-more]'))) {
      const m = x.dataset.more; S.f = F0(); $('#q').value = '';
      if (m === 'free') S.f.free = true; else if (m === 'swap') S.f.swap = true; else if (m === 'save') S.f.sort = 'save'; else if (m.startsWith('cat:')) S.f.cat = m.slice(4);
      return go('#/explorar');
    }
    if ((x = el('#sortBtn'))) return openMenu(x, 'Ordenar por', SORTS, S.f.sort, (v) => setFilter({ sort: v }));
    if ((x = el('#qCat'))) {
      const base = applyFilters(S.products, S.f, 'cat');
      return openMenu(x, 'Categorías', CATS.map((c) => ({ value: c.id, label: c.id === 'todo' ? 'Todas' : c.label, icon: c.icon, count: c.id === 'todo' ? base.length : base.filter((p) => p.categoria === c.id).length })), S.f.cat, (v) => setFilter({ cat: v }));
    }
    if ((x = el('#openFilters'))) return renderFilterSheet();
    if ((x = el('[data-mtab]'))) { S.mineTab = x.dataset.mtab; return render(); }
    if ((x = el('[data-mst]'))) {
      const p = S.products.find((y) => y.id === x.dataset.id); const st = x.dataset.mst;
      const patch = { status: st }; if (st === 'disponible' && qty(p) < 1) patch.cantidad = 1;
      try { await DB.patch(p.id, patch); Object.assign(p, patch); toast(st === 'vendido' ? '¡Felicitaciones por la venta!' : st === 'reservado' ? 'Marcada como reservada' : 'Publicación activa de nuevo', 'ok'); render(); } catch (err) { toast(err.message, 'err'); }
      return;
    }
    if ((x = el('[data-login]'))) return openAuth(x.dataset.login || 'login', render);
  });

  /* ---------------- buscador ---------------- */
  let qt;
  $('#q').addEventListener('input', (e) => {
    clearTimeout(qt);
    qt = setTimeout(() => { const v = e.target.value.trim(); if (v === S.f.q) return; S.f.q = v; if (v || S.view === 'explore') setFilter({}); }, 250);
  });
  $('#searchForm').onsubmit = (e) => { e.preventDefault(); S.f.q = $('#q').value.trim(); $('#q').blur(); setFilter({}); };

  /* ---------------- header / usuario ---------------- */
  function userMenuHTML() {
    const name = (S.profile && S.profile.nombre) || S.user.email;
    return `<p class="menu-name"><span class="av">${esc(initials(name))}</span><span>${esc(name)}<small>${esc(S.user.email)}</small></span></p>
      <a href="#/mis" role="menuitem"><i data-lucide="package"></i> Mis publicaciones</a>
      <a href="#/publicar" role="menuitem"><i data-lucide="plus"></i> Publicar algo</a>
      <button type="button" role="menuitem" data-profile><i data-lucide="user-round"></i> Mi perfil y WhatsApp</button>
      <button type="button" role="menuitem" data-logout><i data-lucide="log-out"></i> Salir</button>`;
  }
  function renderUser() {
    const slot = $('#userSlot');
    if (!S.user) { slot.innerHTML = '<button type="button" class="btn-login" data-login>Ingresar</button>'; return; }
    const name = (S.profile && S.profile.nombre) || S.user.email;
    slot.innerHTML = `<button type="button" class="avatar" id="avatarBtn" aria-haspopup="menu" aria-expanded="false" title="${esc(name)}">${esc(initials(name))}</button><div class="menu" id="userMenu" role="menu" hidden>${userMenuHTML()}</div>`;
    const m = $('#userMenu'), a = $('#avatarBtn');
    a.onclick = (e) => { e.stopPropagation(); m.hidden = !m.hidden; a.setAttribute('aria-expanded', !m.hidden); };
    icons();
  }
  document.addEventListener('click', (e) => {
    const m = $('#userMenu'); if (m && !e.target.closest('#avatarBtn')) m.hidden = true;
    const p = $('#bluePop'); if (p && !p.hidden && !e.target.closest('#blue')) { p.hidden = true; $('#blue').setAttribute('aria-expanded', 'false'); }
    if (e.target.closest('[data-profile]')) { closeSheet(); openProfile(); }
    if (e.target.closest('[data-logout]')) { closeSheet(); DB.signOut().then(() => { toast('Saliste de tu cuenta'); go('#/'); }); }
  });
  $('#tabMe').onclick = () => {
    if (!S.user) return openAuth('login', render);
    openSheet(`<div class="sh-h"><h3>Tu cuenta</h3><button type="button" class="btn-icon" data-close aria-label="Cerrar"><i data-lucide="x"></i></button></div><div class="sh-b menu-sheet" data-close>${userMenuHTML()}</div>`, 'account');
  };

  /* ---------------- auth ---------------- */
  function openAuth(mode, then, reason) {
    mode = mode || 'login';
    const domains = (C.ALLOWED_EMAIL_DOMAINS || []).filter(Boolean);
    const dHint = domains.length ? `Usá tu mail de ${domains.map((d) => '@' + d).join(' o ')}` : '';
    openDialog(`
      <button type="button" class="x" data-dclose aria-label="Cerrar"><i data-lucide="x"></i></button>
      <div class="dlg auth">
        <img src="img/logo-globe.svg" alt="" class="auth-globe">
        <h3>${mode === 'login' ? 'Entrá al Mercado' : 'Creá tu cuenta'}</h3>
        <p class="dlg-sub">${esc(reason || (mode === 'login' ? 'Con tu cuenta comprás y publicás en segundos.' : 'Una sola vez y listo. Tu WhatsApp solo lo ven compañeros con cuenta.'))}</p>
        <div class="seg seg-auth" role="tablist">
          <button type="button" data-m="login" class="${mode === 'login' ? 'on' : ''}">Ya tengo cuenta</button>
          <button type="button" data-m="signup" class="${mode === 'signup' ? 'on' : ''}">Soy nuevo/a</button>
        </div>
        <form id="authForm" novalidate>
          ${mode === 'signup' ? `
          <label class="fld"><span>Nombre y apellido</span><input name="nombre" autocomplete="name" required placeholder="Ej: Martina Sosa"></label>
          <label class="fld"><span>WhatsApp</span><input name="whatsapp" type="tel" inputmode="tel" autocomplete="tel" required placeholder="11 5555 0101"><small>Así te escriben cuando les interesa algo tuyo.</small></label>` : ''}
          <label class="fld"><span>Email</span><input name="email" type="email" inputmode="email" autocomplete="email" required placeholder="vos@mundolococgi.com">${dHint ? `<small>${esc(dHint)}</small>` : ''}</label>
          <label class="fld"><span>Contraseña</span>
            <span class="pw"><input name="password" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" required minlength="6" placeholder="${mode === 'login' ? '' : 'Mínimo 6 caracteres'}"><button type="button" class="pw-eye" aria-label="Mostrar contraseña"><i data-lucide="eye"></i></button></span>
          </label>
          <p class="form-err" id="authErr" role="alert"></p>
          <button type="submit" class="btn-primary wide">${mode === 'login' ? 'Ingresar' : 'Crear cuenta y entrar'}</button>
          ${mode === 'login' ? '<button type="button" class="btn-text center" id="forgot">Me olvidé la contraseña</button>' : ''}
        </form>
      </div>`);
    $$('.seg-auth button').forEach((b) => (b.onclick = () => openAuth(b.dataset.m, then, reason)));
    $('.pw-eye').onclick = (e) => { const i = $('#authForm [name=password]'); i.type = i.type === 'password' ? 'text' : 'password'; e.currentTarget.innerHTML = `<i data-lucide="${i.type === 'password' ? 'eye' : 'eye-off'}"></i>`; icons(); };
    if ($('#forgot')) $('#forgot').onclick = async () => {
      const email = $('#authForm [name=email]').value.trim();
      if (!email) { $('#authErr').textContent = 'Escribí tu email arriba y volvé a tocar acá.'; return; }
      try { await DB.resetPassword(email); toast('Te mandamos un mail para crear una nueva contraseña', 'ok'); } catch (e) { $('#authErr').textContent = e.message; }
    };
    $('#authForm').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target, err = $('#authErr'), btn = $('button[type=submit]', f);
      const v = Object.fromEntries(new FormData(f).entries());
      Object.keys(v).forEach((k) => (v[k] = String(v[k]).trim()));
      err.textContent = '';
      if (mode === 'signup' && v.nombre.length < 2) return (err.textContent = 'Contanos tu nombre.');
      if (mode === 'signup' && digits(v.whatsapp).length < 8) return (err.textContent = 'Revisá el WhatsApp: con código de área, ej. 11 5555 0101.');
      if (!/^\S+@\S+\.\S+$/.test(v.email)) return (err.textContent = 'Ese email no parece válido.');
      if (mode === 'signup' && domains.length && !domains.some((d) => v.email.toLowerCase().endsWith('@' + d.toLowerCase()))) return (err.textContent = dHint + '.');
      if ((v.password || '').length < 6) return (err.textContent = 'La contraseña tiene que tener al menos 6 caracteres.');
      btn.disabled = true; btn.classList.add('loading');
      try {
        if (mode === 'signup') {
          const r = await DB.signUp(v);
          if (r.needsConfirm) { openDialog(`<button type="button" class="x" data-dclose aria-label="Cerrar"><i data-lucide="x"></i></button><div class="dlg"><h3>Revisá tu mail 📬</h3><p class="dlg-sub">Te mandamos un link a <b>${esc(v.email)}</b> para confirmar la cuenta. Después volvés acá e ingresás.</p><button type="button" class="btn-primary wide" data-dclose>Entendido</button></div>`); return; }
          toast('¡Bienvenido/a, ' + firstName(v.nombre) + '!', 'ok');
        } else { await DB.signIn(v); toast('¡Hola de nuevo!', 'ok'); }
        await onAuthChange(await DB.init(), true);
        closeDialog();
        if (then) then();
      } catch (ex) { err.textContent = ex.message; }
      finally { btn.disabled = false; btn.classList.remove('loading'); }
    };
  }
  function openProfile() {
    if (!S.user) return openAuth('login', openProfile);
    const p = S.profile || {};
    openDialog(`
      <button type="button" class="x" data-dclose aria-label="Cerrar"><i data-lucide="x"></i></button>
      <div class="dlg">
        <h3>Mi perfil</h3>
        <p class="dlg-sub">${esc(S.user.email)}</p>
        <form id="profForm" novalidate>
          <label class="fld"><span>Nombre y apellido</span><input name="nombre" value="${esc(p.nombre || '')}" required autocomplete="name"></label>
          <label class="fld"><span>WhatsApp</span><input name="whatsapp" type="tel" value="${esc(p.whatsapp || '')}" required autocomplete="tel"><small>Lo ven solo compañeros con cuenta, cuando tocan “Me interesa”.</small></label>
          <label class="fld"><span>Nueva contraseña <em>(opcional)</em></span><input name="password" type="password" autocomplete="new-password" placeholder="Dejalo vacío para no cambiarla"></label>
          <p class="form-err" id="profErr" role="alert"></p>
          <button type="submit" class="btn-primary wide">Guardar</button>
        </form>
      </div>`);
    $('#profForm').onsubmit = async (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(e.target).entries());
      const d = { nombre: v.nombre.trim(), whatsapp: v.whatsapp.trim() };
      if (v.password) { if (v.password.length < 6) return ($('#profErr').textContent = 'La contraseña tiene que tener al menos 6 caracteres.'); d.password = v.password; }
      if (digits(d.whatsapp).length < 8) return ($('#profErr').textContent = 'Revisá el WhatsApp.');
      try {
        await DB.updateProfile(S.user.id, d);
        S.profile = Object.assign({}, S.profile, { nombre: d.nombre, whatsapp: d.whatsapp });
        S.products.forEach((x) => { if (x.user_id === S.user.id) x.vendedor_nombre = d.nombre; });
        renderUser(); closeDialog(); toast('Perfil guardado', 'ok'); if (S.view !== 'form') render();
      } catch (ex) { $('#profErr').textContent = ex.message; }
    };
  }

  /* ---------------- datos / estado ---------------- */
  async function loadProducts(silent) {
    try { S.products = await DB.listProducts(); }
    catch (e) { toast('No pudimos cargar las publicaciones: ' + e.message, 'err'); S.products = S.products || []; }
    if (!silent && S.view !== 'form') render();
  }
  async function onAuthChange(user, quiet) {
    const changed = (user && user.id) !== (S.user && S.user.id);
    S.user = user;
    S.profile = user ? await DB.getProfile(user.id).catch(() => null) : null;
    renderUser();
    if (changed && !quiet && S.view && S.view !== 'form') render();
    gate();
  }
  function gate() {
    const need = C.REQUIRE_LOGIN_TO_VIEW && !S.user;
    document.body.classList.toggle('gated', !!need);
    if (need && $('#dialog').hidden) openAuth('login', render, 'El Mercado es solo para el equipo de Mundoloco.');
  }

  window.addEventListener('hashchange', () => { closeSheet(); closeMenu(); closeDialog(); render(); window.scrollTo(0, 0); });

  /* ---------------- init ---------------- */
  async function init() {
    if (DB.mode === 'demo') {
      $('#demoStrip').hidden = false;
      $('#resetDemo').onclick = async () => { await DB.resetDemo(); location.hash = '#/'; location.reload(); };
    }
    $('#blue').onclick = (e) => { e.stopPropagation(); const p = $('#bluePop'); p.hidden = !p.hidden; $('#blue').setAttribute('aria-expanded', !p.hidden); };
    setInterval(() => { const m = $('.mirror'); if (m) { m.classList.add('is-flipped'); setTimeout(() => m.classList.remove('is-flipped'), 1400); } }, 7000);
    icons();
    DB.onAuth((u) => { if ((u && u.id) !== (S.user && S.user.id)) onAuthChange(u); });
    const user = await DB.init().catch(() => null);
    await onAuthChange(user, true);
    await loadProducts(true);
    render();
    loadBlue();
    setInterval(async () => { const b = await fetchBlue(); if (b) { S.blue = b; onRateChange(); } }, 10 * 60e3);
    setInterval(() => { if (document.visibilityState === 'visible' && ['home', 'explore', 'mine'].includes(S.view) && $('#sheet').hidden) loadProducts(); }, 2 * 60e3);
  }
  init();
})();

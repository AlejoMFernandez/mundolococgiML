/* =========================================================
   Mercado Mundoloco · app
   ========================================================= */
(function () {
  'use strict';
  const C = window.ML_CONFIG || {};
  const DB = window.DB;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const TZ = 'America/Argentina/Buenos_Aires';

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

  const S = {
    user: null, profile: null, products: [],
    blue: null, // {venta, compra, fecha, src, stale}
    q: '', cat: 'todo', sort: 'new', hideSold: true, mine: false
  };

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
  const icons = () => { if (window.lucide) lucide.createIcons({ attrs: { 'stroke-width': 1.8 } }); };

  function savings(p) {
    if (!p.ml_precio) return null;
    const a = toARS(p.precio, p.moneda), b = toARS(p.ml_precio, p.ml_moneda || 'ARS');
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

  /* ---------------- dólar blue ---------------- */
  const BLUE_KEY = 'mml_blue';
  function fmtWhen(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const day = d.toLocaleDateString('es-AR', { timeZone: TZ, day: '2-digit', month: '2-digit' });
    const time = d.toLocaleTimeString('es-AR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: true });
    return day + ' ' + time;
  }
  function paintBlue() {
    const b = S.blue, btn = $('#blue');
    btn.classList.toggle('stale', !!(b && b.stale));
    btn.classList.toggle('none', !b);
    $('#blueVal').textContent = b ? fARS(b.venta) : '—';
    $('#blueTime').textContent = b ? '· act. ' + fmtWhen(b.fecha) : '· sin datos';
    $('#bluePop').innerHTML = b
      ? `<b>Dólar blue</b><div class="bp-row"><span>Compra</span><span>${fARS(b.compra)}</span></div><div class="bp-row"><span>Venta</span><span>${fARS(b.venta)}</span></div>
         <p>Usamos el valor de <b>venta</b> para convertir todos los precios. Última actualización de la cotización: ${fmtWhen(b.fecha)} hs.</p>
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
  async function loadBlue() {
    if (!S.blue) { try { const c = JSON.parse(localStorage.getItem(BLUE_KEY)); if (c) S.blue = Object.assign(c, { stale: true }); } catch (e) {} }
    paintBlue(); renderGrid();
    const b = await fetchBlue();
    if (b) S.blue = b; else if (S.blue) S.blue.stale = true;
    paintBlue(); renderGrid(); refreshOpenDetail();
  }

  /* ---------------- header / usuario ---------------- */
  function renderUser() {
    const slot = $('#userSlot');
    if (!S.user) { slot.innerHTML = '<button type="button" class="btn-login" id="loginBtn">Ingresar</button>'; $('#loginBtn').onclick = () => openAuth('login'); return; }
    const name = (S.profile && S.profile.nombre) || S.user.email;
    slot.innerHTML = `<button type="button" class="avatar" id="avatarBtn" aria-haspopup="menu" aria-expanded="false" title="${esc(name)}">${esc(initials(name))}</button>
      <div class="menu" id="userMenu" role="menu" hidden>
        <p class="menu-name">${esc(name)}<small>${esc(S.user.email)}</small></p>
        <a href="#/mis" role="menuitem"><i data-lucide="package"></i> Mis publicaciones</a>
        <a href="#/perfil" role="menuitem"><i data-lucide="user-round"></i> Mi perfil y WhatsApp</a>
        <button type="button" role="menuitem" id="logoutBtn"><i data-lucide="log-out"></i> Salir</button>
      </div>`;
    const m = $('#userMenu'), a = $('#avatarBtn');
    a.onclick = (e) => { e.stopPropagation(); m.hidden = !m.hidden; a.setAttribute('aria-expanded', !m.hidden); };
    m.onclick = () => (m.hidden = true);
    $('#logoutBtn').onclick = async () => { await DB.signOut(); toast('Saliste de tu cuenta'); location.hash = '#/'; };
    icons();
  }
  document.addEventListener('click', () => { const m = $('#userMenu'); if (m) m.hidden = true; const p = $('#bluePop'); if (p && !p.hidden) { p.hidden = true; $('#blue').setAttribute('aria-expanded', 'false'); } });

  /* ---------------- catálogo ---------------- */
  function renderChips() {
    $('#chips').innerHTML = CATS.map((c) => `<button type="button" role="tab" class="chip ${S.cat === c.id ? 'on' : ''}" data-cat="${c.id}" aria-selected="${S.cat === c.id}"><i data-lucide="${c.icon}"></i>${c.label}</button>`).join('');
    $$('#chips .chip').forEach((b) => (b.onclick = () => { S.cat = b.dataset.cat; renderChips(); renderGrid(); }));
    icons();
  }

  function visible() {
    let list = S.products.slice();
    if (S.mine && S.user) list = list.filter((p) => p.user_id === S.user.id);
    else if (S.hideSold) list = list.filter((p) => p.status !== 'vendido');
    if (S.cat !== 'todo') list = list.filter((p) => p.categoria === S.cat);
    if (S.q) {
      const q = S.q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      list = list.filter((p) => (p.titulo + ' ' + (p.descripcion || '') + ' ' + (p.vendedor_nombre || '')).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(q));
    }
    const price = (p) => toARS(p.precio, p.moneda) || 0;
    const rank = (p) => (p.status === 'vendido' ? 2 : p.status === 'reservado' ? 1 : 0);
    const sorters = {
      new: (a, b) => b.created_at.localeCompare(a.created_at),
      low: (a, b) => price(a) - price(b),
      high: (a, b) => price(b) - price(a),
      save: (a, b) => ((savings(b) || { pct: -999 }).pct - (savings(a) || { pct: -999 }).pct)
    };
    list.sort((a, b) => rank(a) - rank(b) || sorters[S.sort](a, b));
    return list;
  }

  function priceBlock(p, big) {
    const alt = p.moneda === 'USD' ? toARS(p.precio, 'USD') : toUSD(p.precio, 'ARS');
    const altTxt = alt == null ? '' : '≈ ' + (p.moneda === 'USD' ? fARS(alt) : fUSD(alt));
    return `<div class="price ${big ? 'big' : ''}"><b>${fmt(p.precio, p.moneda)}</b>${altTxt ? `<span class="alt">${altTxt}</span>` : ''}</div>`;
  }

  function thumb(p, cls) {
    const c = catOf(p.categoria);
    return p.fotos && p.fotos.length
      ? `<img class="${cls || ''}" src="${esc(p.fotos[0])}" alt="${esc(p.titulo)}" loading="lazy">`
      : `<div class="ph ${cls || ''}" data-cat="${esc(c.id)}"><i data-lucide="${c.icon}"></i></div>`;
  }

  function statusTag(p) {
    if (p.status === 'reservado') return '<span class="tag tag-res">Reservado</span>';
    if (p.status === 'vendido') return '<span class="tag tag-sold">Vendido</span>';
    return '';
  }

  function renderGrid() {
    const g = $('#grid');
    if (!g) return;
    const list = visible();
    const active = S.products.filter((p) => p.status === 'disponible');
    const sv = active.map(savings).filter((x) => x && x.pct > 0);
    const avg = sv.length ? Math.round(sv.reduce((a, b) => a + b.pct, 0) / sv.length) : 0;
    $('#stats').innerHTML = active.length
      ? `<b>${active.length}</b> ${active.length === 1 ? 'cosa disponible' : 'cosas disponibles'}${avg ? ` · en promedio <b>${avg}% más barato</b> que nuevo` : ''}`
      : '';

    if (!list.length) {
      g.innerHTML = S.mine
        ? `<div class="empty"><i data-lucide="package-open"></i><h3>Todavía no publicaste nada</h3><p>Sacale una foto a eso que ya no usás y en un minuto está online.</p><a href="#/publicar" class="btn-primary"><i data-lucide="plus"></i> Publicar algo</a></div>`
        : `<div class="empty"><i data-lucide="search-x"></i><h3>No encontramos nada${S.q ? ` para “${esc(S.q)}”` : ''}</h3><p>Probá con otra palabra o categoría. ¿Lo tenés vos? Publicalo.</p><a href="#/publicar" class="btn-primary"><i data-lucide="plus"></i> Publicar</a></div>`;
      icons(); return;
    }
    g.innerHTML = list.map((p, i) => {
      const s = savings(p);
      return `<a class="card ${p.status !== 'disponible' ? 'is-' + p.status : ''}" href="#/p/${esc(p.id)}" style="--i:${Math.min(i, 12)}">
        <div class="card-img">${thumb(p)}${statusTag(p)}<span class="cond">${esc(cap(p.estado))}</span></div>
        <div class="card-body">
          <h3>${esc(p.titulo)}</h3>
          ${priceBlock(p)}
          ${s && s.pct > 0 ? `<span class="save-chip"><i data-lucide="trending-down"></i> ${s.pct}% menos que nuevo</span>` : ''}
          <p class="seller"><span class="mini-av">${esc(initials(p.vendedor_nombre))}</span>${esc(firstName(p.vendedor_nombre))} · ${ago(p.created_at)}</p>
        </div>
      </a>`;
    }).join('');
    icons();
  }

  async function loadProducts() {
    try { S.products = await DB.listProducts(); }
    catch (e) { toast('No pudimos cargar las publicaciones: ' + e.message, 'err'); S.products = []; }
    renderGrid();
  }

  /* ---------------- capas ---------------- */
  let sheetMode = null; // 'detail' | 'form'
  let sheetId = null;
  function openSheet(html, mode, id) {
    sheetMode = mode; sheetId = id || null;
    const card = $('#sheetCard');
    card.className = 'sheet-card ' + mode;
    card.innerHTML = html;
    $('#sheet').hidden = false;
    document.body.classList.add('locked');
    card.scrollTop = 0;
    icons();
  }
  function closeSheet() {
    $('#sheet').hidden = true; sheetMode = null; sheetId = null;
    if ($('#dialog').hidden) document.body.classList.remove('locked');
  }
  function openDialog(html) {
    $('#dialogCard').innerHTML = html; $('#dialog').hidden = false; document.body.classList.add('locked'); icons();
    const f = $('#dialogCard input'); if (f && matchMedia('(pointer:fine)').matches) f.focus();
  }
  function closeDialog() {
    $('#dialog').hidden = true;
    if ($('#sheet').hidden) document.body.classList.remove('locked');
  }
  const goHome = () => { location.hash = S.mine ? '#/mis' : '#/'; };
  $('#sheet').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) goHome(); });
  $('#dialog').addEventListener('click', (e) => { if (e.target.closest('[data-dclose]')) { closeDialog(); if (location.hash === '#/perfil') goHome(); } });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#dialog').hidden) { closeDialog(); if (location.hash === '#/perfil') goHome(); }
    else if (!$('#sheet').hidden) goHome();
  });

  /* ---------------- detalle ---------------- */
  async function openDetail(id) {
    const p = S.products.find((x) => x.id === id);
    if (!p) { toast('Esa publicación ya no existe'); location.hash = '#/'; return; }
    const own = S.user && p.user_id === S.user.id;
    const s = savings(p);
    const c = catOf(p.categoria);
    const fotos = p.fotos && p.fotos.length ? p.fotos : null;

    const gallery = fotos
      ? `<div class="gal" id="gal">${fotos.map((f, i) => `<img src="${esc(f)}" alt="${esc(p.titulo)} — foto ${i + 1}" data-i="${i}">`).join('')}</div>
         ${fotos.length > 1 ? `<div class="gal-dots" id="galDots">${fotos.map((_, i) => `<button type="button" aria-label="Foto ${i + 1}" data-i="${i}" class="${i ? '' : 'on'}"></button>`).join('')}</div>` : ''}`
      : `<div class="gal">${thumb(p, 'ph-big')}</div>`;

    let ml = '';
    if (p.ml_url || p.ml_precio) {
      const nuevo = p.ml_precio ? fmt(p.ml_precio, p.ml_moneda || 'ARS') : 'Ver precio';
      const pct = s && s.pct > 0 ? ` · ahorrás ${s.pct}%` : '';
      ml = p.ml_url
        ? `<a class="ml-pill" href="${esc(p.ml_url)}" target="_blank" rel="noopener">Nuevo en Mercado Libre: ${nuevo}${pct} <i data-lucide="arrow-up-right"></i></a>`
        : `<span class="ml-pill">Nuevo: ${nuevo}${pct}</span>`;
    }
    const saveBox = s && s.pct > 0
      ? `<div class="save-box"><i data-lucide="piggy-bank"></i><div><b>Te ahorrás ${fARS(s.diff)}</b><span>comprándoselo a ${esc(firstName(p.vendedor_nombre))} en vez de nuevo.</span></div></div>` : '';

    let cta;
    if (own) {
      cta = `<div class="owner">
        <a class="btn-primary" href="#/editar/${esc(p.id)}"><i data-lucide="pencil"></i> Editar</a>
        <div class="seg seg-status" role="group" aria-label="Estado de la publicación">
          ${['disponible', 'reservado', 'vendido'].map((st) => `<button type="button" data-st="${st}" class="${p.status === st ? 'on' : ''}">${st[0].toUpperCase() + st.slice(1)}</button>`).join('')}
        </div>
        <button type="button" class="btn-text danger" id="delBtn"><i data-lucide="trash-2"></i> Eliminar publicación</button>
      </div>`;
    } else if (p.status === 'vendido') {
      cta = `<button type="button" class="btn-wa" disabled>Ya se vendió</button>`;
    } else if (!S.user) {
      cta = `<button type="button" class="btn-wa" id="waLogin"><i data-lucide="message-circle"></i> Me interesa por WhatsApp</button>
             <p class="cta-note">Ingresá con tu cuenta del Mercado para ver el contacto de ${esc(firstName(p.vendedor_nombre))}. Es un toque.</p>`;
    } else {
      cta = `<a class="btn-wa" id="waBtn" href="#" target="_blank" rel="noopener" aria-disabled="true"><i data-lucide="message-circle"></i> Me interesa por WhatsApp</a>
             ${p.status === 'reservado' ? `<p class="cta-note">Está reservado: podés escribir igual por si se cae la venta.</p>` : ''}`;
    }

    openSheet(`
      <button type="button" class="x" data-close aria-label="Cerrar"><i data-lucide="x"></i></button>
      <div class="det">
        <div class="det-media">${gallery}${statusTag(p)}</div>
        <div class="det-info">
          <p class="det-meta"><span><i data-lucide="${c.icon}"></i> ${c.label}</span><span class="cond-inline">${esc(cap(p.estado))}</span><span>${ago(p.created_at)}</span></p>
          <h2>${esc(p.titulo)}</h2>
          ${priceBlock(p, true)}
          ${ml}
          ${cta}
          ${saveBox}
          ${p.descripcion ? `<div class="desc"><h4>Descripción</h4><p>${esc(p.descripcion).replace(/\n/g, '<br>')}</p></div>` : ''}
          <div class="seller-card">
            <span class="av">${esc(initials(p.vendedor_nombre))}</span>
            <div><b>${esc(p.vendedor_nombre || 'Compañero/a')}</b><span>Equipo Mundoloco</span></div>
            <button type="button" class="btn-icon" id="shareBtn" aria-label="Compartir publicación"><i data-lucide="share-2"></i></button>
          </div>
        </div>
      </div>`, 'detail', id);

    // galería
    const gal = $('#gal'), dots = $('#galDots');
    if (gal && dots) {
      gal.addEventListener('scroll', () => { const i = Math.round(gal.scrollLeft / gal.clientWidth); $$('button', dots).forEach((b, j) => b.classList.toggle('on', i === j)); }, { passive: true });
      $$('button', dots).forEach((b) => (b.onclick = () => gal.scrollTo({ left: gal.clientWidth * +b.dataset.i, behavior: 'smooth' })));
    }
    $('#shareBtn').onclick = async () => {
      const url = location.href.split('#')[0] + '#/p/' + p.id;
      const data = { title: p.titulo, text: `${p.titulo} · ${fmt(p.precio, p.moneda)} en el Mercado Mundoloco`, url };
      if (navigator.share) { try { await navigator.share(data); } catch (e) {} }
      else { try { await navigator.clipboard.writeText(url); toast('Link copiado'); } catch (e) { prompt('Copiá el link:', url); } }
    };
    if ($('#waLogin')) $('#waLogin').onclick = () => openAuth('login', () => openDetail(id), `Ingresá para escribirle a ${firstName(p.vendedor_nombre)}. Si es tu primera vez, creá tu cuenta en 30 segundos.`);
    if ($('#waBtn')) {
      const contact = await DB.getContact(p.user_id).catch(() => null);
      const btn = $('#waBtn');
      if (!btn) return;
      if (contact && contact.whatsapp) {
        const me = firstName(S.profile && S.profile.nombre);
        const msg = `¡Hola ${firstName(contact.nombre)}! ${me ? 'Soy ' + me + '. ' : ''}Vi en el Mercado Mundoloco tu publicación “${p.titulo}” a ${fmt(p.precio, p.moneda)}. ¿Sigue disponible?\n${location.href.split('#')[0]}#/p/${p.id}`;
        btn.href = waLink(contact.whatsapp, msg); btn.removeAttribute('aria-disabled');
      } else {
        btn.outerHTML = `<p class="cta-note">${esc(firstName(p.vendedor_nombre))} todavía no cargó su WhatsApp. Buscalo/a en la oficina 🙂</p>`;
      }
    }
    if (own) {
      $$('.seg-status button').forEach((b) => (b.onclick = async () => {
        try { await DB.setStatus(p.id, b.dataset.st); p.status = b.dataset.st; toast(b.dataset.st === 'vendido' ? '¡Felicitaciones por la venta!' : 'Estado actualizado', 'ok'); renderGrid(); openDetail(id); }
        catch (e) { toast(e.message, 'err'); }
      }));
      $('#delBtn').onclick = () => confirmDialog('¿Eliminar esta publicación?', 'No se puede deshacer. Si ya la vendiste, mejor marcala como vendida.', 'Eliminar', async () => {
        try { await DB.deleteProduct(p.id); S.products = S.products.filter((x) => x.id !== p.id); toast('Publicación eliminada'); goHome(); renderGrid(); }
        catch (e) { toast(e.message, 'err'); }
      });
    }
  }
  function refreshOpenDetail() { if (sheetMode === 'detail' && sheetId) openDetail(sheetId); }

  function confirmDialog(title, text, okLabel, onOk) {
    openDialog(`<div class="dlg"><h3>${esc(title)}</h3><p class="dlg-sub">${esc(text)}</p>
      <div class="dlg-actions"><button type="button" class="btn-ghost" data-dclose>Cancelar</button><button type="button" class="btn-primary danger" id="okBtn">${esc(okLabel)}</button></div></div>`);
    $('#okBtn').onclick = async () => { closeDialog(); await onOk(); };
  }

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
          ${mode === 'login' ? '<button type="button" class="btn-text" id="forgot">Me olvidé la contraseña</button>' : ''}
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
        } else {
          await DB.signIn(v); toast('¡Hola de nuevo!', 'ok');
        }
        await onAuthChange(await DB.init());
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
        renderUser(); renderGrid(); closeDialog(); toast('Perfil guardado', 'ok'); goHome();
      } catch (ex) { $('#profErr').textContent = ex.message; }
    };
  }

  /* ---------------- publicar / editar ---------------- */
  function moneyInput(name, val) {
    return `<input name="${name}" inputmode="numeric" autocomplete="off" value="${val ? num(val) : ''}" placeholder="0" class="money">`;
  }
  function openForm(id) {
    if (!S.user) return openAuth('signup', () => openForm(id), 'Para publicar necesitás una cuenta (así te pueden escribir).');
    const p = id ? S.products.find((x) => x.id === id) : null;
    if (id && (!p || p.user_id !== S.user.id)) { toast('No podés editar esa publicación'); location.hash = '#/'; return; }
    const d = p || { moneda: 'ARS', ml_moneda: 'ARS', estado: 'usado', categoria: '' };
    let photos = (d.fotos || []).map((u) => ({ url: u }));
    const MAX = C.MAX_FOTOS || 6;

    openSheet(`
      <div class="form-head">
        <button type="button" class="btn-icon" data-close aria-label="Cerrar"><i data-lucide="x"></i></button>
        <h2>${p ? 'Editar publicación' : 'Publicar algo'}</h2>
        <span></span>
      </div>
      <form id="pf" class="pf" novalidate>
        <section class="pf-sec">
          <h4>Fotos <em>La primera es la portada</em></h4>
          <div class="photos" id="photos"></div>
          <input type="file" id="fileIn" accept="image/*" multiple hidden>
        </section>

        <section class="pf-sec">
          <h4>¿Qué vendés?</h4>
          <label class="fld"><span>Título</span><input name="titulo" maxlength="80" required value="${esc(d.titulo || '')}" placeholder="Ej: Monitor Dell 27 pulgadas 4K"></label>
          <div class="fld"><span>Categoría</span>
            <div class="pick" id="pickCat">${CATS.slice(1).map((c) => `<button type="button" data-v="${c.id}" class="${d.categoria === c.id ? 'on' : ''}"><i data-lucide="${c.icon}"></i>${c.label}</button>`).join('')}</div>
          </div>
          <div class="fld"><span>Estado</span>
            <div class="seg" id="pickEstado">${ESTADOS.map((e) => `<button type="button" data-v="${e}" class="${d.estado === e ? 'on' : ''}">${e[0].toUpperCase() + e.slice(1)}</button>`).join('')}</div>
          </div>
        </section>

        <section class="pf-sec">
          <h4>Precio</h4>
          <div class="money-row">
            <div class="cur" id="curP">${['ARS', 'USD'].map((c) => `<button type="button" data-v="${c}" class="${d.moneda === c ? 'on' : ''}">${c === 'ARS' ? '$' : 'US$'}</button>`).join('')}</div>
            ${moneyInput('precio', d.precio)}
          </div>
          <p class="hint" id="convP"></p>
        </section>

        <section class="pf-sec ml-sec">
          <h4>¿Cuánto sale nuevo? <em>Opcional, pero vende más</em></h4>
          <p class="hint">Buscalo en Mercado Libre, pegá el link y el precio. Le mostramos al comprador cuánto se ahorra.</p>
          <button type="button" class="btn-ml" id="mlSearch"><i data-lucide="search"></i><span class="btn-ml-t">Buscar “<span id="mlQ">${esc(d.titulo || 'tu producto')}</span>” en Mercado Libre</span><i data-lucide="arrow-up-right"></i></button>
          <label class="fld"><span>Link de la publicación</span><input name="ml_url" type="url" inputmode="url" value="${esc(d.ml_url || '')}" placeholder="https://articulo.mercadolibre.com.ar/…"></label>
          <div class="fld"><span>Precio nuevo</span>
            <div class="money-row">
              <div class="cur" id="curML">${['ARS', 'USD'].map((c) => `<button type="button" data-v="${c}" class="${(d.ml_moneda || 'ARS') === c ? 'on' : ''}">${c === 'ARS' ? '$' : 'US$'}</button>`).join('')}</div>
              ${moneyInput('ml_precio', d.ml_precio)}
            </div>
          </div>
          <div class="save-prev" id="savePrev" hidden></div>
        </section>

        <section class="pf-sec">
          <h4>Descripción <em>Opcional</em></h4>
          <label class="fld"><span class="sr">Descripción</span><textarea name="descripcion" rows="4" maxlength="1200" placeholder="Estado, qué incluye, dónde se retira…">${esc(d.descripcion || '')}</textarea></label>
        </section>

        <div class="pf-foot">
          <p class="form-err" id="pfErr" role="alert"></p>
          <button type="submit" class="btn-primary wide" id="pfBtn">${p ? 'Guardar cambios' : 'Publicar'}</button>
        </div>
      </form>`, 'form', id);

    const f = $('#pf');
    const val = { categoria: d.categoria, estado: d.estado, moneda: d.moneda || 'ARS', ml_moneda: d.ml_moneda || 'ARS' };
    const pick = (sel, key, after) => $$(sel + ' button').forEach((b) => (b.onclick = () => { val[key] = b.dataset.v; $$(sel + ' button').forEach((x) => x.classList.toggle('on', x === b)); after && after(); }));
    pick('#pickCat', 'categoria'); pick('#pickEstado', 'estado'); pick('#curP', 'moneda', live); pick('#curML', 'ml_moneda', live);

    const parse = (n) => { const v = digits(f[n].value); return v ? +v : null; };
    $$('.money', f).forEach((i) => i.addEventListener('input', () => { const v = digits(i.value); i.value = v ? num(+v) : ''; live(); }));
    f.titulo.addEventListener('input', () => { $('#mlQ').textContent = f.titulo.value.trim() || 'tu producto'; });
    $('#mlSearch').onclick = () => {
      const q = (f.titulo.value.trim() || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (!q) { toast('Primero escribí el título'); f.titulo.focus(); return; }
      window.open('https://listado.mercadolibre.com.ar/' + q, '_blank', 'noopener');
    };

    function live() {
      const pr = parse('precio'), mp = parse('ml_precio');
      const cp = $('#convP');
      if (pr && rate()) cp.innerHTML = val.moneda === 'USD' ? `≈ ${fARS(pr * rate())} al blue de hoy (${fARS(rate())})` : `≈ ${fUSD(pr / rate())} al blue de hoy (${fARS(rate())})`;
      else cp.textContent = val.moneda === 'USD' ? 'Si publicás en dólares, el precio en pesos se actualiza solo con el blue.' : '';
      const sp = $('#savePrev');
      if (pr && mp) {
        const s = savings({ precio: pr, moneda: val.moneda, ml_precio: mp, ml_moneda: val.ml_moneda });
        sp.hidden = !s;
        if (s) sp.innerHTML = s.pct > 0
          ? `<i data-lucide="sparkles"></i> Tu precio es <b>${s.pct}% menos</b> que nuevo: el comprador se ahorra <b>${fARS(s.diff)}</b>.`
          : `<i data-lucide="alert-triangle"></i> Tu precio está ${s.pct === 0 ? 'igual que' : 'por encima de'} nuevo. Quizás te conviene bajarlo.`;
        sp.className = 'save-prev ' + (s && s.pct > 0 ? 'good' : 'warn');
        icons();
      } else sp.hidden = true;
    }
    live();

    // fotos
    function renderPhotos() {
      const box = $('#photos');
      box.innerHTML = photos.map((ph, i) => `<div class="ph-item ${i === 0 ? 'cover' : ''}">
          <img src="${esc(ph.preview || ph.url)}" alt="Foto ${i + 1}">
          ${i === 0 ? '<span class="ph-badge">Portada</span>' : `<button type="button" class="ph-cover" data-i="${i}">Hacer portada</button>`}
          <button type="button" class="ph-del" data-i="${i}" aria-label="Quitar foto"><i data-lucide="x"></i></button>
        </div>`).join('') +
        (photos.length < MAX ? `<button type="button" class="ph-add" id="phAdd"><i data-lucide="camera"></i><span>${photos.length ? 'Agregar' : 'Subir fotos'}</span><small>${photos.length}/${MAX}</small></button>` : '');
      $$('.ph-del', box).forEach((b) => (b.onclick = () => { const r = photos.splice(+b.dataset.i, 1)[0]; if (r.preview) URL.revokeObjectURL(r.preview); renderPhotos(); }));
      $$('.ph-cover', box).forEach((b) => (b.onclick = () => { const [x] = photos.splice(+b.dataset.i, 1); photos.unshift(x); renderPhotos(); }));
      if ($('#phAdd')) $('#phAdd').onclick = () => $('#fileIn').click();
      icons();
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
    renderPhotos();

    f.onsubmit = async (e) => {
      e.preventDefault();
      const err = $('#pfErr'); err.textContent = '';
      const titulo = f.titulo.value.trim(), precio = parse('precio'), mlp = parse('ml_precio');
      let mlUrl = f.ml_url.value.trim();
      if (mlUrl && !/^https?:\/\//i.test(mlUrl)) mlUrl = 'https://' + mlUrl;
      const fail = (m, el) => { err.textContent = m; if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
      if (titulo.length < 3) return fail('Ponele un título.', f.titulo);
      if (!val.categoria) return fail('Elegí una categoría.', $('#pickCat'));
      if (!precio) return fail('Poné un precio.', f.precio);
      if (mlUrl && !/mercadoli(b|v)re\.com|meli\.la/i.test(mlUrl)) return fail('El link tiene que ser de Mercado Libre.', f.ml_url);

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
          titulo, categoria: val.categoria, estado: val.estado, precio, moneda: val.moneda,
          ml_url: mlUrl || null, ml_precio: mlp || null, ml_moneda: val.ml_moneda,
          descripcion: f.descripcion.value.trim(), fotos: urls,
          vendedor_nombre: (S.profile && S.profile.nombre) || S.user.email.split('@')[0]
        };
        if (p) row.id = p.id; else row.user_id = S.user.id;
        const saved = await DB.saveProduct(row);
        await loadProducts();
        toast(p ? 'Cambios guardados' : '¡Publicado! Ya lo ven todos en el estudio 🎉', 'ok');
        location.hash = '#/p/' + saved.id;
      } catch (ex) {
        err.textContent = ex.message;
      } finally { if (document.body.contains(btn)) { btn.disabled = false; btn.classList.remove('loading'); btn.textContent = p ? 'Guardar cambios' : 'Publicar'; } }
    };
  }

  /* ---------------- router ---------------- */
  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [r, id] = h.split('/');
    const wasMine = S.mine;
    S.mine = r === 'mis' || (wasMine && (r === 'p' || r === 'editar'));
    if (r === 'mis' && !S.user) { openAuth('login', route, 'Ingresá para ver tus publicaciones.'); S.mine = false; }
    $('#mineHead').hidden = !S.mine;
    document.body.classList.toggle('mine', S.mine);
    if (wasMine !== S.mine) { renderGrid(); window.scrollTo(0, 0); }

    if (r !== 'perfil' && !$('#dialog').hidden && location.hash !== '') { /* deja diálogos de auth abiertos */ }
    if (r === 'p' && id) return openDetail(decodeURIComponent(id));
    if (r === 'publicar') return openForm();
    if (r === 'editar' && id) return openForm(decodeURIComponent(id));
    if (!$('#sheet').hidden) closeSheet();
    if (r === 'perfil') return openProfile();
  }
  window.addEventListener('hashchange', route);

  /* ---------------- auth state ---------------- */
  async function onAuthChange(user) {
    const changed = (user && user.id) !== (S.user && S.user.id);
    S.user = user;
    S.profile = user ? await DB.getProfile(user.id).catch(() => null) : null;
    renderUser();
    if (changed) { renderGrid(); }
    gate();
  }
  function gate() {
    const need = C.REQUIRE_LOGIN_TO_VIEW && !S.user;
    document.body.classList.toggle('gated', !!need);
    if (need && $('#dialog').hidden) openAuth('login', null, 'El Mercado es solo para el equipo de Mundoloco.');
  }

  /* ---------------- init ---------------- */
  async function init() {
    if (DB.mode === 'demo') {
      $('#demoStrip').hidden = false;
      $('#resetDemo').onclick = async () => { await DB.resetDemo(); location.hash = '#/'; location.reload(); };
    }
    $('#blue').onclick = (e) => { e.stopPropagation(); const p = $('#bluePop'); p.hidden = !p.hidden; $('#blue').setAttribute('aria-expanded', !p.hidden); };
    $('#bluePop').onclick = (e) => e.stopPropagation();
    let qt; $('#q').addEventListener('input', (e) => { clearTimeout(qt); qt = setTimeout(() => { S.q = e.target.value.trim(); renderGrid(); }, 120); });
    $('#sort').onchange = (e) => { S.sort = e.target.value; renderGrid(); };
    $('#hideSold').onchange = (e) => { S.hideSold = e.target.checked; renderGrid(); };
    const m = $('#mirror'); setInterval(() => { m.classList.add('is-flipped'); setTimeout(() => m.classList.remove('is-flipped'), 1400); }, 7000);

    renderChips();
    renderGrid();
    DB.onAuth((u) => { if ((u && u.id) !== (S.user && S.user.id)) onAuthChange(u); });
    const user = await DB.init().catch(() => null);
    await onAuthChange(user);
    await loadProducts();
    route();
    loadBlue();
    setInterval(async () => { const b = await fetchBlue(); if (b) { S.blue = b; paintBlue(); renderGrid(); } }, 10 * 60e3);
    setInterval(() => { if (document.visibilityState === 'visible' && sheetMode !== 'form') loadProducts(); }, 2 * 60e3);
  }
  init();
})();

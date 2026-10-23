/* =========================================================
   Capa de datos: misma interfaz para MODO DEMO (localStorage)
   y para Supabase (real, compartido). app.js solo usa window.DB.
   ========================================================= */
(function () {
  const C = window.ML_CONFIG || {};
  const listeners = [];
  const emit = (u) => listeners.forEach((f) => { try { f(u); } catch (e) { console.error(e); } });

  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const newId = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  const nowISO = () => new Date().toISOString();

  /* ---------------- compresión de fotos ---------------- */
  async function compress(file, max, quality) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const type = 'image/jpeg';
      const blob = await new Promise((res) => c.toBlob(res, type, quality));
      return { blob, dataURL: c.toDataURL(type, quality) };
    } finally { URL.revokeObjectURL(url); }
  }

  /* =======================================================
     MODO DEMO
     ======================================================= */
  const K = { users: 'mml_users', prods: 'mml_products', sess: 'mml_session', seeded: 'mml_seeded_v3' };

  function seed() {
    if (LS.get(K.seeded)) return;
    const users = [
      { id: 'u-martina', email: 'martina@mundolococgi.com', password: 'demo1234', nombre: 'Martina Sosa', whatsapp: '1155550101' },
      { id: 'u-nico', email: 'nico@mundolococgi.com', password: 'demo1234', nombre: 'Nico Ferreyra', whatsapp: '1155550102' },
      { id: 'u-caro', email: 'caro@mundolococgi.com', password: 'demo1234', nombre: 'Caro Benítez', whatsapp: '1155550103' }
    ];
    const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
    const ml = (q) => 'https://listado.mercadolibre.com.ar/' + q;
    const P = (o) => Object.assign({ id: newId(), fotos: [], status: 'disponible', ml_moneda: 'ARS', descripcion: '' }, o);
    const prods = [
      P({ user_id: 'u-martina', vendedor_nombre: 'Martina Sosa', titulo: 'Tableta Wacom Intuos Pro M', categoria: 'tecnologia', estado: 'usado', precio: 220, moneda: 'USD', ml_url: ml('wacom-intuos-pro-m'), ml_precio: 780000, descripcion: 'La usé dos años para storyboard. Anda perfecto, con 6 puntas de repuesto y el cable original. Tiene algunas marcas de uso en la superficie.', created_at: ago(3) }),
      P({ user_id: 'u-nico', vendedor_nombre: 'Nico Ferreyra', titulo: 'Monitor Dell UltraSharp 27" 4K', categoria: 'tecnologia', estado: 'como nuevo', precio: 650000, moneda: 'ARS', ml_url: ml('monitor-dell-ultrasharp-27-4k'), ml_precio: 1190000, descripcion: 'Calibrado, sin píxeles muertos. Incluye cable USB-C y DisplayPort. Lo puedo llevar a la oficina.', created_at: ago(7) }),
      P({ user_id: 'u-caro', vendedor_nombre: 'Caro Benítez', titulo: 'Silla ergonómica con apoyo lumbar', categoria: 'muebles', estado: 'usado', precio: 180000, moneda: 'ARS', ml_url: ml('silla-ergonomica-apoyo-lumbar'), ml_precio: 389000, descripcion: 'Regulable en altura y apoyabrazos. Retiro por Núñez.', created_at: ago(20) }),
      P({ user_id: 'u-martina', vendedor_nombre: 'Martina Sosa', titulo: 'iPad 9ª gen 64 GB + funda', categoria: 'tecnologia', estado: 'como nuevo', precio: 260, moneda: 'USD', ml_url: ml('ipad-9-generacion-64gb'), ml_precio: 749999, descripcion: 'Batería al 91%. Con funda tipo libro y cargador.', created_at: ago(30) }),
      P({ user_id: 'u-nico', vendedor_nombre: 'Nico Ferreyra', titulo: 'Auriculares Sony WH-1000XM4', categoria: 'audio', estado: 'usado', precio: 210000, moneda: 'ARS', ml_url: ml('sony-wh-1000xm4'), ml_precio: 520000, status: 'reservado', descripcion: 'Cancelación de ruido impecable, ideal para render nocturno.', created_at: ago(44) }),
      P({ user_id: 'u-caro', vendedor_nombre: 'Caro Benítez', titulo: 'Cafetera Nespresso Essenza Mini', categoria: 'hogar', estado: 'como nuevo', precio: 75000, moneda: 'ARS', ml_url: ml('nespresso-essenza-mini'), ml_precio: 159000, created_at: ago(52) }),
      P({ user_id: 'u-nico', vendedor_nombre: 'Nico Ferreyra', titulo: 'Bicicleta rodado 29 talle M', categoria: 'deportes', estado: 'usado', precio: 320000, moneda: 'ARS', ml_url: '', ml_precio: null, trueque: 'si', trueque_nota: 'Una tablet o un monitor', descripcion: 'Frenos a disco, 21 cambios. Service hecho hace 3 meses.', created_at: ago(70) }),
      P({ user_id: 'u-martina', vendedor_nombre: 'Martina Sosa', titulo: "Libro The Animator's Survival Kit", categoria: 'libros', estado: 'usado', precio: 35000, moneda: 'ARS', ml_url: ml('animators-survival-kit'), ml_precio: 72000, descripcion: 'Edición en inglés, tapa blanda. Algunas notas en lápiz.', created_at: ago(90) }),
      P({ user_id: 'u-nico', vendedor_nombre: 'Nico Ferreyra', titulo: 'Sillas plegables para eventos', categoria: 'muebles', estado: 'usado', precio: 15000, moneda: 'ARS', cantidad: 6, ml_url: ml('silla-plegable'), ml_precio: 38000, descripcion: 'Sobraron del último evento del estudio. Precio por unidad.', created_at: ago(9) }),
      P({ user_id: 'u-martina', vendedor_nombre: 'Martina Sosa', titulo: 'Consola retro con 2 joysticks', categoria: 'gaming', estado: 'como nuevo', precio: 0, moneda: 'ARS', trueque: 'solo', trueque_nota: 'Un teclado mecánico o auriculares', ml_url: '', ml_precio: null, created_at: ago(14) }),
      P({ user_id: 'u-caro', vendedor_nombre: 'Caro Benítez', titulo: 'Plantas de interior (3 potus)', categoria: 'hogar', estado: 'usado', precio: 0, moneda: 'ARS', ml_url: '', ml_precio: null, descripcion: 'Me mudo y no las puedo llevar. Las dejo en la cocina del estudio, avisame y son tuyas.', created_at: ago(5) }),
      P({ user_id: 'u-caro', vendedor_nombre: 'Caro Benítez', titulo: 'Teclado mecánico TKL switches red', categoria: 'gaming', estado: 'usado', precio: 38000, moneda: 'ARS', ml_url: ml('teclado-mecanico-tkl-red'), ml_precio: 64000, status: 'vendido', created_at: ago(120) })
    ];
    LS.set(K.users, users);
    LS.set(K.prods, prods);
    LS.set(K.seeded, true);
  }

  const local = {
    mode: 'demo',
    async init() { seed(); const s = LS.get(K.sess); return s ? this._pub(s) : null; },
    _pub(id) { const u = LS.get(K.users, []).find((x) => x.id === id); return u ? { id: u.id, email: u.email } : null; },
    onAuth(cb) { listeners.push(cb); },
    async signUp({ nombre, email, password, whatsapp }) {
      const users = LS.get(K.users, []);
      if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) throw new Error('Ya hay una cuenta con ese email. Probá ingresar.');
      const u = { id: newId(), email, password, nombre, whatsapp };
      users.push(u); LS.set(K.users, users); LS.set(K.sess, u.id);
      const pub = this._pub(u.id); emit(pub); return { user: pub, needsConfirm: false };
    },
    async signIn({ email, password }) {
      const u = LS.get(K.users, []).find((x) => x.email.toLowerCase() === email.toLowerCase());
      if (!u || u.password !== password) throw new Error('Email o contraseña incorrectos.');
      LS.set(K.sess, u.id); const pub = this._pub(u.id); emit(pub); return pub;
    },
    async resetPassword() { throw new Error('En modo demo no se envían mails. Usá demo1234 con las cuentas de ejemplo.'); },
    async signOut() { LS.del(K.sess); emit(null); },
    async getProfile(id) { const u = LS.get(K.users, []).find((x) => x.id === id); return u ? { id: u.id, nombre: u.nombre, whatsapp: u.whatsapp, email: u.email } : null; },
    async updateProfile(id, data) {
      const users = LS.get(K.users, []); const u = users.find((x) => x.id === id); if (!u) return;
      Object.assign(u, data); LS.set(K.users, users);
      if (data.nombre) { const ps = LS.get(K.prods, []); ps.forEach((p) => { if (p.user_id === id) p.vendedor_nombre = data.nombre; }); LS.set(K.prods, ps); }
    },
    async listProducts() { return LS.get(K.prods, []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async getContact(userId) { const p = await this.getProfile(userId); return p ? { nombre: p.nombre, whatsapp: p.whatsapp } : null; },
    async uploadPhoto(file) { const { dataURL } = await compress(file, 900, 0.72); return dataURL; },
    async saveProduct(p) {
      const ps = LS.get(K.prods, []);
      let saved;
      if (p.id) { const i = ps.findIndex((x) => x.id === p.id); ps[i] = saved = Object.assign({}, ps[i], p, { updated_at: nowISO() }); }
      else { saved = Object.assign({ id: newId(), status: 'disponible', created_at: nowISO() }, p); ps.push(saved); }
      if (!LS.set(K.prods, ps)) throw new Error('El navegador se quedó sin espacio para fotos (modo demo). Probá con menos fotos.');
      return saved;
    },
    async patch(id, data) { const ps = LS.get(K.prods, []); const p = ps.find((x) => x.id === id); if (p) { Object.assign(p, data); LS.set(K.prods, ps); } },
    async setStatus(id, status) { const ps = LS.get(K.prods, []); const p = ps.find((x) => x.id === id); if (p) { p.status = status; LS.set(K.prods, ps); } },
    async deleteProduct(id) { LS.set(K.prods, LS.get(K.prods, []).filter((x) => x.id !== id)); },
    async resetDemo() { [K.users, K.prods, K.sess, K.seeded].forEach(LS.del); }
  };

  /* =======================================================
     SUPABASE
     ======================================================= */
  function sbError(e) {
    const m = (e && e.message) || String(e);
    if (/invalid login/i.test(m)) return new Error('Email o contraseña incorrectos.');
    if (/already registered|already exists/i.test(m)) return new Error('Ya hay una cuenta con ese email. Probá ingresar.');
    if (/at least 6/i.test(m)) return new Error('La contraseña tiene que tener al menos 6 caracteres.');
    if (/email not confirmed/i.test(m)) return new Error('Falta confirmar tu email: revisá tu casilla (y spam).');
    if (/rate limit/i.test(m)) return new Error('Demasiados intentos. Esperá un minuto y probá de nuevo.');
    return new Error(m);
  }

  function makeSupabase() {
    const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
    const pub = (u) => (u ? { id: u.id, email: u.email } : null);
    sb.auth.onAuthStateChange((_ev, session) => emit(pub(session && session.user)));
    return {
      mode: 'supabase',
      async init() { const { data } = await sb.auth.getSession(); return pub(data.session && data.session.user); },
      onAuth(cb) { listeners.push(cb); },
      async signUp({ nombre, email, password, whatsapp }) {
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { nombre, whatsapp }, emailRedirectTo: location.origin + location.pathname } });
        if (error) throw sbError(error);
        return { user: pub(data.user), needsConfirm: !data.session };
      },
      async signIn({ email, password }) {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw sbError(error); return pub(data.user);
      },
      async resetPassword(email) {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + '#/perfil' });
        if (error) throw sbError(error);
      },
      async signOut() { await sb.auth.signOut(); },
      async getProfile(id) {
        const { data } = await sb.from('profiles').select('id,nombre,whatsapp').eq('id', id).maybeSingle();
        return data;
      },
      async updateProfile(id, d) {
        const { error } = await sb.from('profiles').update(d).eq('id', id); if (error) throw sbError(error);
        if (d.nombre) await sb.from('productos').update({ vendedor_nombre: d.nombre }).eq('user_id', id);
        if (d.password) { const r = await sb.auth.updateUser({ password: d.password }); if (r.error) throw sbError(r.error); }
      },
      async listProducts() {
        const { data, error } = await sb.from('productos').select('*').order('created_at', { ascending: false });
        if (error) throw sbError(error); return data || [];
      },
      async getContact(userId) {
        const { data } = await sb.from('profiles').select('nombre,whatsapp').eq('id', userId).maybeSingle();
        return data;
      },
      async uploadPhoto(file, userId) {
        const { blob } = await compress(file, 1400, 0.82);
        const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await sb.storage.from('fotos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (error) throw sbError(error);
        return sb.storage.from('fotos').getPublicUrl(path).data.publicUrl;
      },
      async saveProduct(p) {
        const row = Object.assign({}, p); const id = row.id; delete row.id;
        delete row.created_at;
        const q = id ? sb.from('productos').update(row).eq('id', id).select().single()
                     : sb.from('productos').insert(row).select().single();
        const { data, error } = await q; if (error) throw sbError(error); return data;
      },
      async setStatus(id, status) { const { error } = await sb.from('productos').update({ status }).eq('id', id); if (error) throw sbError(error); },
      async patch(id, data) { const { error } = await sb.from('productos').update(data).eq('id', id); if (error) throw sbError(error); },
      async deleteProduct(id) { const { error } = await sb.from('productos').delete().eq('id', id); if (error) throw sbError(error); }
    };
  }

  const useSB = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase);
  window.DB = useSB ? makeSupabase() : local;
})();

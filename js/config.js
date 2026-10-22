/* =========================================================
   Mercado Mundoloco · configuración
   ---------------------------------------------------------
   Sin SUPABASE_URL / SUPABASE_ANON_KEY el sitio corre en
   MODO DEMO: todo se guarda solo en el navegador (sirve para
   mostrarlo). Con las claves cargadas pasa a ser compartido
   entre todos los empleados. Ver README.md.
   ========================================================= */
window.ML_CONFIG = {
  SUPABASE_URL: '',        // ej: 'https://xxxxxxxx.supabase.co'
  SUPABASE_ANON_KEY: '',   // Project Settings → API → anon public

  // Opcional: solo dejar registrarse con mails de la empresa.
  // ej: ['mundolococgi.com']  — vacío = cualquier mail.
  ALLOWED_EMAIL_DOMAINS: [],

  // Si true, hay que ingresar para ver el catálogo.
  // Si false, el catálogo se ve sin cuenta y el WhatsApp del vendedor
  // solo aparece después de ingresar.
  REQUIRE_LOGIN_TO_VIEW: false,

  MAX_FOTOS: 6
};

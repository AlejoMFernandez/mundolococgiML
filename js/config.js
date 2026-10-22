/* =========================================================
   Mercado Mundoloco · configuración
   ---------------------------------------------------------
   Sin SUPABASE_URL / SUPABASE_ANON_KEY el sitio corre en
   MODO DEMO: todo se guarda solo en el navegador (sirve para
   mostrarlo). Con las claves cargadas pasa a ser compartido
   entre todos los empleados. Ver README.md.
   ========================================================= */
window.ML_CONFIG = {
  SUPABASE_URL: 'https://pcemjcohwcqrpgrocees.supabase.co',
  // clave pública "anon" (es segura en el navegador; la protección real son las reglas RLS de schema.sql)
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZW1qY29od2NxcnBncm9jZWVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2NzgwMzEsImV4cCI6MjEwODI1NDAzMX0.6IgjfsbuiWDGj3TV99dgYL0c-UNeY-J1lpMno8_9Bsw',

  // Opcional: solo dejar registrarse con mails de la empresa.
  // ej: ['mundolococgi.com']  — vacío = cualquier mail.
  ALLOWED_EMAIL_DOMAINS: [],

  // Si true, hay que ingresar para ver el catálogo.
  // Si false, el catálogo se ve sin cuenta y el WhatsApp del vendedor
  // solo aparece después de ingresar.
  REQUIRE_LOGIN_TO_VIEW: false,

  MAX_FOTOS: 6
};

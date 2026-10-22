# Mercado Mundoloco

Mercado interno para que los empleados de Mundoloco CGI compren y vendan cosas entre ellos.

- **Dólar blue en vivo** (DolarAPI.com, con Bluelytics de respaldo): valor de venta + fecha y hora de la última actualización de la cotización. Se refresca cada 10 min.
- **Conversión automática** en cada precio: si se publica en pesos muestra ≈ US$, si se publica en dólares muestra ≈ $ al blue del día.
- **Comparación con Mercado Libre**: el vendedor pega el link y el precio nuevo (con un botón que le abre la búsqueda en ML). Se muestra "Nuevo: $ X · ahorrás Y%" y "Te ahorrás $ Z".
- **Contacto por WhatsApp** con mensaje armado (producto, precio y link).
- Registro / ingreso con email y contraseña, publicar con fotos (se comprimen solas), editar, marcar reservado/vendido, eliminar, "Mis publicaciones" y perfil.

Es HTML + CSS + JS sin build. Funciona en XAMPP, en cualquier hosting o en Vercel/Netlify.

## Modo demo vs. modo real

Con `js/config.js` vacío corre en **modo demo**: todo se guarda en el navegador (sirve para mostrarlo).
Cuentas de prueba: `martina@`, `nico@`, `caro@mundolococgi.com` · contraseña `demo1234`.

Para que sea real y compartido entre todos → Supabase (gratis):

1. Crear proyecto en https://supabase.com (región São Paulo).
2. **SQL Editor → New query** → pegar `supabase/schema.sql` → Run. (Crea tablas, seguridad y el bucket de fotos.)
3. **Authentication → Sign In / Providers → Email**: dejar Email activo. Recomendado: desactivar *Confirm email* para que el registro sea instantáneo (es interno).
4. **Authentication → URL Configuration**: poner la URL del sitio en *Site URL* (para el mail de "olvidé mi contraseña").
5. **Project Settings → API**: copiar *Project URL* y *anon public key* en `js/config.js`.
6. Opcional en `config.js`: `ALLOWED_EMAIL_DOMAINS: ['mundolococgi.com']` para que solo se registren mails de la empresa, y `REQUIRE_LOGIN_TO_VIEW: true` si el catálogo no debe verse sin cuenta.

## Archivos

```
index.html
css/app.css
js/config.js   ← claves y opciones
js/data.js     ← capa de datos (demo / Supabase)
js/app.js      ← interfaz
img/           ← logos Mundoloco
supabase/schema.sql
```

Sitio desarrollado por Alejo Martín Fernández — https://alejomfernandez.com.ar

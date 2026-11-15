# JobMatch

JobMatch conecta a trabajadores y empresas de una misma zona mediante fichas profesionales, ofertas con salario visible, intereses mutuos y chat. La interfaz es mobile-first y se exporta como sitio estático de Next.js; Capacitor puede cargar esa exportación como aplicación Android.

## Índice

- [Estado y alcance](#estado-y-alcance)
- [Cómo se usa](#cómo-se-usa)
- [Arquitectura](#arquitectura)
- [Requisitos y desarrollo local](#requisitos-y-desarrollo-local)
- [Supabase](#supabase)
- [Variables de entorno](#variables-de-entorno)
- [Despliegue web y SEO](#despliegue-web-y-seo)
- [Capacitor y Android](#capacitor-y-android)
- [Auditoría de seguridad y privacidad](#auditoría-de-seguridad-y-privacidad)
- [Plan futuro: dominio propio y Supabase aislado](#plan-futuro-dominio-propio-y-supabase-aislado)
- [Solución de problemas](#solución-de-problemas)

## Estado y alcance

- Repositorio: `Dton1s/jobmatch`, rama de publicación: `main`.
- Proyecto Vercel: `jobmatch`, equipo `nebula-b346`.
- Dominio operativo conocido: `https://jobmatch.nebuladigitalstudio.es`.
- Dominio objetivo: `https://jobmatch.es` (la app no debe depender de él hasta que esté registrado y su DNS resuelva).
- Supabase actual: instancia compartida con otros proyectos de Nébula. Las tablas, tipos, funciones, triggers, índices y políticas propias de la app usan el prefijo `jobmatch_`; los buckets dedicados son `jobmatch-media` y `jobmatch-cvs`.
- Suscripciones, pagos y funciones de pago como `super like` aún no están integradas.

## Cómo se usa

### Trabajador

1. Inicia sesión con Google y elige **Trabajador**.
2. Completa su Perfil Base si quiere guardar datos reutilizables.
3. Crea o actualiza su ficha: puesto buscado, sector, experiencia, disponibilidad, habilidades, ciudad y ubicación. Puede añadir avatar, audio de presentación (máximo 15 segundos) y currículum PDF.
4. En **Descubrir**, filtra las ofertas por distancia, sector, disponibilidad y salario. Puede abrir detalles, descartar o mostrar interés.
5. Si la empresa también muestra interés, aparece una conexión. Desde ahí puede abrir el chat, compartir respuestas rápidas y responder a propuestas de entrevista.

### Empresa

1. Inicia sesión con Google y elige **Empresa**.
2. Completa el Perfil Base comercial y publica una o varias ofertas. Cada oferta requiere un salario visible, tiene jornada y puede pausarse o reactivarse.
3. En **Descubrir**, elige una oferta activa y revisa trabajadores cercanos.
4. Un interés mutuo crea un match y habilita la conversación. Las entrevistas se proponen como tarjetas dentro del chat; la otra persona puede confirmar, cancelar o pedir otra hora.

### Perfil, chat y eliminación

- El selector superior permite cambiar de identidad sin perder la pestaña abierta. **Perfil y ajustes** contiene estadísticas, ofertas, edición y cierre de sesión.
- Los mensajes y matches se actualizan con Supabase Realtime.
- La eliminación dentro de la app borra los archivos de la carpeta del usuario en `jobmatch-media` y `jobmatch-cvs`, y llama a `jobmatch_delete_my_account()` para eliminar filas relacionadas y el usuario de Auth.
- `/eliminar-cuenta` ofrece además instrucciones externas para solicitar el borrado sin tener instalada la app.

## Arquitectura

| Área | Implementación |
| --- | --- |
| Web | Next.js App Router, React, TypeScript, Tailwind CSS 4, Framer Motion y Lucide |
| Backend | Supabase Auth, PostgreSQL con RLS, Storage y Realtime |
| Exportación | `output: "export"`; la web resultante queda en `out/` |
| Android | Capacitor 7, `appId` `es.nebuladigitalstudio.jobmatch`, esquema OAuth `es.nebuladigitalstudio.jobmatch://auth/callback` |
| Rutas públicas | `/`, `/aviso-legal`, `/privacidad`, `/terminos`, `/eliminar-cuenta` |

Las páginas legales y la portada se prerenderizan estáticamente. Las funciones de usuario se ejecutan en el navegador y usan la clave pública/anon de Supabase junto con las políticas RLS. No se debe incluir `service_role` en el frontend.

## Requisitos y desarrollo local

Requiere Node.js 20 o posterior y npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

En PowerShell, crea `.env.local` copiando `.env.example` y rellena las variables. Después abre `http://localhost:3000`.

Comprobaciones solicitadas para cambios de código:

```bash
npm run typecheck
npm run build
git diff --check
```

`npm run build` genera la exportación estática en `out/`. No hay suite de tests automatizados configurada en este repositorio.

## Supabase

### Objetos de JobMatch

El esquema actual contiene, entre otros, `jobmatch_profiles`, `jobmatch_worker_cards`, `jobmatch_job_offers`, `jobmatch_swipes`, `jobmatch_matches`, `jobmatch_messages`, `jobmatch_card_views` y `jobmatch_company_contacts`. El trigger de intereses mutuos crea matches y `jobmatch_messages` almacena mensajes y propuestas estructuradas.

Los scripts SQL pertenecen a esta app:

- `supabase/schema.sql`: esquema completo para una base nueva. **No lo ejecutes sobre una base compartida que ya tenga estas tablas**.
- `supabase/upgrade_v2.sql`, `supabase/upgrade_profiles.sql`, `supabase/upgrade_cv_v4.sql`, `supabase/upgrade_role_modes.sql`: ampliaciones incrementales de versiones anteriores. `upgrade_role_modes.sql` habilita el modo dual y restringe la lectura pública de fichas/ofertas al rol activo.
- `supabase/fix_profiles_v3.sql`, `supabase/fix_match_profile_rls.sql`: columnas y permisos de lectura del perfil ampliado.
- `supabase/fix_storage_cv.sql`, `supabase/fix_storage_all.sql`: políticas y configuración del bucket; lee la nota de seguridad antes de aplicar o reutilizar estas políticas.
- `supabase/legal_and_delete_account.sql`: RPC de eliminación de cuenta.
- `supabase/seed_demo.sql`: crea ocho ofertas y ocho candidatos ficticios de Torrevieja/Alicante, identificados como `is_demo`.

Para una base nueva, ejecuta `schema.sql`, después `legal_and_delete_account.sql` y, si quieres, `seed_demo.sql`. Para una base existente, identifica primero qué migraciones ya se ejecutaron y aplica solo las siguientes en orden; no vuelvas a ejecutar una instalación completa encima de datos reales.

Antes de desplegar el modo de rol único/dual en una base existente, ejecuta `supabase/upgrade_role_modes.sql` al final de las migraciones anteriores. Añade `enabled_roles`, conserva el rol principal existente y aplica RLS para que las fichas y ofertas solo sean visibles en descubrimiento mientras su modo está habilitado.

### Auth y Google OAuth

1. En Supabase, activa el proveedor Google y configura sus credenciales OAuth.
2. En **Authentication → URL Configuration**, registra los orígenes web que realmente se van a usar, por ejemplo `http://localhost:3000` y `https://jobmatch.nebuladigitalstudio.es/`. Cuando el dominio nuevo esté activo, añade `https://jobmatch.es/`.
3. Añade `es.nebuladigitalstudio.jobmatch://auth/callback` a las URLs permitidas para redirección.
4. En Google Cloud, configura el callback que muestra Supabase como URI de redirección autorizada.
5. El inicio web vuelve al origen actual; el inicio nativo abre el flujo OAuth en el navegador del sistema y procesa el enlace profundo con `@capacitor/app`.

Las listas de redirección de Supabase y Google son configuración externa: el build no puede comprobar que las credenciales, consent screen, URLs permitidas o callback estén bien en sus paneles.

### Storage

Los avatares, logos y audios se guardan en `jobmatch-media`, que permite lectura pública y restringe las escrituras a la carpeta del usuario autenticado. Los currículums se guardan en el bucket privado `jobmatch-cvs`, con límite de 5 MB y solo PDF. `supabase/private_cvs_storage.sql` crea el bucket y aplica políticas estrictas: el titular puede leer su CV y otros usuarios solo pueden leerlo si existe un match confirmado. La app genera una URL firmada con vigencia de 5 minutos al abrir el documento. No se guardan nuevas URLs públicas.

**Estado de seguridad:** el flujo nuevo está protegido. Antes de desplegar la app, ejecuta `supabase/private_cvs_storage.sql` en el SQL Editor del proyecto Supabase. Los archivos PDF históricos que aún estén en el bucket público `jobmatch-media` siguen siendo accesibles públicamente hasta migrarlos a `jobmatch-cvs` y borrar los originales. La app conserva compatibilidad temporal al firmar las referencias antiguas, pero esa compatibilidad no vuelve privados los objetos antiguos.

## Variables de entorno

Copia `.env.example` a `.env.local` en local y añade las mismas variables en Vercel (Development/Preview/Production según proceda):

```env
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clave-publica-anon>
```

Estas dos variables son públicas por diseño y están sujetas a RLS. Nunca uses `SUPABASE_SERVICE_ROLE_KEY` en el cliente o en variables `NEXT_PUBLIC_*`.

## Despliegue web y SEO

Vercel está conectado con `Dton1s/jobmatch`; cada push a `main` inicia un despliegue de producción. Revisa el estado en Vercel después de publicar. Comprueba la versión en el dominio que esté resolviendo correctamente.

El manifest usa rutas relativas (`/`) para que la instalación PWA no quede ligada a un dominio antes de comprarlo. Los metadatos canónicos y el aviso legal deberán reflejar el dominio definitivo cuando el cambio se haga efectivo. No anuncies `jobmatch.es` como dirección operativa mientras su DNS no resuelva.

## Capacitor y Android

`capacitor.config.ts` apunta a `webDir: "out"` y define el esquema Android `https`. En este repositorio **todavía no hay carpeta `android/`**, por tanto `cap sync android` no puede completar la sincronización inicial hasta añadir la plataforma.

Primer alta de Android:

```bash
npm run build
npx cap add android
```

Después configura el intent filter del callback en `android/app/src/main/AndroidManifest.xml` para el esquema `es.nebuladigitalstudio.jobmatch`, host `auth` y ruta `/callback`, con las categorías `DEFAULT` y `BROWSABLE`. Revisa también los permisos de micrófono y ubicación, el icono adaptativo y los iconos de lanzamiento; el único recurso de marca incluido ahora es `public/icon.svg`, no un paquete de recursos Android.

Sincronización y apertura posteriores:

```bash
npm run build
npm run cap:sync
npm run cap:open
```

En Android Studio genera y firma un Android App Bundle (`.aab`) para Play Console. Usa el mismo `applicationId` en todas las versiones publicadas y guarda de forma segura el keystore y sus copias de seguridad. El proyecto nativo, el intent filter, el icono de Play y la compilación firmada requieren validación en Android Studio/dispositivo; no pueden confirmarse desde el build web.

## Auditoría de seguridad y privacidad

- La base compartida exige mantener el prefijo `jobmatch_` en tablas, funciones, triggers, índices y políticas. No renombres ni modifiques objetos de otros proyectos.
- Google OAuth usa el correo como identidad; no se debe mostrar a otros usuarios como contacto.
- Los perfiles ampliados y el teléfono comercial están condicionados por matches y preferencias, mediante RLS y la interfaz.
- La solicitud de borrado in-app borra los objetos bajo el UUID del usuario en ambos buckets antes de llamar al RPC. Las antiguas rutas de CV `cv/<user-id>/...` también deben limpiarse durante la migración de archivos históricos.
- El aviso de privacidad y los términos nombran `jobmatch.es` y `@jobmatch.es`. Antes de usar el dominio, registra y configura el dominio y crea/verifica esos buzones o reenvíos; comprueba que las solicitudes de privacidad y eliminación llegan a una persona responsable.
- La auditoría de código no verifica el estado real de las políticas, OAuth, Realtime, bucket o funciones en el proyecto Supabase. Contrasta esos ajustes con los scripts y realiza un inicio, match, chat, subida y borrado controlados en un entorno de prueba.

## Plan futuro: dominio propio y Supabase aislado

### A. Comprar y activar `jobmatch.es`

1. Registra el dominio en el proveedor elegido y configura los registros DNS exactamente como Vercel los muestre para el proyecto. Espera a que Vercel confirme la verificación y el certificado TLS.
2. En Vercel, añade `jobmatch.es` y `www.jobmatch.es`; elige un único dominio canónico y configura el otro para redirigir a él.
3. Crea y prueba `soporte@jobmatch.es` y `privacidad@jobmatch.es` o reenvíos equivalentes antes de dejarlos como vías oficiales de contacto.
4. Añade el dominio final a las URLs de Supabase Auth y al origen/redirect de Google OAuth. Conserva temporalmente el subdominio anterior durante la transición.
5. Actualiza `metadataBase`, canonical/OG, textos legales y cualquier enlace absoluto de eliminación de cuenta. El manifest ya es relativo y no necesita cambiar de origen.
6. Verifica HTTPS, login/logout, callback OAuth, páginas legales, enlace de borrado y PWA en ambos dominios. Después establece la redirección permanente del dominio anterior y actualiza Google Search Console si se usa.

No copies valores DNS de una guía antigua: utiliza los valores que Vercel muestre en el panel cuando se configure el dominio.

### B. Migrar desde Supabase compartido a un proyecto JobMatch propio

La migración es un cambio de identidad de backend, no basta con cambiar las dos variables de entorno. Si se apunta una copia nueva vacía, los usuarios aparecerán sin fichas, los matches desaparecerán y los enlaces de archivo dejarán de funcionar.

1. Crea el nuevo proyecto JobMatch en el plan elegido y guarda URL y claves en un gestor seguro. Mantén el proyecto compartido intacto durante la migración y prepara una ventana de mantenimiento.
2. Ejecuta `supabase/schema.sql` y `supabase/legal_and_delete_account.sql` en el proyecto nuevo. Revisa todas las políticas RLS, el bucket, MIME/tamaño, extensiones necesarias y Realtime. No incluyas secretos en el repositorio.
3. Configura Google OAuth, URLs de retorno web y `es.nebuladigitalstudio.jobmatch://auth/callback`. Añade el dominio nuevo cuando ya exista.
4. Haz copia de seguridad de todos los objetos `jobmatch_*`, datos relacionados, usuarios de Supabase Auth que correspondan y archivos de `jobmatch-media`. Migra usuarios preservando sus UUID para conservar las relaciones; si no se pueden preservar, prepara un proceso de reautenticación y reasociación antes del cambio.
5. Copia `jobmatch-media` y `jobmatch-cvs` conservando las rutas que contienen el UUID del usuario. En el proyecto destino aplica `supabase/private_cvs_storage.sql` y verifica que el bucket de CV siga privado. Comprueba las referencias firmadas; no migres filas de Nebula Games ni de otros productos.
6. Ejecuta verificaciones de conteo y relaciones en la copia, y prueba con cuentas de trabajador y empresa: perfil, oferta, upload, swipe mutuo, chat, propuesta, lectura de PDF y borrado.
7. Actualiza `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en Vercel en todos los entornos; despliega primero Preview y luego Production. Sincroniza `.env.local` y compila de nuevo la APK con el proyecto nuevo.
8. Conserva backups verificables y acceso de solo lectura al proyecto compartido hasta confirmar la estabilidad de producción. Después retira los secretos antiguos de Vercel y define el plan de apagado con el propietario de Nebula Games.

Una instancia propia separa el riesgo operativo de otros productos y facilita definir capacidad, backups, facturación y acceso. El plan Supabase Pro no sustituye backups, RLS ni el procedimiento de migración.

## Solución de problemas

- **No se conecta a Supabase:** comprueba las dos variables `NEXT_PUBLIC_*`, reinicia el servidor de desarrollo y verifica que la clave sea la pública anon/publishable, no la service role.
- **Google vuelve a una página de error:** revisa las URLs permitidas de Supabase, la URL de callback que muestra Supabase en Google Cloud y que el `redirectTo` coincida exactamente.
- **Android no abre el callback:** comprueba el intent filter, el esquema/host/path, el registro de URL en Supabase y el listener `appUrlOpen`; recompila e instala la app después de cambios nativos.
- **Storage devuelve error RLS al subir CV:** comprueba que `supabase/private_cvs_storage.sql` se ejecutó, que el bucket es privado y que el path empieza por `<user-id>/cv-...pdf`. Para imágenes/audio, comprueba `jobmatch-media` y sus políticas de propietario.
- **No aparece Realtime:** habilita `jobmatch_matches` y `jobmatch_messages` en la publicación de Realtime del proyecto correcto.
- **No funciona el dominio nuevo:** primero valida DNS y TLS en Vercel. Un alias configurado no garantiza que el dominio esté registrado o que ya resuelva públicamente.

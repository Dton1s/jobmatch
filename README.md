# JobMatch

Job Match conecta a trabajadores y empresas mediante fichas profesionales, ofertas con salario visible, intereses mutuos y chat, con filtros de distancia que pueden superar los 50 km. La interfaz es mobile-first y se exporta como sitio estático de Next.js; Capacitor puede cargar esa exportación como aplicación Android.

> **Estado revisado el 18 de noviembre de 2026.** Nombre visible de marca: **Job Match**; nombre compacto **JobMatch** se conserva en identificadores técnicos y en el logotipo actual. El dominio canónico `https://job-match.es` está conectado a Vercel, resuelve con SSL y sirve producción, según la confirmación del propietario. Android tiene configurado `versionName 1.0.8` y `versionCode 10`.

## Índice

- [Estado y alcance](#estado-y-alcance)
- [Estado de lanzamiento](#estado-de-lanzamiento)
- [Cómo se usa](#cómo-se-usa)
- [Arquitectura](#arquitectura)
- [Requisitos y desarrollo local](#requisitos-y-desarrollo-local)
- [Supabase](#supabase)
- [Variables de entorno](#variables-de-entorno)
- [Despliegue web y SEO](#despliegue-web-y-seo)
- [Variables de entorno en Vercel](#variables-de-entorno-en-vercel)
- [Capacitor y Android](#capacitor-y-android)
- [Auditoría de seguridad y privacidad](#auditoría-de-seguridad-y-privacidad)
- [Plan futuro: marca/dominio y Supabase aislado](#plan-futuro-marcadominio-y-supabase-aislado)
- [Lista detallada antes del lanzamiento oficial](#lista-detallada-antes-del-lanzamiento-oficial)
- [Solución de problemas](#solución-de-problemas)

## Estado y alcance

- Repositorio: `Dton1s/jobmatch`, rama de publicación: `main`.
- Proyecto Vercel: `jobmatch`, equipo `nebula-b346`.
- Dominio canónico `https://job-match.es` verificado en Vercel, operativo y con certificado SSL activo. Las Redirect URLs de Supabase se limpiaron y quedaron limitadas a `job-match.es` y a los dominios de Nebula Digital Studio; se retiraron rutas de proyectos anteriores. El Site URL del proyecto compartido se mantiene según la configuración actual.
- Nombre de marca: **Job Match** en textos visibles y previsto para la ficha de Play como **Job Match - Trabajo y Empleo**. El logotipo actual conserva el wordmark compacto `jobmatch`; identificadores técnicos como `jobmatch_*`, paquete NPM y `appId` no se renombran en esta actualización.
- Operador: **Antonio Meroño Estañ**, persona física autónoma y titular legal del servicio, NIF indicado en la documentación legal. **Nebula Digital Studio** se usa como nombre comercial/estudio que gestiona el servicio; no es una sociedad distinta del titular.
- Supabase conectado actualmente: instancia compartida con otros proyectos de Nébula, que mantiene la aplicación web en producción. El aislamiento de Job Match es a nivel de esquema: sus tablas, tipos, funciones, triggers, índices y políticas usan el prefijo estricto `jobmatch_`; los buckets dedicados son `jobmatch-media` y `jobmatch-cvs`. La instancia compartida no se presenta como una base exclusiva.
- Monetización: Boost (7,99 € por 7 días) y Job Match Pro (19,99 €/mes). Según confirmación del propietario, Stripe está en modo Live y su webhook de producción está activo en `https://job-match.es/api/webhooks/stripe` con los siete eventos documentados más abajo. Vercel confirma que `STRIPE_WEBHOOK_SECRET` se actualizó el 16-11-2026 a las 16:13 UTC y que después quedó `READY` un despliegue de producción (16:14 UTC). La infraestructura de pagos se considera configurada y operativa; la clave no se copia al repositorio.
- **Google Play Billing** está integrado en código para Pro y Boost de oferta/perfil, con verificación de compra en servidor. IDs reales: `jobmatch_pro` (plan `pro-mensual`), `jobmatch_offer_boost_7d` (opción `standar`) y `jobmatch_worker_boost_7d` (opción `standar-worker`). El estado de conexión de credenciales y publicación de cada producto debe confirmarse en Play Console/Vercel; este README no afirma que las compras reales hayan pasado una transacción de extremo a extremo.
- **Moderación UGC:** el frontend incorpora denuncias de perfiles/ofertas/chat, bloqueo desde el chat y aceptación obligatoria de las normas al crear el primer perfil u oferta. Para una base nueva, ejecuta `supabase/jobmatch_moderation.sql`; si la tabla ya existe, ejecuta también `supabase/upgrade_message_reports.sql` para habilitar los motivos nuevos de denuncia de mensajes. Confirma que la migración se haya aplicado en producción antes de activar estas denuncias.
- **Actualizaciones Android**: `@capawesome/capacitor-app-update` consulta disponibilidad mediante Play Core al abrir la app y al volver a primer plano. Si Google Play admite el flujo flexible, el botón inicia la descarga dentro de la app y permite reiniciar para instalar; si solo admite el flujo inmediato, lo ejecuta. Si Play no permite ninguno, abre la ficha de Job Match en Play Store como alternativa.
- PWA instalada: manifest con nombre e iconos de JobMatch, `display: standalone` y banner de instalación para Chromium en PC/Android, con instrucciones manuales para Safari en iOS. La app no anuncia modo sin conexión ni registra un service worker.
- Identidad visual: logo, banner, icono maestro de la app y favicons/iconos PWA están incorporados al repositorio. El logotipo gráfico conserva el wordmark compacto `jobmatch`, mientras la interfaz y la ficha de tienda utilizan **Job Match**.
- Correo corporativo: el propietario confirma que Nominalia tiene creados y activos `administracion@job-match.es`, `privacidad@job-match.es` y `soporte@job-match.es`. Privacidad y Soporte son los contactos públicos; Administración queda para gestiones internas hasta definir flujos específicos.
- Estado de infraestructura web: Vercel, dominio canónico y SSL, correo Nominalia, Stripe Live/webhook y SEO están completados según la confirmación operativa del propietario. La app Android usa Capacitor; esta revisión de código no valida una compilación AAB firmada ni la publicación del track.

## Estado de lanzamiento

La aplicación web está desplegada en Vercel. `job-match.es` aparece verificado en el proyecto y sirve la producción. El último despliegue de producción observado está `READY`; el subdominio `jobmatch.nebuladigitalstudio.es` permanece conectado como origen anterior.

> **Infraestructura web completada al 100% según confirmación operativa del propietario:** Vercel, dominio canónico con SSL, buzones de Nominalia, Stripe Live con webhook activo y SEO (rastreo y Search Console). La plataforma Android ya está inicializada; el siguiente hito es validar OAuth, recursos y compilación firmada.

| Área | Estado a 16-11-2026 |
| --- | --- |
| Aplicación web y flujos principales | Desplegados en Vercel; los flujos autenticados principales se revisaron en sesión. Mantener pruebas de aceptación de extremo a extremo antes de escalar el registro público. |
| PWA e identidad visual | Manifest, instalación guiada, logotipo, banner «Haz match con el empleo», icono y favicon incorporados. |
| Supabase | La web funciona sobre el proyecto compartido con Nébula. El esquema de Job Match está aislado por el prefijo estricto `jobmatch_` en tablas, funciones y políticas. Una migración futura a proyecto dedicado es una decisión de infraestructura, no un requisito para que la web actual funcione. |
| Currículums privados | Código y SQL de bucket privado implementados; validar políticas y migración de los CV antiguos en el proyecto conectado. |
| Stripe | Infraestructura configurada en modo Live; webhook de producción activo según confirmación del propietario. Checkout controlado, reembolsos y facturación siguen siendo validaciones operativas recomendadas. |
| Nombre, dominio y correo | Nombre **Job Match**, `https://job-match.es`, SSL y los tres buzones de Nominalia operativos según confirmación del propietario. |
| SEO | `public/robots.txt` y `public/sitemap.xml` están desplegados y verificados con HTTP 200. El sitemap lista las cinco páginas públicas principales; la propiedad de Google Search Console está verificada. |
| Android / Google Play | Configuración fuente actual `versionName 1.0.8` / `versionCode 10`. Google Play Billing e In-App Updates están implementados en el código. La disponibilidad de productos, credenciales y compras requiere validación operativa en Play Console y en dispositivos del track de pruebas. |

La producción web utiliza la instancia Supabase compartida existente. Los objetos de base de datos propios de Job Match se aíslan mediante el prefijo estricto `jobmatch_` en tablas, funciones y políticas; esta separación de esquema permite operar la aplicación actual sin presentarla como un proyecto Supabase exclusivo. Una futura migración a una instancia dedicada se planificará con backup, validación y despliegue controlado.

### Verificación técnica de producción — 16 de noviembre de 2026

- **Dominio y SSL:** el propietario confirma que `https://job-match.es` está operativo en Vercel y con SSL activo; el último despliegue Production consultado está en estado `READY`.
- **Correo:** el propietario confirma que `administracion@job-match.es`, `privacidad@job-match.es` y `soporte@job-match.es` están activos y listos para uso operativo.
- **Stripe:** el propietario confirma modo Live, webhook activo en `https://job-match.es/api/webhooks/stripe` y recepción configurada para los siete eventos enumerados en la sección de monetización. Vercel muestra `STRIPE_WEBHOOK_SECRET` actualizado el 16-11-2026 a las 16:13 UTC y un despliegue Production `READY` posterior, a las 16:14 UTC. No se registra el secreto `whsec_...` en el repositorio.
- **SEO:** `public/robots.txt` y `public/sitemap.xml` están desplegados y responden HTTP 200 en el dominio canónico. El sitemap contiene cinco URLs públicas (`/`, `/aviso-legal`, `/privacidad`, `/terminos` y `/eliminar-cuenta`); el propietario confirma que la verificación de Google Search Console está completada.
- **Supabase:** el propietario confirma que las Redirect URLs se limpiaron y limitaron a `job-match.es` y dominios de Nebula Digital Studio, retirando URLs de proyectos anteriores. La aplicación sigue usando el proyecto compartido, con sus tablas, funciones y políticas aisladas bajo el prefijo estricto `jobmatch_`.
- **Variables Production:** el inventario de Vercel contiene todas las claves críticas documentadas; no faltan entradas. La variable pública `NEXT_PUBLIC_APP_URL` está configurada como `https://job-match.es`. Los valores secretos no se imprimen ni se copian al README.
- **Next.js y funciones:** `next.config.ts` configura `output: "export"`; las páginas públicas se generan como contenido estático. Las funciones independientes están en `api/`; `package.json` declara `"type": "module"`, los handlers usan ESM y las importaciones locales llevan extensión `.js`. No se encontraron usos de CommonJS (`require`/`module.exports`) en estas funciones.
- **Build local:** `npm run typecheck` y `npm run build` finalizaron correctamente; Next generó las rutas estáticas.

### Próximo hito técnico

1. Revisar en Android Studio el proyecto `android/` y validar el intent filter OAuth `es.nebuladigitalstudio.jobmatch://auth/callback` junto con las URLs de redirección de Supabase.
2. Configurar recursos nativos y revisar permisos; ejecutar `npm run build` y `npx cap sync android`, y probar en dispositivos antes de generar el AAB.
3. En paralelo, mantener las pruebas operativas de Checkout, webhook, renovación, cancelación y reembolso antes de ampliar el volumen de pagos.

El código de Checkout y el webhook de Stripe están en el repositorio. La cuenta de Stripe no está conectada a esta auditoría; el estado Live y el endpoint activo se documentan según confirmación del propietario. La publicación de infraestructura no sustituye las pruebas operativas periódicas de pagos.

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
| Exportación | `output: "export"`; las páginas Next prerenderizadas quedan en `out/` |
| API de pagos | Funciones serverless de Vercel desde `api/checkout/` y `api/webhooks/`; usan Stripe y Supabase Admin solo en servidor |
| PWA | `public/manifest.webmanifest`, iconos instalables y `PwaInstallBanner`; `beforeinstallprompt` en Chromium e instrucciones de “Añadir a pantalla de inicio” en Safari iOS |
| Android | Capacitor 7, `appId` `es.nebuladigitalstudio.jobmatch`, esquema OAuth `es.nebuladigitalstudio.jobmatch://auth/callback` |
| Rutas públicas | `/`, `/aviso-legal`, `/privacidad`, `/terminos`, `/eliminar-cuenta` |

Las páginas legales y la portada se prerenderizan estáticamente. Las funciones de usuario se ejecutan en el navegador y usan la clave pública/anon de Supabase junto con las políticas RLS. No se debe incluir `service_role` en el frontend.

Como Next está en `output: "export"`, las rutas de negocio de Stripe no se implementan como `src/app/api` dentro de la exportación estática: viven en el directorio raíz `api/` y Vercel las sirve como funciones Node.js aparte del frontend. La aplicación usa ESM: `package.json` declara `"type": "module"`, los handlers usan `import`/`export` y las importaciones locales del backend escriben la extensión `.js` para la resolución de módulos. No hay una capa dual CommonJS/ESM ni se deben mezclar `require`/`module.exports` con esos handlers.

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

El esquema actual contiene, entre otros, `jobmatch_profiles`, `jobmatch_worker_cards`, `jobmatch_job_offers`, `jobmatch_swipes`, `jobmatch_matches`, `jobmatch_messages`, `jobmatch_card_views` y `jobmatch_company_contacts`. La migración de moderación añade `jobmatch_user_reports`, `jobmatch_user_blocks` y `jobmatch_community_acceptances`.

Los scripts SQL pertenecen a esta app:

- `supabase/schema.sql`: esquema completo para una base nueva. **No lo ejecutes sobre una base compartida que ya tenga estas tablas**.
- `supabase/upgrade_v2.sql`, `supabase/upgrade_profiles.sql`, `supabase/upgrade_cv_v4.sql`, `supabase/upgrade_role_modes.sql`: ampliaciones incrementales de versiones anteriores. `upgrade_role_modes.sql` habilita el modo dual y restringe la lectura pública de fichas/ofertas al rol activo.
- `supabase/fix_profiles_v3.sql`, `supabase/fix_match_profile_rls.sql`: columnas y permisos de lectura del perfil ampliado.
- `supabase/fix_storage_cv.sql`, `supabase/fix_storage_all.sql`: políticas y configuración del bucket; lee la nota de seguridad antes de aplicar o reutilizar estas políticas.
- `supabase/legal_and_delete_account.sql`: RPC de eliminación de cuenta.
- La eliminación desde la app recorre de forma paginada la carpeta UUID del usuario en `jobmatch-media` y `jobmatch-cvs`, y también el prefijo histórico `cv/<user-id>/` en `jobmatch-cvs`; borra los archivos en bloques y después llama al RPC `jobmatch_delete_my_account`; los registros vinculados (incluidas aceptaciones, denuncias propias y bloqueos) se eliminan/anomizan mediante sus FK.
- `supabase/jobmatch_moderation.sql`: crea las tablas de denuncias, bloqueos y aceptación de normas; configura RLS y hace cumplir bloqueos en perfiles, ofertas, swipes, matches y chat. Para una base existente, aplica `supabase/upgrade_message_reports.sql` para ampliar los motivos admitidos al denunciar mensajes.
- Las denuncias quedan en estado `pending` y se revisan desde el entorno administrativo de Supabase; el cliente solo puede registrar denuncias y consultar las propias, no modificar el estado interno ni las notas de moderación. Tras revisar, documenta la resolución y aplica la retirada de contenido o medida sobre la cuenta si procede.
- `supabase/upgrade_monetization.sql`: columnas de Boost y Pro, historial idempotente de eventos Stripe, protección de campos de pago y RPC para contacto directo Pro. Aplícalo una vez en el SQL Editor del proyecto antes de habilitar cobros.
- `supabase/free_offer_limit.sql`: aplica el máximo de tres ofertas activas en el plan gratuito y deja ilimitadas las empresas con Pro vigente. Ejecútalo en el SQL Editor de Supabase.
- `supabase/seed_demo.sql`: carga opcional de perfiles y ofertas ficticios, con `is_demo=true`; no representan personas o negocios reales. Lánzalo solo para pruebas.
- El descubrimiento consulta todas las fichas y ofertas activas sin filtrar `is_demo`; si el mazo incluye registros ficticios, muestra un aviso global. Esos registros no crean matches ni conversaciones.
- `supabase/cleanup_demo.sql`: elimina exclusivamente fichas/ofertas con `is_demo=true`; sus matches, mensajes y demás relaciones dependientes se eliminan por las FK. No elimina cuentas ni perfiles de autenticación. Revisa el contenido y ejecútalo cuando quieras retirar los datos ficticios.

Para una base nueva, ejecuta `schema.sql` y las migraciones incrementales aplicables, incluidas `legal_and_delete_account.sql` y `free_offer_limit.sql`. El seed es opcional y no se aplica en despliegues nuevos automáticamente. Las fichas de muestra aparecen identificadas en el mazo, no registran vistas ni swipes, y no pueden crear matches ni chats. Para una base existente, identifica primero qué migraciones ya se ejecutaron y aplica solo las siguientes en orden; no vuelvas a ejecutar una instalación completa encima de datos reales.

Antes de desplegar el modo de rol único/dual en una base existente, ejecuta `supabase/upgrade_role_modes.sql` al final de las migraciones anteriores. Añade `enabled_roles`, conserva el rol principal existente y aplica RLS para que las fichas y ofertas solo sean visibles en descubrimiento mientras su modo está habilitado.

### Auth y Google OAuth

1. En Supabase, activa el proveedor Google y configura sus credenciales OAuth.
2. En **Authentication → URL Configuration**, registra los orígenes web que se van a usar: `http://localhost:3000`, `https://job-match.es/` y temporalmente el subdominio anterior durante la transición.
3. Añade `es.nebuladigitalstudio.jobmatch://auth/callback` a las URLs permitidas para redirección.
4. En Google Cloud, configura el callback que muestra Supabase como URI de redirección autorizada.
5. El inicio web vuelve al origen actual; el inicio nativo abre el flujo OAuth en el navegador del sistema y procesa el enlace profundo con `@capacitor/app`.

Las listas de redirección de Supabase y Google son configuración externa: el build no puede comprobar que las credenciales, consent screen, URLs permitidas o callback estén bien en sus paneles.

### Storage

Los avatares, logos y audios se guardan en `jobmatch-media`, que permite lectura pública y restringe las escrituras a la carpeta del usuario autenticado. Los currículums se guardan en el bucket privado `jobmatch-cvs`, con límite de 5 MB y solo PDF. `supabase/private_cvs_storage.sql` crea el bucket y aplica políticas estrictas: el titular puede leer su CV y otros usuarios solo pueden leerlo si existe un match confirmado. La app genera una URL firmada con vigencia de 5 minutos al abrir el documento. No se guardan nuevas URLs públicas.

**Estado de seguridad:** el repositorio contiene `supabase/private_cvs_storage.sql` para el bucket privado y las políticas estrictas. El propietario informó que ejecutó en el SQL Editor el SQL corregido de `INSERT`/`UPDATE` sin depender de `metadata`; antes del lanzamiento al público hay que comprobar en el proyecto Supabase conectado que `jobmatch-cvs` sea privado, admita solo PDF hasta 5 MB y tenga las políticas esperadas. Los archivos PDF históricos que aún estén en el bucket público `jobmatch-media` siguen siendo accesibles públicamente hasta migrarlos a `jobmatch-cvs` y borrar los originales. La app conserva compatibilidad temporal al firmar las referencias antiguas, pero esa compatibilidad no vuelve privados los objetos antiguos.

### Monetización de empresa

- **Plan gratuito:** hasta 3 ofertas activas simultáneamente. Al llegar al límite, la interfaz explica Job Match Pro y la base de datos aplica el mismo máximo mediante el trigger de `supabase/free_offer_limit.sql`.
- **Web:** Stripe procesa Boost de oferta (7,99 €), Boost de trabajador (1,99 €) y Job Match Pro (19,99 €/mes).
- **Android:** Google Play Billing procesa estos mismos productos dentro de la app; Android no abre Stripe. La suscripción usa `jobmatch_pro` / `pro-mensual`; los pagos únicos usan `jobmatch_offer_boost_7d` / `standar` y `jobmatch_worker_boost_7d` / `standar-worker`.
- La activación de beneficios depende de la validación del pago en backend. Las empresas Pro pueden iniciar conversaciones directas con candidatos disponibles desde el detalle de la ficha.
- Las funciones Vercel están en `api/checkout/boost.ts`, `api/checkout/subscription.ts` y `api/webhooks/stripe.ts`. El webhook valida la firma Stripe, y la clave `service_role` solo se usa en backend.
- En Vercel están creadas las variables de producción enumeradas en [Variables de entorno en Vercel](#variables-de-entorno-en-vercel). No copies sus valores al README. `STRIPE_PRO_PRICE_ID` debe identificar un precio Stripe activo de 19,99 EUR recurrente cada mes; el endpoint lo valida antes de crear Checkout. El Boost actual crea un precio único de 7,99 EUR directamente en el endpoint y dura 7 días; `STRIPE_BOOST_PRICE_ID` también está configurada en Vercel, pero el código actual no la consume. El propietario confirma que el endpoint de producción está configurado y activo en Stripe: `https://job-match.es/api/webhooks/stripe`, con los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` e `invoice.payment_failed`.
- El propietario confirma Stripe Live y webhook activo; la actualización de `STRIPE_WEBHOOK_SECRET` fue seguida por un despliegue Production `READY`. Sigue pendiente comprobar el ciclo de compra, cancelación y reembolso con transacciones controladas. Los botones Stripe se ocultan en Android; el código nativo utiliza Google Play Billing.

### Impulso de perfil de trabajador

- **Precio y vigencia:** pago único de 1,99 € para impulsar una ficha de trabajador durante 7 días. Las fichas impulsadas vigentes se priorizan en la búsqueda de empresas.
- **Checkout:** `api/checkout/worker-boost.ts` valida sesión y modo Trabajador en servidor, y crea la sesión Stripe con `user_id` en metadata. El webhook activa el impulso mediante `jobmatch_apply_worker_boost`, con deduplicación de eventos Stripe.
- **Interfaz:** el panel `Perfil y ajustes` del modo Trabajador muestra si el impulso está activo y cuánto tiempo queda. En web usa Stripe; Android muestra precio localizado de Google Play y compra nativa.
- **Migración Supabase:** aplica `supabase/upgrade_worker_boost.sql` una vez en el proyecto conectado. El script añade campos de vigencia, impide cambios de entitlement desde clientes autenticados y habilita el RPC solo para `service_role`. `supabase/schema.sql` también incluye el esquema para instalaciones nuevas.

### Google Play Billing para Android

- El proyecto usa `@capgo/native-purchases` para Google Play Billing y `@capawesome/capacitor-app-update` para In-App Updates de Play Core. La web conserva Stripe; Android no abre Stripe.
- IDs configurados: suscripción `jobmatch_pro` con base plan `pro-mensual`; Boost de oferta `jobmatch_offer_boost_7d` con opción `standar`; Boost de trabajador `jobmatch_worker_boost_7d` con opción `standar-worker`. La interfaz toma los precios localizados de Play.
- Antes de probar: aplicar `supabase/google_play_billing.sql`; habilitar Google Play Android Developer API y vincular el service account con permisos de gestión de pedidos/suscripciones en Play Console; añadir su JSON completo en Vercel Production como `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`; redesplegar las funciones. No subir el JSON al repositorio.
- Las compras se validan en el servidor con la API Android Publisher, se vinculan a un hash de la cuenta Job Match y se registran por hash del purchase token para impedir duplicados y reutilización entre cuentas. El servidor activa los beneficios y consume Boosts o confirma Pro únicamente tras validar el pago.
- Añadir los testers a la lista de License Testing y al track de testing. Deben instalar la versión desde Google Play, no mediante APK sideload. Los productos deben estar activos y disponibles para el track.
- El estado Pro se vuelve a consultar en Google Play al entrar y al regresar a la app; los paneles de facturación vuelven a consultar también el catálogo y el precio localizado al abrirse y al volver a primer plano. La vigencia almacenada limita el acceso hasta la fecha confirmada por Google. Si falla el acuse/consumo tras validar una compra, la app conserva el contexto pendiente y vuelve a intentarlo al reanudar. Para operación comercial completa, configurar Real-time Developer Notifications para procesar reembolsos y cambios de suscripción en cuanto ocurran.

### Actualizaciones desde Play Store

La app consulta In-App Updates de Google Play en el arranque y al volver a primer plano. Si el dispositivo tiene una versión más reciente disponible en su canal de Play, presenta “Actualización disponible” y `Actualizar` inicia la descarga flexible o el flujo inmediato nativo, según lo permita Play. El aviso ofrece reiniciar cuando la descarga flexible está lista; si no hay un flujo nativo permitido, abre la ficha de Play Store. El aviso no se activa en navegador web ni cuando Play no ofrece una actualización a esa cuenta/dispositivo.

## Variables de entorno

Copia `.env.example` a `.env.local` en local y añade las mismas variables en Vercel (Development/Preview/Production según proceda):

```env
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clave-publica-anon>
```

Estas dos variables son públicas por diseño y están sujetas a RLS. Nunca uses `SUPABASE_SERVICE_ROLE_KEY` en el cliente o en variables `NEXT_PUBLIC_*`.

### Variables presentes en el entorno Production de Vercel

Se comprobó la lista de nombres de variables de Production del proyecto Vercel `jobmatch`. Aquí se documentan solo las claves; sus valores se mantienen secretos y no se imprimen en el repositorio.

| Variable | Uso / notas |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase conectado. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública del cliente; las políticas RLS siguen siendo obligatorias. |
| `NEXT_PUBLIC_APP_URL` | Configurada en Production como `https://job-match.es`; base de retornos de Stripe. |
| `SUPABASE_SERVICE_ROLE_KEY` | Acceso administrativo solo desde funciones serverless. Nunca exponer al cliente. |
| `STRIPE_SECRET_KEY` | Clave privada para Checkout y consultas de precios. Live mode confirmado por el propietario; el valor está oculto por Vercel y no se verificó su prefijo. |
| `STRIPE_PRO_PRICE_ID` | Price ID que el endpoint valida como 19,99 EUR/mes. |
| `STRIPE_BOOST_PRICE_ID` | Está configurada, pero el endpoint Boost actual fija 7,99 EUR usando `price_data` y no la lee. |
| `STRIPE_WEBHOOK_SECRET` | Firma para validar el webhook. Actualizada el 16-11-2026 16:13 UTC; despliegue Production posterior en estado `READY` a las 16:14 UTC. No publicar el valor `whsec_...`. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Está configurada; actualmente el flujo de Checkout servidor no la consume. |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | **Pendiente de configurar** tras crear el service account y concederle acceso a la app en Play Console. JSON privado de Android Publisher API, usado solo por `/api/google-play/verify-purchase`. |

La auditoría de Vercel del 16-11-2026 encontró todas las claves esperadas en Production: no falta ninguna variable requerida en el inventario. Los secretos no se revelan ni se copian a este archivo. `STRIPE_BOOST_PRICE_ID` y `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` existen pero el checkout de servidor actual no los consume; el endpoint Boost construye su precio inline. `.env.example` es una plantilla local con marcadores, no una copia del entorno Live.

## Despliegue web y SEO

Vercel está conectado con `Dton1s/jobmatch`; cada push a `main` inicia un despliegue de producción. Revisa que quede `READY` en Vercel después de publicar. El dominio canónico `https://job-match.es` está operativo; el subdominio `https://jobmatch.nebuladigitalstudio.es` puede mantenerse como origen anterior durante la transición.

El manifest usa rutas relativas (`/`) y no queda ligado a un dominio. El banner solicita la instalación solo cuando Chromium emite `beforeinstallprompt`; en iOS muestra los pasos manuales. El cierre persiste en `localStorage`. No existe un service worker ni funcionalidad offline implementada. Los metadatos y textos legales usan `soporte@job-match.es` y `privacidad@job-match.es`. El propietario confirma que los tres buzones de Nominalia (`administracion@job-match.es`, `privacidad@job-match.es`, `soporte@job-match.es`) están creados, activos y listos. Las Redirect URLs de Supabase se limpiaron y acotaron a `job-match.es` y los dominios de Nebula Digital Studio; se retiraron las URLs antiguas de otros proyectos. El proyecto Supabase compartido continúa siendo el backend de producción.

### SEO y rastreo — completado

`public/robots.txt` y `public/sitemap.xml` se incluyen en la exportación estática, están desplegados y responden HTTP 200 en `https://job-match.es/robots.txt` y `https://job-match.es/sitemap.xml`. El sitemap contiene las cinco páginas públicas principales: portada, aviso legal, privacidad, términos y eliminación de cuenta. La verificación del dominio en Google Search Console está completada. El seguimiento periódico de indexación y cobertura continúa como mantenimiento SEO.

## Capacitor y Android

`capacitor.config.ts` apunta a `webDir: "out"` y define el esquema Android `https`. La plataforma nativa ya se creó en `android/`; la exportación estática se copia a `android/app/src/main/assets/public/` mediante `npx cap sync android`.

Primer alta de Android:

```bash
npm run build
npx cap add android
```

El manifiesto `android/app/src/main/AndroidManifest.xml` declara el intent filter OAuth `es.nebuladigitalstudio.jobmatch://auth/callback`. La versión configurada actualmente es `versionCode 10` / `versionName 1.0.8`. El plugin de compras integra Google Play Billing; el plugin de actualizaciones usa In-App Updates de Google Play. Antes de compilar el siguiente AAB, ejecuta las migraciones SQL pendientes y valida productos/credenciales en el track correspondiente.

Sincronización y apertura posteriores:

```bash
npm run build
npm run cap:sync
npm run cap:open
```

Después de aplicar la migración SQL, configurar los productos en Play Console y añadir `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` a Vercel, genera un AAB firmado con Android Studio y súbelo al track de testing. Los testers deben instalarlo desde Play Store para que Billing y la consulta de actualizaciones estén disponibles.

En Android Studio genera y firma un Android App Bundle (`.aab`) para Play Console. Usa el mismo `applicationId` en todas las versiones publicadas y guarda de forma segura el keystore y sus copias de seguridad. El proyecto nativo, el intent filter, el icono de Play y la compilación firmada requieren validación en Android Studio/dispositivo; no pueden confirmarse desde el build web.

## Lista detallada antes del lanzamiento oficial

Esta es la lista pendiente de trabajo técnico y administrativo. Los pasos que dependen de compras, verificaciones externas o cuentas deben cerrarse desde sus paneles; un build local por sí solo no los acredita.

### 1. Cuenta de desarrollador y número D‑U‑N‑S

1. Decidir si Google Play Console se registrará como organización o persona y completar la verificación de identidad correspondiente.
2. Para el alta como organización, confirmar en Play Console si requiere un número D‑U‑N‑S y comprobar que razón social, domicilio y teléfono coinciden exactamente entre D&B y la documentación legal.
3. Solicitar el número o corregir los datos empresariales si procede; guardar la referencia y documentación en un gestor corporativo seguro.
4. Completar la verificación de Google Play Console, activar la autenticación multifactor y asignar un propietario y un segundo administrador de recuperación.
5. No programar la publicación de la app hasta que la cuenta quede verificada y habilitada para crear el registro de la aplicación.

### 2. Proyecto Supabase de producción independiente

La app desplegada utiliza Supabase compartido con otros productos y mantiene su propio esquema mediante el prefijo estricto `jobmatch_` en tablas, funciones y políticas. Si en el futuro se decide pasar a un proyecto Supabase dedicado, usar este procedimiento de migración; no es un paso necesario para que la web actual funcione.

1. Elegir el plan Supabase adecuado y crear un proyecto separado llamado JobMatch; guardar región, URL, anon key y service role key en un gestor de secretos.
2. Mantener la instancia compartida disponible hasta terminar pruebas de migración y definir una ventana de cambio. No borrar ni pausar la base origen.
3. Aplicar las migraciones en orden sobre el destino. Revisar tablas, extensiones, funciones, triggers, RLS, Realtime, buckets, MIME y tamaño; mantener el prefijo `jobmatch_`.
4. Ejecutar `schema.sql` solo en una base vacía. Para migrar datos existentes, usar un backup verificado y scripts incrementales, preservando IDs de usuarios y relaciones; no copiar objetos de otros productos.
5. Migrar usuarios de Auth conforme al método soportado, perfiles, tarjetas, ofertas, swipes, matches, chats y eventos necesarios. Si no es posible conservar identidades, planificar reautenticación y reasociación antes del corte.
6. Copiar `jobmatch-media` y `jobmatch-cvs` conservando rutas `<user-id>/...`. Verificar el acceso privado a CV mediante URL firmada, borrar CV históricos del bucket público tras confirmar la copia y validar la eliminación de cuenta.
7. Configurar Google OAuth, URLs permitidas web, callbacks de Capacitor, SMTP si se usa y las políticas necesarias para producción.
8. Actualizar en Vercel `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` en los entornos necesarios. Probar primero Preview con cuentas controladas.
9. Hacer pruebas de trabajador y empresa: login, perfil, avatar/audio/CV, oferta, filtros, swipe, match, chat, entrevista, Storage, pago de prueba y borrado. Comparar recuentos y relaciones contra la copia de origen.
10. Desplegar Production al proyecto aislado, monitorizar errores y conservar backup/acceso de lectura del origen hasta declarar estable el cambio.

### 3. Identidad, dominio y correo

1. **Completado:** dominio canónico `job-match.es` activo, verificado en Vercel y con SSL; mantener acceso al registrador y configurar `www` solo si se decide usarlo.
2. **Completado según el propietario:** buzones de Nominalia `administracion@job-match.es`, `privacidad@job-match.es` y `soporte@job-match.es` creados y activos. Seguir probando su recepción y entrega.
3. **Completado según el propietario:** las Redirect URLs de Supabase se limpiaron y limitaron a `job-match.es` y dominios de Nebula Digital Studio; se retiraron rutas de proyectos anteriores. El Site URL de la instancia compartida permanece según la configuración operativa vigente.
4. Mantener comprobaciones periódicas de login, eliminación de cuenta y recepción de correo desde el dominio operativo.

### 4. SEO y presencia local

1. **Completado:** `robots.txt` y `sitemap.xml` están desplegados y verificados con HTTP 200; el sitemap contiene las cinco páginas públicas principales.
2. **Completado según el propietario:** propiedad del dominio verificada en Google Search Console.
3. Como mantenimiento, revisar cobertura, indexabilidad móvil, metadatos por página y enlaces rotos. Preparar contenido local útil sin duplicar páginas ni inventar ofertas.
4. Si se cambia el dominio operativo, seguir el proceso de cambio de dirección de Search Console cuando aplique y mantener las redirecciones del dominio previo.

### 5. APK/AAB y publicación en Google Play

1. Tras la verificación de Play Console, crear el registro de la app y completar clasificación de contenido, seguridad de datos, política de privacidad, URL de eliminación y ficha de tienda. Nombre público previsto: **Job Match - Trabajo y Empleo**.
2. Revisar el proyecto `android/` ya creado y configurar enlaces, permisos y barra de estado; validar OAuth/deep links con Supabase.
3. Generar recursos adaptativos Android a partir del máster y validar icono, splash, banner e identidad visual en varios tamaños.
4. Confirmar dominio y Supabase destino que usará la app, compilar web, ejecutar `npx cap sync android` y revisar que la salida `out/` corresponda al commit esperado.
5. Generar APK para pruebas internas y AAB firmado para Play Console. Guardar keystore y credenciales fuera del repositorio, con copia de seguridad y acceso restringido.
6. Probar OAuth/deep links, funcionamiento sin navegación de navegador, estados de permisos, subida de archivos, compra web y retorno desde Checkout en dispositivos reales.
7. Publicar primero en testing interno/cerrado, resolver los informes y requisitos de Google Play, y después iniciar el despliegue gradual de producción.

### 6. Validación comercial de Stripe

1. **Configuración declarada por el propietario:** cuenta Stripe en modo Live, Boost de 7,99 € y Job Match Pro de 19,99 €/mes.
2. **Configurado según el propietario:** webhook `https://job-match.es/api/webhooks/stripe` con `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` e `invoice.payment_failed`.
3. **Comprobado en Vercel:** existe `STRIPE_WEBHOOK_SECRET`, fue actualizado el 16-11-2026 16:13 UTC y hubo un despliegue Production posterior `READY` a las 16:14 UTC. No se documenta el valor del secreto.
4. **Pendiente de prueba de extremo a extremo:** completar un checkout controlado, validar firmas válidas/inválidas e idempotencia y comprobar en la base que el Boost y la suscripción actualizan sus fechas y estados correctamente.
5. Revisar cancelación, renovación, impago, expiración, reembolso, facturación, impuestos y atención a clientes antes de abrir pagos al público.

## Auditoría de seguridad y privacidad

- La base compartida exige mantener el prefijo `jobmatch_` en tablas, funciones, triggers, índices y políticas. No renombres ni modifiques objetos de otros proyectos.
- Google OAuth usa el correo como identidad; no se debe mostrar a otros usuarios como contacto.
- Los perfiles ampliados y el teléfono comercial están condicionados por matches y preferencias, mediante RLS y la interfaz.
- La solicitud de borrado in-app borra de forma paginada los objetos bajo el UUID del usuario en ambos buckets y el prefijo histórico `cv/<user-id>/` de `jobmatch-cvs` antes de llamar al RPC.
- El aviso legal, privacidad y términos identifican a Antonio Meroño Estañ como titular persona física autónoma, y a Nebula Digital Studio como nombre comercial/estudio que gestiona Job Match. El propietario confirma que los tres buzones Nominalia están activos. Administración queda disponible para uso interno; no se expone como contacto público.
- La auditoría de código no verifica el estado real de las políticas, OAuth, Realtime, bucket o funciones en el proyecto Supabase. Contrasta esos ajustes con los scripts y realiza un inicio, match, chat, subida y borrado controlados en un entorno de prueba.

## Plan futuro: marca/dominio y Supabase aislado

### A. Dominio operativo y contactos de marca

1. Dominio `job-match.es` y los tres buzones de Nominalia constan activos según el propietario; mantener acceso de recuperación y comprobar entrega de correo periódicamente.
2. Si se decide usar `www.job-match.es`, añadirlo y redirigirlo al dominio canónico. Conservar el subdominio anterior durante la transición si aún se necesita.
3. **Completado según el propietario:** las Redirect URLs se limpiaron y limitaron a `job-match.es` y dominios de Nebula Digital Studio; se retiraron rutas de proyectos anteriores. Mantener la configuración del Site URL compartido mientras esa instancia siga en uso.
4. Comprobar canonical/OG, documentos legales, enlaces de eliminación, checkout y PWA en `https://job-match.es`.



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

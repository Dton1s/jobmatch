# JobMatch

Aplicación web instalable para conectar trabajadores y negocios locales mediante tarjetas, intereses recíprocos y chat. La interfaz está en español y se adapta a móvil y escritorio.

## 1. Preparar Supabase

1. Crea o elige un proyecto de Supabase.
2. Si partes de una instalación anterior de JobMatch, ejecuta `supabase/upgrade_v2.sql` y después `supabase/upgrade_profiles.sql` para añadir campos y vistas sin borrar datos; para una instalación nueva ejecuta `supabase/schema.sql`. Los scripts solo crean o modifican objetos con prefijo `jobmatch_` y usan el bucket reservado `jobmatch-media`.
3. Opcionalmente ejecuta `supabase/seed_demo.sql` para añadir ocho fichas y ocho ofertas de ejemplo del área Torrevieja/Alicante. Están marcadas como demostración, no tienen usuarios de Auth asociados y no pueden crear matches reales.
4. En **Authentication → Providers**, activa Google. En Google Cloud, configura el callback de Supabase como redirect URI OAuth.
5. En **Authentication → URL Configuration**, añade `http://localhost:3000`, `https://jobmatch.nebuladigitalstudio.es` y `es.nebuladigitalstudio.jobmatch://auth/callback` a las URLs de redirección permitidas.
6. Copia `.env.example` como `.env.local` y añade la URL del proyecto y la clave pública/anon de Supabase. No uses una `service_role` en el navegador.

## 2. Ejecutar en local

Requiere Node.js 20 o posterior.

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`, inicia sesión con Google y elige Trabajador o Empresa. La ficha de trabajador admite presentación de audio de hasta 15 segundos. Las ofertas exigen un salario visible y caducan a los 14 días.

## 3. Publicar en Vercel

1. Importa este proyecto en Vercel.
2. Configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en los entornos necesarios.
3. Despliega y conecta el dominio `jobmatch.nebuladigitalstudio.es`.
4. Añade el dominio final a las URLs permitidas de Supabase Auth y a los orígenes autorizados de Google OAuth.

La compilación produce una exportación web estática en `out`, también compatible con el contenedor móvil de Capacitor.

## 4. Preparar Android con Capacitor

Configura primero las variables y genera la web:

```bash
npm run build
npx cap add android
npm run cap:sync
npm run cap:open
```

Se abrirá Android Studio con `appId` `es.nebuladigitalstudio.jobmatch`. Para cambios posteriores de la web, vuelve a ejecutar `npm run build` y `npm run cap:sync` antes de compilar el APK. La autenticación abre Google en el navegador del sistema y vuelve mediante `es.nebuladigitalstudio.jobmatch://auth/callback`; al generar la plataforma, añade un intent filter `VIEW` con `DEFAULT` y `BROWSABLE` para el esquema `es.nebuladigitalstudio.jobmatch`, host `auth` y ruta `/callback` en `android/app/src/main/AndroidManifest.xml`. Después registra el mismo redirect URI en Supabase Auth. En web se vuelve al origen actual.

La grabación de voz requiere permiso de micrófono. La ubicación se pide de forma explícita al pulsar **Detectar mi ubicación actual**; si se prefiere, se puede elegir una ciudad y código postal. Las coordenadas se guardan sin mostrarse en el formulario.

## Alcance de la primera versión

- Modo trabajador y empresa con cambio de rol, ficha editable y geolocalización voluntaria.
- Perfil Base separado para datos reutilizables de trabajador y empresa; al crear fichas u ofertas se proponen esos valores.
- Ficha ampliada del contacto accesible desde Conexiones y la cabecera del chat. Los datos completos se muestran solo cuando existe un match; el teléfono comercial aparece únicamente si el negocio activa la opción.
- Mazo ordenado por distancia, filtrado por radio y sector.
- Match recíproco creado por trigger SQL, con bandeja de conexiones y mensajes en tiempo real.
- Plantillas de contacto rápido para empresas.
- El botón de propuesta directa de pago aparece bloqueado hasta integrar y activar una suscripción; no se cobra nada en esta versión.
- `is_featured` existe para soportar una futura opción de trabajador destacado, pero la compra/activación requiere integrar pagos y reglas de moderación.

## Privacidad y operación

Los usuarios deben iniciar sesión para consultar tarjetas y subir archivos. La ubicación se solicita solo al pulsar el botón de geolocalización; se guarda en la tarjeta para calcular proximidad y se comparte con usuarios autenticados. La aplicación no procesa pagos ni recopila CV en PDF. Antes de abrir el servicio al público, publica políticas de privacidad y términos, define contacto para derechos de datos y revisa requisitos laborales locales.

Las tablas de mensajes y matches se añaden a `supabase_realtime` de forma condicional. Si el rol que ejecuta el SQL no tiene permiso para modificar la publicación, un administrador del proyecto deberá habilitar Realtime para las dos tablas `jobmatch_` desde Supabase.

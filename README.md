# Legium

Plataforma de cumplimiento para abogados. Este repositorio contiene el
scaffolding inicial (Fase 0 de la especificación técnica): autenticación,
multi-tenancy base, log de auditoría y panel de configuración del tenant.

## Stack

- React + TypeScript + Vite
- Tailwind CSS v4 (tokens de diseño en `src/index.css`)
- Supabase (Postgres + Auth)
- React Router

## Seed de datos de prueba

`supabase/seed/seed.sql` crea un despacho de prueba con clientes, casos,
actividad, una sentencia de ejemplo y plazos, vinculados a un usuario que
**ya debe existir en Authentication → Users** (ajusta el correo dentro
del script si no es `mhurtado1016@gmail.com`). Ejecutarlo en el SQL
Editor de Supabase, después de aplicar todas las migraciones.

## Configuración local

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Crear un proyecto en [Supabase](https://supabase.com) y aplicar las
   migraciones de `supabase/migrations/` (vía Supabase CLI o pegándolas
   en el SQL Editor del panel de Supabase, en orden).

3. Copiar las variables de entorno:

   ```bash
   cp .env.example .env
   ```

   Y completar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los
   valores de tu proyecto (Project Settings → API).

4. Ejecutar en desarrollo:

   ```bash
   npm run dev
   ```

## Edge Functions

Todas las funciones invocadas desde el navegador (`supabase.functions.invoke`)
incluyen los headers CORS necesarios (`supabase/functions/_shared/cors.ts`)
y responden al preflight `OPTIONS`. Sin esto, el navegador bloquea la
respuesta por venir de un origen distinto al de la app (Vercel vs.
Supabase), y toda llamada falla con un error genérico de red.

Desplegar con la Supabase CLI (`supabase functions deploy <nombre>`):

- `buscar-sentencias`: búsqueda en cache con fallback a la API en vivo de
  datos.gov.co (sección 4.2/4.4). Requiere `SUPABASE_SERVICE_ROLE_KEY`.
- `localizar-texto-sentencia`: construye y verifica la URL de una
  providencia en el sitio oficial de la Corte a partir del patrón
  `relatoria/{año}/{tipo}-{numero}-{añoYY}.htm` (sección 4.3.1). Se
  invoca también internamente desde `generar-resumen-ia` cuando falta
  `texto_completo_url`.
- `localizar-textos-sentencias-lote`: la misma lógica en lote, para
  correr como cron periódico sobre las sentencias del cache que aún no
  tienen texto resuelto.
- `ingesta-sentencias`: sincronización periódica del dataset hacia
  `sentencias_cache` (sección 4.2, punto 1). Configurar como cron job
  desde el dashboard de Supabase (Edge Functions → Schedules).
- `generar-resumen-ia`: extrae el texto completo y genera el análisis
  estructurado con Gemini (sección 4.3). Requiere el secreto
  `GEMINI_API_KEY` (`supabase secrets set GEMINI_API_KEY=...`).

- `enviar-notificaciones-plazos`: despacha notificaciones de plazos por
  email (Resend) y push (Web Push), y marca las de canal `app` como
  procesadas (sección 6.3). Configurar como cron (ej. cada hora) y los
  secretos `RESEND_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.
- `actualizar-plazos-vencidos`: marca como `vencido` los plazos
  pendientes cuya fecha ya pasó. Configurar como cron diario.

- `extraer-texto-documento`: extrae texto de una versión de documento
  recién subida para habilitar la búsqueda de contenido (sección 7.3).
  Implementado para texto plano/HTML; PDF y DOCX quedan pendientes de
  una librería de extracción dedicada.

- `generar-documento-plantilla`: resuelve variables automáticas del
  caso/cliente y manuales del formulario, rellena el `.docx` base con
  docxtemplater + pizzip, y crea el documento resultante en el Módulo 4
  (sección 8.3/8.4).

- `generar-cuenta-cobro`: agrega horas no facturadas o el honorario fijo
  del caso, genera la cuenta de cobro con numeración consecutiva por
  tenant (`fn_siguiente_numero_cobro`), y produce el PDF con pdf-lib —
  sin integración DIAN (sección 9.4).

## Estado actual

Implementado:

**Fase 0**
- Login con correo/contraseña y recuperación de contraseña.
- Enrutamiento protegido (redirige a `/login` sin sesión).
- Esquema base: `firmas`, `usuarios` (con `es_administrador`, `activo`),
  `configuracion_tenant`, `audit_log` + trigger genérico de auditoría.
- Función `registrar_firma(nombre_firma, nombre_usuario)`: crea la firma
  y registra al usuario autenticado como su socio fundador.

**Fase 1 — Módulo 1: Sentencias**
- Esquema `sentencias_cache`, `consultas_guardadas`, `historial_busqueda`,
  `verificaciones_resumen` + RLS.
- Edge Function de búsqueda con cache + fallback a la API en vivo.
- Edge Function de ingesta periódica (pendiente configurar el cron).
- Edge Function de generación de resumen con Gemini (localización
  automática del texto en el sitio oficial aún pendiente de implementar
  contra su estructura real, sección 4.3.1).
- Pantalla de Dashboard + buscador de sentencias unificados, con
  verificación humana de resúmenes IA.

**Fase 2 — Módulo 2: Casos y expedientes**
- Esquema `clientes`, `casos`, `caso_sentencias`, `caso_actividad` + RLS.
- Listado de casos con filtro por estado y alta rápida de caso/cliente.
- Ficha de caso (documento único con navegación por anclas): datos
  generales, bitácora de actividad, sentencias vinculadas (lectura) y
  placeholder de documentos.

**Fase 3 — Módulo 3: Plazos y términos procesales**
- Esquema `plazos`, `plazo_notificaciones`, `push_subscriptions` + RLS.
- Alta de plazos desde la ficha de caso, con notificación por app/email/push.
- Vista general de plazos (todos los casos), con vencidos siempre primero
  y `--seal` reservado para vencidos o por vencer en menos de 3 días.
- Service worker (`public/sw.js`) para mostrar notificaciones push del
  navegador; falta el flujo de UI para pedir el permiso y suscribirse
  (la función `suscribirsePush` ya existe en `src/lib/plazos.ts`, solo
  falta invocarla desde un botón).
- Edge Functions de disparo de notificaciones y actualización de vencidos.

**Fase 4 — Módulo 4: Gestión documental**
- Esquema `categorias_documento` (con seed de categorías predefinidas
  globales), `documentos`, `documento_versiones` + RLS.
- Bucket privado `documentos` en Supabase Storage, con políticas por
  `firma_id` (primer segmento de la ruta).
- Subida de documentos desde la ficha de caso, con control de versiones
  (una nueva subida al mismo documento incrementa la versión).
- Historial de versiones desplegable, con descarga vía URL firmada.
- Búsqueda por nombre en la lista de documentos del caso (la búsqueda
  por contenido depende de que la extracción de texto esté implementada
  para el tipo de archivo).
- Límites definidos: 20 MB por archivo, tipos permitidos PDF, DOCX, DOC,
  JPG, PNG y texto plano (sección 7.5).

**Fase 5 — Módulo 5: Plantillas de escritos**
- Tabla `plantillas` (globales o propias del despacho) + bucket separado
  `plantillas` en Storage.
- Edge Function que resuelve variables automáticas (ej.
  `caso.cliente.nombre`, `fecha_actual`) contra los datos reales del
  caso, combina con las variables manuales del formulario, y genera el
  `.docx` final con docxtemplater.
- El documento generado queda vinculado al caso como un `documento`
  normal del Módulo 4 (mismo historial de versiones, misma búsqueda).
- **Aún no hay ninguna plantilla cargada**: hay que subir manualmente al
  menos un `.docx` de prueba al bucket `plantillas` (ruta
  `global/<archivo>.docx` o `<firma_id>/<archivo>.docx`) y crear su fila
  en `plantillas` con las variables que use, para poder probar el flujo.

**Fase 6 — Módulo 6: Facturación y honorarios**
- Esquema `tarifas_hora`, `registros_tiempo`, `honorarios_fijos`,
  `cuentas_cobro`, `cuenta_cobro_items` + RLS.
- Bucket privado `facturas` para los PDF generados.
- Sección de facturación en la ficha de caso: registrar horas, definir
  honorario fijo, y generar la cuenta de cobro con un botón.
- Pantalla de listado de cuentas de cobro (`/facturacion`) con cambio de
  estado (pendiente/pagada/vencida/anulada) y descarga del PDF.
- Sin integración DIAN: el PDF incluye un aviso de que es un documento
  interno de cobro, no factura electrónica.
- La resolución de tarifa por hora (caso → usuario → despacho) usa una
  consulta simplificada; conviene revisarla si el despacho maneja
  tarifas distintas por usuario de forma más compleja.

**Fase 7 — Módulo 7: Reportes y analítica**
- Vistas `rpt_cartera`, `rpt_horas_por_usuario`, `rpt_casos_por_estado`,
  `rpt_plazos_por_estado` (`security_invoker = true`, heredan el
  aislamiento por `firma_id` de las tablas base sin duplicar RLS).
- Pantalla `/reportes`: cartera (pendiente/vencida/cobrado, con "cobrado"
  filtrable por período), casos por estado, plazos por estado, y horas
  por usuario — todo visible para cualquier usuario del tenant.
- Filtro de período (mes/trimestre/año/todo el tiempo) implementado en
  el cliente para horas y cobrado; pendiente/vencida/casos/plazos son
  totales actuales, no dependen del período (igual que en la
  especificación).
- No incluye exportación (CSV/PDF) todavía.

**Sobre el visor del texto completo** (`SentenciaDetailPage`): en vez de
un `<iframe src="...">` apuntando directo al sitio de la Corte (que
varios sitios de gobierno bloquean con `X-Frame-Options`), una Edge
Function (`obtener-texto-sentencia`) descarga el HTML del lado del
servidor y el frontend lo muestra con `srcDoc` en un iframe
`sandbox=""` — evita el bloqueo porque no es el navegador quien pide
embeber la página ajena. Si aun así falla, siempre queda el enlace
"Abrir en una pestaña nueva" como respaldo.

**Sobre el certificado TLS del sitio de la Corte**: el servidor de
`corteconstitucional.gov.co` usa un certificado emitido por GoDaddy bajo
su nueva jerarquía de raíz "R1" (migración de 2026), pero no envía la
cadena completa — le falta el certificado que conecta esa raíz nueva
con la raíz vieja ("G2") que sí es universalmente confiable. Los
navegadores lo tienen resuelto porque ya confían directamente en la
raíz R1 o completan la cadena por su cuenta; Deno no, y falla con
`invalid peer certificate: UnknownIssuer`.

Solución implementada: `generar-resumen-ia`, `localizar-texto-sentencia`,
`localizar-textos-sentencias-lote` y `obtener-texto-sentencia` incluyen
la cadena completa (Intermedio DV R1v1 → Raíz R1 cross-signed → Raíz G2,
obtenida de `certs.godaddy.com/repository/gd_bundle_dv-r1-g2.crt.pem`)
como constantes, usadas vía `Deno.createHttpClient({ caCerts: [...] })`
para las peticiones a ese dominio específico. Verificado con
`openssl verify` antes de integrarlo. No depende de ningún servicio de
terceros.

Si GoDaddy rota estos certificados en el futuro (tienen vigencia hasta
2027 para el intermedio, más allá para las raíces), este error volverá
a aparecer y habrá que repetir el proceso: bajar el bundle actualizado
de `certs.godaddy.com/repository/gd_bundle_dv-r1-g2.crt.pem` y
reemplazar la constante `CADENA_CORTE_CONSTITUCIONAL` en las cuatro
funciones.

Con esto quedan implementados los 7 módulos de la especificación
técnica. Pendiente (ver la especificación completa, sección 14 — Lista
de tareas de desarrollo, y el resto de "pendientes de definir" en cada
sección): pantalla de registro de firma, resto de Fase 0 (creación de
usuarios desde el panel del administrador, panel de configuración del
tenant), consultas guardadas en la UI, vincular sentencias desde el
buscador directamente a un caso, botón de suscripción push en la UI,
extracción de texto para PDF/DOCX, catálogo inicial de plantillas
globales, exportación de reportes, y los módulos futuros discutidos
pero no detallados (colaboración de equipo, portal del cliente, alertas
normativas, conflictos de interés).

**Sobre la localización automática de texto de sentencias**: el patrón
de URLs del sitio de la Corte (`relatoria/{año}/{tipo}-{numero}-{añoYY}.htm`,
con la excepción de las sentencias SU) se dedujo observando URLs reales
publicadas, no de documentación oficial del sitio. Si en el futuro deja
de encontrar sentencias que sí existen, revisar primero
`localizar-texto-sentencia/index.ts`.

## Estructura

```
src/
  components/
    AppHeader.tsx      encabezado compartido con menú hamburguesa
  lib/
    supabase.ts       cliente de Supabase
    AuthContext.tsx   sesión, login, logout, recuperación de contraseña
    useUsuario.ts      datos de `usuarios` para el usuario autenticado
    sentencias.ts      búsqueda y verificación de sentencias (Módulo 1)
    casos.ts           casos, clientes, actividad y vínculo con sentencias (Módulo 2)
    plazos.ts          plazos, notificaciones y suscripción push (Módulo 3)
    documentos.ts      documentos, versiones y subida a Storage (Módulo 4)
    plantillas.ts      generación de documentos desde plantilla (Módulo 5)
    facturacion.ts     horas, honorarios fijos y cuentas de cobro (Módulo 6)
    reportes.ts        cartera, casos, plazos y horas por usuario (Módulo 7)
  pages/
    LoginPage.tsx      login + recuperación de contraseña (sección 13.2)
    DashboardPage.tsx  dashboard + buscador de sentencias (sección 13.3)
    SentenciaDetailPage.tsx ficha de sentencia (ruta por número, ej. /sentencias/T-760%2F98, no por id — evita depender de que un id capturado antes siga siendo válido)
    CasosListPage.tsx  listado de casos + alta rápida (sección 5.4)
    CasoDetailPage.tsx ficha de caso: actividad, plazos, documentos, plantillas y facturación (sección 13.5)
    PlazosPage.tsx     vista general de plazos (sección 13.6)
    CuentasCobroPage.tsx listado de cuentas de cobro
    ReportesPage.tsx   reportes y analítica
public/
  sw.js                service worker para notificaciones push
supabase/
  migrations/          esquema SQL, en orden de aplicación
  functions/           Edge Functions (Deno)
  seed/                script de datos de prueba
```

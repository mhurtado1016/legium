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

Desplegar con la Supabase CLI (`supabase functions deploy <nombre>`):

- `buscar-sentencias`: búsqueda en cache con fallback a la API en vivo de
  datos.gov.co (sección 4.2/4.4). Requiere `SUPABASE_SERVICE_ROLE_KEY`.
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

Pendiente (ver la especificación técnica completa, sección 14 — Lista de
tareas de desarrollo): pantalla de registro de firma, resto de Fase 0
(creación de usuarios desde el panel del administrador, panel de
configuración del tenant), localización automática del texto completo
de sentencias en el sitio oficial, consultas guardadas en la UI,
vincular sentencias desde el buscador directamente a un caso, botón de
suscripción push en la UI, extracción de texto para PDF/DOCX, y los
Módulos 5 a 7.

## Estructura

```
src/
  lib/
    supabase.ts       cliente de Supabase
    AuthContext.tsx   sesión, login, logout, recuperación de contraseña
    useUsuario.ts      datos de `usuarios` para el usuario autenticado
    sentencias.ts      búsqueda y verificación de sentencias (Módulo 1)
    casos.ts           casos, clientes, actividad y vínculo con sentencias (Módulo 2)
    plazos.ts          plazos, notificaciones y suscripción push (Módulo 3)
    documentos.ts      documentos, versiones y subida a Storage (Módulo 4)
  pages/
    LoginPage.tsx      login + recuperación de contraseña (sección 13.2)
    DashboardPage.tsx  dashboard + buscador de sentencias (sección 13.3)
    CasosListPage.tsx  listado de casos + alta rápida (sección 5.4)
    CasoDetailPage.tsx ficha de caso: actividad, plazos y documentos (sección 13.5)
    PlazosPage.tsx     vista general de plazos (sección 13.6)
public/
  sw.js                service worker para notificaciones push
supabase/
  migrations/          esquema SQL, en orden de aplicación
  functions/           Edge Functions (Deno)
  seed/                script de datos de prueba
```

# Legium

Plataforma de cumplimiento para abogados. Este repositorio contiene el
scaffolding inicial (Fase 0 de la especificación técnica): autenticación,
multi-tenancy base, log de auditoría y panel de configuración del tenant.

## Stack

- React + TypeScript + Vite
- Tailwind CSS v4 (tokens de diseño en `src/index.css`)
- Supabase (Postgres + Auth)
- React Router

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

Pendiente (ver la especificación técnica completa, sección 14 — Lista de
tareas de desarrollo): pantalla de registro de firma, resto de Fase 0
(creación de usuarios desde el panel del administrador, panel de
configuración del tenant), localización automática del texto completo en
el sitio oficial, consultas guardadas en la UI, vincular sentencias desde
el buscador directamente a un caso, y los Módulos 3 a 7.

## Estructura

```
src/
  lib/
    supabase.ts       cliente de Supabase
    AuthContext.tsx   sesión, login, logout, recuperación de contraseña
    useUsuario.ts      datos de `usuarios` para el usuario autenticado
    sentencias.ts      búsqueda y verificación de sentencias (Módulo 1)
    casos.ts           casos, clientes, actividad y vínculo con sentencias (Módulo 2)
  pages/
    LoginPage.tsx      login + recuperación de contraseña (sección 13.2)
    DashboardPage.tsx  dashboard + buscador de sentencias (sección 13.3)
    CasosListPage.tsx  listado de casos + alta rápida (sección 5.4)
    CasoDetailPage.tsx ficha de caso (sección 13.5)
supabase/
  migrations/          esquema SQL, en orden de aplicación
  functions/           Edge Functions (Deno)
```

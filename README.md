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

## Estado actual

Implementado (Fase 0):

- Login con correo/contraseña y recuperación de contraseña.
- Enrutamiento protegido (redirige a `/login` sin sesión).
- Esquema base: `firmas`, `usuarios` (con `es_administrador`, `activo`),
  `configuracion_tenant`, `audit_log` + trigger genérico de auditoría.
- Función `registrar_firma(nombre_firma, nombre_usuario)`: crea la firma
  y registra al usuario autenticado como su socio fundador.

Pendiente (ver la especificación técnica completa, sección 14 — Lista de
tareas de desarrollo): pantalla de registro, resto de Fase 0 (creación de
usuarios desde el panel del administrador, panel de configuración del
tenant), y los Módulos 1 a 7.

## Estructura

```
src/
  lib/
    supabase.ts       cliente de Supabase
    AuthContext.tsx   sesión, login, logout, recuperación de contraseña
  pages/
    LoginPage.tsx      login + recuperación de contraseña (sección 13.2)
    DashboardPage.tsx  placeholder de la pantalla principal (sección 13.3)
supabase/
  migrations/          esquema SQL, en orden de aplicación
```

-- ============================================================
-- Legium — Configuración de contacto del landing
--
-- El landing público mostraba correo/teléfono/ciudad hardcodeados en
-- LandingPage.tsx (constante CONTACTO, con un TODO pendiente). Se
-- reemplaza por una fila única editable desde el panel admin, mismo
-- patrón singleton que `configuracion_agenda` (ver 0016): cualquiera
-- puede leerla (la muestra el landing público a un visitante anónimo),
-- solo un administrador la modifica.
-- ============================================================

create table configuracion_contacto (
  id integer primary key default 1,
  correo text not null,
  telefono text not null,
  ciudad text not null,
  actualizado_por uuid references usuarios(id),
  updated_at timestamptz not null default now(),
  check (id = 1)
);

insert into configuracion_contacto (id, correo, telefono, ciudad)
values (1, 'contacto@legium.com', '+57 300 000 0000', 'Bogotá, Colombia');

alter table configuracion_contacto enable row level security;

create policy "cualquiera puede leer la configuracion de contacto"
  on configuracion_contacto for select
  to anon, authenticated
  using (true);

create policy "solo administradores modifican la configuracion de contacto"
  on configuracion_contacto for update
  to authenticated
  using (true)
  with check (soy_administrador());

-- Sin trigger de auditoría, misma razón que configuracion_agenda (0016):
-- la llave no es un uuid y la tabla no tiene firma_id.

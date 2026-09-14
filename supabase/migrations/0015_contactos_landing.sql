-- ============================================================
-- Legium — Mensajes del formulario de contacto del landing público
--
-- A diferencia del resto de tablas del proyecto, esta NO lleva
-- `firma_id`: el landing es la vitrina pública de un único despacho
-- (el que opera esta instancia), no un dato aislado por tenant como
-- casos, clientes o documentos. Cualquier visitante (sin sesión) debe
-- poder insertar un mensaje; solo el equipo autenticado del despacho
-- puede leerlos y marcarlos como atendidos.
-- ============================================================

create table contactos_landing (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  correo text not null,
  telefono text,
  mensaje text not null,
  atendido boolean not null default false,
  created_at timestamptz not null default now()
);

alter table contactos_landing enable row level security;

-- Cualquier visitante del landing (autenticado o no) puede enviar un mensaje.
create policy "cualquiera puede enviar un mensaje de contacto"
  on contactos_landing for insert
  to anon, authenticated
  with check (true);

-- Solo el equipo del despacho (usuarios ya autenticados en la app) puede
-- ver y gestionar los mensajes recibidos.
create policy "el equipo del despacho lee los mensajes de contacto"
  on contactos_landing for select
  to authenticated
  using (true);

create policy "el equipo del despacho actualiza los mensajes de contacto"
  on contactos_landing for update
  to authenticated
  using (true);

create index contactos_landing_created_at_idx on contactos_landing (created_at desc);

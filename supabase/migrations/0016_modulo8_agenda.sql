-- ============================================================
-- Legium — Módulo 8: Agenda de consultas
--
-- Igual que `contactos_landing` (0015): estas tablas NO llevan
-- `firma_id`. La agenda pública (landing) es la de un único despacho
-- (el que opera esta instancia), no un dato aislado por tenant.
-- Cualquier visitante puede ver la disponibilidad y reservar; solo el
-- equipo autenticado gestiona las citas, y solo un administrador
-- configura horarios y bloqueos.
--
-- Para no exponer datos internos a `anon` (nombre/correo/teléfono de
-- otros clientes en `citas_agenda`, el motivo de un bloqueo en
-- `bloqueos_agenda`), se crean vistas públicas que solo devuelven las
-- columnas necesarias para calcular franjas disponibles. Las vistas
-- corren con los privilegios de su dueño (el rol de las migraciones),
-- por lo que no quedan sujetas al RLS restrictivo de la tabla base —
-- ese es justamente el punto: son la frontera de seguridad en vez de
-- una política de RLS.
-- ============================================================

-- ---------- Configuración de disponibilidad (fila única) ----------
create table configuracion_agenda (
  id integer primary key default 1,
  dias_habiles smallint[] not null default '{1,2,3,4,5}', -- 1=lunes … 7=domingo (ISO)
  hora_inicio time not null default '08:00',
  hora_fin time not null default '18:00',
  duracion_franja_minutos integer not null default 60,
  actualizado_por uuid references usuarios(id),
  updated_at timestamptz not null default now(),
  check (id = 1),
  check (hora_fin > hora_inicio),
  check (duracion_franja_minutos > 0),
  check (dias_habiles <@ array[1,2,3,4,5,6,7]::smallint[])
);

insert into configuracion_agenda (id) values (1);

alter table configuracion_agenda enable row level security;

create policy "cualquiera puede leer la configuracion de agenda"
  on configuracion_agenda for select
  to anon, authenticated
  using (true);

create policy "solo administradores modifican la configuracion de agenda"
  on configuracion_agenda for update
  to authenticated
  using (true)
  with check (soy_administrador());

-- Sin trigger de auditoría: fn_audit_log() asume una columna `id` de
-- tipo uuid (ver fix en 0006 para configuracion_tenant) y esta tabla
-- usa `id integer` como llave fija del único registro.

-- ---------- Bloqueos de agenda (franjas, días, semanas o meses) ----------
create table bloqueos_agenda (
  id uuid primary key default gen_random_uuid(),
  fecha_inicio date not null,
  fecha_fin date not null,
  hora_inicio time, -- null = bloquea el día completo en todo el rango
  hora_fin time,
  motivo text,
  creado_por uuid references usuarios(id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (fecha_fin >= fecha_inicio),
  check (
    (hora_inicio is null and hora_fin is null)
    or (hora_inicio is not null and hora_fin is not null and hora_fin > hora_inicio)
  )
);

alter table bloqueos_agenda enable row level security;

create policy "el equipo del despacho lee los bloqueos"
  on bloqueos_agenda for select
  to authenticated
  using (true);

create policy "solo administradores crean bloqueos"
  on bloqueos_agenda for insert
  to authenticated
  with check (soy_administrador());

create policy "solo administradores eliminan bloqueos"
  on bloqueos_agenda for delete
  to authenticated
  using (soy_administrador());

create trigger trg_audit_bloqueos_agenda
  after insert or delete on bloqueos_agenda
  for each row execute function fn_audit_log();

create index bloqueos_agenda_rango_idx on bloqueos_agenda (fecha_inicio, fecha_fin);

-- Vista pública: solo el rango de fecha/hora bloqueado, sin motivo ni autor.
create view bloqueos_agenda_publico as
  select fecha_inicio, fecha_fin, hora_inicio, hora_fin from bloqueos_agenda;

grant select on bloqueos_agenda_publico to anon, authenticated;

-- ---------- Citas ----------
create table citas_agenda (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  tipo_sesion text not null check (tipo_sesion in ('presencial', 'virtual')),
  nombre_cliente text not null,
  correo_cliente text not null,
  telefono_cliente text,
  notas text,
  estado text not null default 'confirmada' check (estado in ('confirmada', 'cancelada')),
  creado_por uuid references usuarios(id) default auth.uid(), -- null = reservada públicamente por el cliente
  created_at timestamptz not null default now(),
  check (hora_fin > hora_inicio)
);

-- Evita doble reserva de la misma franja (a nivel de base de datos, no
-- solo de UI) sin bloquear volver a reservar una franja ya cancelada.
create unique index citas_agenda_franja_unica
  on citas_agenda (fecha, hora_inicio)
  where estado = 'confirmada';

alter table citas_agenda enable row level security;

create policy "cualquiera puede reservar una cita"
  on citas_agenda for insert
  to anon, authenticated
  with check (true);

create policy "el equipo del despacho lee las citas"
  on citas_agenda for select
  to authenticated
  using (true);

create policy "el equipo del despacho actualiza las citas"
  on citas_agenda for update
  to authenticated
  using (true);

create trigger trg_audit_citas_agenda
  after insert or update on citas_agenda
  for each row execute function fn_audit_log();

create index citas_agenda_fecha_idx on citas_agenda (fecha, hora_inicio);

-- Vista pública: solo lo necesario para saber qué franjas ya están
-- ocupadas, sin datos del cliente que las reservó.
create view citas_agenda_ocupacion as
  select fecha, hora_inicio, hora_fin from citas_agenda where estado = 'confirmada';

grant select on citas_agenda_ocupacion to anon, authenticated;

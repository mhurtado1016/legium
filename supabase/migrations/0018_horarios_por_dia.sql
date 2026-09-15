-- ============================================================
-- Legium — Horario de agenda por día de la semana
--
-- `configuracion_agenda` tenía un único hora_inicio/hora_fin
-- aplicado por igual a todos los `dias_habiles` — no permitía, por
-- ejemplo, un horario reducido los sábados. Se reemplaza por una fila
-- por día ISO (1=lunes … 7=domingo) en `horarios_agenda`, cada una
-- con su propio horario y bandera de actividad.
-- `duracion_franja_minutos` se queda en `configuracion_agenda`: la
-- duración de la franja es global, solo el horario cambia por día.
-- ============================================================

create table horarios_agenda (
  dia smallint primary key check (dia between 1 and 7), -- 1=lunes … 7=domingo (ISO)
  activo boolean not null default false,
  hora_inicio time,
  hora_fin time,
  check (not activo or (hora_inicio is not null and hora_fin is not null and hora_fin > hora_inicio))
);

-- Semilla: conserva el horario global vigente como punto de partida
-- por día, para que la migración no cambie la disponibilidad ya
-- publicada en el landing.
insert into horarios_agenda (dia, activo, hora_inicio, hora_fin)
select dia, (dia::smallint = any(c.dias_habiles)), c.hora_inicio, c.hora_fin
from configuracion_agenda c, generate_series(1, 7) as dia
where c.id = 1;

alter table horarios_agenda enable row level security;

create policy "cualquiera puede leer los horarios de agenda"
  on horarios_agenda for select
  to anon, authenticated
  using (true);

create policy "solo administradores modifican los horarios de agenda"
  on horarios_agenda for update
  to authenticated
  using (true)
  with check (soy_administrador());

-- Sin trigger de auditoría, misma razón que configuracion_agenda (ver
-- 0016): la llave no es un uuid y la tabla no tiene firma_id.

alter table configuracion_agenda
  drop column dias_habiles,
  drop column hora_inicio,
  drop column hora_fin;

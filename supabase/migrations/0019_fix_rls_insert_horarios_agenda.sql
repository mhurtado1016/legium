-- ============================================================
-- Legium — Fix RLS: falta política de INSERT en horarios_agenda
--
-- `actualizarHorarios` (src/lib/agenda.ts) guarda los horarios con
-- `.upsert()`, que Postgres ejecuta como `INSERT ... ON CONFLICT DO
-- UPDATE`. Aunque las 7 filas ya existen (sembradas en 0018) y el
-- upsert siempre termina resolviendo el conflicto con un UPDATE, RLS
-- exige que el INSERT del propio statement esté permitido — sin
-- ninguna política de INSERT, Postgres lo deniega con 42501 antes de
-- siquiera llegar al conflicto.
-- ============================================================

create policy "solo administradores insertan horarios de agenda"
  on horarios_agenda for insert
  to authenticated
  with check (soy_administrador());

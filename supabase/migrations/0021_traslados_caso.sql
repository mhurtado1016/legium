-- ============================================================
-- Legium — Historial de traslados de responsable de caso
--
-- Cada caso ya tenía `responsable_id` (0004), pero nada dejaba
-- constancia de a quién se le reasignaba un caso ni cuándo. Se agrega
-- `caso_traslados` como historial append-only (solo lectura e
-- inserción, sin update/delete, igual que `audit_log`) y una función
-- `fn_trasladar_caso` que hace el cambio de responsable y el registro
-- del traslado de forma atómica, validando que el nuevo responsable
-- pertenezca a la misma firma.
-- ============================================================

create table caso_traslados (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  caso_id uuid not null references casos(id),
  responsable_anterior_id uuid not null references usuarios(id),
  responsable_nuevo_id uuid not null references usuarios(id),
  trasladado_por uuid not null references usuarios(id),
  motivo text,
  created_at timestamptz not null default now(),
  check (responsable_anterior_id <> responsable_nuevo_id)
);

alter table caso_traslados enable row level security;

create policy "lectura de traslados de la propia firma"
  on caso_traslados for select
  using (firma_id = mi_firma_id());

create policy "crear traslados de la propia firma"
  on caso_traslados for insert
  with check (firma_id = mi_firma_id());

create trigger trg_audit_caso_traslados after insert on caso_traslados
  for each row execute function fn_audit_log();

create index caso_traslados_caso_idx on caso_traslados (caso_id, created_at desc);

-- RPC llamada desde el frontend en vez de actualizar `casos.responsable_id`
-- directamente, para garantizar que todo cambio de responsable quede
-- reflejado en el historial.
create or replace function fn_trasladar_caso(
  p_caso_id uuid,
  p_nuevo_responsable_id uuid,
  p_motivo text default null
) returns void
language plpgsql security definer as $$
declare
  v_firma_id uuid;
  v_responsable_actual uuid;
begin
  select firma_id, responsable_id into v_firma_id, v_responsable_actual
  from casos where id = p_caso_id;

  if v_firma_id is null or v_firma_id <> mi_firma_id() then
    raise exception 'Caso no encontrado.';
  end if;

  if v_responsable_actual = p_nuevo_responsable_id then
    raise exception 'El caso ya está asignado a ese responsable.';
  end if;

  if not exists (
    select 1 from usuarios where id = p_nuevo_responsable_id and firma_id = v_firma_id and activo
  ) then
    raise exception 'El nuevo responsable no pertenece a esta firma.';
  end if;

  insert into caso_traslados (
    firma_id, caso_id, responsable_anterior_id, responsable_nuevo_id, trasladado_por, motivo
  )
  values (v_firma_id, p_caso_id, v_responsable_actual, p_nuevo_responsable_id, auth.uid(), p_motivo);

  update casos set responsable_id = p_nuevo_responsable_id where id = p_caso_id;
end;
$$;

-- ============================================================
-- Fix: fn_audit_log() fallaba al ejecutarse sin sesión autenticada
-- (ej. desde el SQL Editor de Supabase, scripts de seed, o cualquier
-- operación hecha con la service role fuera de una request de usuario).
-- auth.uid() devuelve NULL en ese contexto, lo que violaba el
-- `not null` de audit_log.usuario_id.
--
-- Criterio: sin usuario autenticado no hay "quién" que auditar, así
-- que se omite el registro en vez de fallar la operación.
-- ============================================================

create or replace function fn_audit_log() returns trigger
language plpgsql security definer as $$
declare
  v_usuario uuid := auth.uid();
  v_firma uuid;
  v_accion text;
begin
  if v_usuario is null then
    return coalesce(new, old);
  end if;

  select firma_id into v_firma from usuarios where id = v_usuario;

  v_accion := case TG_OP
    when 'INSERT' then 'crear'
    when 'UPDATE' then 'actualizar'
    when 'DELETE' then 'eliminar'
  end;

  insert into audit_log (firma_id, usuario_id, accion, entidad, entidad_id, detalle)
  values (
    coalesce(v_firma, (case when TG_OP = 'DELETE' then old.firma_id else new.firma_id end)),
    v_usuario,
    v_accion,
    TG_TABLE_NAME,
    case when TG_OP = 'DELETE' then old.id else new.id end,
    case when TG_OP = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

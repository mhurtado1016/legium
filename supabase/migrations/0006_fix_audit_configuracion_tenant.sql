-- ============================================================
-- Fix: fn_audit_log asumía que toda tabla tiene columna `id`.
-- `configuracion_tenant` usa `firma_id` como llave primaria, sin
-- columna `id` propia, lo que rompía el trigger genérico con:
--   ERROR: record "old"/"new" has no field "id"
-- ============================================================

drop trigger if exists trg_audit_configuracion_tenant on configuracion_tenant;

create or replace function fn_audit_log_configuracion_tenant() returns trigger
language plpgsql security definer as $$
declare
  v_usuario uuid := auth.uid();
  v_accion text;
begin
  -- Al registrar una firma nueva, esta fila se crea ANTES de que exista
  -- el usuario (socio fundador) en `usuarios` (ver registrar_firma()).
  -- Si aún no hay fila de usuario, se omite el log en vez de fallar por
  -- la FK de audit_log.usuario_id.
  if not exists (select 1 from usuarios where id = v_usuario) then
    return coalesce(new, old);
  end if;

  v_accion := case TG_OP
    when 'INSERT' then 'crear'
    when 'UPDATE' then 'actualizar'
    when 'DELETE' then 'eliminar'
  end;

  insert into audit_log (firma_id, usuario_id, accion, entidad, entidad_id, detalle)
  values (
    case when TG_OP = 'DELETE' then old.firma_id else new.firma_id end,
    v_usuario,
    v_accion,
    TG_TABLE_NAME,
    case when TG_OP = 'DELETE' then old.firma_id else new.firma_id end,
    case when TG_OP = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_audit_configuracion_tenant
  after insert or update or delete on configuracion_tenant
  for each row execute function fn_audit_log_configuracion_tenant();

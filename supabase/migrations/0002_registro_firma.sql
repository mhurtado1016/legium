-- ============================================================
-- Legium — Flujo de registro: firma + socio fundador
-- ============================================================

-- Al crear una firma, se inicializa su configuración con valores por defecto.
create or replace function fn_crear_configuracion_tenant() returns trigger
language plpgsql as $$
begin
  insert into configuracion_tenant (firma_id) values (new.id);
  return new;
end;
$$;

create trigger trg_crear_configuracion_tenant
  after insert on firmas
  for each row execute function fn_crear_configuracion_tenant();

-- RPC llamada desde el frontend justo después de auth.signUp(), con el
-- usuario ya autenticado (auth.uid() disponible). Crea la firma y registra
-- al usuario actual como su socio fundador (es_administrador = true).
create or replace function registrar_firma(p_nombre_firma text, p_nombre_usuario text)
returns uuid
language plpgsql security definer as $$
declare
  v_firma_id uuid;
begin
  if exists (select 1 from usuarios where id = auth.uid()) then
    raise exception 'Este usuario ya pertenece a una firma.';
  end if;

  insert into firmas (nombre) values (p_nombre_firma) returning id into v_firma_id;

  insert into usuarios (id, firma_id, nombre, email, es_administrador)
  values (auth.uid(), v_firma_id, p_nombre_usuario, auth.jwt() ->> 'email', true);

  return v_firma_id;
end;
$$;

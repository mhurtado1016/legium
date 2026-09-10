-- ============================================================
-- Legium — Fase 0: Infraestructura base
-- Ver especificación técnica, secciones 4.7, 8, 9, 10, 11.
-- ============================================================

-- ---------- Tenants ----------
create table firmas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default now()
);

-- ---------- Usuarios ----------
create table usuarios (
  id uuid primary key references auth.users(id),
  firma_id uuid not null references firmas(id),
  nombre text,
  email text,
  activo boolean not null default true,
  es_administrador boolean not null default false,
  creado_por uuid references usuarios(id),
  created_at timestamptz not null default now()
);

alter table usuarios enable row level security;

create policy "solo administradores crean usuarios de su firma"
  on usuarios
  for insert
  with check (
    firma_id = (select firma_id from usuarios where id = auth.uid())
    and (select es_administrador from usuarios where id = auth.uid()) = true
  );

create policy "solo administradores desactivan usuarios de su firma"
  on usuarios
  for update
  using (firma_id = (select firma_id from usuarios where id = auth.uid()))
  with check ((select es_administrador from usuarios where id = auth.uid()) = true);

create policy "lectura de usuarios de la propia firma"
  on usuarios
  for select
  using (firma_id = (select firma_id from usuarios where id = auth.uid()));

-- ---------- Configuración por tenant ----------
create table configuracion_tenant (
  firma_id uuid primary key references firmas(id),
  retencion_auditoria_dias integer not null default 730,
  nombre_facturacion text,
  identificacion_fiscal text,
  direccion_facturacion text,
  ultimo_numero_cobro integer not null default 0,
  actualizado_por uuid references usuarios(id),
  updated_at timestamptz not null default now()
);

alter table configuracion_tenant enable row level security;

create policy "lectura de configuracion propia del tenant"
  on configuracion_tenant
  for select
  using (firma_id = (select firma_id from usuarios where id = auth.uid()));

create policy "solo administrador modifica configuracion del tenant"
  on configuracion_tenant
  for update
  using (firma_id = (select firma_id from usuarios where id = auth.uid()))
  with check ((select es_administrador from usuarios where id = auth.uid()) = true);

-- ---------- Log de auditoría (append-only) ----------
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  usuario_id uuid not null references usuarios(id),
  accion text not null check (accion in ('crear', 'actualizar', 'eliminar', 'desactivar', 'reactivar', 'verificar', 'iniciar_sesion')),
  entidad text not null,
  entidad_id uuid,
  detalle jsonb,
  created_at timestamptz not null default now()
);

alter table audit_log enable row level security;

create policy "lectura de auditoria solo de la propia firma"
  on audit_log
  for select
  using (firma_id = (select firma_id from usuarios where id = auth.uid()));

-- Trigger genérico de auditoría, para vincular a cada tabla mutable
-- a medida que se creen en fases posteriores (ver sección 10.1).
create or replace function fn_audit_log() returns trigger
language plpgsql security definer as $$
declare
  v_usuario uuid := auth.uid();
  v_firma uuid;
  v_accion text;
begin
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

create trigger trg_audit_usuarios
  after insert or update or delete on usuarios
  for each row execute function fn_audit_log();

create trigger trg_audit_configuracion_tenant
  after insert or update or delete on configuracion_tenant
  for each row execute function fn_audit_log();

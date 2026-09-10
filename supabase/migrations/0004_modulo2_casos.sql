-- ============================================================
-- Legium — Módulo 2: Gestión de casos y expedientes
-- Ver especificación técnica, sección 5.
-- ============================================================

create table clientes (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  tipo text not null check (tipo in ('persona_natural', 'empresa')),
  nombre text not null,
  identificacion text,
  email text,
  telefono text,
  created_at timestamptz not null default now()
);

create table casos (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  cliente_id uuid not null references clientes(id),
  tipo text not null check (tipo in ('litigio', 'consultoria')),
  titulo text not null,
  descripcion text,
  estado text not null default 'abierto' check (estado in ('abierto', 'en_curso', 'suspendido', 'cerrado')),
  numero_radicado text,
  despacho_judicial text,
  etapa_procesal text,
  fecha_apertura date not null default current_date,
  fecha_cierre date,
  responsable_id uuid not null references usuarios(id),
  created_at timestamptz not null default now()
);

create table caso_sentencias (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  caso_id uuid not null references casos(id),
  sentencia_id uuid not null references sentencias_cache(id),
  nota text,
  agregado_por uuid not null references usuarios(id),
  created_at timestamptz not null default now()
);

create table caso_actividad (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  caso_id uuid not null references casos(id),
  usuario_id uuid not null references usuarios(id),
  descripcion text not null,
  created_at timestamptz not null default now()
);

alter table clientes enable row level security;
alter table casos enable row level security;
alter table caso_sentencias enable row level security;
alter table caso_actividad enable row level security;

create policy "acceso solo a datos de la propia firma" on clientes for all
  using (firma_id = (select firma_id from usuarios where id = auth.uid()));

create policy "acceso solo a datos de la propia firma" on casos for all
  using (firma_id = (select firma_id from usuarios where id = auth.uid()));

create policy "acceso solo a datos de la propia firma" on caso_sentencias for all
  using (firma_id = (select firma_id from usuarios where id = auth.uid()));

create policy "acceso solo a datos de la propia firma" on caso_actividad for all
  using (firma_id = (select firma_id from usuarios where id = auth.uid()));

create trigger trg_audit_clientes after insert or update or delete on clientes
  for each row execute function fn_audit_log();
create trigger trg_audit_casos after insert or update or delete on casos
  for each row execute function fn_audit_log();
create trigger trg_audit_caso_sentencias after insert or update or delete on caso_sentencias
  for each row execute function fn_audit_log();
create trigger trg_audit_caso_actividad after insert or update or delete on caso_actividad
  for each row execute function fn_audit_log();

create index casos_firma_estado_idx on casos (firma_id, estado);
create index caso_actividad_caso_idx on caso_actividad (caso_id, created_at desc);

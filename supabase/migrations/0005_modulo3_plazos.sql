-- ============================================================
-- Legium — Módulo 3: Control de plazos y términos procesales
-- Ver especificación técnica, sección 6.
-- ============================================================

create table plazos (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  caso_id uuid not null references casos(id),
  titulo text not null,
  descripcion text,
  fecha_vencimiento timestamptz not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'cumplido', 'vencido')),
  responsable_id uuid not null references usuarios(id),
  creado_por uuid not null references usuarios(id),
  created_at timestamptz not null default now()
);

create table plazo_notificaciones (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  plazo_id uuid not null references plazos(id),
  canal text not null check (canal in ('app', 'email', 'push')),
  dias_antes integer not null default 1,
  enviado boolean not null default false,
  enviado_en timestamptz,
  created_at timestamptz not null default now()
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  usuario_id uuid not null references usuarios(id),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table plazos enable row level security;
alter table plazo_notificaciones enable row level security;
alter table push_subscriptions enable row level security;

create policy "acceso solo a datos de la propia firma" on plazos for all
  using (firma_id = (select firma_id from usuarios where id = auth.uid()));

create policy "acceso solo a datos de la propia firma" on plazo_notificaciones for all
  using (firma_id = (select firma_id from usuarios where id = auth.uid()));

create policy "acceso solo a datos de la propia firma" on push_subscriptions for all
  using (firma_id = (select firma_id from usuarios where id = auth.uid()));

create trigger trg_audit_plazos after insert or update or delete on plazos
  for each row execute function fn_audit_log();
create trigger trg_audit_plazo_notificaciones after insert or update or delete on plazo_notificaciones
  for each row execute function fn_audit_log();

create index plazos_firma_estado_idx on plazos (firma_id, estado, fecha_vencimiento);
create index plazo_notificaciones_pendientes_idx on plazo_notificaciones (enviado) where enviado = false;

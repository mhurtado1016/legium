-- ============================================================
-- Legium — Sentencias favoritas
-- Tabla de uso por tenant (no en sentencias_cache, que es información
-- pública compartida entre todos los despachos).
-- ============================================================

create table sentencia_favoritos (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  usuario_id uuid not null references usuarios(id),
  sentencia_id uuid not null references sentencias_cache(id),
  created_at timestamptz not null default now(),
  unique (firma_id, sentencia_id)
);

alter table sentencia_favoritos enable row level security;

create policy "acceso solo a datos de la propia firma" on sentencia_favoritos for all
  using (firma_id = (select firma_id from usuarios where id = auth.uid()));

create trigger trg_audit_sentencia_favoritos after insert or update or delete on sentencia_favoritos
  for each row execute function fn_audit_log();

create index sentencia_favoritos_firma_idx on sentencia_favoritos (firma_id);

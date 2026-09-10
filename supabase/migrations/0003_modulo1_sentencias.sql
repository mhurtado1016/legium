-- ============================================================
-- Legium — Módulo 1: Búsqueda y verificación de sentencias
-- Ver especificación técnica, sección 4.
-- ============================================================

-- ---------- Cache de sentencias (dato público, compartido entre tenants) ----------
create table sentencias_cache (
  id uuid primary key default gen_random_uuid(),
  proceso text,
  expediente_tipo text,
  expediente_numero text,
  magistrado_a text,
  sala text,
  sentencia_tipo text,
  sentencia text unique,
  fecha_sentencia timestamptz,
  sv_spv text,
  av_apv text,
  texto_completo_url text,
  texto_completo_no_disponible boolean not null default false,
  resumen_ia text,
  hechos_ia text,
  problema_juridico_ia text,
  consideraciones_ia text,
  decision_ia text,
  resumen_ia_verificado boolean not null default false,
  resumen_ia_generado_en timestamptz,
  ultima_sincronizacion timestamptz not null default now()
);

create index sentencias_cache_texto_idx on sentencias_cache
  using gin (to_tsvector('spanish', coalesce(sentencia, '') || ' ' || coalesce(proceso, '')));

create index sentencias_cache_fecha_idx on sentencias_cache (fecha_sentencia desc);
create index sentencias_cache_tipo_idx on sentencias_cache (sentencia_tipo);

-- sentencias_cache no lleva RLS: es información pública, igual para todos los tenants.

-- ---------- Tablas de uso por tenant (aislamiento por firma_id) ----------
create table consultas_guardadas (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  usuario_id uuid not null references usuarios(id),
  nombre text,
  criterios jsonb not null,
  created_at timestamptz not null default now()
);

create table historial_busqueda (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  usuario_id uuid not null references usuarios(id),
  criterios jsonb not null,
  resultados_count integer,
  fuente text check (fuente in ('cache', 'api_en_vivo')),
  created_at timestamptz not null default now()
);

create table verificaciones_resumen (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  usuario_id uuid not null references usuarios(id),
  sentencia_id uuid not null references sentencias_cache(id),
  comentario text,
  verificado_en timestamptz not null default now()
);

alter table consultas_guardadas enable row level security;
alter table historial_busqueda enable row level security;
alter table verificaciones_resumen enable row level security;

create policy "acceso solo a datos de la propia firma"
  on consultas_guardadas for all
  using (firma_id = (select firma_id from usuarios where id = auth.uid()));

create policy "acceso solo a datos de la propia firma"
  on historial_busqueda for all
  using (firma_id = (select firma_id from usuarios where id = auth.uid()));

create policy "acceso solo a datos de la propia firma"
  on verificaciones_resumen for all
  using (firma_id = (select firma_id from usuarios where id = auth.uid()));

create trigger trg_audit_consultas_guardadas
  after insert or update or delete on consultas_guardadas
  for each row execute function fn_audit_log();

create trigger trg_audit_verificaciones_resumen
  after insert or update or delete on verificaciones_resumen
  for each row execute function fn_audit_log();

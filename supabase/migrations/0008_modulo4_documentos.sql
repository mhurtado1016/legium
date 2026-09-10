-- ============================================================
-- Legium — Módulo 4: Gestión documental
-- Ver especificación técnica, sección 7.
-- ============================================================

create table categorias_documento (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid references firmas(id),   -- null = categoría global predefinida
  nombre text not null,
  es_predefinida boolean not null default false,
  created_at timestamptz not null default now()
);

insert into categorias_documento (firma_id, nombre, es_predefinida) values
  (null, 'Contrato', true),
  (null, 'Prueba', true),
  (null, 'Escrito', true),
  (null, 'Concepto', true),
  (null, 'Otro', true);

create table documentos (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  caso_id uuid not null references casos(id),
  categoria_id uuid not null references categorias_documento(id),
  nombre text not null,
  descripcion text,
  creado_por uuid not null references usuarios(id),
  created_at timestamptz not null default now()
);

create table documento_versiones (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  documento_id uuid not null references documentos(id),
  version_numero integer not null,
  storage_path text not null,
  nombre_archivo text not null,
  mime_type text,
  tamano_bytes bigint,
  texto_extraido text,
  texto_extraido_en timestamptz,
  subido_por uuid not null references usuarios(id),
  created_at timestamptz not null default now(),
  unique (documento_id, version_numero)
);

create index documento_versiones_texto_idx on documento_versiones
  using gin (to_tsvector('spanish', coalesce(texto_extraido, '')));

alter table categorias_documento enable row level security;
alter table documentos enable row level security;
alter table documento_versiones enable row level security;

-- Categorías: predefinidas globales visibles a todos, propias solo a la firma
create policy "lectura de categorias globales y de la propia firma"
  on categorias_documento for select
  using (firma_id is null or firma_id = (select firma_id from usuarios where id = auth.uid()));

create policy "crear categorias solo para la propia firma"
  on categorias_documento for insert
  with check (firma_id = (select firma_id from usuarios where id = auth.uid()));

create policy "modificar solo categorias propias (no las globales)"
  on categorias_documento for update
  using (firma_id = (select firma_id from usuarios where id = auth.uid()));

create policy "acceso solo a datos de la propia firma" on documentos for all
  using (firma_id = (select firma_id from usuarios where id = auth.uid()));

create policy "acceso solo a datos de la propia firma" on documento_versiones for all
  using (firma_id = (select firma_id from usuarios where id = auth.uid()));

create trigger trg_audit_documentos after insert or update or delete on documentos
  for each row execute function fn_audit_log();
create trigger trg_audit_documento_versiones after insert or update or delete on documento_versiones
  for each row execute function fn_audit_log();

-- ---------- Storage: bucket de documentos ----------
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

-- Rutas esperadas: {firma_id}/{caso_id}/{documento_id}/{version}-{nombre_archivo}
-- El primer segmento de la ruta (foldername[1]) es el firma_id.
create policy "lectura de documentos de la propia firma"
  on storage.objects for select
  using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = (select firma_id::text from usuarios where id = auth.uid())
  );

create policy "subir documentos solo a la propia firma"
  on storage.objects for insert
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = (select firma_id::text from usuarios where id = auth.uid())
  );

create policy "eliminar documentos solo de la propia firma"
  on storage.objects for delete
  using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = (select firma_id::text from usuarios where id = auth.uid())
  );

-- ============================================================
-- Legium — Módulo 5: Plantillas de escritos
-- Ver especificación técnica, sección 8.
-- ============================================================

create table plantillas (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid references firmas(id),   -- null = plantilla global predefinida
  categoria_id uuid not null references categorias_documento(id),
  nombre text not null,
  descripcion text,
  storage_path text not null,
  variables jsonb not null default '[]',
  creado_por uuid references usuarios(id),
  created_at timestamptz not null default now()
);

alter table plantillas enable row level security;

create policy "lectura de plantillas globales y de la propia firma"
  on plantillas for select
  using (firma_id is null or firma_id = (select firma_id from usuarios where id = auth.uid()));

create policy "crear plantillas solo para la propia firma"
  on plantillas for insert
  with check (firma_id = (select firma_id from usuarios where id = auth.uid()));

create policy "modificar solo plantillas propias (no las globales)"
  on plantillas for update
  using (firma_id = (select firma_id from usuarios where id = auth.uid()));

create trigger trg_audit_plantillas after insert or update or delete on plantillas
  for each row execute function fn_audit_log();

-- Bucket separado para los archivos base de las plantillas (distinto del
-- bucket "documentos", que guarda los documentos ya generados/subidos).
insert into storage.buckets (id, name, public)
values ('plantillas', 'plantillas', false)
on conflict (id) do nothing;

-- Las plantillas globales (sin firma_id) se guardan bajo el prefijo
-- "global/"; las propias de un despacho bajo "{firma_id}/".
create policy "lectura de plantillas globales y de la propia firma"
  on storage.objects for select
  using (
    bucket_id = 'plantillas'
    and (
      (storage.foldername(name))[1] = 'global'
      or (storage.foldername(name))[1] = (select firma_id::text from usuarios where id = auth.uid())
    )
  );

create policy "subir plantillas solo a la propia firma"
  on storage.objects for insert
  with check (
    bucket_id = 'plantillas'
    and (storage.foldername(name))[1] = (select firma_id::text from usuarios where id = auth.uid())
  );

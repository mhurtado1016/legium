-- ============================================================
-- Legium — Caché de texto extraído de archivos de Google Drive para
-- el asistente de Documentos IA (Mañecito).
--
-- Las credenciales de la cuenta de servicio de Google solo existen en
-- Vercel (api/drive/*.ts); documentos-ia-chat las usa indirectamente
-- llamando a esos mismos endpoints (ver supabase/functions/_shared/drive.ts)
-- para traer el contenido de los documentos del caso que viven en Drive,
-- igual que ya hace con los del módulo de Documentos.
--
-- Se cachea por (caso_id, drive_file_id) — no por conversación — para que
-- varias conversaciones sobre el mismo caso reusen el mismo texto ya
-- extraído en vez de volver a descargar y procesar el archivo en cada
-- turno de cada conversación. modified_time (el de Drive) permite
-- detectar que el archivo cambió y toca re-extraer.
-- ============================================================

create table documentos_ia_archivos_drive_cache (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  caso_id uuid not null references casos(id),
  drive_file_id text not null,
  nombre_archivo text not null,
  mime_type text,
  modified_time timestamptz,
  texto_extraido text,
  actualizado_en timestamptz not null default now(),
  unique (caso_id, drive_file_id)
);

alter table documentos_ia_archivos_drive_cache enable row level security;

create policy "acceso solo admin de la propia firma" on documentos_ia_archivos_drive_cache for all
  using (
    firma_id = (select firma_id from usuarios where id = auth.uid())
    and (select es_administrador from usuarios where id = auth.uid()) = true
  );

create trigger trg_audit_documentos_ia_archivos_drive_cache
  after insert or update or delete on documentos_ia_archivos_drive_cache
  for each row execute function fn_audit_log();

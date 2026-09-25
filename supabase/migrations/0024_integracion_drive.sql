-- ============================================================
-- Integración con Google Drive: una sola cuenta compartida por firma
-- (conectada una vez desde Administración), usada para listar en el
-- detalle del caso los archivos de la carpeta de Drive cuyo nombre
-- contiene el número de radicado (casos.numero_radicado).
-- ============================================================

create table integraciones_drive (
  firma_id uuid primary key references firmas(id),
  refresh_token text not null,
  cuenta_email text,
  conectado_por uuid references usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table integraciones_drive enable row level security;

-- Sin políticas: el refresh_token nunca debe llegar al cliente. Solo lo
-- leen/escriben api/drive/callback.ts y api/drive/listar.ts con la
-- service role (que bypasea RLS); con RLS activo y ninguna política,
-- authenticated/anon quedan sin ningún acceso a esta tabla.

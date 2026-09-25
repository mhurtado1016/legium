-- ============================================================
-- Bandeja de notificaciones en la app (campanita en AppHeader).
--
-- Hasta ahora los avisos de plazos/citas solo llegaban por push o
-- correo; esto agrega un registro persistente por usuario para que
-- también se vean dentro del sitio, con estado leído/no leído.
-- ============================================================

create table notificaciones (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  usuario_id uuid not null references usuarios(id),
  titulo text not null,
  cuerpo text,
  enlace text,
  leido boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notificaciones enable row level security;

-- Solo el propio destinatario ve/actualiza sus notificaciones (no toda
-- la firma, a diferencia del patrón "acceso solo a datos de la propia
-- firma" que usan la mayoría de las tablas). Las inserciones las hacen
-- siempre las Edge/Serverless Functions con la service role, que
-- bypasea RLS, así que no hace falta una política de insert.
create policy "cada usuario ve y actualiza solo sus notificaciones" on notificaciones for select
  using (firma_id = mi_firma_id() and usuario_id = auth.uid());

create policy "marcar como leida solo la propia" on notificaciones for update
  using (firma_id = mi_firma_id() and usuario_id = auth.uid())
  with check (firma_id = mi_firma_id() and usuario_id = auth.uid());

create index notificaciones_usuario_no_leidas_idx on notificaciones (usuario_id, created_at desc) where leido = false;
create index notificaciones_usuario_idx on notificaciones (usuario_id, created_at desc);

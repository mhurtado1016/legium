-- ============================================================
-- Legium — lectura de sentencias_cache para usuarios autenticados.
-- sentencias_cache es información pública (igual para todos los tenants),
-- pero si la base tiene RLS activo sobre la tabla sin ninguna política,
-- las consultas con la sesión del usuario no ven filas: el detalle del
-- caso mostraba "Sentencia no disponible" en las sentencias vinculadas
-- (el embed a sentencias_cache llegaba null) y el buscador nunca leía
-- el cache. verificarResumen() también actualiza esta tabla con la
-- sesión del usuario (resumen_ia_verificado), por eso se permite update;
-- insert/delete siguen siendo solo del service role.
-- ============================================================

alter table sentencias_cache enable row level security;

drop policy if exists "lectura de sentencias para usuarios autenticados" on sentencias_cache;
create policy "lectura de sentencias para usuarios autenticados"
  on sentencias_cache for select
  to authenticated
  using (true);

drop policy if exists "verificacion de resumen por usuarios autenticados" on sentencias_cache;
create policy "verificacion de resumen por usuarios autenticados"
  on sentencias_cache for update
  to authenticated
  using (true)
  with check (true);

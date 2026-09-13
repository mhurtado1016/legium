-- ============================================================
-- Fix: "infinite recursion detected in policy for relation usuarios"
--
-- Causa: casi todas las políticas RLS del proyecto usan el patrón
--   using (firma_id = (select firma_id from usuarios where id = auth.uid()))
-- Ese subquery consulta la propia tabla `usuarios`, la cual también
-- tiene RLS activado — para decidir si una fila de `usuarios` es
-- visible dentro del subquery, Postgres tiene que evaluar la MISMA
-- política de nuevo, y así indefinidamente. Es el error clásico de
-- RLS recursiva documentado por Supabase.
--
-- Solución (la recomendada oficialmente por Supabase): mover esa
-- consulta a funciones `security definer`, que se ejecutan con
-- privilegios elevados y por lo tanto SÍ pueden leer `usuarios` sin
-- volver a pasar por sus políticas RLS, rompiendo el ciclo.
--
-- Esta migración reemplaza TODAS las políticas del proyecto que usaban
-- ese patrón (tocaba prácticamente cada tabla, no solo `usuarios`).
-- ============================================================

create or replace function mi_firma_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select firma_id from usuarios where id = auth.uid()
$$;

create or replace function soy_administrador()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(es_administrador, false) from usuarios where id = auth.uid()
$$;

-- ---------- usuarios ----------
drop policy if exists "solo administradores crean usuarios de su firma" on usuarios;
create policy "solo administradores crean usuarios de su firma"
  on usuarios for insert
  with check (firma_id = mi_firma_id() and soy_administrador());

drop policy if exists "solo administradores desactivan usuarios de su firma" on usuarios;
create policy "solo administradores desactivan usuarios de su firma"
  on usuarios for update
  using (firma_id = mi_firma_id())
  with check (soy_administrador());

drop policy if exists "lectura de usuarios de la propia firma" on usuarios;
create policy "lectura de usuarios de la propia firma"
  on usuarios for select
  using (firma_id = mi_firma_id());

-- ---------- configuracion_tenant ----------
drop policy if exists "lectura de configuracion propia del tenant" on configuracion_tenant;
create policy "lectura de configuracion propia del tenant"
  on configuracion_tenant for select
  using (firma_id = mi_firma_id());

drop policy if exists "solo administrador modifica configuracion del tenant" on configuracion_tenant;
create policy "solo administrador modifica configuracion del tenant"
  on configuracion_tenant for update
  using (firma_id = mi_firma_id())
  with check (soy_administrador());

-- ---------- audit_log ----------
drop policy if exists "lectura de auditoria solo de la propia firma" on audit_log;
create policy "lectura de auditoria solo de la propia firma"
  on audit_log for select
  using (firma_id = mi_firma_id());

-- ---------- tablas con la política simple "acceso solo a datos de la propia firma" (for all) ----------
do $$
declare
  t text;
  tablas text[] := array[
    'consultas_guardadas', 'historial_busqueda', 'verificaciones_resumen',
    'clientes', 'casos', 'caso_sentencias', 'caso_actividad',
    'plazos', 'plazo_notificaciones', 'push_subscriptions',
    'documentos', 'documento_versiones',
    'tarifas_hora', 'registros_tiempo', 'honorarios_fijos', 'cuentas_cobro', 'cuenta_cobro_items',
    'sentencia_favoritos'
  ];
begin
  foreach t in array tablas loop
    execute format('drop policy if exists "acceso solo a datos de la propia firma" on %I', t);
    execute format(
      'create policy "acceso solo a datos de la propia firma" on %I for all using (firma_id = mi_firma_id())',
      t
    );
  end loop;
end $$;

-- ---------- categorias_documento (globales + propias) ----------
drop policy if exists "lectura de categorias globales y de la propia firma" on categorias_documento;
create policy "lectura de categorias globales y de la propia firma"
  on categorias_documento for select
  using (firma_id is null or firma_id = mi_firma_id());

drop policy if exists "crear categorias solo para la propia firma" on categorias_documento;
create policy "crear categorias solo para la propia firma"
  on categorias_documento for insert
  with check (firma_id = mi_firma_id());

drop policy if exists "modificar solo categorias propias (no las globales)" on categorias_documento;
create policy "modificar solo categorias propias (no las globales)"
  on categorias_documento for update
  using (firma_id = mi_firma_id());

-- ---------- plantillas (globales + propias) ----------
drop policy if exists "lectura de plantillas globales y de la propia firma" on plantillas;
create policy "lectura de plantillas globales y de la propia firma"
  on plantillas for select
  using (firma_id is null or firma_id = mi_firma_id());

drop policy if exists "crear plantillas solo para la propia firma" on plantillas;
create policy "crear plantillas solo para la propia firma"
  on plantillas for insert
  with check (firma_id = mi_firma_id());

drop policy if exists "modificar solo plantillas propias (no las globales)" on plantillas;
create policy "modificar solo plantillas propias (no las globales)"
  on plantillas for update
  using (firma_id = mi_firma_id());

-- ---------- storage.objects (buckets documentos, plantillas, facturas) ----------
drop policy if exists "lectura de documentos de la propia firma" on storage.objects;
create policy "lectura de documentos de la propia firma"
  on storage.objects for select
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = mi_firma_id()::text);

drop policy if exists "subir documentos solo a la propia firma" on storage.objects;
create policy "subir documentos solo a la propia firma"
  on storage.objects for insert
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = mi_firma_id()::text);

drop policy if exists "eliminar documentos solo de la propia firma" on storage.objects;
create policy "eliminar documentos solo de la propia firma"
  on storage.objects for delete
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = mi_firma_id()::text);

drop policy if exists "lectura de plantillas globales y de la propia firma" on storage.objects;
create policy "lectura de plantillas globales y de la propia firma"
  on storage.objects for select
  using (
    bucket_id = 'plantillas'
    and ((storage.foldername(name))[1] = 'global' or (storage.foldername(name))[1] = mi_firma_id()::text)
  );

drop policy if exists "subir plantillas solo a la propia firma" on storage.objects;
create policy "subir plantillas solo a la propia firma"
  on storage.objects for insert
  with check (bucket_id = 'plantillas' and (storage.foldername(name))[1] = mi_firma_id()::text);

drop policy if exists "lectura de facturas de la propia firma" on storage.objects;
create policy "lectura de facturas de la propia firma"
  on storage.objects for select
  using (bucket_id = 'facturas' and (storage.foldername(name))[1] = mi_firma_id()::text);

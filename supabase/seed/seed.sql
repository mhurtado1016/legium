-- ============================================================
-- Legium — Script de seed
-- Ejecutar en el SQL Editor de Supabase, en un proyecto que ya
-- tenga aplicadas todas las migraciones de supabase/migrations/.
--
-- Precondición: el usuario mhurtado1016@gmail.com ya debe existir en
-- auth.users (creado desde Authentication → Users, o vía sign up).
-- Este script NO crea usuarios de auth, solo los vincula a Legium.
-- ============================================================

do $$
declare
  v_usuario_id uuid;
  v_firma_id uuid;
  v_cliente_persona_id uuid;
  v_cliente_empresa_id uuid;
  v_caso_litigio_id uuid;
  v_caso_consultoria_id uuid;
  v_sentencia_id uuid;
begin

  -- ---------- Usuario y firma ----------
  select id into v_usuario_id from auth.users where email = 'mhurtado1016@gmail.com';
  if v_usuario_id is null then
    raise exception 'No existe mhurtado1016@gmail.com en auth.users. Créalo primero en Authentication → Users.';
  end if;

  if exists (select 1 from usuarios where id = v_usuario_id) then
    raise notice 'El usuario ya está vinculado a una firma; se omite la creación de firma/usuario.';
    select firma_id into v_firma_id from usuarios where id = v_usuario_id;
  else
    insert into firmas (nombre) values ('Despacho de Prueba Legium')
      returning id into v_firma_id;
    -- configuracion_tenant se crea automáticamente vía trigger (0002)

    insert into usuarios (id, firma_id, nombre, email, es_administrador)
    values (v_usuario_id, v_firma_id, 'Manuel Hurtado', 'mhurtado1016@gmail.com', true);
  end if;

  -- ---------- Clientes ----------
  insert into clientes (firma_id, tipo, nombre, identificacion, email, telefono)
  values (v_firma_id, 'persona_natural', 'Carlos Ramírez', '79.345.678', 'carlos.ramirez@example.com', '3001234567')
  returning id into v_cliente_persona_id;

  insert into clientes (firma_id, tipo, nombre, identificacion, email, telefono)
  values (v_firma_id, 'empresa', 'Comercializadora XYZ S.A.S.', '900.123.456-7', 'contacto@xyzsas.com', '6014567890')
  returning id into v_cliente_empresa_id;

  -- ---------- Casos ----------
  insert into casos (
    firma_id, cliente_id, tipo, titulo, descripcion, estado,
    numero_radicado, despacho_judicial, etapa_procesal, responsable_id
  ) values (
    v_firma_id, v_cliente_persona_id, 'litigio',
    'Proceso de tutela por vulneración al debido proceso',
    'Acción de tutela contra una entidad pública por incumplimiento de términos.',
    'en_curso', '11001-31-03-001-2026-00123-00',
    'Juzgado 1 Civil del Circuito de Bogotá', 'Contestación de la demanda',
    v_usuario_id
  ) returning id into v_caso_litigio_id;

  insert into casos (
    firma_id, cliente_id, tipo, titulo, descripcion, estado, responsable_id
  ) values (
    v_firma_id, v_cliente_empresa_id, 'consultoria',
    'Concepto sobre cláusulas de un contrato de arrendamiento comercial',
    'Revisión y concepto jurídico sobre cláusulas de terminación anticipada.',
    'abierto', v_usuario_id
  ) returning id into v_caso_consultoria_id;

  -- ---------- Actividad de ejemplo ----------
  insert into caso_actividad (firma_id, caso_id, usuario_id, descripcion)
  values
    (v_firma_id, v_caso_litigio_id, v_usuario_id, 'Caso abierto y radicado.'),
    (v_firma_id, v_caso_litigio_id, v_usuario_id, 'Se recibió notificación del despacho judicial.'),
    (v_firma_id, v_caso_consultoria_id, v_usuario_id, 'Caso abierto. Pendiente de revisión del contrato.');

  -- ---------- Sentencia de ejemplo en el cache (Módulo 1) ----------
  insert into sentencias_cache (
    proceso, expediente_tipo, expediente_numero, magistrado_a, sala,
    sentencia_tipo, sentencia, fecha_sentencia, sv_spv, av_apv
  ) values (
    'Acción de tutela', 'T', '1234567', 'Carlos Gaviria Díaz', 'Sala Novena de Revisión',
    'T', 'T-760/08', '2008-08-01T00:00:00.000Z', 's.d.', 's.d.'
  )
  on conflict (sentencia) do nothing
  returning id into v_sentencia_id;

  if v_sentencia_id is null then
    select id into v_sentencia_id from sentencias_cache where sentencia = 'T-760/08';
  end if;

  insert into caso_sentencias (firma_id, caso_id, sentencia_id, nota, agregado_por)
  values (v_firma_id, v_caso_litigio_id, v_sentencia_id, 'Precedente aplicable al debido proceso.', v_usuario_id);

  -- ---------- Plazos de ejemplo ----------
  insert into plazos (firma_id, caso_id, titulo, fecha_vencimiento, responsable_id, creado_por)
  values
    (v_firma_id, v_caso_litigio_id, 'Contestación de la demanda', now() + interval '3 days', v_usuario_id, v_usuario_id),
    (v_firma_id, v_caso_consultoria_id, 'Entrega del concepto al cliente', now() + interval '6 days', v_usuario_id, v_usuario_id);

  raise notice 'Seed completado. firma_id = %', v_firma_id;
end $$;

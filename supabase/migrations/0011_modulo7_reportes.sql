-- ============================================================
-- Legium — Módulo 7: Reportes y analítica
-- Ver especificación técnica, sección 10.
--
-- No se introducen tablas nuevas: solo vistas sobre datos ya
-- existentes. `security_invoker = true` hace que cada vista respete
-- las políticas RLS de las tablas subyacentes con el usuario que
-- consulta, en vez de ejecutarse con privilegios del dueño de la vista.
-- ============================================================

create view rpt_cartera
  with (security_invoker = true) as
  select
    firma_id,
    coalesce(sum(total) filter (where estado = 'pendiente'), 0) as pendiente,
    coalesce(sum(total) filter (where estado = 'vencida'), 0) as vencida,
    coalesce(sum(total) filter (where estado = 'pagada'), 0) as cobrado
  from cuentas_cobro
  group by firma_id;

create view rpt_horas_por_usuario
  with (security_invoker = true) as
  select
    firma_id,
    usuario_id,
    date_trunc('month', fecha) as periodo,
    sum(horas) as horas_totales,
    sum(horas) filter (where facturado) as horas_facturadas
  from registros_tiempo
  group by firma_id, usuario_id, date_trunc('month', fecha);

create view rpt_casos_por_estado
  with (security_invoker = true) as
  select firma_id, estado, count(*) as total
  from casos
  group by firma_id, estado;

create view rpt_plazos_por_estado
  with (security_invoker = true) as
  select firma_id, estado, count(*) as total
  from plazos
  group by firma_id, estado;

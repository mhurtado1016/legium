-- ============================================================
-- Legium — Módulo 6: Facturación y honorarios
-- Ver especificación técnica, sección 9. Sin integración DIAN.
-- ============================================================

create table tarifas_hora (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  usuario_id uuid references usuarios(id),
  caso_id uuid references casos(id),
  valor_hora numeric(12,2) not null,
  moneda text not null default 'COP',
  created_at timestamptz not null default now()
);

create table registros_tiempo (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  caso_id uuid not null references casos(id),
  usuario_id uuid not null references usuarios(id),
  fecha date not null default current_date,
  horas numeric(6,2) not null,
  descripcion text,
  facturado boolean not null default false,
  created_at timestamptz not null default now()
);

create table honorarios_fijos (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  caso_id uuid not null references casos(id) unique,
  monto_acordado numeric(14,2) not null,
  moneda text not null default 'COP',
  descripcion text,
  created_at timestamptz not null default now()
);

create table cuentas_cobro (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  caso_id uuid not null references casos(id),
  cliente_id uuid not null references clientes(id),
  numero text not null,
  fecha_emision date not null default current_date,
  fecha_vencimiento date,
  subtotal numeric(14,2) not null,
  total numeric(14,2) not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'pagada', 'vencida', 'anulada')),
  storage_path text,
  creado_por uuid not null references usuarios(id),
  created_at timestamptz not null default now(),
  unique (firma_id, numero)
);

create table cuenta_cobro_items (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  cuenta_cobro_id uuid not null references cuentas_cobro(id),
  descripcion text not null,
  cantidad numeric(10,2) not null default 1,
  valor_unitario numeric(14,2) not null,
  valor_total numeric(14,2) not null,
  registro_tiempo_id uuid references registros_tiempo(id)
);

alter table tarifas_hora enable row level security;
alter table registros_tiempo enable row level security;
alter table honorarios_fijos enable row level security;
alter table cuentas_cobro enable row level security;
alter table cuenta_cobro_items enable row level security;

create policy "acceso solo a datos de la propia firma" on tarifas_hora for all
  using (firma_id = (select firma_id from usuarios where id = auth.uid()));
create policy "acceso solo a datos de la propia firma" on registros_tiempo for all
  using (firma_id = (select firma_id from usuarios where id = auth.uid()));
create policy "acceso solo a datos de la propia firma" on honorarios_fijos for all
  using (firma_id = (select firma_id from usuarios where id = auth.uid()));
create policy "acceso solo a datos de la propia firma" on cuentas_cobro for all
  using (firma_id = (select firma_id from usuarios where id = auth.uid()));
create policy "acceso solo a datos de la propia firma" on cuenta_cobro_items for all
  using (firma_id = (select firma_id from usuarios where id = auth.uid()));

create trigger trg_audit_tarifas_hora after insert or update or delete on tarifas_hora
  for each row execute function fn_audit_log();
create trigger trg_audit_registros_tiempo after insert or update or delete on registros_tiempo
  for each row execute function fn_audit_log();
create trigger trg_audit_honorarios_fijos after insert or update or delete on honorarios_fijos
  for each row execute function fn_audit_log();
create trigger trg_audit_cuentas_cobro after insert or update or delete on cuentas_cobro
  for each row execute function fn_audit_log();

create index registros_tiempo_facturado_idx on registros_tiempo (caso_id, facturado);
create index cuentas_cobro_estado_idx on cuentas_cobro (firma_id, estado);

-- Función que incrementa el consecutivo del tenant de forma atómica y
-- devuelve el número formateado (sección 9.4).
create or replace function fn_siguiente_numero_cobro(p_firma_id uuid)
returns text
language plpgsql security definer as $$
declare
  v_numero integer;
begin
  update configuracion_tenant
  set ultimo_numero_cobro = ultimo_numero_cobro + 1
  where firma_id = p_firma_id
  returning ultimo_numero_cobro into v_numero;

  return 'CC-' || lpad(v_numero::text, 4, '0');
end;
$$;

-- ---------- Storage: PDFs de cuentas de cobro ----------
insert into storage.buckets (id, name, public)
values ('facturas', 'facturas', false)
on conflict (id) do nothing;

create policy "lectura de facturas de la propia firma"
  on storage.objects for select
  using (
    bucket_id = 'facturas'
    and (storage.foldername(name))[1] = (select firma_id::text from usuarios where id = auth.uid())
  );

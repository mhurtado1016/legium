-- ============================================================
-- Legium — Módulo: Redacción de documentos jurídicos con IA
-- Chat con Gemini para redactar/responder tutelas, demandas y otros
-- escritos, con tipos de documento y su especificación (markdown)
-- editables por administradores, y archivos de soporte opcionales.
-- Todo el módulo queda restringido a usuarios es_administrador.
-- ============================================================

-- ---------- Tipos de documento legal (catálogo + especificación) ----------
create table tipos_documento_legal (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid references firmas(id),   -- null = tipo global predefinido
  nombre text not null,
  descripcion text,
  especificacion_md text not null,
  es_predefinida boolean not null default false,
  activo boolean not null default true,
  creado_por uuid references usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tipos_documento_legal enable row level security;

create policy "lectura de tipos globales y de la propia firma"
  on tipos_documento_legal for select
  using (
    (select es_administrador from usuarios where id = auth.uid()) = true
    and (firma_id is null or firma_id = (select firma_id from usuarios where id = auth.uid()))
  );

create policy "crear tipos solo admin y para la propia firma"
  on tipos_documento_legal for insert
  with check (
    firma_id = (select firma_id from usuarios where id = auth.uid())
    and (select es_administrador from usuarios where id = auth.uid()) = true
  );

create policy "modificar solo tipos propios (no los globales), solo admin"
  on tipos_documento_legal for update
  using (
    firma_id = (select firma_id from usuarios where id = auth.uid())
    and (select es_administrador from usuarios where id = auth.uid()) = true
  );

create policy "eliminar solo tipos propios (no los globales), solo admin"
  on tipos_documento_legal for delete
  using (
    firma_id = (select firma_id from usuarios where id = auth.uid())
    and (select es_administrador from usuarios where id = auth.uid()) = true
  );

create trigger trg_audit_tipos_documento_legal
  after insert or update or delete on tipos_documento_legal
  for each row execute function fn_audit_log();

-- ---------- Conversaciones (sesiones de chat con la IA) ----------
create table documentos_ia_conversaciones (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  caso_id uuid references casos(id),   -- opcional: la conversación no requiere un caso
  tipo_documento_id uuid not null references tipos_documento_legal(id),
  titulo text not null,
  contenido_generado text,
  datos_faltantes jsonb,
  estado text not null default 'en_curso' check (estado in ('en_curso', 'con_borrador')),
  creado_por uuid not null references usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table documentos_ia_mensajes (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  conversacion_id uuid not null references documentos_ia_conversaciones(id) on delete cascade,
  rol text not null check (rol in ('usuario', 'asistente')),
  contenido text not null,
  creado_por uuid references usuarios(id),
  created_at timestamptz not null default now()
);

create table documentos_ia_archivos_soporte (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  conversacion_id uuid not null references documentos_ia_conversaciones(id) on delete cascade,
  storage_path text not null,
  nombre_archivo text not null,
  mime_type text,
  tamano_bytes bigint,
  gemini_file_uri text,
  gemini_file_expira timestamptz,
  subido_por uuid not null references usuarios(id),
  created_at timestamptz not null default now()
);

create table documentos_ia_archivos_generados (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmas(id),
  conversacion_id uuid not null references documentos_ia_conversaciones(id) on delete cascade,
  formato text not null check (formato in ('docx', 'pdf')),
  storage_path text not null,
  nombre_archivo text not null,
  mime_type text,
  tamano_bytes bigint,
  generado_por uuid references usuarios(id),
  created_at timestamptz not null default now()
);

alter table documentos_ia_conversaciones enable row level security;
alter table documentos_ia_mensajes enable row level security;
alter table documentos_ia_archivos_soporte enable row level security;
alter table documentos_ia_archivos_generados enable row level security;

create policy "acceso solo admin de la propia firma" on documentos_ia_conversaciones for all
  using (
    firma_id = (select firma_id from usuarios where id = auth.uid())
    and (select es_administrador from usuarios where id = auth.uid()) = true
  );

create policy "acceso solo admin de la propia firma" on documentos_ia_mensajes for all
  using (
    firma_id = (select firma_id from usuarios where id = auth.uid())
    and (select es_administrador from usuarios where id = auth.uid()) = true
  );

create policy "acceso solo admin de la propia firma" on documentos_ia_archivos_soporte for all
  using (
    firma_id = (select firma_id from usuarios where id = auth.uid())
    and (select es_administrador from usuarios where id = auth.uid()) = true
  );

create policy "acceso solo admin de la propia firma" on documentos_ia_archivos_generados for all
  using (
    firma_id = (select firma_id from usuarios where id = auth.uid())
    and (select es_administrador from usuarios where id = auth.uid()) = true
  );

create trigger trg_audit_documentos_ia_conversaciones
  after insert or update or delete on documentos_ia_conversaciones
  for each row execute function fn_audit_log();
create trigger trg_audit_documentos_ia_mensajes
  after insert or update or delete on documentos_ia_mensajes
  for each row execute function fn_audit_log();
create trigger trg_audit_documentos_ia_archivos_soporte
  after insert or update or delete on documentos_ia_archivos_soporte
  for each row execute function fn_audit_log();
create trigger trg_audit_documentos_ia_archivos_generados
  after insert or update or delete on documentos_ia_archivos_generados
  for each row execute function fn_audit_log();

-- ---------- Storage: bucket de documentos IA ----------
insert into storage.buckets (id, name, public)
values ('documentos-ia', 'documentos-ia', false)
on conflict (id) do nothing;

-- Rutas esperadas:
--   {firma_id}/{conversacion_id}/soporte/{id}-{nombre_archivo}
--   {firma_id}/{conversacion_id}/generado/{id}-{nombre_archivo}
-- El primer segmento de la ruta (foldername[1]) es el firma_id.
create policy "lectura de documentos ia solo admin de la propia firma"
  on storage.objects for select
  using (
    bucket_id = 'documentos-ia'
    and (storage.foldername(name))[1] = (select firma_id::text from usuarios where id = auth.uid())
    and (select es_administrador from usuarios where id = auth.uid()) = true
  );

create policy "subir documentos ia solo admin de la propia firma"
  on storage.objects for insert
  with check (
    bucket_id = 'documentos-ia'
    and (storage.foldername(name))[1] = (select firma_id::text from usuarios where id = auth.uid())
    and (select es_administrador from usuarios where id = auth.uid()) = true
  );

create policy "eliminar documentos ia solo admin de la propia firma"
  on storage.objects for delete
  using (
    bucket_id = 'documentos-ia'
    and (storage.foldername(name))[1] = (select firma_id::text from usuarios where id = auth.uid())
    and (select es_administrador from usuarios where id = auth.uid()) = true
  );

-- ============================================================
-- Seed: 6 tipos de documento predefinidos (globales, firma_id null).
-- Cada especificación es la instrucción que recibe la IA (junto con el
-- contexto del usuario y los archivos de soporte) para redactar ese tipo
-- de documento. Estructura común a todas: identificación de las partes,
-- hechos, fundamentos, petición y la regla de no inventar información.
-- ============================================================

insert into tipos_documento_legal (firma_id, nombre, descripcion, especificacion_md, es_predefinida) values

(null, 'Acción de tutela', 'Mecanismo de protección de derechos fundamentales (art. 86 CP).', $doc$# Acción de tutela

Fundamento: artículo 86 de la Constitución Política y Decreto 2591 de 1991.

## Cuándo aplica
Cuando se busca la protección inmediata de un derecho fundamental
vulnerado o amenazado por una autoridad pública o, en los casos que
proceda (art. 42 Decreto 2591/1991), por un particular.

## Estructura obligatoria
1. **Encabezado**: dirigido al juez o despacho competente (reparto),
   ciudad y fecha.
2. **Identificación del accionante**: nombre completo, identificación,
   dirección y datos de contacto para notificaciones. Si actúa por medio
   de agente oficioso o apoderado, indicarlo expresamente.
3. **Identificación del accionado**: entidad o persona que vulnera el
   derecho, y su representante legal si se conoce.
4. **Derechos fundamentales invocados**: nombrarlos explícitamente (p. ej.
   salud, mínimo vital, petición, debido proceso) y explicar brevemente
   por qué tienen esa naturaleza en el caso concreto.
5. **Hechos**: numerados, cronológicos, concretos — qué pasó, cuándo, y
   qué hizo o dejó de hacer el accionado.
6. **Fundamentos de derecho**: por qué la conducta del accionado vulnera o
   amenaza el derecho; puede citar jurisprudencia de la Corte
   Constitucional si el usuario la aporta o si es de conocimiento general
   consolidado (no inventar números de sentencia).
7. **Pretensiones (petición)**: qué se pide en órdenes concretas y
   verificables (p. ej. "ordenar a [accionado] que en el término de 48
   horas...").
8. **Juramento**: manifestación bajo la gravedad del juramento de no haber
   presentado otra tutela por los mismos hechos y derechos (art. 37
   Decreto 2591/1991), salvo que el usuario indique lo contrario.
9. **Pruebas**: relacionar los documentos aportados como soporte.
10. **Notificaciones**: dirección física y electrónica del accionante.
11. **Firma**.

## Reglas
- Lenguaje formal pero claro, en español jurídico colombiano.
- La tutela debe mostrar por qué no existe otro medio de defensa judicial
  eficaz, o por qué se usa como mecanismo transitorio para evitar un
  perjuicio irremediable, cuando el caso lo amerite.
- Si el usuario no indica el despacho competente, dejar
  "[DATO FALTANTE: despacho o juez competente]" en el encabezado en vez de
  inventar uno.
$doc$, true),

(null, 'Respuesta o contestación a tutela', 'Informe/contestación que presenta la entidad o persona accionada dentro del término del traslado.', $doc$# Respuesta o contestación a una acción de tutela

Se redacta desde la posición del **accionado**, para responder dentro del
término que fijó el juzgado al admitir la tutela (usualmente 1 a 3 días).

## Estructura obligatoria
1. **Encabezado**: dirigido al juzgado que tramita la tutela, con el
   número de radicado del proceso y el nombre del accionante.
2. **Identificación de quien contesta**: nombre de la entidad o persona
   accionada y de quien la representa (representante legal o apoderado).
3. **Pronunciamiento sobre los hechos**: frente a cada hecho de la
   tutela, indicar si es cierto, parcialmente cierto, no le consta o lo
   niega, con la explicación correspondiente. Si el usuario no da su
   versión de un hecho puntual, usar
   "[DATO FALTANTE: posición de la entidad frente a este hecho]" en vez de
   inventarla.
4. **Razones de defensa**: por qué, a juicio del accionado, no hubo
   vulneración del derecho invocado, o por qué la actuación cuestionada
   fue legal/reglamentaria/justificada.
5. **Excepciones o argumentos procesales**, si aplican (p. ej.
   improcedencia por existir otro mecanismo de defensa, carencia actual de
   objeto, hecho superado, falta de legitimación).
6. **Pruebas** que sustentan la respuesta.
7. **Petición**: solicitar que se declare improcedente o se nieguen las
   pretensiones de la tutela (o, si corresponde reconocer parcialmente el
   derecho, indicarlo con honestidad en vez de forzar una negación total).
8. **Notificaciones** y firma.

## Reglas
- Tono institucional, respetuoso, sin desconocer los hechos que sí sean
  ciertos.
- No debe inventarse un fundamento normativo o fáctico que el usuario no
  haya aportado; marcar los vacíos con "[DATO FALTANTE: ...]".
$doc$, true),

(null, 'Demanda', 'Demanda civil general bajo el Código General del Proceso (Ley 1564 de 2012).', $doc$# Demanda

Fundamento: Código General del Proceso (Ley 1564 de 2012), artículo 82 y
siguientes (requisitos de la demanda).

## Estructura obligatoria
1. **Encabezado**: designación del juez o despacho competente (por
   cuantía y factor territorial, si el usuario lo indica).
2. **Identificación de las partes**: demandante(s) y demandado(s), con
   nombre completo, identificación y domicilio para notificaciones.
3. **Apoderado**, si actúa por medio de uno (poder debe anexarse).
4. **Pretensiones**: numeradas, claras y concretas — qué se pide que
   declare o condene el juez.
5. **Hechos**: numerados, cronológicos, cada uno referido a un solo
   suceso, evitando mezclar hechos con argumentos jurídicos.
6. **Fundamentos de derecho**: normas sustanciales en que se apoyan las
   pretensiones (no inventar artículos o leyes; si el usuario no precisa
   el fundamento exacto, usar
   "[DATO FALTANTE: fundamento normativo específico]").
7. **Pretensiones patrimoniales/estimación razonada de la cuantía**, si
   aplica.
8. **Pruebas**: relación de las que se piden practicar y las que se
   aportan con la demanda.
9. **Anexos**: documentos que se acompañan.
10. **Notificaciones** de las partes.
11. **Firma** del demandante o su apoderado.

## Reglas
- Cada pretensión debe ser consistente con los hechos narrados.
- No mezclar tipos de proceso (verbal, verbal sumario, ejecutivo) sin que
  el usuario lo haya indicado; si no lo indica, dejarlo como
  "[DATO FALTANTE: tipo de proceso]" y redactar el resto de forma
  compatible con cualquiera.
$doc$, true),

(null, 'Contestación de demanda', 'Respuesta del demandado dentro de un proceso civil (Código General del Proceso).', $doc$# Contestación de demanda

Fundamento: Código General del Proceso, artículo 96 y siguientes.

## Estructura obligatoria
1. **Encabezado**: juzgado y número de radicado del proceso.
2. **Identificación de quien contesta** (demandado o su apoderado).
3. **Pronunciamiento sobre cada hecho** de la demanda: cierto, no cierto,
   parcialmente cierto o no le consta, con la explicación respectiva.
4. **Pronunciamiento sobre cada pretensión**: se opone, se allana total o
   parcialmente, o se atiene a lo que resulte probado.
5. **Excepciones de mérito**: numeradas, cada una con su sustento fáctico
   y jurídico (p. ej. prescripción, pago, compensación, inexistencia de
   la obligación). No inventar una excepción sin que el usuario haya dado
   la base fáctica; en ese caso usar
   "[DATO FALTANTE: hechos que sustentan esta excepción]".
6. **Excepciones previas**, si aplican (falta de competencia, indebida
   representación, etc.).
7. **Pruebas** que sustentan la defensa.
8. **Petición**: que se nieguen las pretensiones de la demanda y se
   declaren probadas las excepciones propuestas.
9. **Notificaciones** y firma.

## Reglas
- Responder hecho por hecho y pretensión por pretensión, sin omitir
  ninguno.
- No asumir hechos que el usuario no confirmó.
$doc$, true),

(null, 'Derecho de petición', 'Solicitud respetuosa ante autoridades o particulares que prestan función pública (art. 23 CP, Ley 1755 de 2015).', $doc$# Derecho de petición

Fundamento: artículo 23 de la Constitución Política y Ley 1755 de 2015
(Código de Procedimiento Administrativo y de lo Contencioso
Administrativo, Título II).

## Estructura obligatoria
1. **Destinatario**: entidad, autoridad o particular (que preste función
   pública o frente a quien el peticionario tenga una relación de
   subordinación o indefensión) ante quien se radica.
2. **Datos del peticionario**: nombre completo, identificación, dirección
   física y electrónica para notificaciones.
3. **Objeto de la petición**: qué se solicita — puede ser información,
   copia de documentos, o una solicitud sustantiva (queja, reclamo,
   manifestación, consulta).
4. **Hechos o razones** que motivan la petición, numerados y concretos.
5. **Petición concreta**: enunciada de forma clara y verificable, para que
   la entidad pueda responder punto por punto.
6. **Fundamentos de derecho**, si aplica (normas que sustentan lo pedido).
7. **Anexos**, si los hay.
8. **Mención del término legal de respuesta** aplicable según el tipo de
   petición (15 días hábiles en general; 10 días para solicitudes de
   documentos e información; 30 días para consultas a autoridades, salvo
   norma especial — si el usuario no precisa el tipo exacto, usar el
   término general de 15 días y anotar
   "[DATO FALTANTE: confirmar tipo de petición para el término aplicable]").
9. **Firma**.

## Reglas
- Tono respetuoso, sin necesidad de abogado ni formalidades procesales
  estrictas.
- La petición debe ser autosuficiente: quien la lea debe poder responder
  sin tener que adivinar qué se pide.
$doc$, true),

(null, 'Recurso de reposición y, en subsidio, apelación', 'Recurso contra una decisión (auto, resolución o acto administrativo) susceptible de ser controvertida.', $doc$# Recurso de reposición y, en subsidio, apelación

Fundamento: según el contexto, Código General del Proceso (arts. 318 y
ss.) para decisiones judiciales, o Código de Procedimiento Administrativo
y de lo Contencioso Administrativo (arts. 74 y ss., Ley 1437 de 2011)
para actos administrativos.

## Estructura obligatoria
1. **Encabezado**: identificación de la decisión que se recurre
   (proveído, auto, resolución o acto administrativo), fecha de
   expedición o notificación, y autoridad que la profirió.
2. **Identificación de quien recurre** y, si aplica, su apoderado.
3. **Oportunidad**: mención de la fecha de notificación y del término
   dentro del cual se interpone el recurso (verificar que esté dentro del
   plazo legal; si el usuario no indica la fecha de notificación, usar
   "[DATO FALTANTE: fecha de notificación de la decisión]" en vez de
   asumir que el recurso es oportuno).
4. **Decisión que se impugna**: transcribir o resumir con precisión la
   parte resolutiva que se controvierte.
5. **Argumentos de inconformidad**: numerados, explicando en qué consistió
   el error de hecho o de derecho de la decisión (valoración probatoria
   indebida, aplicación incorrecta de una norma, falta de motivación,
   etc.).
6. **Petición principal**: que se revoque, modifique o aclare la decisión
   (reposición).
7. **Petición subsidiaria**: que, en caso de mantenerse la decisión, se
   conceda el recurso de apelación ante el superior jerárquico o
   funcional.
8. **Pruebas adicionales**, si se aportan o solicitan para el recurso.
9. **Notificaciones** y firma.

## Reglas
- El recurso debe atacar puntualmente los argumentos de la decisión
  recurrida, no repetir los argumentos ya expuestos en la etapa anterior
  sin conectarlos con un error concreto de esa decisión.
- No inventar el contenido de la decisión que se recurre; si el usuario no
  aportó el texto completo, pedirlo o marcar
  "[DATO FALTANTE: texto completo de la decisión recurrida]".
$doc$, true);

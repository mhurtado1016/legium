import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AgendarConsultaPublico } from '../components/AgendarConsultaPublico'
import {
  Scale,
  Building2,
  Briefcase,
  Landmark,
  Users,
  Receipt,
  ShieldCheck,
  Home,
  Mail,
  Phone,
  MapPin,
  Menu,
  X,
  ArrowRight,
  CheckCircle2,
  Check,
  ChevronRight,
  Loader2,
  ImagePlus,
  Code2,
  Globe,
  CalendarDays,
  Search,
  Target,
  Zap,
  Radar,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '#servicios', label: 'Áreas de práctica' },
  { href: '#metodologia', label: 'Cómo trabajamos' },
  { href: '#equipo', label: 'Equipo' },
  { href: '#contacto', label: 'Contacto' },
]

// Enlaces de "compartir" (footer): destino fijo (URL canónica del landing),
// no dependen de dónde haga scroll el usuario, así que se arman una sola
// vez acá en vez de calcularlos en cada render.
const URL_SITIO = 'https://efrata360.com/'
const TEXTO_COMPARTIR = 'Efrata 360 — Despacho de abogados y desarrollo de software'
const COMPARTIR_LINKS = [
  {
    label: 'WhatsApp',
    href: `https://wa.me/?text=${encodeURIComponent(`${TEXTO_COMPARTIR} ${URL_SITIO}`)}`,
  },
  {
    label: 'LinkedIn',
    href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(URL_SITIO)}`,
  },
  {
    label: 'Facebook',
    href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(URL_SITIO)}`,
  },
  {
    label: 'X',
    href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(URL_SITIO)}&text=${encodeURIComponent(TEXTO_COMPARTIR)}`,
  },
]

const GRUPOS_SERVICIOS = [
  {
    titulo: 'Legal',
    items: [
      {
        icon: Building2,
        titulo: 'Derecho Comercial, Corporativo y Societario',
        descripcion:
          '¿Vas a crear una empresa, tienes un conflicto con un socio o alguien está usando tu marca sin autorización? Te acompañamos en cada decisión legal de tu negocio.',
        descripcionAmplia:
          'Toda empresa enfrenta decisiones legales que afectan directamente su operación: constituir una sociedad, resolver un conflicto entre socios, proteger una marca o negociar un contrato con un proveedor o cliente. En Efrata360 te acompañamos desde la constitución hasta el día a día societario y comercial, con una mirada que combina rigor jurídico y sentido práctico de negocio.',
        beneficios: [
          'Asesoría integral en creación de sociedades.',
          'Servicios especializados en derecho societario.',
          'Asesoría en derecho corporativo.',
          'Registro y protección de marcas y patentes.',
          'Redacción, revisión y negociación de contratos comerciales.',
          'Representación judicial en procesos comerciales y societarios.',
        ],
      },
      {
        icon: Users,
        titulo: 'Derecho de Familia',
        descripcion:
          '¿El papá de tu hijo no cumple con la cuota alimentaria? También te acompañamos en divorcios, custodia y sucesiones.',
        descripcionAmplia:
          'Los procesos de familia —divorcios, sucesiones, cuotas alimentarias o custodia— mezclan una carga legal con un momento personal difícil. En Efrata360 te representamos con claridad jurídica y un trato cercano, para que el proceso avance sin que tengas que pelear cada paso tú solo.',
        beneficios: [
          'Representación judicial en procesos de divorcio.',
          'Representación judicial en procesos de sucesión.',
          'Fijación de cuotas alimentarias.',
          'Procesos de custodia, entre otros.',
        ],
      },
      {
        icon: Landmark,
        titulo: 'Derecho Administrativo y Público',
        descripcion:
          '¿Una entidad pública te negó un trámite o una empresa de servicios públicos te cobró de más? Te representamos frente al Estado.',
        descripcionAmplia:
          'Relacionarte con el Estado —responder ante una entidad pública, reclamar por un servicio público mal prestado o enfrentar un proceso contencioso-administrativo— exige conocer reglas distintas a las del derecho privado. En Efrata360 te representamos ante la administración pública para que tus derechos no se pierdan en el trámite.',
        beneficios: [
          'Representación judicial en procesos contencioso-administrativos.',
          'Procedimientos administrativos y reclamaciones ante entidades públicas.',
          'Reclamaciones ante empresas de servicios públicos.',
        ],
      },
      {
        icon: Receipt,
        titulo: 'Derecho Fiscal y Tributario',
        descripcion:
          '¿La DIAN o la Secretaría de Hacienda te iniciaron un proceso, o tienes dudas sobre tus obligaciones tributarias? Te asesoramos y te representamos.',
        descripcionAmplia:
          'Un requerimiento de la DIAN o de la Secretaría de Hacienda puede escalar rápido si no se responde con la estrategia correcta. En Efrata360 te asesoramos y representamos en procedimientos tributarios, para que tomes decisiones informadas en cada etapa del proceso.',
        beneficios: [
          'Asesoría en derecho fiscal y tributario.',
          'Representación en procedimientos ante la Secretaría de Hacienda.',
          'Representación en procedimientos ante la DIAN.',
        ],
      },
      {
        icon: ShieldCheck,
        titulo: 'Derecho Constitucional',
        descripcion:
          '¿Sientes que un derecho fundamental tuyo no se está respetando? Te ayudamos a redactar y tramitar la acción que corresponda.',
        descripcionAmplia:
          'Cuando un derecho fundamental está en riesgo, el tiempo importa. En Efrata360 redactamos y tramitamos derechos de petición y acciones constitucionales, y te representamos en la defensa de tus derechos humanos y constitucionales frente a particulares o entidades públicas.',
        beneficios: [
          'Protección y defensa de los derechos humanos constitucionales.',
          'Redacción, asesoría y trámite de derechos de petición.',
          'Interposición y seguimiento de acciones de tutela.',
          'Interposición y seguimiento de acciones populares, de grupo y de cumplimiento.',
        ],
      },
      {
        icon: Home,
        titulo: 'Derecho Urbanístico e Inmobiliario',
        descripcion:
          '¿Vas a comprar, vender o construir y no sabes si el predio tiene todos los permisos en regla? Te acompañamos en cada trámite urbanístico e inmobiliario.',
        descripcionAmplia:
          'Comprar, vender o construir un inmueble implica trámites que, si no se hacen bien desde el inicio, pueden detener un proyecto o poner en riesgo tu inversión. En Efrata360 te acompañamos desde el concepto de viabilidad urbanística hasta la inscripción final ante la Oficina de Registro de Instrumentos Públicos.',
        beneficios: [
          'Emisión de conceptos sobre viabilidad urbanística.',
          'Gestión de licencias urbanísticas ante curadurías o secretarías de planeación.',
          'Acompañamiento y redacción de minutas de escritura pública.',
          'Trámites de registro notarial hasta la inscripción final ante la Oficina de Registro de Instrumentos Públicos.',
        ],
      },
      {
        icon: Scale,
        titulo: 'Derecho Civil y Responsabilidad',
        descripcion:
          '¿Un contrato no se está cumpliendo o alguien te causó un daño que debe repararse? Te representamos para proteger tu patrimonio.',
        descripcionAmplia:
          'Los conflictos relacionados con contratos, propiedad o responsabilidad civil pueden comprometer tu patrimonio sin que lo veas venir. En Efrata360 te representamos en procesos civiles, te asesoramos para el cumplimiento de tus contratos y redactamos los que necesites, desde una promesa de compraventa hasta un contrato de arrendamiento.',
        beneficios: [
          'Representación judicial en procesos civiles (ordinarios, ejecutivos, divisorios, entre otros).',
          'Representación en casos de daño moral y patrimonial.',
          'Asesoría para el cumplimiento y ejecución de contratos.',
          'Redacción de contratos civiles (promesa de compraventa, arrendamiento, entre otros).',
        ],
      },
      {
        icon: Briefcase,
        titulo: 'Derecho Laboral y Seguridad Social',
        descripcion:
          '¿Te despidieron sin justa causa o crees que tu pensión no se liquidó correctamente? También asesoramos a tu empresa para que no llegue a ese punto.',
        descripcionAmplia:
          'Las relaciones laborales y pensionales generan obligaciones en cada etapa: contratación, cambios internos, terminación o el reconocimiento de una pensión. En Efrata360 representamos tanto a empresas como a trabajadores, incluyendo trámites pensionales y demandas por traslado de régimen entre fondos privados y Colpensiones.',
        beneficios: [
          'Representación judicial en procesos y demandas laborales.',
          'Consultoría en derecho laboral.',
          'Trámites pensionales: reconocimiento y reliquidación de pensiones de vejez, invalidez y sobrevivencia.',
          'Demandas por ineficacia de traslado de régimen pensional, ante fondos privados y Colpensiones.',
          'Redacción de contratos laborales y perfiles de cargos.',
          'Redacción de reglamento interno de trabajo y auditoría de cumplimiento laboral.',
          'Conciliación de cartera con entidades del sistema de seguridad social.',
        ],
      },
    ],
  },
  {
    titulo: 'Tecnología y transformación digital',
    items: [
      {
        icon: Code2,
        titulo: 'Construcción de Software a la Medida',
        descripcion:
          'Creamos aplicaciones y sistemas diseñados alrededor de los procesos reales de tu empresa, no al revés.',
        descripcionAmplia:
          'El software genérico obliga a las empresas a adaptar sus procesos a herramientas que no fueron pensadas para ellas. En Efrata360 hacemos el camino inverso: diseñamos aplicaciones web y sistemas internos a partir de cómo funciona realmente tu negocio, combinando conocimiento técnico con la comprensión legal y empresarial que ya tenemos de organizaciones como la tuya.',
        beneficios: [
          'Aplicaciones web adaptadas a tus procesos internos.',
          'Sistemas de gestión diseñados a la medida de tu operación.',
          'Desarrollo guiado por conocimiento legal y empresarial, no solo técnico.',
          'Acompañamiento desde el diseño hasta la implementación.',
        ],
      },
      {
        icon: Globe,
        titulo: 'Construcción de Página Web Corporativa',
        descripcion:
          'Diseñamos y construimos la página web de tu empresa o despacho, pensada para transmitir confianza y convertir visitas en clientes.',
        descripcionAmplia:
          'Una página web genérica, armada con una plantilla, rara vez transmite la seriedad de tu negocio ni está pensada para que un visitante termine escribiéndote. En Efrata360 diseñamos y construimos tu sitio corporativo desde cero: estructura, contenido y formularios de contacto pensados para tus clientes reales, igual que hicimos con el sitio que estás viendo ahora mismo.',
        beneficios: [
          'Diseño y desarrollo de sitios corporativos a la medida.',
          'Estructura y contenido pensados para generar contactos y clientes.',
          'Formularios de contacto y agendamiento integrados.',
          'Sitio propio, sin depender de plantillas genéricas de terceros.',
        ],
      },
    ],
  },
]

const METODOLOGIA = [
  {
    icon: Search,
    titulo: 'Consulta inicial',
    descripcion: 'Escuchamos el caso, revisamos los documentos y definimos si hay una vía viable.',
  },
  {
    icon: Target,
    titulo: 'Análisis y estrategia',
    descripcion:
      'Investigamos jurisprudencia y precedentes aplicables, y trazamos un plan con hitos y plazos claros.',
  },
  {
    icon: Zap,
    titulo: 'Ejecución',
    descripcion:
      'Llevamos el proceso con seguimiento permanente de términos judiciales y administrativos.',
  },
  {
    icon: Radar,
    titulo: 'Seguimiento',
    descripcion: 'El cliente conoce en todo momento en qué va su caso, sin tener que preguntar.',
  },
]

// Logos de clientes reales en public/clientes/. Si algún archivo llegara
// a faltar (404 → onError), LogoCliente cae a una caja placeholder en vez
// de inventar una marca.
const CLIENTES_LOGOS = [
  { src: '/clientes/logo-life.png', alt: 'Life', width: 445, height: 235 },
  { src: '/clientes/logo-logistic.png', alt: 'Logistic', width: 320, height: 320 },
  { src: '/clientes/logo-petro.png', alt: 'Petro', width: 300, height: 90 },
]

// Valores mostrados mientras se carga configuracion_contacto (o si la
// carga falla) — se reemplazan por los datos reales editables desde el
// panel admin (ver DashboardPage.tsx, ContactoConfigSeccion) en cuanto
// resuelve el fetch en el componente Contacto de abajo.
const CONTACTO_FALLBACK = {
  correo: 'contacto@efrata360.com',
  telefono: '+57 300 000 0000',
  ciudad: 'Bogotá, Colombia',
}

/**
 * Landing público para ofertar los servicios jurídicos del despacho.
 * Vive en "/" y no requiere sesión — la app interna de gestión de casos
 * se movió a /app (ver App.tsx). Diseño inspirado en la estructura de
 * lexia.co (hero → propuesta de valor → metodología → áreas de práctica
 * → diferenciador tecnológico → contacto), adaptado a un solo despacho
 * y sin contenido inventado (sin testimonios ni cifras que no podemos
 * respaldar). Los logos de clientes en <Clientes /> son placeholders
 * hasta que se agreguen los archivos reales en /public/clientes/.
 */
export function LandingPage() {
  const [menuAbierto, setMenuAbierto] = useState(false)
  // Área elegida desde el botón "Agendar consulta para esta área" del
  // modal de un servicio (ver ServicioModal) — se precarga en el campo
  // de notas del formulario de agendamiento, para que quede registrada
  // en la cita y en el correo/notificación que recibe el equipo.
  const [areaConsulta, setAreaConsulta] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader menuAbierto={menuAbierto} setMenuAbierto={setMenuAbierto} />
      <Hero />
      <Metodologia />
      <AreasPractica onAgendarArea={setAreaConsulta} />
      <Equipo />
      <Clientes />
      <Agenda notaInicial={areaConsulta ? `Consulta sobre: ${areaConsulta}` : undefined} />
      <Contacto />
      <SiteFooter />
      <BotonAgendarFlotante />
    </div>
  )
}

// Botón flotante solo en móvil (en desktop el CTA ya está siempre visible
// en el header) para que agendar una consulta quede a un toque, sin
// depender de que el usuario haga scroll hasta el header o la sección
// #agenda.
function BotonAgendarFlotante() {
  return (
    <a
      href="#agenda"
      className="md:hidden fixed z-40 bottom-5 right-5 inline-flex items-center gap-2
        rounded-full bg-ink text-paper-raised px-5 py-3.5 text-sm font-medium
        shadow-[var(--shadow-raised)] active:scale-[0.97] transition-transform"
      style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
    >
      <CalendarDays size={18} strokeWidth={1.75} />
      Agendar consulta
    </a>
  )
}

function SiteHeader({
  menuAbierto,
  setMenuAbierto,
}: {
  menuAbierto: boolean
  setMenuAbierto: (v: boolean) => void
}) {
  return (
    <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur-sm border-b border-line/70">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
        <a href="#top" className="flex items-center">
          <img
            src="/logo.jpg"
            alt="Efrata 360"
            width={600}
            height={164}
            className="h-12 w-auto rounded-[var(--radius-field)]"
          />
        </a>

        <nav className="hidden md:flex items-center gap-8 text-sm text-slate">
          {NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-ink transition-colors">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <Link to="/login" className="text-sm text-slate hover:text-ink transition-colors">
            Ingresar
          </Link>
          <a href="#agenda" className="btn-primary btn-sm">
            Agenda una consulta
          </a>
        </div>

        <button
          onClick={() => setMenuAbierto(!menuAbierto)}
          aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuAbierto}
          className="md:hidden p-2 -m-2 rounded-md hover:bg-paper-raised transition-colors"
        >
          {menuAbierto ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {menuAbierto && (
        <nav className="md:hidden border-t border-line/70 px-6 py-4 flex flex-col gap-1 text-sm">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setMenuAbierto(false)}
              className="px-2 py-2.5 rounded-md text-slate hover:text-ink hover:bg-paper-raised transition-colors"
            >
              {item.label}
            </a>
          ))}
          <div className="my-1 border-t border-line" />
          <Link
            to="/login"
            onClick={() => setMenuAbierto(false)}
            className="px-2 py-2.5 rounded-md text-slate hover:text-ink hover:bg-paper-raised transition-colors"
          >
            Ingresar
          </Link>
          <a href="#agenda" onClick={() => setMenuAbierto(false)} className="btn-primary mt-2">
            Agenda una consulta
          </a>
        </nav>
      )}
    </header>
  )
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-ink">
      <HeroImage />
      <HeroPattern />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-14 md:pt-32 md:pb-40">
        <div className="flex items-center gap-2 mb-5">
          <span className="h-px w-6 bg-[#d9b878]/70 shrink-0" />
          <p className="min-w-0 text-xs font-semibold text-[#d9b878] tracking-[0.16em] uppercase">
            Despacho de abogados &amp; desarrollo de software
          </p>
        </div>
        <h1 className="font-serif text-4xl md:text-6xl leading-[1.08] tracking-tight max-w-3xl text-paper-raised">
          Claridad jurídica para decisiones que importan.
        </h1>
        <p className="mt-6 text-lg text-paper-raised/80 max-w-2xl leading-relaxed">
          Acompañamos a personas y empresas en sus procesos legales con estrategia clara,
          cumplimiento riguroso de plazos y tecnología propia de investigación jurisprudencial.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <a href="#agenda" className="btn-primary bg-paper-raised text-ink hover:bg-paper-raised/90">
            Agenda una consulta
            <ArrowRight size={16} strokeWidth={1.75} />
          </a>
          <a
            href="#servicios"
            className="btn-secondary bg-transparent border-paper-raised/25 text-paper-raised hover:bg-paper-raised/10 hover:border-paper-raised/40"
          >
            Ver áreas de práctica
          </a>
        </div>
      </div>
    </section>
  )
}

// Textura discreta (grid de puntos) sobre el degradado del hero — aporta
// profundidad sin competir con la foto ni con el texto; opacidad muy baja
// a propósito (sección 7 del pedido: "no abusar de patrones").
function HeroPattern() {
  return (
    <div
      className="absolute inset-0 z-[1] opacity-[0.07] pointer-events-none"
      style={{
        backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
        backgroundSize: '22px 22px',
      }}
    />
  )
}

// Foto real del equipo (1840×576, muy panorámica) como fondo del hero. En
// desktop la sección es ancha y baja, así que la foto llena toda la
// sección con object-cover sin perder al grupo. En móvil la sección es
// angosta y alta: forzar la misma foto a "cubrir" ese alto la ampliaría
// tanto que solo se vería un fragmento borroso en el borde (el equipo
// quedaba prácticamente fuera de cuadro). Por eso en móvil la foto vive en
// un bloque propio con su propia relación de aspecto (banner arriba,
// ancla a la izquierda donde está el grupo) y el texto va debajo en flujo
// normal, en vez de superpuesto — de ahí "aspect-[2/1] md:aspect-auto
// md:absolute md:inset-0": relación de aspecto fija en móvil, y en
// desktop se abandona porque el inset-0 ya fija ambas dimensiones.
function HeroImage() {
  return (
    <div className="relative aspect-[2/1] md:aspect-auto md:absolute md:inset-0">
      <img
        src="/hero/01-equipo.jpg"
        alt="Equipo de Efrata 360"
        width={1840}
        height={576}
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover object-left md:object-center"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-ink via-ink/10 to-transparent
          md:bg-gradient-to-r md:from-ink/85 md:via-ink/55 md:to-ink/20"
      />
    </div>
  )
}

// Nodo circular del diagrama de flujo: ícono del paso + número en una
// insignia superpuesta en la esquina, mismo lenguaje visual (ink/accent)
// que el resto del sitio.
function NodoPaso({ icon: Icon, numero }: { icon: typeof Search; numero: number }) {
  return (
    <span className="relative inline-flex shrink-0">
      <span className="flex items-center justify-center h-14 w-14 rounded-[var(--radius-card)] bg-ink shadow-[var(--shadow-card)]">
        <Icon size={22} strokeWidth={1.75} className="text-[var(--color-accent)]" />
      </span>
      <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center h-5 w-5 rounded-full bg-[var(--color-accent)] text-[10px] font-bold text-ink ring-2 ring-paper-raised">
        {numero}
      </span>
    </span>
  )
}

// Pequeño trazo tipo "pin de circuito" — decoración junto a cada nodo,
// evoca una placa/esquema técnico sin reproducir ningún diagrama ajeno.
function PinCircuito({ className }: { className?: string }) {
  return <span aria-hidden="true" className={`block h-2 w-px bg-[var(--color-line-strong)] ${className ?? ''}`} />
}

// Diagrama de "Cómo trabajamos": una sola traza horizontal (vertical en
// móvil, ver Metodologia) con los 4 nodos de METODOLOGIA, sobre un fondo
// de retícula — composición propia y deliberadamente simple (sin malla
// de nodos ni iconografía de otro sitio) para que se sienta técnica sin
// calcar el diseño de nadie.
function DiagramaMetodologia() {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper-sunken/60 px-10 py-14">
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse 70% 100% at center, black 35%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 100% at center, black 35%, transparent 85%)',
        }}
      />

      <div className="relative">
        <div className="absolute top-7 left-[12.5%] right-[12.5%] h-px flow-line-x" />
        <div className="relative grid grid-cols-4 gap-x-8">
          {METODOLOGIA.map((paso, i) => (
            <div key={paso.titulo} className="flex flex-col items-center text-center">
              <NodoPaso icon={paso.icon} numero={i + 1} />
              <span className="flex gap-1 mt-1">
                <PinCircuito />
                <PinCircuito />
                <PinCircuito />
              </span>
              <h3 className="mt-4 text-base font-semibold mb-2 tracking-tight">{paso.titulo}</h3>
              <p className="text-sm text-slate leading-relaxed">{paso.descripcion}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Metodologia() {
  return (
    <section id="metodologia" className="border-t border-line/70 bg-paper-raised">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading
          eyebrow="Cómo trabajamos"
          titulo="Un proceso sin improvisación"
          descripcion="Cada caso sigue la misma disciplina, desde la primera consulta hasta el cierre."
        />

        {/* Diagrama de flujo — desktop (lg+): los 4 pasos de METODOLOGIA
            sobre una traza de circuito (línea con barrido animado +
            pines decorativos), ver DiagramaMetodologia. */}
        <div className="hidden lg:block mt-16">
          <DiagramaMetodologia />
        </div>

        {/* Mismo diagrama, apilado — móvil y tablet: cada nodo conectado al
            siguiente por un tramo de línea cuya altura sigue la del texto
            (flex-1 dentro de una columna "stretched" por el row flex). */}
        <div className="flex flex-col lg:hidden mt-14">
          {METODOLOGIA.map((paso, i) => (
            <div key={paso.titulo} className="flex gap-4">
              <div className="flex flex-col items-center">
                <NodoPaso icon={paso.icon} numero={i + 1} />
                {i < METODOLOGIA.length - 1 && <span className="w-px flex-1 my-2 flow-line-y" />}
              </div>
              <div className={i < METODOLOGIA.length - 1 ? 'pb-9' : ''}>
                <h3 className="text-base font-semibold mb-2 tracking-tight">{paso.titulo}</h3>
                <p className="text-sm text-slate leading-relaxed">{paso.descripcion}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

type ServicioItem = (typeof GRUPOS_SERVICIOS)[number]['items'][number]

function AreasPractica({ onAgendarArea }: { onAgendarArea: (titulo: string) => void }) {
  const [servicioActivoTitulo, setServicioActivoTitulo] = useState<string | null>(null)

  return (
    <section id="servicios" className="border-t border-line/70">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading
          eyebrow="Áreas de práctica"
          titulo="En qué te podemos ayudar"
          descripcion="Servicios legales y de desarrollo de software, con el mismo estándar de rigor en cada materia."
        />

        <div className="mt-14 flex flex-col gap-14">
          {GRUPOS_SERVICIOS.map((grupo) => (
            <div key={grupo.titulo}>
              <h3 className="flex items-center gap-3 text-xs font-semibold text-slate tracking-[0.14em] uppercase mb-6">
                {grupo.titulo}
                <span className="h-px flex-1 bg-line" />
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {grupo.items.map((item) => (
                  <button
                    key={item.titulo}
                    type="button"
                    onClick={() => setServicioActivoTitulo(item.titulo)}
                    className="card card-interactive p-6 text-left"
                  >
                    <div className="flex items-start justify-between gap-3 mb-5">
                      <span className="inline-flex items-center justify-center h-11 w-11 rounded-[var(--radius-field)] bg-[var(--color-accent-soft)]">
                        <item.icon size={20} strokeWidth={1.75} className="text-[var(--color-accent-strong)]" />
                      </span>
                      <ChevronRight size={18} strokeWidth={1.75} className="mt-1.5 text-slate/50 shrink-0" />
                    </div>
                    <h4 className="text-base font-semibold mb-2 tracking-tight line-clamp-2 min-h-12">{item.titulo}</h4>
                    <p className="text-sm text-slate leading-relaxed line-clamp-3">{item.descripcion}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Los 9 modales quedan siempre montados (uno por servicio, visibilidad
          controlada por CSS/atributo "hidden") en vez de montar solo el
          activo — así descripcionAmplia y beneficios de cada servicio están
          presentes en el HTML (y en el prerender) desde el primer render,
          no solo tras un click. Es el mismo patrón de acordeón/tab que
          Google indexa igual que contenido visible, aplicado a un modal en
          vez de un panel inline. Sin esto, ese texto — la mayor parte del
          contenido real del landing — nunca llegaba a un crawler que no
          simula clics. */}
      {GRUPOS_SERVICIOS.flatMap((grupo) => grupo.items).map((item) => (
        <ServicioModal
          key={item.titulo}
          item={item}
          abierto={servicioActivoTitulo === item.titulo}
          onClose={() => setServicioActivoTitulo(null)}
          onAgendar={() => {
            onAgendarArea(item.titulo)
            setServicioActivoTitulo(null)
          }}
        />
      ))}
    </section>
  )
}

// Modal centrado en vez de acordeón dentro de la tarjeta: al expandir en el
// propio grid, la fila entera se estiraba para igualar la tarjeta abierta y
// dejaba huecos vacíos junto a ella. El modal deja el grid intacto.
function ServicioModal({
  item,
  abierto,
  onClose,
  onAgendar,
}: {
  item: ServicioItem
  abierto: boolean
  onClose: () => void
  onAgendar: () => void
}) {
  useEffect(() => {
    if (!abierto) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [abierto, onClose])

  return (
    <div
      hidden={!abierto}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-hidden={!abierto}
    >
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm animate-in" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-raised)] p-7 animate-in">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-5 right-5 p-1.5 -m-1.5 rounded-md text-slate hover:text-ink hover:bg-paper-sunken transition-colors"
        >
          <X size={18} />
        </button>

        <span className="inline-flex items-center justify-center h-11 w-11 rounded-[var(--radius-field)] bg-[var(--color-accent-soft)] mb-5">
          <item.icon size={20} strokeWidth={1.75} className="text-[var(--color-accent-strong)]" />
        </span>

        <h3 className="text-xl font-semibold tracking-tight mb-3 pr-8">{item.titulo}</h3>
        <div className="space-y-3 text-sm text-slate leading-relaxed">
          <p>{item.descripcion}</p>
          <p>{item.descripcionAmplia}</p>
        </div>

        <ul className="mt-5 flex flex-col gap-2.5">
          {item.beneficios.map((beneficio) => (
            <li key={beneficio} className="flex items-start gap-2 text-sm text-ink">
              <Check size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-[var(--color-accent-strong)]" />
              {beneficio}
            </li>
          ))}
        </ul>

        <a
          href="#agenda"
          onClick={onAgendar}
          className="btn-primary btn-sm mt-6 w-full justify-center"
        >
          <CalendarDays size={15} strokeWidth={1.75} />
          Agendar consulta para esta área
        </a>
      </div>
    </div>
  )
}

function Equipo() {
  return (
    <section id="equipo" className="border-t border-line/70 bg-paper-raised">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading
          eyebrow="Equipo"
          titulo="Quiénes te acompañan"
          descripcion="Un equipo con la experiencia y disponibilidad para llevar tu caso de principio a fin, combinando trayectoria jurídica con el uso constante de tecnología propia."
        />

        <div className="mt-12">
          <FotoGrupalEquipo />
        </div>
      </div>
    </section>
  )
}

// Posición aproximada (en % del ancho/alto de la foto real) de cada
// integrante — medida sobre la imagen con una cuadrícula de referencia.
// left/width/cx/cy: zona de hover y centro del foco de color (cuerpo
// completo). boxLeft/boxWidth/boxTop/boxBottom: recuadro tipo "escáner"
// alrededor de cabeza/hombros para la tarjeta flotante.
const INTEGRANTES_FOTO = [
  {
    nombre: 'William Puello',
    cargo: 'Abogado Especialista · Socio',
    left: 0,
    width: 27,
    cx: 14,
    cy: 47,
    boxLeft: 2,
    boxWidth: 24,
    boxTop: 5,
    boxBottom: 40,
  },
  {
    nombre: 'Melissa Martinez',
    cargo: 'Economista Especialista · Socio',
    left: 19,
    width: 29,
    cx: 33,
    cy: 60,
    boxLeft: 20,
    boxWidth: 27,
    boxTop: 26,
    boxBottom: 59,
  },
  {
    nombre: 'Grety Puello',
    cargo: 'Abogada Espec. Laboral y SST · Socio',
    left: 46,
    width: 30,
    cx: 61,
    cy: 60,
    boxLeft: 48,
    boxWidth: 27,
    boxTop: 24,
    boxBottom: 59,
  },
  {
    nombre: 'Manuel Hurtado',
    cargo: 'Ingeniero de software · Socio',
    left: 74,
    width: 26,
    cx: 87,
    cy: 46,
    boxLeft: 76,
    boxWidth: 23,
    boxTop: 4,
    boxBottom: 39,
  },
]

// Marcador visual de "foto pendiente" — un cuadro ancho con borde
// punteado en vez de una foto de stock genérica que podría pasar por el
// equipo real sin serlo. Reemplazar por
// <img src="/equipo/foto-grupal.jpg" className="w-full aspect-[21/9]
// rounded-[var(--radius-card)] object-cover" /> cuando haya una foto real.
function FotoGrupalEquipo() {
  const [error, setError] = useState(false)
  const [activo, setActivo] = useState<number | null>(null)

  if (error) {
    return (
      <div
        className="w-full max-w-3xl mx-auto aspect-[4/3] rounded-[var(--radius-card)]
          border-2 border-dashed border-line bg-paper flex flex-col items-center
          justify-center gap-2 text-slate/50"
      >
        <ImagePlus size={32} strokeWidth={1.5} />
        <span className="text-xs uppercase tracking-wide">Foto grupal del equipo — pendiente</span>
      </div>
    )
  }

  const integrante = activo !== null ? INTEGRANTES_FOTO[activo] : null

  // Foco de color: la foto se muestra a color; al pasar el mouse sobre un
  // integrante se superpone una copia en blanco y negro con un "hueco"
  // (radial-gradient usado como máscara) centrado en esa persona, de modo
  // que solo ella queda a color y el resto se ve en blanco y negro.
  return (
    <div className="w-full max-w-3xl mx-auto" onClick={() => setActivo(null)}>
      <div className="relative">
        {/* Capa de imagen, recortada con bordes redondeados */}
        <div className="relative rounded-[var(--radius-card)] overflow-hidden">
          <img
            src="/equipo/foto-grupal.jpg"
            alt="Equipo de Efrata 360"
            width={1427}
            height={1102}
            loading="lazy"
            onError={() => setError(true)}
            className="w-full block select-none"
            draggable={false}
          />
          {/* Capa puramente decorativa (blanco y negro con "hueco" de color)
              — un <div> con background-image en vez de <img alt=""> para
              que checkers SEO no la cuenten como una imagen de contenido
              sin descripción ALT; es un efecto visual, no contenido. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 w-full h-full bg-cover bg-center pointer-events-none transition-opacity duration-300 ease-out"
            style={{
              backgroundImage: 'url(/equipo/foto-grupal.jpg)',
              filter: 'grayscale(1)',
              opacity: integrante ? 1 : 0,
              maskImage: integrante
                ? `radial-gradient(ellipse 28% 60% at ${integrante.cx}% ${integrante.cy}%, transparent 0%, transparent 55%, black 100%)`
                : undefined,
              WebkitMaskImage: integrante
                ? `radial-gradient(ellipse 28% 60% at ${integrante.cx}% ${integrante.cy}%, transparent 0%, transparent 55%, black 100%)`
                : undefined,
            }}
          />
        </div>

        {/* Capa de interacción (zonas de hover, HUD y tarjetas flotantes),
            sin recorte, para que las tarjetas puedan asomarse fuera del
            recuadro redondeado sin cortarse. */}
        <div className="absolute inset-0">
          {INTEGRANTES_FOTO.map((p, i) => {
            const isActivo = activo === i
            return (
              <div key={p.nombre} className="absolute inset-y-0" style={{ left: `${p.left}%`, width: `${p.width}%` }}>
                {/* Recuadro tipo "escáner" alrededor de cabeza/hombros */}
                <div
                  className="absolute transition-opacity duration-300 ease-out"
                  style={{
                    left: `${((p.boxLeft - p.left) / p.width) * 100}%`,
                    width: `${(p.boxWidth / p.width) * 100}%`,
                    top: `${p.boxTop}%`,
                    bottom: `${100 - p.boxBottom}%`,
                    opacity: isActivo ? 1 : 0,
                  }}
                >
                  {(
                    [
                      'top-0 left-0 border-t-2 border-l-2',
                      'top-0 right-0 border-t-2 border-r-2',
                      'bottom-0 left-0 border-b-2 border-l-2',
                      'bottom-0 right-0 border-b-2 border-r-2',
                    ] as const
                  ).map((pos) => (
                    <span key={pos} className={`absolute h-3.5 w-3.5 border-[var(--color-accent)] ${pos}`} />
                  ))}
                  <span className="absolute -top-1.5 -right-1.5 h-2 w-2 rounded-full bg-[var(--color-accent)] shadow-[0_0_0_3px_rgba(150,112,43,0.25)] animate-pulse" />
                </div>

                {/* Línea guía hacia la tarjeta flotante */}
                <div
                  className="absolute w-px bg-gradient-to-b from-[var(--color-accent)]/70 to-[var(--color-accent)]/0 transition-opacity duration-300 ease-out"
                  style={{
                    left: `${((p.cx - p.left) / p.width) * 100}%`,
                    top: `${p.boxBottom}%`,
                    bottom: '9%',
                    opacity: isActivo ? 1 : 0,
                  }}
                />

                {/* Zona interactiva (hover / foco / tap) */}
                <button
                  type="button"
                  aria-label={`${p.nombre} — ${p.cargo}`}
                  className="absolute inset-0 focus:outline-none"
                  onMouseEnter={() => setActivo(i)}
                  onMouseLeave={() => setActivo((cur) => (cur === i ? null : cur))}
                  onFocus={() => setActivo(i)}
                  onBlur={() => setActivo((cur) => (cur === i ? null : cur))}
                  onClick={(e) => {
                    e.stopPropagation()
                    setActivo(i)
                  }}
                />
              </div>
            )
          })}

          {/* Tarjeta flotante con la info del integrante activo */}
          {INTEGRANTES_FOTO.map((p, i) => (
            <div
              key={p.nombre}
              className="absolute bottom-[6%] w-[200px] rounded-lg border border-[var(--color-accent)]/50
                bg-[var(--color-ink)]/85 backdrop-blur-md px-4 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.4)]
                transition-all duration-300 ease-out pointer-events-none"
              style={{
                // clamp() mantiene la tarjeta centrada sobre la persona pero
                // sin salirse del contenedor en pantallas angostas (móvil).
                left: `clamp(104px, ${p.cx}%, calc(100% - 104px))`,
                opacity: activo === i ? 1 : 0,
                transform: `translate(-50%, ${activo === i ? '0' : '6px'})`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-accent)]">
                  Perfil · 0{i + 1}
                </span>
              </div>
              <p className="text-sm font-semibold text-white leading-tight">{p.nombre}</p>
              <p className="text-[11px] text-white/65 uppercase tracking-wide">{p.cargo}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-slate/60">
        Toca o pasa el mouse sobre cada integrante del equipo para conocerlo
      </p>
    </div>
  )
}

function Clientes() {
  return (
    <section id="clientes" className="border-t border-line/70 bg-paper-sunken">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-center text-xs font-semibold text-slate tracking-[0.14em] uppercase mb-10">
          Empresas y personas que han confiado en nosotros
        </p>
        <div className="flex flex-wrap justify-center items-center gap-x-16 gap-y-8">
          {CLIENTES_LOGOS.map((logo) => (
            <LogoCliente key={logo.src} src={logo.src} alt={logo.alt} width={logo.width} height={logo.height} />
          ))}
        </div>
      </div>
    </section>
  )
}

function LogoCliente({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) {
  const [error, setError] = useState(false)

  if (error) {
    return (
      <div className="w-28 h-12 rounded-md border border-dashed border-line flex items-center justify-center text-slate/40">
        <ImagePlus size={16} strokeWidth={1.5} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      onError={() => setError(true)}
      className="h-20 w-auto mx-auto object-contain grayscale opacity-70 hover:opacity-100 hover:grayscale-0 transition"
    />
  )
}

function Agenda({ notaInicial }: { notaInicial?: string }) {
  return (
    <section id="agenda" className="border-t border-line/70 bg-paper-raised">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading
          eyebrow="Agenda tu consulta"
          titulo="Reserva un horario con nosotros"
          descripcion="Elige el día y la hora que más te convengan — presencial o virtual — y confirma tu cita en línea."
        />
        <div className="mt-12">
          <AgendarConsultaPublico notaInicial={notaInicial} />
        </div>
      </div>
    </section>
  )
}

function Contacto() {
  const [datosContacto, setDatosContacto] = useState(CONTACTO_FALLBACK)
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [telefono, setTelefono] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Import dinámico, misma razón que en handleSubmit más abajo: el
    // landing no debe depender de Supabase para su primer render.
    import('../lib/configuracionContacto')
      .then(({ obtenerConfiguracionContacto }) => obtenerConfiguracionContacto())
      .then(setDatosContacto)
      .catch(() => {}) // se queda con CONTACTO_FALLBACK
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      // Import dinámico: el resto del landing no depende de Supabase para
      // renderizar (sección "página en blanco" — src/lib/supabase.ts lanza
      // un error si falta VITE_SUPABASE_URL/ANON_KEY, y con un import
      // estático eso tumbaba toda la SPA). Solo al enviar el formulario se
      // necesita el cliente, y aquí el error queda contenido en el catch.
      const { enviarContactoLanding } = await import('../lib/contactoLanding')
      await enviarContactoLanding({ nombre, correo, telefono, mensaje })
      setEnviado(true)
      setNombre('')
      setCorreo('')
      setTelefono('')
      setMensaje('')
    } catch {
      setError('No pudimos enviar tu mensaje. Intenta de nuevo o escríbenos directamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section id="contacto" className="border-t border-line/70">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading
          eyebrow="Contacto"
          titulo="Hablemos de tu caso"
          descripcion="Cuéntanos qué necesitas y te contactamos a la brevedad."
        />

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-5 gap-12">
          <div className="lg:col-span-2 space-y-6">
            <ContactoDato icon={Mail} label="Correo">
              <a href={`mailto:${datosContacto.correo}`} className="link">
                {datosContacto.correo}
              </a>
            </ContactoDato>
            <ContactoDato icon={Phone} label="Teléfono">
              <a href={`tel:${datosContacto.telefono.replace(/\s+/g, '')}`} className="link">
                {datosContacto.telefono}
              </a>
            </ContactoDato>
            <ContactoDato icon={MapPin} label="Ciudad">
              <span className="text-ink">{datosContacto.ciudad}</span>
            </ContactoDato>
          </div>

          <div className="lg:col-span-3">
            {enviado ? (
              <div className="card p-8 flex items-start gap-3 animate-in">
                <span className="flex items-center justify-center h-9 w-9 rounded-full bg-[var(--color-success-soft)] shrink-0">
                  <CheckCircle2 size={20} className="text-success" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="font-medium text-ink">Mensaje enviado</p>
                  <p className="text-sm text-slate mt-1">
                    Gracias por escribirnos. Te contactaremos pronto a {correo || 'tu correo'}.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="card p-8 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Nombre" value={nombre} onChange={setNombre} required />
                  <Field
                    label="Correo"
                    type="email"
                    value={correo}
                    onChange={setCorreo}
                    required
                  />
                </div>
                <Field
                  label="Teléfono (opcional)"
                  type="tel"
                  value={telefono}
                  onChange={setTelefono}
                />
                <label className="block">
                  <span className="block text-sm text-slate mb-1">Mensaje</span>
                  <textarea
                    value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)}
                    required
                    rows={4}
                    className="w-full field"
                  />
                </label>

                {error && <p className="text-sm text-danger">{error}</p>}

                <button type="submit" disabled={enviando} className="btn-primary">
                  {enviando ? (
                    <>
                      <Loader2 size={16} className="animate-spin" strokeWidth={1.75} />
                      Enviando…
                    </>
                  ) : (
                    'Enviar mensaje'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function ContactoDato({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-3.5">
      <span className="flex items-center justify-center h-10 w-10 rounded-[var(--radius-field)] bg-paper-sunken shrink-0">
        <Icon size={17} strokeWidth={1.75} className="text-ink" />
      </span>
      <div className="pt-1.5">
        <p className="text-xs uppercase tracking-wide text-slate mb-0.5">{label}</p>
        <p className="text-sm font-medium">{children}</p>
      </div>
    </div>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-line/70 bg-paper-sunken">
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <img
            src="/logo.jpg"
            alt="Efrata 360"
            width={600}
            height={164}
            loading="lazy"
            className="h-11 w-auto rounded-[var(--radius-field)] mb-2"
          />
          <p className="text-sm text-slate">Claridad jurídica para decisiones que importan.</p>
        </div>
        <div className="flex items-center gap-6 text-sm text-slate">
          {/* Texto distinto al de la nav del header (aunque el destino sea
              el mismo) para no repetir el mismo texto ancla en varios
              enlaces — señal que los checkers de SEO marcan como debilidad. */}
          <a href="#servicios" className="hover:text-ink transition-colors">
            Nuestros servicios
          </a>
          <a href="#contacto" className="hover:text-ink transition-colors">
            Escríbenos
          </a>
          <Link to="/login" className="hover:text-ink transition-colors">
            Acceder
          </Link>
        </div>
      </div>
      <div className="border-t border-line/70">
        <div className="mx-auto max-w-6xl px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-slate">© {new Date().getFullYear()} Efrata 360. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4 text-xs text-slate">
            <span className="text-slate/60">Compartir:</span>
            {COMPARTIR_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-ink transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

function SectionHeading({
  eyebrow,
  titulo,
  descripcion,
}: {
  eyebrow: string
  titulo: string
  descripcion: string
}) {
  return (
    <div className="max-w-2xl">
      <p className="eyebrow mb-3">{eyebrow}</p>
      <h2 className="font-serif text-3xl md:text-[2.75rem] leading-[1.1] tracking-tight">{titulo}</h2>
      <p className="mt-4 text-slate leading-relaxed">{descripcion}</p>
    </div>
  )
}

function Field({
  label,
  type = 'text',
  value,
  onChange,
  required,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="block text-sm text-slate mb-1">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full field"
      />
    </label>
  )
}

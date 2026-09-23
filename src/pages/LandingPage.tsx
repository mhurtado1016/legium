import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AgendarConsultaPublico } from '../components/AgendarConsultaPublico'
import {
  Scale,
  Building2,
  Briefcase,
  Landmark,
  Users,
  FileText,
  Mail,
  Phone,
  MapPin,
  Menu,
  X,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ImagePlus,
  Code2,
  Workflow,
  Plug,
  CalendarDays,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '#servicios', label: 'Áreas de práctica' },
  { href: '#metodologia', label: 'Cómo trabajamos' },
  { href: '#equipo', label: 'Equipo' },
  { href: '#contacto', label: 'Contacto' },
]

const GRUPOS_SERVICIOS = [
  {
    titulo: 'Legal',
    items: [
      {
        icon: Scale,
        titulo: 'Derecho Civil',
        descripcion:
          'Contratos, responsabilidad civil, propiedad y procesos declarativos o ejecutivos.',
      },
      {
        icon: Building2,
        titulo: 'Derecho Comercial y Corporativo',
        descripcion:
          'Constitución de sociedades, contratos mercantiles, gobierno corporativo y cumplimiento.',
      },
      {
        icon: Briefcase,
        titulo: 'Derecho Laboral',
        descripcion:
          'Contratación, terminaciones, procesos ante el Ministerio del Trabajo y litigios laborales.',
      },
      {
        icon: Landmark,
        titulo: 'Litigios y Arbitraje',
        descripcion: 'Representación en procesos judiciales y arbitrales, de la demanda al fallo.',
      },
      {
        icon: Users,
        titulo: 'Derecho de Familia',
        descripcion: 'Divorcios, custodia, alimentos, sucesiones y demás procesos de familia.',
      },
      {
        icon: FileText,
        titulo: 'Derecho Administrativo',
        descripcion:
          'Contratación estatal, procesos ante entidades públicas y acciones constitucionales.',
      },
    ],
  },
  {
    titulo: 'Desarrollo de software',
    items: [
      {
        icon: Code2,
        titulo: 'Desarrollo a la medida',
        descripcion:
          'Aplicaciones web y sistemas internos diseñados alrededor de los procesos reales de tu negocio.',
      },
      {
        icon: Workflow,
        titulo: 'Automatización de procesos',
        descripcion:
          'Herramientas que eliminan tareas manuales repetitivas y aceleran la operación diaria.',
      },
      {
        icon: Plug,
        titulo: 'Integraciones y APIs',
        descripcion: 'Conectamos tus sistemas, datos y plataformas para que trabajen como uno solo.',
      },
    ],
  },
]

const METODOLOGIA = [
  {
    numero: '01',
    titulo: 'Consulta inicial',
    descripcion: 'Escuchamos el caso, revisamos los documentos y definimos si hay una vía viable.',
  },
  {
    numero: '02',
    titulo: 'Análisis y estrategia',
    descripcion:
      'Investigamos jurisprudencia y precedentes aplicables, y trazamos un plan con hitos y plazos claros.',
  },
  {
    numero: '03',
    titulo: 'Ejecución',
    descripcion:
      'Llevamos el proceso con seguimiento permanente de términos judiciales y administrativos.',
  },
  {
    numero: '04',
    titulo: 'Seguimiento',
    descripcion: 'El cliente conoce en todo momento en qué va su caso, sin tener que preguntar.',
  },
]

// Logos de clientes reales en public/clientes/. Si algún archivo llegara
// a faltar (404 → onError), LogoCliente cae a una caja placeholder en vez
// de inventar una marca.
const CLIENTES_LOGOS = [
  { src: '/clientes/logo-life.jpg', alt: 'Life' },
  { src: '/clientes/logo-logistic.png', alt: 'Logistic' },
  { src: '/clientes/logo-petro.png', alt: 'Petro' },
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

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader menuAbierto={menuAbierto} setMenuAbierto={setMenuAbierto} />
      <Hero />
      <Metodologia />
      <AreasPractica />
      <Equipo />
      <Clientes />
      <Agenda />
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
          <img src="/logo.jpg" alt="Efrata 360" className="h-12 w-auto rounded-[var(--radius-field)]" />
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
            Despacho de abogados &amp; software jurídico
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
        className="absolute inset-0 h-full w-full object-cover object-left md:object-center"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-ink via-ink/10 to-transparent
          md:bg-gradient-to-r md:from-ink/85 md:via-ink/55 md:to-ink/20"
      />
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

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
          {METODOLOGIA.map((paso) => (
            <div key={paso.numero} className="relative pl-0 lg:pr-6 lg:border-r lg:border-line last:border-r-0">
              <p className="font-serif text-4xl text-accent mb-4">{paso.numero}</p>
              <h3 className="text-base font-semibold mb-2 tracking-tight">{paso.titulo}</h3>
              <p className="text-sm text-slate leading-relaxed">{paso.descripcion}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function AreasPractica() {
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
                  <div key={item.titulo} className="card card-interactive p-6">
                    <span className="inline-flex items-center justify-center h-11 w-11 rounded-[var(--radius-field)] bg-[var(--color-accent-soft)] mb-5">
                      <item.icon size={20} strokeWidth={1.75} className="text-[var(--color-accent-strong)]" />
                    </span>
                    <h4 className="text-base font-semibold mb-2 tracking-tight">{item.titulo}</h4>
                    <p className="text-sm text-slate leading-relaxed">{item.descripcion}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
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
            onError={() => setError(true)}
            className="w-full block select-none"
            draggable={false}
          />
          <img
            src="/equipo/foto-grupal.jpg"
            alt=""
            aria-hidden="true"
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-300 ease-out"
            style={{
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
            <LogoCliente key={logo.src} src={logo.src} alt={logo.alt} />
          ))}
        </div>
      </div>
    </section>
  )
}

function LogoCliente({ src, alt }: { src: string; alt: string }) {
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
      onError={() => setError(true)}
      className="h-20 w-auto mx-auto object-contain grayscale opacity-70 hover:opacity-100 hover:grayscale-0 transition"
    />
  )
}

function Agenda() {
  return (
    <section id="agenda" className="border-t border-line/70 bg-paper-raised">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading
          eyebrow="Agenda tu consulta"
          titulo="Reserva un horario con nosotros"
          descripcion="Elige el día y la hora que más te convengan — presencial o virtual — y confirma tu cita en línea."
        />
        <div className="mt-12">
          <AgendarConsultaPublico />
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
          <img src="/logo.jpg" alt="Efrata 360" className="h-11 w-auto rounded-[var(--radius-field)] mb-2" />
          <p className="text-sm text-slate">Claridad jurídica para decisiones que importan.</p>
        </div>
        <div className="flex items-center gap-6 text-sm text-slate">
          <a href="#servicios" className="hover:text-ink transition-colors">
            Áreas de práctica
          </a>
          <a href="#contacto" className="hover:text-ink transition-colors">
            Contacto
          </a>
          <Link to="/login" className="hover:text-ink transition-colors">
            Ingresar
          </Link>
        </div>
      </div>
      <div className="border-t border-line/70">
        <p className="mx-auto max-w-6xl px-6 py-4 text-xs text-slate">
          © {new Date().getFullYear()} Efrata 360. Todos los derechos reservados.
        </p>
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

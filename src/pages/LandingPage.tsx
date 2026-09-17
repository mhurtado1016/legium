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
  correo: 'contacto@legium.com',
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
          <img src="/logo.svg" alt="Legium" className="h-12 w-auto" />
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

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-10 md:pt-28 md:pb-36">
        <p className="text-sm font-medium text-paper/85 tracking-wide uppercase mb-4">
          Despacho de abogados
        </p>
        <h1 className="font-display text-4xl md:text-6xl leading-[1.1] tracking-tight max-w-3xl text-paper">
          Claridad jurídica para decisiones que importan.
        </h1>
        <p className="mt-6 text-lg text-paper/85 max-w-2xl">
          Acompañamos a personas y empresas en sus procesos legales con estrategia clara,
          cumplimiento riguroso de plazos y tecnología propia de investigación jurisprudencial.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a href="#agenda" className="btn-primary">
            Agenda una consulta
            <ArrowRight size={16} strokeWidth={1.75} />
          </a>
          <a href="#servicios" className="btn-secondary">
            Ver áreas de práctica
          </a>
        </div>
      </div>
    </section>
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
        alt="Equipo de Legium"
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

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {METODOLOGIA.map((paso) => (
            <div key={paso.numero}>
              <p className="font-display text-3xl text-seal mb-3">{paso.numero}</p>
              <h3 className="text-base font-semibold mb-2">{paso.titulo}</h3>
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

        <div className="mt-12 flex flex-col gap-12">
          {GRUPOS_SERVICIOS.map((grupo) => (
            <div key={grupo.titulo}>
              <h3 className="text-sm font-medium text-slate tracking-wide uppercase mb-5">
                {grupo.titulo}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {grupo.items.map((item) => (
                  <div key={item.titulo} className="card p-6">
                    <item.icon size={22} strokeWidth={1.75} className="text-seal mb-4" />
                    <h4 className="text-base font-semibold mb-2">{item.titulo}</h4>
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

// Marcador visual de "foto pendiente" — un cuadro ancho con borde
// punteado en vez de una foto de stock genérica que podría pasar por el
// equipo real sin serlo. Reemplazar por
// <img src="/equipo/foto-grupal.jpg" className="w-full aspect-[21/9]
// rounded-[var(--radius-card)] object-cover" /> cuando haya una foto real.
function FotoGrupalEquipo() {
  const [error, setError] = useState(false)

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

  // Sin aspect-ratio ni object-fit forzados: la foto real no es tan ancha
  // como el placeholder (antes en 21:9) y quedaba recortada. Se limita
  // solo el ancho máximo y el navegador calcula el alto según la
  // proporción real de la imagen, mostrándola completa.
  return (
    <img
      src="/equipo/foto-grupal.jpg"
      alt="Equipo de Legium"
      onError={() => setError(true)}
      className="w-full max-w-3xl mx-auto rounded-[var(--radius-card)] block"
    />
  )
}

function Clientes() {
  return (
    <section id="clientes" className="border-t border-line/70 bg-paper-raised">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-center text-sm font-medium text-slate tracking-wide uppercase mb-10">
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
    <section id="agenda" className="border-t border-line/70">
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
              <div className="card p-8 flex items-start gap-3">
                <CheckCircle2 size={22} className="text-seal shrink-0 mt-0.5" strokeWidth={1.75} />
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

                {error && <p className="text-sm text-seal">{error}</p>}

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
    <div className="flex items-start gap-3">
      <Icon size={18} strokeWidth={1.75} className="text-slate mt-0.5 shrink-0" />
      <div>
        <p className="text-xs uppercase tracking-wide text-slate mb-0.5">{label}</p>
        <p className="text-sm">{children}</p>
      </div>
    </div>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-line/70">
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <img src="/logo.svg" alt="Legium" className="h-11 w-auto mb-2" />
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
          © {new Date().getFullYear()} Legium. Todos los derechos reservados.
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
      <p className="text-sm font-medium text-seal tracking-wide uppercase mb-3">{eyebrow}</p>
      <h2 className="font-display text-3xl md:text-4xl tracking-tight">{titulo}</h2>
      <p className="mt-3 text-slate">{descripcion}</p>
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

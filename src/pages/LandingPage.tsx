import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Scale,
  Building2,
  Briefcase,
  Landmark,
  Users,
  FileText,
  Search,
  Clock3,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  Menu,
  X,
  ArrowRight,
  CheckCircle2,
  Loader2,
  BookOpen,
  Handshake,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '#servicios', label: 'Áreas de práctica' },
  { href: '#metodologia', label: 'Cómo trabajamos' },
  { href: '#equipo', label: 'Equipo' },
  { href: '#tecnologia', label: 'Tecnología' },
  { href: '#contacto', label: 'Contacto' },
]

const AREAS_PRACTICA = [
  {
    icon: Scale,
    titulo: 'Derecho Civil',
    descripcion: 'Contratos, responsabilidad civil, propiedad y procesos declarativos o ejecutivos.',
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

const TECNOLOGIA = [
  {
    icon: Search,
    titulo: 'Investigación jurisprudencial asistida por IA',
    descripcion:
      'Analizamos sentencias de las altas cortes para construir argumentos con precedentes sólidos y actualizados.',
  },
  {
    icon: Clock3,
    titulo: 'Plazos bajo control',
    descripcion:
      'Cada término judicial y administrativo queda registrado y monitoreado: nada se vence por descuido.',
  },
  {
    icon: ShieldCheck,
    titulo: 'Documentos organizados y seguros',
    descripcion:
      'Expedientes, evidencia y versiones de documentos centralizados y disponibles para el equipo del caso.',
  },
]

// TODO: reemplazar por fotografía real del despacho/equipo — no había
// ninguna disponible ni licencia para usar fotos de stock de terceros,
// así que el carrusel del hero usa fondos degradados con un ícono como
// marcador de posición en lugar de fotos genéricas que podrían pasar
// por auténticas sin serlo.
const HERO_SLIDES = [
  { icon: Landmark, from: 'from-ink', to: 'to-ink-soft' },
  { icon: Users, from: 'from-seal', to: 'to-ink' },
  { icon: BookOpen, from: 'from-ink-soft', to: 'to-slate' },
  { icon: Handshake, from: 'from-slate', to: 'to-ink' },
]

// TODO: reemplazar por los datos reales de contacto del despacho.
const CONTACTO = {
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
 * y sin contenido inventado (sin testimonios, logos de clientes ni
 * cifras que no podemos respaldar).
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
      <Tecnologia />
      <Contacto />
      <SiteFooter />
    </div>
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
        <a href="#top" className="font-display text-xl tracking-tight">
          Legium
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
          <a href="#contacto" className="btn-primary btn-sm">
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
          <a href="#contacto" onClick={() => setMenuAbierto(false)} className="btn-primary mt-2">
            Agenda una consulta
          </a>
        </nav>
      )}
    </header>
  )
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <HeroCarousel />

      {/* pointer-events-none: este div ocupa todo el ancho de la sección
          aunque el texto esté alineado a la izquierda, y sin esto tapaba
          los clics de las flechas/puntos del carrusel de fondo — se
          reactivan explícitamente en los dos enlaces del CTA. */}
      <div className="relative z-10 mx-auto max-w-6xl px-6 pt-20 pb-28 md:pt-28 md:pb-36 pointer-events-none">
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
          <a href="#contacto" className="btn-primary pointer-events-auto">
            Agenda una consulta
            <ArrowRight size={16} strokeWidth={1.75} />
          </a>
          <a href="#servicios" className="btn-secondary pointer-events-auto">
            Ver áreas de práctica
          </a>
        </div>
      </div>
    </section>
  )
}

// Carrusel de fondo del hero. Autoavanza cada 6s (en pausa con el mouse
// encima o si el visitante prefiere menos movimiento), con flechas y
// puntos para navegación manual. Las "fotos" son degradados con un
// ícono — ver el comentario en HERO_SLIDES sobre por qué no son fotos
// reales todavía.
function HeroCarousel() {
  const [indice, setIndice] = useState(0)
  const [pausado, setPausado] = useState(false)

  useEffect(() => {
    const prefiereMenosMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefiereMenosMovimiento || pausado) return
    const id = setInterval(() => setIndice((i) => (i + 1) % HERO_SLIDES.length), 6000)
    return () => clearInterval(id)
  }, [pausado])

  function anterior() {
    setIndice((i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)
  }
  function siguiente() {
    setIndice((i) => (i + 1) % HERO_SLIDES.length)
  }

  return (
    <div
      className="absolute inset-0"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      {HERO_SLIDES.map((slide, i) => (
        <div
          key={i}
          aria-hidden={i !== indice}
          className={`absolute inset-0 overflow-hidden bg-gradient-to-br ${slide.from} ${slide.to}
            transition-opacity duration-1000 ease-in-out ${i === indice ? 'opacity-100' : 'opacity-0'}`}
        >
          <slide.icon
            size={340}
            strokeWidth={0.75}
            className="absolute -right-12 -bottom-12 text-paper/10"
          />
        </div>
      ))}
      <div className="absolute inset-0 bg-ink/60" />

      {/* Flechas solo desde sm: en móvil el hero es más alto que ancho (el
          texto ocupa el centro vertical) y quedaban encima del párrafo;
          ahí los puntos de abajo bastan como control táctil. */}
      <button
        onClick={anterior}
        aria-label="Imagen anterior"
        className="hidden sm:block absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-paper/15 text-paper
          hover:bg-paper/25 transition-colors"
      >
        <ChevronLeft size={20} strokeWidth={1.75} />
      </button>
      <button
        onClick={siguiente}
        aria-label="Imagen siguiente"
        className="hidden sm:block absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-paper/15 text-paper
          hover:bg-paper/25 transition-colors"
      >
        <ChevronRight size={20} strokeWidth={1.75} />
      </button>

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
        {HERO_SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndice(i)}
            aria-label={`Ir a la imagen ${i + 1}`}
            aria-current={i === indice}
            className={`h-1.5 rounded-full transition-all ${
              i === indice ? 'w-6 bg-paper' : 'w-1.5 bg-paper/50 hover:bg-paper/80'
            }`}
          />
        ))}
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
          descripcion="Cobertura amplia con el mismo estándar de rigor en cada materia."
        />

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {AREAS_PRACTICA.map((area) => (
            <div key={area.titulo} className="card p-6">
              <area.icon size={22} strokeWidth={1.75} className="text-seal mb-4" />
              <h3 className="text-base font-semibold mb-2">{area.titulo}</h3>
              <p className="text-sm text-slate leading-relaxed">{area.descripcion}</p>
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

function Tecnologia() {
  return (
    <section id="tecnologia" className="border-t border-line/70 bg-paper-raised">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading
          eyebrow="Tecnología"
          titulo="Un despacho que usa su propia tecnología"
          descripcion="Construimos herramientas internas para llevar cada caso con más rigor — no son promesas de mercadeo, es lo que usamos todos los días."
        />

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {TECNOLOGIA.map((item) => (
            <div key={item.titulo} className="p-6 rounded-[var(--radius-card)] border border-line">
              <item.icon size={22} strokeWidth={1.75} className="text-ink mb-4" />
              <h3 className="text-base font-semibold mb-2">{item.titulo}</h3>
              <p className="text-sm text-slate leading-relaxed">{item.descripcion}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Contacto() {
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [telefono, setTelefono] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
              <a href={`mailto:${CONTACTO.correo}`} className="link">
                {CONTACTO.correo}
              </a>
            </ContactoDato>
            <ContactoDato icon={Phone} label="Teléfono">
              <a href={`tel:${CONTACTO.telefono.replace(/\s+/g, '')}`} className="link">
                {CONTACTO.telefono}
              </a>
            </ContactoDato>
            <ContactoDato icon={MapPin} label="Ciudad">
              <span className="text-ink">{CONTACTO.ciudad}</span>
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
          <p className="font-display text-lg tracking-tight">Legium</p>
          <p className="text-sm text-slate mt-1">Claridad jurídica para decisiones que importan.</p>
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

import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/AuthContext'

type Mode = 'login' | 'recuperar' | 'recuperar-enviado'

/**
 * Pantalla de login y recuperación de contraseña.
 * Ver especificación técnica, sección 13.2: un formulario centrado, sin
 * modal ni pantalla aparte para "olvidé mi contraseña" — se alterna en
 * el mismo lugar para mantener el login como una única superficie simple.
 */
export function LoginPage() {
  const { signIn, requestPasswordReset } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) setError('Correo o contraseña incorrectos.')
  }

  async function handleRecover(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    await requestPasswordReset(email)
    setSubmitting(false)
    // Mensaje genérico: no se revela si el correo existe o no (sección 3.1).
    setMode('recuperar-enviado')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-display text-ink text-center mb-8 tracking-tight">Legium</h1>

        <div className="card p-8">
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <Field label="Correo" type="email" value={email} onChange={setEmail} required />
              <Field
                label="Contraseña"
                type="password"
                value={password}
                onChange={setPassword}
                required
              />

              {error && <p className="text-sm text-seal">{error}</p>}

              <button type="submit" disabled={submitting} className="w-full btn-primary">
                {submitting ? 'Ingresando…' : 'Ingresar'}
              </button>

              <button
                type="button"
                onClick={() => setMode('recuperar')}
                className="w-full text-center link text-sm"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </form>
          )}

          {mode === 'recuperar' && (
            <form onSubmit={handleRecover} className="space-y-4">
              <p className="text-sm text-slate">
                Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
              </p>
              <Field label="Correo" type="email" value={email} onChange={setEmail} required />
              <button type="submit" disabled={submitting} className="w-full btn-primary">
                {submitting ? 'Enviando…' : 'Enviar enlace de recuperación'}
              </button>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full text-center link text-sm"
              >
                Volver a ingresar
              </button>
            </form>
          )}

          {mode === 'recuperar-enviado' && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-ink">
                Si el correo existe en Legium, se envió un enlace de recuperación.
              </p>
              <button type="button" onClick={() => setMode('login')} className="link text-sm">
                Volver a ingresar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  type,
  value,
  onChange,
  required,
}: {
  label: string
  type: string
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

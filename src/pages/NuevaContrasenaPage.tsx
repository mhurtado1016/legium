import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

/**
 * Fijar contraseña tras un enlace de recuperación o de invitación
 * (invitar-usuario). Supabase ya deja la sesión activa a partir del
 * token en la URL (ver AuthContext, `onAuthStateChange`) antes de que
 * este componente monte, así que aquí solo falta llamar
 * `auth.updateUser`.
 */
export function NuevaContrasenaPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSubmitting(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    navigate('/app', { replace: true })
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-paper px-4 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.4] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 0%, var(--color-accent-soft), transparent 55%)',
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img src="/logo.jpg" alt="Efrata 360" className="h-14 w-auto rounded-[var(--radius-field)] shadow-[var(--shadow-card)]" />
        </div>

        <div className="card shadow-[var(--shadow-raised)] p-8">
          {loading ? null : !session ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-ink">Este enlace ya no es válido o expiró.</p>
              <a href="/login" className="link text-sm">
                Volver a ingresar
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-slate">Elige una contraseña para tu cuenta.</p>
              <label className="block">
                <span className="block text-sm text-slate mb-1">Nueva contraseña</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full field"
                />
              </label>
              <label className="block">
                <span className="block text-sm text-slate mb-1">Repetir contraseña</span>
                <input
                  type="password"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  required
                  className="w-full field"
                />
              </label>

              {error && <p className="text-sm text-danger">{error}</p>}

              <button type="submit" disabled={submitting} className="w-full btn-primary">
                {submitting ? 'Guardando…' : 'Guardar contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

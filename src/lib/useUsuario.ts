import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'

export interface Usuario {
  id: string
  firma_id: string
  nombre: string | null
  es_administrador: boolean
}

// Carga la fila de `usuarios` correspondiente a la sesión activa —
// necesaria en el frontend para saber el firma_id del usuario al
// escribir en tablas aisladas por tenant (ver sección 4.7).
export function useUsuario() {
  const { session, loading: loadingSesion } = useAuth()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mientras AuthContext todavía está resolviendo la sesión (p. ej. justo
    // después de una recarga completa de página), `session` puede valer
    // `null` de forma transitoria antes del valor real. Si se tratara ese
    // `null` como "no hay sesión" ya se marcaría loading=false con
    // usuario=null, y un guard como AdminOnlyRoute podría alcanzar a leer
    // ese estado todavía-no-definitivo (loadingUsuario ya en false, pero con
    // datos viejos) antes de que este efecto vuelva a correr con la sesión
    // real, provocando una redirección a /app en cada recarga directa de
    // una ruta de administrador. Por eso se espera explícitamente a que
    // AuthContext termine de resolver antes de decidir cualquier cosa.
    if (loadingSesion) return

    if (!session) {
      setUsuario(null)
      setLoading(false)
      return
    }

    setLoading(true)
    supabase
      .from('usuarios')
      .select('id, firma_id, nombre, es_administrador')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        setUsuario(data)
        setLoading(false)
      })
  }, [session, loadingSesion])

  return { usuario, loading: loading || loadingSesion }
}

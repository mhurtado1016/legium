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
  const { session } = useAuth()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
  }, [session])

  return { usuario, loading }
}

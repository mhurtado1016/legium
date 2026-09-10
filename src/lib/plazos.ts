import { supabase } from './supabase'

export type EstadoPlazo = 'pendiente' | 'cumplido' | 'vencido'
export type CanalNotificacion = 'app' | 'email' | 'push'

export interface Plazo {
  id: string
  caso_id: string
  titulo: string
  descripcion: string | null
  fecha_vencimiento: string
  estado: EstadoPlazo
  responsable_id: string
  casos?: { titulo: string }
}

export async function listarPlazos(filtro?: { estado?: EstadoPlazo; caso_id?: string }) {
  let query = supabase
    .from('plazos')
    .select('*, casos(titulo)')
    .order('fecha_vencimiento', { ascending: true })

  if (filtro?.estado) query = query.eq('estado', filtro.estado)
  if (filtro?.caso_id) query = query.eq('caso_id', filtro.caso_id)

  const { data, error } = await query
  if (error) throw error
  return data as Plazo[]
}

export async function crearPlazo(
  plazo: Pick<Plazo, 'caso_id' | 'titulo' | 'descripcion' | 'fecha_vencimiento' | 'responsable_id'> & {
    firma_id: string
    creado_por: string
  },
  notificaciones: { canal: CanalNotificacion; dias_antes: number }[],
) {
  const { data, error } = await supabase.from('plazos').insert(plazo).select().single()
  if (error) throw error

  if (notificaciones.length > 0) {
    const { error: notifError } = await supabase.from('plazo_notificaciones').insert(
      notificaciones.map((n) => ({
        firma_id: plazo.firma_id,
        plazo_id: data.id,
        canal: n.canal,
        dias_antes: n.dias_antes,
      })),
    )
    if (notifError) throw notifError
  }

  return data as Plazo
}

export async function marcarCumplido(id: string) {
  const { error } = await supabase.from('plazos').update({ estado: 'cumplido' }).eq('id', id)
  if (error) throw error
}

// Días restantes (negativo si ya venció), para ordenar/resaltar en la UI.
export function diasRestantes(fechaVencimiento: string) {
  const ms = new Date(fechaVencimiento).getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

// Registro de suscripción push (sección 6.3, punto 4). Requiere que el
// service worker (public/sw.js) ya esté registrado y VITE_VAPID_PUBLIC_KEY
// configurada.
export async function suscribirsePush(firmaId: string, usuarioId: string) {
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!publicKey) throw new Error('VITE_VAPID_PUBLIC_KEY no configurada')

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: publicKey,
  })

  const json = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      firma_id: firmaId,
      usuario_id: usuarioId,
      endpoint: json.endpoint!,
      p256dh: json.keys!.p256dh,
      auth: json.keys!.auth,
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

// Detecta que hay una versión nueva desplegada mientras la app sigue
// abierta. Es el caso típico de una PWA instalada (sección "Agregar a
// pantalla de inicio"): como no hay barra de direcciones ni botón de
// recargar, el usuario se queda corriendo el bundle viejo en memoria
// hasta que cierra la app por completo y la vuelve a abrir.
//
// __BUILD_ID__ es el commit con el que se generó este bundle (ver
// vite.config.ts). /version.json se genera con el mismo valor en cada
// build (scripts/prerender.mjs) y se pide siempre con cache: 'no-store'
// para que el chequeo nunca lo responda una copia vieja cacheada.
declare const __BUILD_ID__: string

const INTERVALO_CHEQUEO_MS = 10 * 60 * 1000

async function hayVersionNueva(): Promise<boolean> {
  try {
    const res = await fetch('/version.json', { cache: 'no-store' })
    if (!res.ok) return false
    const { buildId } = (await res.json()) as { buildId?: string }
    return Boolean(buildId) && buildId !== __BUILD_ID__
  } catch {
    // sin conexión u otro error de red: se reintenta en el próximo chequeo
    return false
  }
}

/**
 * Empieza a chequear si hay una versión nueva: al volver a primer plano
 * (abrir la PWA desde el fondo) y cada INTERVALO_CHEQUEO_MS mientras está
 * visible. Llama a `onNuevaVersionDisponible` la primera vez que detecta
 * una distinta — el llamador decide cómo avisarle al usuario. Devuelve
 * una función para dejar de chequear.
 */
export function iniciarDeteccionDeActualizacion(onNuevaVersionDisponible: () => void) {
  let avisado = false

  async function verificar() {
    if (avisado) return
    if (await hayVersionNueva()) {
      avisado = true
      onNuevaVersionDisponible()
    }
  }

  function alCambiarVisibilidad() {
    if (document.visibilityState === 'visible') verificar()
  }

  document.addEventListener('visibilitychange', alCambiarVisibilidad)
  const intervalo = setInterval(() => {
    if (document.visibilityState === 'visible') verificar()
  }, INTERVALO_CHEQUEO_MS)

  verificar()

  return () => {
    document.removeEventListener('visibilitychange', alCambiarVisibilidad)
    clearInterval(intervalo)
  }
}

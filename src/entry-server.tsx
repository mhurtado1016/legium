import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import { LandingPage } from './pages/LandingPage'

// Entry-point separado para el build SSR (ver scripts/prerender.mjs):
// renderiza solo LandingPage — sin AuthProvider ni el resto de rutas del
// panel interno — para producir el HTML estático que reemplaza el
// <div id="root"></div> vacío de dist/index.html. El cliente sigue
// montando la SPA completa vía createRoot (sin hidratación) al cargar
// el bundle, así que este HTML es solo para crawlers/primer pintado,
// no necesita coincidir nodo a nodo con el árbol de <App />.
export function render(url: string) {
  return renderToString(
    <StaticRouter location={url}>
      <LandingPage />
    </StaticRouter>,
  )
}

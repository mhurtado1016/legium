// Post-build: inyecta el HTML estático de LandingPage (generado por el
// build SSR en dist-ssr/, ver "build" en package.json) dentro del
// <div id="root"></div> vacío de dist/index.html. Así un crawler que no
// ejecuta JS (o el primer pintado de un visitante real) recibe el
// contenido real del landing en vez de un shell vacío — el bundle
// cliente sigue montando la SPA normalmente encima al cargar.
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const indexPath = join(root, 'dist/index.html')
const ssrEntryPath = join(root, 'dist-ssr/entry-server.js')

// Mismo buildId que vite.config.ts embebió en el bundle cliente
// (__BUILD_ID__, a partir del commit actual) — src/lib/actualizarApp.ts
// lo compara contra este archivo, pedido siempre sin caché, para avisar
// cuando hay una versión más nueva que la que sigue corriendo en una
// PWA instalada que no se ha recargado.
function obtenerBuildId() {
  try {
    return execSync('git rev-parse HEAD').toString().trim()
  } catch {
    return String(Date.now())
  }
}
writeFileSync(join(root, 'dist/version.json'), JSON.stringify({ buildId: obtenerBuildId() }))

const { render } = await import(`file://${ssrEntryPath}`)
const appHtml = render('/')

const html = readFileSync(indexPath, 'utf-8')
if (!html.includes('<div id="root"></div>')) {
  throw new Error('No se encontró <div id="root"></div> en dist/index.html — revisa si cambió el shell del build.')
}
writeFileSync(indexPath, html.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`))

rmSync(join(root, 'dist-ssr'), { recursive: true, force: true })

console.log('Prerender OK: dist/index.html ahora incluye el HTML estático del landing.')

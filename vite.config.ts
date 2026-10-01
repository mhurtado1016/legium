import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Identificador de build (commit actual) embebido en el bundle para que
// el cliente pueda detectar una versión nueva comparándolo contra
// /version.json (generado con el mismo valor en scripts/prerender.mjs,
// ver src/lib/actualizarApp.ts). Sin esto, una PWA instalada que nunca
// se recarga manualmente se queda en el bundle viejo hasta que el
// usuario cierra y vuelve a abrir la app.
function obtenerBuildId() {
  try {
    return execSync('git rev-parse HEAD').toString().trim()
  } catch {
    return String(Date.now())
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_ID__: JSON.stringify(obtenerBuildId()),
  },
})

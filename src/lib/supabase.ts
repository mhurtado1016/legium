import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // No lanzamos: App.tsx importa todas las páginas de forma estática (no
  // hay code-splitting por ruta), así que este módulo se evalúa siempre
  // al cargar el bundle — un throw aquí tumbaba TODA la SPA en blanco,
  // incluido el landing público en "/" (LandingPage), que no depende de
  // Supabase para renderizar. Con un placeholder, el cliente se crea sin
  // error; cualquier llamada real (login, buscador, etc.) simplemente
  // fallará más adelante con un error de red, ya manejado por cada
  // pantalla como cualquier otro error de Supabase.
  console.error(
    'Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env y complétalas.'
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
)

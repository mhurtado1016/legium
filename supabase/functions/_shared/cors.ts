// Headers CORS compartidos por las Edge Functions invocadas desde el
// navegador (supabase.functions.invoke). Sin esto, el navegador bloquea
// la respuesta por ser un origen distinto al de la app (Vercel vs.
// Supabase), y la llamada falla con un error genérico de red.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

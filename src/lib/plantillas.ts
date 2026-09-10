import { supabase } from './supabase'

export interface VariableDef {
  clave: string
  fuente?: string
  manual?: boolean
}

export interface Plantilla {
  id: string
  nombre: string
  descripcion: string | null
  categoria_id: string
  variables: VariableDef[]
}

export async function listarPlantillas() {
  const { data, error } = await supabase.from('plantillas').select('*').order('nombre')
  if (error) throw error
  return data as Plantilla[]
}

// Invoca la Edge Function que resuelve variables (automáticas + manuales)
// y genera el documento final vinculado al caso (sección 8.3).
export async function generarDocumentoDesdePlantilla(
  plantillaId: string,
  casoId: string,
  variablesManuales: Record<string, string>,
) {
  const { data, error } = await supabase.functions.invoke('generar-documento-plantilla', {
    body: { plantilla_id: plantillaId, caso_id: casoId, variables_manuales: variablesManuales },
  })
  if (error) throw error
  return data as { ok: boolean; documento_id: string }
}

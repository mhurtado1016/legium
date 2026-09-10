// Edge Function: generar-cuenta-cobro
// Ver especificación técnica, sección 9.3 y 9.4. Sin integración DIAN:
// es una cuenta de cobro interna, no una factura electrónica.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1'
// Headers CORS: sin esto, el navegador bloquea la respuesta por venir
// de un origen distinto al de la app (Vercel vs. Supabase).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Body {
  caso_id: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const { caso_id }: Body = await req.json()

    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) throw new Error('No autenticado')

    const { data: caso, error: casoError } = await admin
      .from('casos')
      .select('*, clientes(*)')
      .eq('id', caso_id)
      .single()
    if (casoError || !caso) throw new Error('Caso no encontrado')

    const { data: config } = await admin
      .from('configuracion_tenant')
      .select('*')
      .eq('firma_id', caso.firma_id)
      .single()

    // 1. Armar las líneas de la cuenta de cobro.
    type Item = { descripcion: string; cantidad: number; valor_unitario: number; valor_total: number; registro_tiempo_id?: string }
    const items: Item[] = []

    const { data: honorarioFijo } = await admin
      .from('honorarios_fijos')
      .select('*')
      .eq('caso_id', caso_id)
      .maybeSingle()

    if (honorarioFijo) {
      items.push({
        descripcion: honorarioFijo.descripcion || `Honorarios — ${caso.titulo}`,
        cantidad: 1,
        valor_unitario: honorarioFijo.monto_acordado,
        valor_total: honorarioFijo.monto_acordado,
      })
    } else {
      const { data: registros } = await admin
        .from('registros_tiempo')
        .select('*')
        .eq('caso_id', caso_id)
        .eq('facturado', false)
      if (!registros || registros.length === 0) {
        throw new Error('No hay horas pendientes de facturar ni honorario fijo definido para este caso.')
      }

      for (const r of registros) {
        const { data: tarifa } = await admin
          .from('tarifas_hora')
          .select('valor_hora')
          .or(`caso_id.eq.${caso_id},usuario_id.eq.${r.usuario_id},and(caso_id.is.null,usuario_id.is.null)`)
          .order('caso_id', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle()
        const valorHora = tarifa?.valor_hora ?? 0

        items.push({
          descripcion: r.descripcion || `Horas trabajadas — ${r.fecha}`,
          cantidad: r.horas,
          valor_unitario: valorHora,
          valor_total: r.horas * valorHora,
          registro_tiempo_id: r.id,
        })
      }
    }

    const total = items.reduce((sum, i) => sum + i.valor_total, 0)

    // 2. Numeración consecutiva atómica del tenant (sección 9.4).
    const { data: numero, error: numeroError } = await admin.rpc('fn_siguiente_numero_cobro', {
      p_firma_id: caso.firma_id,
    })
    if (numeroError) throw numeroError

    // 3. Crear la cuenta de cobro y sus líneas.
    const { data: cuenta, error: cuentaError } = await admin
      .from('cuentas_cobro')
      .insert({
        firma_id: caso.firma_id,
        caso_id,
        cliente_id: caso.cliente_id,
        numero,
        subtotal: total,
        total,
        creado_por: userData.user.id,
      })
      .select()
      .single()
    if (cuentaError) throw cuentaError

    await admin.from('cuenta_cobro_items').insert(
      items.map((i) => ({ ...i, firma_id: caso.firma_id, cuenta_cobro_id: cuenta.id })),
    )

    // Marcar como facturadas las horas usadas.
    const idsRegistros = items.map((i) => i.registro_tiempo_id).filter(Boolean)
    if (idsRegistros.length > 0) {
      await admin.from('registros_tiempo').update({ facturado: true }).in('id', idsRegistros)
    }

    // 4. Generar el PDF (pdf-lib), con membrete del tenant y aviso de que
    //    no es factura electrónica (sección 9.4).
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595, 842]) // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    let y = 800

    page.drawText(config?.nombre_facturacion || 'Legium', { x: 50, y, size: 16, font: fontBold })
    y -= 18
    if (config?.identificacion_fiscal) {
      page.drawText(`NIT/ID: ${config.identificacion_fiscal}`, { x: 50, y, size: 10, font })
      y -= 14
    }
    if (config?.direccion_facturacion) {
      page.drawText(config.direccion_facturacion, { x: 50, y, size: 10, font })
      y -= 14
    }

    y -= 20
    page.drawText(`Cuenta de cobro ${numero}`, { x: 50, y, size: 13, font: fontBold })
    y -= 16
    page.drawText(`Fecha de emisión: ${cuenta.fecha_emision}`, { x: 50, y, size: 10, font })
    y -= 14
    page.drawText(`Cliente: ${caso.clientes?.nombre ?? ''}`, { x: 50, y, size: 10, font })
    y -= 14
    page.drawText(`Caso: ${caso.titulo}`, { x: 50, y, size: 10, font })

    y -= 30
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) })
    y -= 18
    page.drawText('Descripción', { x: 50, y, size: 10, font: fontBold })
    page.drawText('Cant.', { x: 350, y, size: 10, font: fontBold })
    page.drawText('Valor', { x: 480, y, size: 10, font: fontBold })
    y -= 14
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) })

    for (const item of items) {
      y -= 18
      page.drawText(item.descripcion.slice(0, 55), { x: 50, y, size: 9, font })
      page.drawText(String(item.cantidad), { x: 350, y, size: 9, font })
      page.drawText(`$${item.valor_total.toLocaleString('es-CO')}`, { x: 480, y, size: 9, font })
    }

    y -= 24
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) })
    y -= 18
    page.drawText('Total', { x: 400, y, size: 11, font: fontBold })
    page.drawText(`$${total.toLocaleString('es-CO')}`, { x: 480, y, size: 11, font: fontBold })

    page.drawText(
      'Documento interno de cobro de honorarios. No constituye factura electrónica.',
      { x: 50, y: 40, size: 8, font, color: rgb(0.4, 0.4, 0.4) },
    )

    const pdfBytes = await pdfDoc.save()
    const storagePath = `${caso.firma_id}/${cuenta.id}.pdf`
    await admin.storage.from('facturas').upload(storagePath, pdfBytes, { contentType: 'application/pdf' })
    await admin.from('cuentas_cobro').update({ storage_path: storagePath }).eq('id', cuenta.id)

    return new Response(JSON.stringify({ ok: true, cuenta_cobro_id: cuenta.id, numero, total }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})

import { useEffect, useState } from 'react'
import { Bot, Plus } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { AsistenteDocumentosIA } from '../components/AsistenteDocumentosIA'
import { SkeletonTableRows } from '../components/Skeleton'
import { listarConversaciones, type ConversacionIA } from '../lib/documentosIA'

/**
 * Redacción de documentos jurídicos con IA, sin partir de un caso
 * específico (para eso está el botón flotante dentro del detalle de un
 * caso). También sirve para retomar cualquier conversación anterior,
 * tenga o no un caso asociado.
 */
export function DocumentosIAPage() {
  const [conversaciones, setConversaciones] = useState<ConversacionIA[]>([])
  const [cargando, setCargando] = useState(true)
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [conversacionAAbrir, setConversacionAAbrir] = useState<string | undefined>(undefined)

  async function cargar() {
    setCargando(true)
    try {
      setConversaciones(await listarConversaciones())
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  function abrirNueva() {
    setConversacionAAbrir(undefined)
    setPanelAbierto(true)
  }

  function abrirExistente(id: string) {
    setConversacionAAbrir(id)
    setPanelAbierto(true)
  }

  function cerrarPanel() {
    setPanelAbierto(false)
    cargar()
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <AppHeader />
      <main className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Documentos IA</h1>
            <p className="text-sm text-slate mt-1">
              Conversa con Mañecito, tu asistente de IA, para redactar o responder tutelas, demandas y otros
              escritos jurídicos.
            </p>
          </div>
          <button type="button" onClick={abrirNueva} className="btn-primary btn-sm">
            <Plus size={14} strokeWidth={1.75} />
            Nueva conversación
          </button>
        </div>

        <div className="card overflow-hidden">
          <table className="table-modern">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Tipo</th>
                <th>Caso</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <SkeletonTableRows columns={5} />
              ) : (
                <>
                  {conversaciones.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium text-ink">{c.titulo}</td>
                      <td className="text-slate">{c.tipos_documento_legal?.nombre ?? '—'}</td>
                      <td className="text-slate">{c.casos?.titulo ?? '—'}</td>
                      <td className="text-slate">{c.estado === 'con_borrador' ? 'Con borrador' : 'En curso'}</td>
                      <td className="text-right">
                        <button onClick={() => abrirExistente(c.id)} className="link">
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                  {conversaciones.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-slate py-6">
                        <Bot size={18} strokeWidth={1.75} className="inline-block mb-1" />
                        <br />
                        Sin conversaciones todavía.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {panelAbierto && <AsistenteDocumentosIA conversacionInicialId={conversacionAAbrir} onClose={cerrarPanel} />}
    </div>
  )
}

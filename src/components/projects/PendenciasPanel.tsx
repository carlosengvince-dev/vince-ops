import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useProjectPendencias } from '../../hooks/useProjectPendencias'
import { logActivity } from '../../lib/activityLog'
import { hasPermissao } from '../../lib/constants'
import { createPendencia, updatePendencia, updatePendenciaStatus } from '../../lib/pendencias'
import type { Disciplina, Fase, Papel, PendenciaExterna, Tarefa } from '../../types'
import { mapPendenciaOrgaoToOrigem, type RevisaoPrefill } from '../../lib/revisoes'
import { Button } from '../ui/Button'
import {
  PendenciaFormModal,
  pendenciaToFormData,
  type PendenciaFormData,
} from './PendenciaFormModal'
import { PendenciaCard } from './PendenciaCard'
import './PendenciasPanel.css'

interface PendenciasPanelProps {
  projetoId: string
  nome: string
  clienteNome: string | null
  disciplinas: Disciplina[]
  papel: Papel
  usuarioId: string
  usuarioNome: string
  tarefas: Tarefa[]
  enabled: boolean
  refreshToken?: number
  expandedPendenciaId: string | null
  onExpandedPendenciaChange: (id: string | null) => void
  onActivityLogged?: () => void
  onGerarRevisao?: (prefill: RevisaoPrefill) => void
  onNavigateToTask?: (disciplina: Disciplina, fase: Fase) => void
}

export function PendenciasPanel({
  projetoId,
  nome,
  clienteNome,
  disciplinas,
  papel,
  usuarioId,
  usuarioNome,
  tarefas,
  enabled,
  refreshToken = 0,
  expandedPendenciaId,
  onExpandedPendenciaChange,
  onActivityLogged,
  onGerarRevisao,
  onNavigateToTask,
}: PendenciasPanelProps) {
  const canManage = hasPermissao(papel, 'editar_projeto')
  const { items, loading, error, refresh, patchItem, prependItem } = useProjectPendencias(
    projetoId,
    enabled,
  )

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingPendencia, setEditingPendencia] = useState<PendenciaExterna | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const activeExpandedId =
    expandedPendenciaId && items.some((p) => p.id === expandedPendenciaId)
      ? expandedPendenciaId
      : null

  useEffect(() => {
    if (!enabled) return
    void refresh()
  }, [enabled, refresh, refreshToken])

  function openCreate() {
    setFormMode('create')
    setEditingPendencia(null)
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(pendencia: PendenciaExterna) {
    setFormMode('edit')
    setEditingPendencia(pendencia)
    setFormError(null)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingPendencia(null)
    setFormError(null)
  }

  async function handleSubmit(form: PendenciaFormData) {
    setSaving(true)
    setFormError(null)
    try {
      if (formMode === 'create') {
        const created = await createPendencia({
          projetoId,
          orgao: form.orgao,
          tipo: form.tipo,
          descricao: form.descricao,
          prazo: form.prazo || null,
          dataRecebimento: form.dataRecebimento || null,
          tarefasVinculadas: form.tarefasVinculadas,
          criadoPor: usuarioId,
        })

        prependItem(created)
        closeForm()

        void logActivity({
          projetoId,
          usuarioId,
          tipo: 'pendencia_criada',
          descricao: `${usuarioNome} registrou pendência ${form.tipo} — ${form.orgao}`,
          metadata: {
            pendencia_id: created.id,
            orgao: form.orgao,
            tipo: form.tipo,
          },
        })
        onActivityLogged?.()
      } else if (editingPendencia) {
        const updated = await updatePendencia(editingPendencia.id, {
          orgao: form.orgao,
          tipo: form.tipo,
          descricao: form.descricao,
          prazo: form.prazo || null,
          dataRecebimento: form.dataRecebimento || null,
          tarefasVinculadas: form.tarefasVinculadas,
        })
        patchItem(editingPendencia.id, updated)
        closeForm()
        onActivityLogged?.()
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar pendência')
    } finally {
      setSaving(false)
    }
  }

  async function handleMarkResponded(id: string) {
    setActionId(id)
    try {
      await updatePendenciaStatus(id, 'respondida')
      patchItem(id, { status: 'respondida' })
    } finally {
      setActionId(null)
    }
  }

  async function handleCancel(id: string) {
    setActionId(id)
    try {
      await updatePendenciaStatus(id, 'cancelada')
      patchItem(id, { status: 'cancelada' })
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="pendencias-panel">
      <header className="pendencias-panel__header">
        <div>
          <h1 className="pendencias-panel__title">{nome}</h1>
          <p className="pendencias-panel__subtitle">{clienteNome ?? 'Sem cliente'} · Pendências</p>
        </div>
        {canManage ? (
          <Button variant="primary" onClick={openCreate}>
            <Plus size={16} aria-hidden />
            Nova pendência
          </Button>
        ) : null}
      </header>

      <div className="pendencias-panel__body">
        {error ? (
          <p className="pendencias-panel__error" role="alert">
            {error}
          </p>
        ) : null}

        {loading && items.length === 0 ? (
          <p className="pendencias-panel__status">Carregando pendências…</p>
        ) : items.length === 0 ? (
          <p className="pendencias-panel__status">Nenhuma pendência registrada.</p>
        ) : (
          <ul className="pendencias-panel__list">
            {items.map((p) => (
              <li key={p.id}>
                <PendenciaCard
                  pendencia={p}
                  tarefas={tarefas}
                  canManage={canManage}
                  expanded={activeExpandedId === p.id}
                  actionLoading={actionId === p.id}
                  onToggle={() =>
                    onExpandedPendenciaChange(activeExpandedId === p.id ? null : p.id)
                  }
                  onMarkResponded={(id) => void handleMarkResponded(id)}
                  onCancel={(id) => void handleCancel(id)}
                  onEdit={openEdit}
                  onNavigateToTask={onNavigateToTask}
                  onGerarRevisao={(pend) => {
                    if (!onGerarRevisao) return
                    const disc =
                      disciplinas.find((d) => d === 'PPCI' || d === 'HID') ?? disciplinas[0]
                    onGerarRevisao({
                      pendenciaId: pend.id,
                      origem: mapPendenciaOrgaoToOrigem(pend.orgao),
                      descricao: pend.descricao,
                      disciplina: disc,
                    })
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <PendenciaFormModal
        open={formOpen}
        mode={formMode}
        loading={saving}
        error={formError}
        tarefas={tarefas}
        storageKey={`modal_pendencia_${projetoId}`}
        initial={editingPendencia ? pendenciaToFormData(editingPendencia) : undefined}
        onClose={closeForm}
        onSubmit={(data) => void handleSubmit(data)}
      />
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useFasesConfig } from '../../contexts/FasesConfigContext'
import { useToast } from '../../hooks/useToast'
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard'
import {
  deleteFaseConfigRpc,
  fetchAllFasesConfig,
  setFaseProjetosAtivosRpc,
  slugifyFaseCodigo,
  upsertFaseConfigRpc,
  type FaseConfig,
} from '../../lib/faseConfig'
import { formatDisciplinaRpcError } from '../../lib/disciplinaConfig'
import {
  countFasesConfigDirty,
  isFaseConfigRowDirty,
} from '../../lib/settingsDirtyUtils'
import { getActiveDisciplinaCodigos } from '../../lib/disciplinaConfig'
import type { Disciplina } from '../../types'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { DisciplinaTabs } from '../ui/DisciplinaTabs'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { SettingsSaveBar } from './SettingsSaveBar'
import { UnsavedSettingsModal } from './UnsavedSettingsModal'
import { RestoreScopeAction } from './RestoreScopeAction'
import './FasesSection.css'
import './SettingsSubsection.css'
import './SettingsSaveBar.css'

type NovaFaseEscopo = 'todos' | 'novos'

function cloneFases(rows: FaseConfig[]): FaseConfig[] {
  return rows.map((f) => ({ ...f }))
}

function reorderFases(rows: FaseConfig[], disciplina: Disciplina, from: number, to: number): FaseConfig[] {
  const discRows = rows
    .filter((f) => f.disciplina === disciplina)
    .sort((a, b) => a.ordem - b.ordem)
  if (to < 0 || to >= discRows.length || from === to) return rows

  const moved = [...discRows]
  const [item] = moved.splice(from, 1)
  moved.splice(to, 0, item)

  const ordemMap = new Map(moved.map((f, idx) => [f.id, idx]))
  return rows.map((f) =>
    f.disciplina === disciplina && ordemMap.has(f.id)
      ? { ...f, ordem: ordemMap.get(f.id)! }
      : f,
  )
}

function FaseRow({
  fase,
  index,
  total,
  baseline,
  onLabelChange,
  onMove,
  onToggleAtivo,
  onDelete,
}: {
  fase: FaseConfig
  index: number
  total: number
  baseline: FaseConfig | undefined
  onLabelChange: (id: string, label: string) => void
  onMove: (id: string, direction: 'up' | 'down') => void
  onToggleAtivo: (id: string, ativo: boolean) => void
  onDelete: (fase: FaseConfig) => void
}) {
  const dirty = isFaseConfigRowDirty(fase, baseline)

  return (
    <li
      className={[
        'fases-section__row',
        dirty ? 'fases-section__row--dirty' : '',
        !fase.ativo ? 'fases-section__row--inactive' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="fases-section__order">
        <button
          type="button"
          className="fases-section__order-btn"
          aria-label="Mover para cima"
          disabled={index === 0}
          onClick={() => onMove(fase.id, 'up')}
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          className="fases-section__order-btn"
          aria-label="Mover para baixo"
          disabled={index >= total - 1}
          onClick={() => onMove(fase.id, 'down')}
        >
          <ChevronDown size={14} />
        </button>
      </div>

      <Input
        label="Nome da fase"
        value={fase.label}
        className={`fases-section__label-input${dirty ? ' ui-input--dirty' : ''}`}
        onChange={(e) => onLabelChange(fase.id, e.target.value)}
      />

      <div className="fases-section__meta">
        <button
          type="button"
          className="fases-section__delete"
          aria-label={`Excluir ${fase.label}`}
          onClick={() => onDelete(fase)}
        >
          <Trash2 size={15} />
        </button>

        <label className="fases-section__toggle">
          <input
            type="checkbox"
            checked={fase.ativo}
            onChange={(e) => onToggleAtivo(fase.id, e.target.checked)}
          />
          Ativa
        </label>
      </div>
    </li>
  )
}

export function FasesSection() {
  const { showToast } = useToast()
  const { refresh: refreshContext } = useFasesConfig()
  const [disciplina, setDisciplina] = useState<Disciplina>(
    () => getActiveDisciplinaCodigos()[0] ?? 'HID',
  )
  const [fases, setFases] = useState<FaseConfig[]>([])
  const [baseline, setBaseline] = useState<FaseConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [baselineReady, setBaselineReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [newNome, setNewNome] = useState('')
  const [newPosicaoAposId, setNewPosicaoAposId] = useState<string>('')
  const [newEscopo, setNewEscopo] = useState<NovaFaseEscopo>('todos')
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<FaseConfig | null>(null)
  const [deleting, setDeleting] = useState(false)

  const dirtyCount = useMemo(() => {
    if (!baselineReady) return 0
    return countFasesConfigDirty(baseline, fases)
  }, [baseline, baselineReady, fases])
  const isDirty = dirtyCount > 0

  const load = useCallback(async () => {
    setLoading(true)
    setBaselineReady(false)
    setError(null)
    try {
      const rows = await fetchAllFasesConfig({ includeInactive: true })
      setFases(cloneFases(rows))
      setBaseline(cloneFases(rows))
      setBaselineReady(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar fases')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const fasesDisciplina = useMemo(
    () =>
      fases
        .filter((f) => f.disciplina === disciplina)
        .sort((a, b) => a.ordem - b.ordem),
    [disciplina, fases],
  )

  const baselineById = useMemo(() => new Map(baseline.map((f) => [f.id, f])), [baseline])

  const discardChanges = useCallback(() => {
    setFases(cloneFases(baseline))
  }, [baseline])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const changed = fases.filter((f) => isFaseConfigRowDirty(f, baselineById.get(f.id)))
      await Promise.all(
        changed.map((f) =>
          upsertFaseConfigRpc({
            p_id: f.id,
            p_disciplina: f.disciplina,
            p_codigo: f.codigo,
            p_label: f.label.trim(),
            p_ordem: f.ordem,
            p_ativo: f.ativo,
          }),
        ),
      )
      const rows = await fetchAllFasesConfig({ includeInactive: true })
      setFases(cloneFases(rows))
      setBaseline(cloneFases(rows))
      await refreshContext()
      showToast('Fases salvas com sucesso')
    } catch (e) {
      const message = formatDisciplinaRpcError(e instanceof Error ? e.message : 'Erro ao salvar fases')
      setError(message)
      showToast(message, 'error')
      throw e
    } finally {
      setSaving(false)
    }
  }, [baselineById, fases, refreshContext, showToast])

  const guard = useUnsavedChangesGuard({
    isDirty,
    enabled: baselineReady,
    onSave: handleSave,
    onDiscard: discardChanges,
    message: 'Você tem alterações não salvas nas fases. Deseja salvar antes de sair?',
  })

  function handleLabelChange(id: string, label: string) {
    setFases((prev) => prev.map((f) => (f.id === id ? { ...f, label } : f)))
  }

  function handleToggleAtivo(id: string, ativo: boolean) {
    setFases((prev) => prev.map((f) => (f.id === id ? { ...f, ativo } : f)))
  }

  function handleMove(id: string, direction: 'up' | 'down') {
    const index = fasesDisciplina.findIndex((f) => f.id === id)
    if (index < 0) return
    const nextIndex = direction === 'up' ? index - 1 : index + 1
    setFases((prev) => reorderFases(prev, disciplina, index, nextIndex))
  }

  function handleDisciplinaChange(next: Disciplina) {
    guard.confirmIfDirty(() => setDisciplina(next))
  }

  function openNewModal() {
    const last = fasesDisciplina[fasesDisciplina.length - 1]
    setNewNome('')
    setNewPosicaoAposId(last?.id ?? '')
    setNewEscopo('todos')
    setNewModalOpen(true)
  }

  async function handleCreateFase() {
    const nome = newNome.trim()
    if (!nome) {
      showToast('Informe o nome da fase', 'error')
      return
    }

    const codigo = slugifyFaseCodigo(nome)
    if (!codigo) {
      showToast('Nome inválido para gerar código da fase', 'error')
      return
    }

    const afterIndex = fasesDisciplina.findIndex((f) => f.id === newPosicaoAposId)
    const ordem = afterIndex >= 0 ? fasesDisciplina[afterIndex].ordem + 1 : 0

    setCreating(true)
    setError(null)
    try {
      const newId = await upsertFaseConfigRpc({
        p_id: null,
        p_disciplina: disciplina,
        p_codigo: codigo,
        p_label: nome,
        p_ordem: ordem,
        p_ativo: true,
      })

      if (newEscopo === 'novos') {
        await setFaseProjetosAtivosRpc(newId, false)
      }

      const rows = await fetchAllFasesConfig({ includeInactive: true })
      setFases(cloneFases(rows))
      setBaseline(cloneFases(rows))
      await refreshContext()
      setNewModalOpen(false)
      showToast('Fase criada com sucesso')
    } catch (e) {
      const message = formatDisciplinaRpcError(e instanceof Error ? e.message : 'Erro ao criar fase')
      setError(message)
      showToast(message, 'error')
    } finally {
      setCreating(false)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setError(null)
    try {
      await deleteFaseConfigRpc(deleteTarget.id)
      const rows = await fetchAllFasesConfig({ includeInactive: true })
      setFases(cloneFases(rows))
      setBaseline(cloneFases(rows))
      await refreshContext()
      setDeleteTarget(null)
      showToast('Fase excluída')
    } catch (e) {
      const message = formatDisciplinaRpcError(e instanceof Error ? e.message : 'Erro ao excluir fase')
      setError(message)
      showToast(message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const orderDirtyForDisciplina = useMemo(() => {
    const baseDisc = baseline
      .filter((f) => f.disciplina === disciplina)
      .sort((a, b) => a.ordem - b.ordem)
      .map((f) => f.id)
    const draftDisc = fasesDisciplina.map((f) => f.id)
    return JSON.stringify(baseDisc) !== JSON.stringify(draftDisc)
  }, [baseline, disciplina, fasesDisciplina])

  return (
    <section
      className={`settings-subsection${isDirty ? ' settings-subsection--with-save-bar' : ''}`}
    >
      <header className="settings-subsection__head">
        <div>
          <h2 className="settings-subsection__title">Fases e sequências</h2>
          <p className="settings-subsection__hint">
            Defina a ordem e os nomes exibidos das fases por disciplina. Projetos existentes
            continuam usando os códigos internos já gravados.
          </p>
        </div>
        <RestoreScopeAction escopo="fases" onRestored={load} onRefreshContext={refreshContext} />
      </header>

      <DisciplinaTabs value={disciplina} onChange={handleDisciplinaChange} />

      {error ? <p className="settings-subsection__error">{error}</p> : null}
      {loading || !baselineReady ? (
        <p className="settings-subsection__status">Carregando…</p>
      ) : null}

      {baselineReady && !loading ? (
        <>
          <ul
            className={`fases-section__list${orderDirtyForDisciplina ? ' fases-section__list--dirty' : ''}`}
          >
            {fasesDisciplina.map((fase, index) => (
              <FaseRow
                key={fase.id}
                fase={fase}
                index={index}
                total={fasesDisciplina.length}
                baseline={baselineById.get(fase.id)}
                onLabelChange={handleLabelChange}
                onMove={handleMove}
                onToggleAtivo={handleToggleAtivo}
                onDelete={setDeleteTarget}
              />
            ))}
          </ul>

          <div className="fases-section__footer">
            <Button type="button" variant="secondary" onClick={openNewModal}>
              <Plus size={16} />
              Nova fase
            </Button>
          </div>
        </>
      ) : null}

      <SettingsSaveBar
        dirtyCount={dirtyCount}
        saving={saving}
        onSave={() => void handleSave()}
        hint="Alterações nas fases ainda não foram salvas."
      />

      <UnsavedSettingsModal
        open={guard.modalOpen}
        message={guard.message}
        saving={guard.saving || saving}
        onSaveAndLeave={() => void guard.handleSaveAndLeave()}
        onDiscard={guard.handleDiscard}
        onCancel={guard.handleCancel}
      />

      <Modal
        open={newModalOpen}
        title="Nova fase"
        onClose={() => {
          if (!creating) setNewModalOpen(false)
        }}
      >
        <div className="fases-section__new-form">
          <Input
            label="Nome da fase"
            value={newNome}
            onChange={(e) => setNewNome(e.target.value)}
            placeholder="Ex.: Vistoria técnica"
          />

          <label>
            Posição
            <select
              value={newPosicaoAposId}
              onChange={(e) => setNewPosicaoAposId(e.target.value)}
            >
              <option value="">Primeira posição</option>
              {fasesDisciplina.map((f) => (
                <option key={f.id} value={f.id}>
                  Após {f.label}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="fases-section__radio-group">
            <legend>Aplicar a</legend>
            <label className="fases-section__radio">
              <input
                type="radio"
                name="nova-fase-escopo"
                checked={newEscopo === 'todos'}
                onChange={() => setNewEscopo('todos')}
              />
              Todos os projetos
            </label>
            <label className="fases-section__radio">
              <input
                type="radio"
                name="nova-fase-escopo"
                checked={newEscopo === 'novos'}
                onChange={() => setNewEscopo('novos')}
              />
              Somente projetos novos
            </label>
          </fieldset>

          <div className="settings-subsection__actions">
            <Button
              type="button"
              variant="secondary"
              disabled={creating}
              onClick={() => setNewModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={creating} onClick={() => void handleCreateFase()}>
              {creating ? 'Salvando…' : 'Criar fase'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={deleteTarget != null}
        title="Excluir fase"
        message={
          deleteTarget
            ? `Excluir a fase "${deleteTarget.label}"? Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null)
        }}
      />
    </section>
  )
}

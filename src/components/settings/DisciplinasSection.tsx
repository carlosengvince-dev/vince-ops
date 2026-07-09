import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useDisciplinasConfig } from '../../contexts/DisciplinasConfigContext'
import { useToast } from '../../hooks/useToast'
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard'
import {
  copiarEstruturaDisciplinaRpc,
  deleteDisciplinaConfigRpc,
  disciplinaColorsToStyle,
  fetchDisciplinasConfig,
  formatDisciplinaRpcError,
  slugifyDisciplinaCodigo,
  upsertDisciplinaConfigRpc,
  type DisciplinaConfig,
} from '../../lib/disciplinaConfig'
import {
  countDisciplinasConfigDirty,
  isDisciplinaConfigRowDirty,
} from '../../lib/settingsDirtyUtils'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { SettingsSaveBar } from './SettingsSaveBar'
import { UnsavedSettingsModal } from './UnsavedSettingsModal'
import { RestoreScopeAction } from './RestoreScopeAction'
import './DisciplinasSection.css'
import './SettingsSubsection.css'
import './SettingsSaveBar.css'

function cloneDisciplinas(rows: DisciplinaConfig[]): DisciplinaConfig[] {
  return rows.map((d) => ({ ...d }))
}

function reorderDisciplinas(rows: DisciplinaConfig[], from: number, to: number): DisciplinaConfig[] {
  if (to < 0 || to >= rows.length || from === to) return rows
  const next = [...rows]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next.map((d, idx) => ({ ...d, ordem: idx }))
}

function DisciplinaBadgePreview({ row }: { row: DisciplinaConfig }) {
  return (
    <span className="disciplinas-section__badge-preview" style={disciplinaColorsToStyle(row)}>
      {row.nome}
    </span>
  )
}

function DisciplinaRow({
  row,
  index,
  total,
  baseline,
  onNomeChange,
  onCorBgChange,
  onCorTextoChange,
  onMove,
  onToggleAtivo,
  onDelete,
}: {
  row: DisciplinaConfig
  index: number
  total: number
  baseline: DisciplinaConfig | undefined
  onNomeChange: (id: string, nome: string) => void
  onCorBgChange: (id: string, cor: string) => void
  onCorTextoChange: (id: string, cor: string) => void
  onMove: (id: string, direction: 'up' | 'down') => void
  onToggleAtivo: (id: string, ativo: boolean) => void
  onDelete: (row: DisciplinaConfig) => void
}) {
  const dirty = isDisciplinaConfigRowDirty(row, baseline)

  return (
    <li
      className={[
        'disciplinas-section__row',
        dirty ? 'disciplinas-section__row--dirty' : '',
        !row.ativo ? 'disciplinas-section__row--inactive' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="disciplinas-section__order">
        <button
          type="button"
          className="disciplinas-section__order-btn"
          aria-label="Mover para cima"
          disabled={index === 0}
          onClick={() => onMove(row.id, 'up')}
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          className="disciplinas-section__order-btn"
          aria-label="Mover para baixo"
          disabled={index >= total - 1}
          onClick={() => onMove(row.id, 'down')}
        >
          <ChevronDown size={14} />
        </button>
      </div>

      <Input
        label="Nome"
        value={row.nome}
        className={`disciplinas-section__nome-input${dirty ? ' ui-input--dirty' : ''}`}
        onChange={(e) => onNomeChange(row.id, e.target.value)}
      />

      <div className="disciplinas-section__colors">
        <label className="disciplinas-section__color-field">
          <span>Fundo</span>
          <input
            type="color"
            value={row.cor_bg}
            onChange={(e) => onCorBgChange(row.id, e.target.value)}
          />
        </label>
        <label className="disciplinas-section__color-field">
          <span>Texto</span>
          <input
            type="color"
            value={row.cor_texto}
            onChange={(e) => onCorTextoChange(row.id, e.target.value)}
          />
        </label>
      </div>

      <DisciplinaBadgePreview row={row} />

      <div className="disciplinas-section__meta">
        {row.sistema ? <span className="disciplinas-section__badge">Padrão</span> : null}
        <button
          type="button"
          className="disciplinas-section__delete"
          aria-label={`Excluir ${row.nome}`}
          onClick={() => onDelete(row)}
        >
          <Trash2 size={15} />
        </button>

        <label className="disciplinas-section__toggle">
          <input
            type="checkbox"
            checked={row.ativo}
            onChange={(e) => onToggleAtivo(row.id, e.target.checked)}
          />
          Ativa
        </label>
      </div>
    </li>
  )
}

export function DisciplinasSection() {
  const { showToast } = useToast()
  const { refresh: refreshContext } = useDisciplinasConfig()
  const [disciplinas, setDisciplinas] = useState<DisciplinaConfig[]>([])
  const [baseline, setBaseline] = useState<DisciplinaConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [baselineReady, setBaselineReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [newNome, setNewNome] = useState('')
  const [newCorBg, setNewCorBg] = useState('#F3F4F6')
  const [newCorTexto, setNewCorTexto] = useState('#374151')
  const [newCopiarDe, setNewCopiarDe] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DisciplinaConfig | null>(null)
  const [deleting, setDeleting] = useState(false)

  const dirtyCount = useMemo(() => {
    if (!baselineReady) return 0
    return countDisciplinasConfigDirty(baseline, disciplinas)
  }, [baseline, baselineReady, disciplinas])
  const isDirty = dirtyCount > 0

  const load = useCallback(async () => {
    setLoading(true)
    setBaselineReady(false)
    setError(null)
    try {
      const rows = await fetchDisciplinasConfig({ includeInactive: true })
      setDisciplinas(cloneDisciplinas(rows))
      setBaseline(cloneDisciplinas(rows))
      setBaselineReady(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar disciplinas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const sortedDisciplinas = useMemo(
    () => [...disciplinas].sort((a, b) => a.ordem - b.ordem),
    [disciplinas],
  )

  const baselineById = useMemo(() => new Map(baseline.map((d) => [d.id, d])), [baseline])

  const discardChanges = useCallback(() => {
    setDisciplinas(cloneDisciplinas(baseline))
  }, [baseline])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const changed = disciplinas.filter((d) => isDisciplinaConfigRowDirty(d, baselineById.get(d.id)))
      await Promise.all(
        changed.map((d) =>
          upsertDisciplinaConfigRpc({
            p_id: d.id,
            p_codigo: d.codigo,
            p_nome: d.nome.trim(),
            p_cor_bg: d.cor_bg,
            p_cor_texto: d.cor_texto,
            p_ordem: d.ordem,
            p_ativo: d.ativo,
          }),
        ),
      )
      const rows = await fetchDisciplinasConfig({ includeInactive: true })
      setDisciplinas(cloneDisciplinas(rows))
      setBaseline(cloneDisciplinas(rows))
      await refreshContext()
      showToast('Disciplinas salvas com sucesso')
    } catch (e) {
      const message = formatDisciplinaRpcError(e instanceof Error ? e.message : 'Erro ao salvar disciplinas')
      setError(message)
      showToast(message, 'error')
      throw e
    } finally {
      setSaving(false)
    }
  }, [baselineById, disciplinas, refreshContext, showToast])

  const guard = useUnsavedChangesGuard({
    isDirty,
    enabled: baselineReady,
    onSave: handleSave,
    onDiscard: discardChanges,
    message: 'Você tem alterações não salvas nas disciplinas. Deseja salvar antes de sair?',
  })

  function handleNomeChange(id: string, nome: string) {
    setDisciplinas((prev) => prev.map((d) => (d.id === id ? { ...d, nome } : d)))
  }

  function handleCorBgChange(id: string, cor_bg: string) {
    setDisciplinas((prev) => prev.map((d) => (d.id === id ? { ...d, cor_bg } : d)))
  }

  function handleCorTextoChange(id: string, cor_texto: string) {
    setDisciplinas((prev) => prev.map((d) => (d.id === id ? { ...d, cor_texto } : d)))
  }

  function handleToggleAtivo(id: string, ativo: boolean) {
    setDisciplinas((prev) => prev.map((d) => (d.id === id ? { ...d, ativo } : d)))
  }

  function handleMove(id: string, direction: 'up' | 'down') {
    const index = sortedDisciplinas.findIndex((d) => d.id === id)
    if (index < 0) return
    const nextIndex = direction === 'up' ? index - 1 : index + 1
    setDisciplinas((prev) => {
      const sorted = [...prev].sort((a, b) => a.ordem - b.ordem)
      return reorderDisciplinas(sorted, index, nextIndex)
    })
  }

  function openNewModal() {
    setNewNome('')
    setNewCorBg('#F3F4F6')
    setNewCorTexto('#374151')
    setNewCopiarDe('')
    setNewModalOpen(true)
  }

  async function handleCreateDisciplina() {
    const nome = newNome.trim()
    if (!nome) {
      showToast('Informe o nome da disciplina', 'error')
      return
    }

    const codigo = slugifyDisciplinaCodigo(nome)
    if (!codigo) {
      showToast('Nome inválido para gerar código da disciplina', 'error')
      return
    }

    const ordem = sortedDisciplinas.length

    setCreating(true)
    setError(null)
    try {
      await upsertDisciplinaConfigRpc({
        p_id: null,
        p_codigo: codigo,
        p_nome: nome,
        p_cor_bg: newCorBg,
        p_cor_texto: newCorTexto,
        p_ordem: ordem,
        p_ativo: true,
      })

      let copySummary = { fases: 0, categorias: 0, templates: 0 }
      if (newCopiarDe) {
        copySummary = await copiarEstruturaDisciplinaRpc(newCopiarDe, codigo)
      }

      const rows = await fetchDisciplinasConfig({ includeInactive: true })
      setDisciplinas(cloneDisciplinas(rows))
      setBaseline(cloneDisciplinas(rows))
      await refreshContext()
      setNewModalOpen(false)
      showToast(
        newCopiarDe
          ? `Disciplina criada. ${copySummary.fases} fases, ${copySummary.categorias} categorias e ${copySummary.templates} templates copiados.`
          : 'Disciplina criada com sucesso',
      )
    } catch (e) {
      const message = formatDisciplinaRpcError(
        e instanceof Error ? e.message : 'Erro ao criar disciplina',
      )
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
      await deleteDisciplinaConfigRpc(deleteTarget.id)
      const rows = await fetchDisciplinasConfig({ includeInactive: true })
      setDisciplinas(cloneDisciplinas(rows))
      setBaseline(cloneDisciplinas(rows))
      await refreshContext()
      setDeleteTarget(null)
      showToast('Disciplina excluída')
    } catch (e) {
      const message = formatDisciplinaRpcError(
        e instanceof Error ? e.message : 'Erro ao excluir disciplina',
      )
      setError(message)
      showToast(message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const orderDirty = useMemo(() => {
    const baseOrder = [...baseline].sort((a, b) => a.ordem - b.ordem).map((d) => d.id)
    const draftOrder = sortedDisciplinas.map((d) => d.id)
    return JSON.stringify(baseOrder) !== JSON.stringify(draftOrder)
  }, [baseline, sortedDisciplinas])

  return (
    <section
      className={`settings-subsection${isDirty ? ' settings-subsection--with-save-bar' : ''}`}
    >
      <header className="settings-subsection__head">
        <div>
          <h2 className="settings-subsection__title">Disciplinas</h2>
          <p className="settings-subsection__hint">
            Nome e cores exibidos em todo o sistema. O código interno é gerado na criação e não
            muda.
          </p>
        </div>
        <RestoreScopeAction
          escopo="disciplinas"
          onRestored={load}
          onRefreshContext={refreshContext}
        />
      </header>

      {error ? <p className="settings-subsection__error">{error}</p> : null}
      {loading || !baselineReady ? (
        <p className="settings-subsection__status">Carregando…</p>
      ) : null}

      {baselineReady && !loading ? (
        <>
          <ul
            className={`disciplinas-section__list${orderDirty ? ' disciplinas-section__list--dirty' : ''}`}
          >
            {sortedDisciplinas.map((row, index) => (
              <DisciplinaRow
                key={row.id}
                row={row}
                index={index}
                total={sortedDisciplinas.length}
                baseline={baselineById.get(row.id)}
                onNomeChange={handleNomeChange}
                onCorBgChange={handleCorBgChange}
                onCorTextoChange={handleCorTextoChange}
                onMove={handleMove}
                onToggleAtivo={handleToggleAtivo}
                onDelete={setDeleteTarget}
              />
            ))}
          </ul>

          <div className="disciplinas-section__footer">
            <Button type="button" variant="secondary" onClick={openNewModal}>
              <Plus size={16} />
              Nova disciplina
            </Button>
          </div>
        </>
      ) : null}

      {isDirty ? (
        <SettingsSaveBar
          dirtyCount={dirtyCount}
          saving={saving}
          onSave={() => void handleSave()}
          hint="Alterações nas disciplinas ainda não foram salvas."
        />
      ) : null}

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
        title="Nova disciplina"
        onClose={() => setNewModalOpen(false)}
      >
        <div className="disciplinas-section__new-form">
          <Input
            label="Nome *"
            value={newNome}
            onChange={(e) => setNewNome(e.target.value)}
            placeholder="Ex: Elétrico"
          />
          <div className="disciplinas-section__new-colors">
            <label className="disciplinas-section__color-field">
              <span>Cor de fundo</span>
              <input type="color" value={newCorBg} onChange={(e) => setNewCorBg(e.target.value)} />
            </label>
            <label className="disciplinas-section__color-field">
              <span>Cor de texto</span>
              <input
                type="color"
                value={newCorTexto}
                onChange={(e) => setNewCorTexto(e.target.value)}
              />
            </label>
            <span
              className="disciplinas-section__badge-preview"
              style={disciplinaColorsToStyle({ cor_bg: newCorBg, cor_texto: newCorTexto })}
            >
              {newNome.trim() || 'Preview'}
            </span>
          </div>
          <label className="disciplinas-section__copy-field">
            <span>Copiar estrutura de (opcional)</span>
            <select value={newCopiarDe} onChange={(e) => setNewCopiarDe(e.target.value)}>
              <option value="">Nenhuma</option>
              {sortedDisciplinas.map((d) => (
                <option key={d.codigo} value={d.codigo}>
                  {d.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="disciplinas-section__new-actions">
            <Button type="button" variant="secondary" onClick={() => setNewModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" loading={creating} onClick={() => void handleCreateDisciplina()}>
              Criar disciplina
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={deleteTarget != null}
        title="Excluir disciplina"
        message={
          deleteTarget
            ? `Excluir "${deleteTarget.nome}"? Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  )
}

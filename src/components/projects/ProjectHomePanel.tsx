import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import { DISCIPLINA_LABELS, formatNumeroProjeto, hasPermissao } from '../../lib/constants'
import { discToneClasses } from '../../lib/disciplinaTokens'
import { getDisciplinasDisponiveis, countTarefasDaDisciplina } from '../../lib/projetoDisciplinas'
import { getProjectStatusConfirmKind } from '../../lib/projectStatus'
import {
  formatProjetoHorasPorDisciplina,
  formatProjetoHorasPrincipal,
  getEstimativaHorasTotal,
} from '../../lib/projectHoras'
import { parseProjetoHomeMetadata, type ProjetoHomeMetadataField } from '../../lib/projectHome'
import {
  camposAtivosPorSecao,
  customFieldMetadataKey,
  type CampoProjetoCustom,
} from '../../lib/camposProjetoConfig'
import { useProjectHoras } from '../../hooks/useProjectHoras'
import type { Disciplina, Fase, Metodologia, Papel, ProjetoStatus, Tarefa } from '../../types'
import { AddDisciplinaChecklistModal } from './AddDisciplinaChecklistModal'
import { RemoveDisciplinaModal } from './RemoveDisciplinaModal'
import { ProjectChat } from './ProjectChat'
import { ProjectStatusConfirmModal } from './ProjectStatusConfirmModal'
import { ProjectStatusDropdown } from './ProjectStatusDropdown'
import { ClientSelect } from '../clients/ClientSelect'
import { ConfirmModal } from '../ui/ConfirmModal'
import './ProjectHomePanel.css'

export interface ProjectHomeCliente {
  nome: string
  cnpj_cpf: string | null
  contato: string | null
  email: string | null
}

interface ProjectHomePanelProps {
  projetoId: string
  codigo: string
  numeroSequencial: number
  disciplinas: Disciplina[]
  metodologia: Partial<Record<Disciplina, Metodologia>>
  endereco: string | null
  tipoEdificacao: string | null
  clienteId: string | null
  cliente: ProjectHomeCliente | null
  metadata: Record<string, unknown>
  tiposEdificacao: string[]
  tarefas: Tarefa[]
  usuarioId: string
  papel: Papel
  onSaveMetadata: (field: ProjetoHomeMetadataField, value: string) => Promise<void>
  onSaveEndereco: (value: string) => Promise<void>
  onSaveTipoEdificacao: (value: string) => Promise<void>
  onSaveClienteId: (clienteId: string | null) => Promise<void>
  onAddDisciplina: (
    disciplina: Disciplina,
    metodologia: Metodologia,
    selectedTemplateIds: Set<string>,
  ) => Promise<void>
  onPrepareRemoveDisciplina: (disciplina: Disciplina) => Promise<{ openRevisoesCount: number }>
  onRemoveDisciplina: (disciplina: Disciplina, archiveTasks: boolean) => Promise<void>
  onNavigateToTask: (disciplina: Disciplina, fase: Fase, tarefaId: string) => void
  readOnly?: boolean
  status: ProjetoStatus
  onStatusChange: (newStatus: ProjetoStatus, justificativa?: string) => Promise<void>
  horasEstimadasHid: number | null
  horasEstimadasPpci: number | null
  camposCustom?: CampoProjetoCustom[]
  onSaveCustomField?: (key: string, value: string) => Promise<void>
}

type FieldType = 'text' | 'date' | 'textarea' | 'select'

interface FieldConfig {
  key: ProjetoHomeMetadataField | 'endereco' | 'tipo_edificacao' | string
  label: string
  type: FieldType
  placeholder?: string
  storage: 'metadata' | 'column' | 'custom'
  selectOptions?: string[]
}

function formatDateDisplay(value: string): string {
  if (!value) return ''
  return new Date(value + 'T00:00:00').toLocaleDateString('pt-BR')
}

export function ProjectHomePanel({
  projetoId,
  codigo,
  numeroSequencial,
  disciplinas,
  metodologia,
  endereco,
  tipoEdificacao,
  clienteId,
  cliente,
  metadata,
  tiposEdificacao,
  tarefas,
  usuarioId,
  papel,
  onSaveMetadata,
  onSaveEndereco,
  onSaveTipoEdificacao,
  onSaveClienteId,
  onAddDisciplina,
  onPrepareRemoveDisciplina,
  onRemoveDisciplina,
  onNavigateToTask,
  readOnly = false,
  status,
  onStatusChange,
  horasEstimadasHid,
  horasEstimadasPpci,
  camposCustom = [],
  onSaveCustomField,
}: ProjectHomePanelProps) {
  const canEdit = !readOnly && hasPermissao(papel, 'editar_projeto')
  const canChangeStatus = canEdit
  const canManageDisciplinas = canEdit
  const { horas: horasRegistradas } = useProjectHoras(projetoId)
  const estimativaHoras = useMemo(
    () => getEstimativaHorasTotal(horasEstimadasHid, horasEstimadasPpci),
    [horasEstimadasHid, horasEstimadasPpci],
  )
  const meta = parseProjetoHomeMetadata(metadata)
  const numero = formatNumeroProjeto(numeroSequencial)

  const [linkingCliente, setLinkingCliente] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [savedKey, setSavedKey] = useState<string | null>(null)

  const [showAddSelect, setShowAddSelect] = useState(false)
  const [pendingAddDisciplina, setPendingAddDisciplina] = useState<Disciplina | null>(null)
  const [confirmAddOpen, setConfirmAddOpen] = useState(false)
  const [checklistModalOpen, setChecklistModalOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [removeDisciplina, setRemoveDisciplina] = useState<Disciplina | null>(null)
  const [removeOpenRevisoes, setRemoveOpenRevisoes] = useState(0)
  const [removeLoading, setRemoveLoading] = useState(false)
  const [removePreparing, setRemovePreparing] = useState(false)

  const [pendingStatus, setPendingStatus] = useState<ProjetoStatus | null>(null)
  const [statusChanging, setStatusChanging] = useState(false)
  const pendingConfirmKind = pendingStatus ? getProjectStatusConfirmKind(status, pendingStatus) : null

  const disciplinasDisponiveis = useMemo(
    () => getDisciplinasDisponiveis(disciplinas),
    [disciplinas],
  )

  useEffect(() => {
    if (!savedKey) return
    const t = window.setTimeout(() => setSavedKey(null), 2000)
    return () => window.clearTimeout(t)
  }, [savedKey])

  const readValue = useCallback(
    (field: FieldConfig): string => {
      if (field.storage === 'column') {
        if (field.key === 'endereco') return endereco ?? ''
        if (field.key === 'tipo_edificacao') return tipoEdificacao ?? ''
      }
      if (field.storage === 'custom') {
        const raw = metadata[field.key]
        return typeof raw === 'string' ? raw : ''
      }
      return meta[field.key as ProjetoHomeMetadataField] ?? ''
    },
    [endereco, meta, metadata, tipoEdificacao],
  )

  const startEdit = useCallback(
    (field: FieldConfig) => {
      if (!canEdit) return
      setEditingKey(field.key)
      setDraft(readValue(field))
    },
    [canEdit, readValue],
  )

  const cancelEdit = useCallback(() => {
    setEditingKey(null)
    setDraft('')
  }, [])

  const commitField = useCallback(
    async (field: FieldConfig, valueOverride?: string) => {
      const nextValue = valueOverride ?? draft
      const current = readValue(field)
      if (nextValue === current) {
        setEditingKey(null)
        return
      }
      try {
        if (field.storage === 'column') {
          if (field.key === 'endereco') await onSaveEndereco(nextValue)
          else if (field.key === 'tipo_edificacao') await onSaveTipoEdificacao(nextValue)
        } else if (field.storage === 'custom') {
          if (onSaveCustomField) await onSaveCustomField(field.key, nextValue)
        } else {
          await onSaveMetadata(field.key as ProjetoHomeMetadataField, nextValue)
        }
        setSavedKey(field.key)
      } catch {
        // parent handles error
      } finally {
        setEditingKey(null)
      }
    },
    [draft, onSaveEndereco, onSaveMetadata, onSaveCustomField, onSaveTipoEdificacao, readValue],
  )

  const customFieldConfigs = useCallback(
    (secao: CampoProjetoCustom['secao']): FieldConfig[] =>
      camposAtivosPorSecao(camposCustom, secao).map((campo) => ({
        key: customFieldMetadataKey(campo.id),
        label: campo.nome,
        type: campo.tipo === 'select' ? 'select' : campo.tipo,
        storage: 'custom' as const,
        selectOptions: campo.opcoes,
      })),
    [camposCustom],
  )

  function renderCustomFields(secao: CampoProjetoCustom['secao']) {
    return customFieldConfigs(secao).map((field) => (
      <InlineField
        key={field.key}
        field={field}
        value={readValue(field)}
        selectOptions={field.selectOptions}
        canEdit={canEdit && field.storage === 'custom' ? onSaveCustomField != null : canEdit}
        editing={editingKey === field.key}
        draft={editingKey === field.key ? draft : ''}
        saved={savedKey === field.key}
        onStartEdit={() => startEdit(field)}
        onDraftChange={setDraft}
        onCommit={() => void commitField(field)}
        onCancel={cancelEdit}
      />
    ))
  }

  const handleClienteLinked = useCallback(
    async (id: string | null) => {
      try {
        await onSaveClienteId(id)
        setLinkingCliente(false)
      } catch {
        // parent handles error
      }
    },
    [onSaveClienteId],
  )

  const handlePickAddDisciplina = useCallback((disc: Disciplina) => {
    setPendingAddDisciplina(disc)
    setShowAddSelect(false)
    setConfirmAddOpen(true)
  }, [])

  const handleConfirmAddDisciplina = useCallback(() => {
    setConfirmAddOpen(false)
    setAddError(null)
    setChecklistModalOpen(true)
  }, [])

  const handleSubmitAddDisciplina = useCallback(
    async (payload: { metodologia: Metodologia; selectedTemplateIds: Set<string> }) => {
      if (!pendingAddDisciplina) return
      setAddLoading(true)
      setAddError(null)
      try {
        await onAddDisciplina(
          pendingAddDisciplina,
          payload.metodologia,
          payload.selectedTemplateIds,
        )
        setChecklistModalOpen(false)
        setPendingAddDisciplina(null)
      } catch (err) {
        setAddError(err instanceof Error ? err.message : 'Erro ao adicionar disciplina')
      } finally {
        setAddLoading(false)
      }
    },
    [onAddDisciplina, pendingAddDisciplina],
  )

  const handleStartRemoveDisciplina = useCallback(
    async (disc: Disciplina) => {
      if (disciplinas.length <= 1) return
      setRemovePreparing(true)
      try {
        const { openRevisoesCount } = await onPrepareRemoveDisciplina(disc)
        setRemoveOpenRevisoes(openRevisoesCount)
        setRemoveDisciplina(disc)
      } catch {
        // parent handles error
      } finally {
        setRemovePreparing(false)
      }
    },
    [disciplinas.length, onPrepareRemoveDisciplina],
  )

  const handleConfirmRemoveDisciplina = useCallback(async () => {
    if (!removeDisciplina) return
    const tarefaCount = countTarefasDaDisciplina(tarefas, removeDisciplina)
    setRemoveLoading(true)
    try {
      await onRemoveDisciplina(removeDisciplina, tarefaCount > 0)
      setRemoveDisciplina(null)
    } catch {
      // parent handles error
    } finally {
      setRemoveLoading(false)
    }
  }, [onRemoveDisciplina, removeDisciplina, tarefas])

  const commitStatusChange = useCallback(
    async (nextStatus: ProjetoStatus, justificativa?: string) => {
      setStatusChanging(true)
      try {
        await onStatusChange(nextStatus, justificativa)
        setPendingStatus(null)
      } catch {
        // parent handles error
      } finally {
        setStatusChanging(false)
      }
    },
    [onStatusChange],
  )

  const handleStatusSelect = useCallback(
    (nextStatus: ProjetoStatus) => {
      if (nextStatus === status || statusChanging) return
      const kind = getProjectStatusConfirmKind(status, nextStatus)
      if (kind) {
        setPendingStatus(nextStatus)
        return
      }
      void commitStatusChange(nextStatus)
    },
    [commitStatusChange, status, statusChanging],
  )

  const handleConfirmStatusChange = useCallback(
    (justificativa?: string) => {
      if (!pendingStatus) return
      void commitStatusChange(pendingStatus, justificativa)
    },
    [commitStatusChange, pendingStatus],
  )

  const empreendimentoFields: FieldConfig[] = [
    {
      key: 'nome_empreendimento',
      label: 'Nome do empreendimento',
      type: 'text',
      placeholder: 'Ex: Residencial Vila Nova',
      storage: 'metadata',
    },
    {
      key: 'endereco',
      label: 'Endereço',
      type: 'text',
      placeholder: 'Rua, número',
      storage: 'column',
    },
    {
      key: 'complemento',
      label: 'Complemento',
      type: 'text',
      placeholder: 'Apto, bloco, sala…',
      storage: 'metadata',
    },
    { key: 'bairro', label: 'Bairro', type: 'text', storage: 'metadata' },
    {
      key: 'tipo_edificacao',
      label: 'Finalidade',
      type: 'select',
      storage: 'column',
    },
  ]

  const emasaFields: FieldConfig[] = [
    {
      key: 'protocolo_emasa',
      label: 'Número protocolo EMASA',
      type: 'text',
      placeholder: 'Ex: 2026/001234',
      storage: 'metadata',
    },
    { key: 'data_entrada_emasa', label: 'Data de entrada EMASA', type: 'date', storage: 'metadata' },
    {
      key: 'data_prevista_aprovacao_emasa',
      label: 'Data prevista aprovação EMASA',
      type: 'date',
      storage: 'metadata',
    },
    {
      key: 'data_aprovacao_real_emasa',
      label: 'Data aprovação real EMASA',
      type: 'date',
      storage: 'metadata',
    },
  ]

  const cbmscFields: FieldConfig[] = [
    {
      key: 'processo_cbmsc',
      label: 'Número processo CBMSC',
      type: 'text',
      placeholder: 'Ex: SC-2026-4567',
      storage: 'metadata',
    },
    { key: 'data_protocolo_cbmsc', label: 'Data protocolo CBMSC', type: 'date', storage: 'metadata' },
    {
      key: 'data_prevista_aprovacao_cbmsc',
      label: 'Data prevista aprovação CBMSC',
      type: 'date',
      storage: 'metadata',
    },
    {
      key: 'data_aprovacao_real_cbmsc',
      label: 'Data aprovação real CBMSC',
      type: 'date',
      storage: 'metadata',
    },
  ]

  const rtFields: FieldConfig[] = [
    { key: 'nome_rt', label: 'Nome do RT', type: 'text', storage: 'metadata' },
    {
      key: 'numero_art',
      label: 'Número ART',
      type: 'text',
      placeholder: 'Ex: SC-123456',
      storage: 'metadata',
    },
    {
      key: 'numero_crea_cau',
      label: 'Número CREA/CAU',
      type: 'text',
      placeholder: 'Ex: 12345-D/SC',
      storage: 'metadata',
    },
  ]

  return (
    <div className="project-home">
      <div className="project-home__layout">
        <div className="project-home__info">
          <HomeSection title="Dados do cliente">
            {cliente ? (
              <div className="project-home__readonly-grid">
                <ReadonlyRow label="Nome" value={cliente.nome} />
                <ReadonlyRow label="CNPJ/CPF" value={cliente.cnpj_cpf} />
                <ReadonlyRow label="Contato" value={cliente.contato} />
                <ReadonlyRow label="E-mail" value={cliente.email} />
              </div>
            ) : linkingCliente && canEdit ? (
              <div className="project-home__link-client">
                <ClientSelect
                  value={clienteId}
                  onChange={(id) => void handleClienteLinked(id)}
                />
                <button
                  type="button"
                  className="project-home__link-cancel"
                  onClick={() => setLinkingCliente(false)}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="project-home__empty-client">
                <p>Nenhum cliente vinculado a este projeto.</p>
                {canEdit ? (
                  <button
                    type="button"
                    className="project-home__link-btn"
                    onClick={() => setLinkingCliente(true)}
                  >
                    Vincular cliente
                  </button>
                ) : (
                  <span className="project-home__muted">—</span>
                )}
              </div>
            )}
            {cliente ? (
              <p className="project-home__hint">
                Edição do cadastro em{' '}
                <Link to="/clientes">Clientes</Link>.
              </p>
            ) : null}
          </HomeSection>

          <HomeSection title="Dados do empreendimento">
            <div className="project-home__grid">
              {empreendimentoFields.map((field) => (
                <InlineField
                  key={field.key}
                  field={field}
                  value={readValue(field)}
                  selectOptions={field.type === 'select' ? tiposEdificacao : undefined}
                  canEdit={canEdit}
                  editing={editingKey === field.key}
                  draft={editingKey === field.key ? draft : ''}
                  saved={savedKey === field.key}
                  onStartEdit={() => startEdit(field)}
                  onDraftChange={setDraft}
                  onCommit={() => void commitField(field)}
                  onCancel={cancelEdit}
                />
              ))}
              {renderCustomFields('empreendimento')}
            </div>
          </HomeSection>

          <HomeSection title="Dados do projeto">
            <div className="project-home__grid">
              <ReadonlyRow label="ID / Sigla" value={codigo} />
              <ReadonlyRow label="Número" value={numero} />
            </div>
            <div className="project-home__badges-block">
              <span className="project-home__badges-label">Status</span>
              <ProjectStatusDropdown
                value={status}
                canChange={canChangeStatus}
                disabled={statusChanging}
                onChange={handleStatusSelect}
              />
            </div>
            <div className="project-home__field project-home__horas-block">
              <span className="project-home__label">Horas registradas</span>
              <span className="project-home__readonly-value">
                {formatProjetoHorasPrincipal(
                  horasRegistradas?.totalSegundos ?? 0,
                  estimativaHoras,
                )}
              </span>
              {disciplinas.length > 1 && horasRegistradas ? (
                <span className="project-home__horas-breakdown">
                  {formatProjetoHorasPorDisciplina(
                    disciplinas,
                    horasRegistradas.porDisciplina,
                    horasRegistradas.totalSegundos,
                  )}
                </span>
              ) : null}
            </div>
            <div className="project-home__badges-block">
              <span className="project-home__badges-label">Disciplinas</span>
              <div className="project-home__disciplinas-row">
                <div className="project-home__badges">
                  {disciplinas.map((d) => (
                    <span
                      key={d}
                      className={`project-home__disc-badge-wrap${canManageDisciplinas ? ' project-home__disc-badge-wrap--manageable' : ''}`}
                    >
                      <span className={`project-home__disc-badge ${discToneClasses(d)}`}>
                        {DISCIPLINA_LABELS[d]}
                      </span>
                      {canManageDisciplinas && disciplinas.length > 1 ? (
                        <button
                          type="button"
                          className="project-home__disc-remove"
                          aria-label={`Remover ${DISCIPLINA_LABELS[d]}`}
                          disabled={removePreparing || removeLoading}
                          onClick={() => void handleStartRemoveDisciplina(d)}
                        >
                          <X size={12} />
                        </button>
                      ) : null}
                    </span>
                  ))}
                </div>
                {canManageDisciplinas && disciplinasDisponiveis.length > 0 ? (
                  <div className="project-home__add-disc">
                    {!showAddSelect ? (
                      <button
                        type="button"
                        className="project-home__add-disc-btn"
                        onClick={() => setShowAddSelect(true)}
                      >
                        <Plus size={14} />
                        Disciplina
                      </button>
                    ) : (
                      <select
                        className="project-home__add-disc-select"
                        autoFocus
                        defaultValue=""
                        onChange={(e) => {
                          const value = e.target.value as Disciplina
                          if (value) handlePickAddDisciplina(value)
                        }}
                        onBlur={() => setShowAddSelect(false)}
                      >
                        <option value="" disabled>
                          Selecione…
                        </option>
                        {disciplinasDisponiveis.map((d) => (
                          <option key={d} value={d}>
                            {DISCIPLINA_LABELS[d]}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="project-home__badges-block">
              <span className="project-home__badges-label">Metodologia</span>
              <div className="project-home__badges">
                {disciplinas.map((d) => (
                  <span key={d} className="project-home__meta-badge">
                    {d}: {metodologia[d] ?? '2D'}
                  </span>
                ))}
              </div>
            </div>
            <div className="project-home__grid project-home__grid--single">
              <InlineField
                field={{
                  key: 'arquivo_base',
                  label: 'Arquivo / Base de referência',
                  type: 'text',
                  placeholder: 'Ex: ARQ-VILA-NOVA-R03',
                  storage: 'metadata',
                }}
                value={meta.arquivo_base ?? ''}
                canEdit={canEdit}
                editing={editingKey === 'arquivo_base'}
                draft={editingKey === 'arquivo_base' ? draft : ''}
                saved={savedKey === 'arquivo_base'}
                onStartEdit={() =>
                  startEdit({
                    key: 'arquivo_base',
                    label: 'Arquivo / Base de referência',
                    type: 'text',
                    storage: 'metadata',
                  })
                }
                onDraftChange={setDraft}
                onCommit={() =>
                  void commitField({
                    key: 'arquivo_base',
                    label: 'Arquivo / Base de referência',
                    type: 'text',
                    storage: 'metadata',
                  })
                }
                onCancel={cancelEdit}
              />
            </div>
            <div className="project-home__grid">
              {renderCustomFields('projeto')}
            </div>
          </HomeSection>

          <HomeSection title="Protocolos e datas técnicas">
            {disciplinas.includes('HID') ? (
              <div className="project-home__protocol-block">
                <h3 className="project-home__protocol-title">EMASA</h3>
                <div className="project-home__grid">
                  {emasaFields.map((field) => (
                    <InlineField
                      key={field.key}
                      field={field}
                      value={readValue(field)}
                      canEdit={canEdit}
                      editing={editingKey === field.key}
                      draft={editingKey === field.key ? draft : ''}
                      saved={savedKey === field.key}
                      onStartEdit={() => startEdit(field)}
                      onDraftChange={setDraft}
                      onCommit={() => void commitField(field)}
                      onCancel={cancelEdit}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {disciplinas.includes('PPCI') ? (
              <div className="project-home__protocol-block">
                <h3 className="project-home__protocol-title">CBMSC</h3>
                <div className="project-home__grid">
                  {cbmscFields.map((field) => (
                    <InlineField
                      key={field.key}
                      field={field}
                      value={readValue(field)}
                      canEdit={canEdit}
                      editing={editingKey === field.key}
                      draft={editingKey === field.key ? draft : ''}
                      saved={savedKey === field.key}
                      onStartEdit={() => startEdit(field)}
                      onDraftChange={setDraft}
                      onCommit={() => void commitField(field)}
                      onCancel={cancelEdit}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="project-home__protocol-block">
              <h3 className="project-home__protocol-title">RT</h3>
              <div className="project-home__grid">
                {rtFields.map((field) => (
                  <InlineField
                    key={field.key}
                    field={field}
                    value={readValue(field)}
                    canEdit={canEdit}
                    editing={editingKey === field.key}
                    draft={editingKey === field.key ? draft : ''}
                    saved={savedKey === field.key}
                    onStartEdit={() => startEdit(field)}
                    onDraftChange={setDraft}
                    onCommit={() => void commitField(field)}
                    onCancel={cancelEdit}
                  />
                ))}
              </div>
            </div>
          </HomeSection>

          <HomeSection title="Especificidades">
            <InlineField
              field={{
                key: 'observacoes_tecnicas',
                label: 'Observações técnicas',
                type: 'textarea',
                placeholder: 'Notas técnicas do projeto…',
                storage: 'metadata',
              }}
              value={meta.observacoes_tecnicas ?? ''}
              fullWidth
              canEdit={canEdit}
              editing={editingKey === 'observacoes_tecnicas'}
              draft={editingKey === 'observacoes_tecnicas' ? draft : ''}
              saved={savedKey === 'observacoes_tecnicas'}
              onStartEdit={() =>
                startEdit({
                  key: 'observacoes_tecnicas',
                  label: 'Observações técnicas',
                  type: 'textarea',
                  storage: 'metadata',
                })
              }
              onDraftChange={setDraft}
              onCommit={() =>
                void commitField({
                  key: 'observacoes_tecnicas',
                  label: 'Observações técnicas',
                  type: 'textarea',
                  storage: 'metadata',
                })
              }
              onCancel={cancelEdit}
            />
            <div className="project-home__grid">{renderCustomFields('especificidades')}</div>
          </HomeSection>
        </div>

        <aside className="project-home__chat" aria-label="Chat da equipe">
          <ProjectChat
            projetoId={projetoId}
            usuarioId={usuarioId}
            usuarioPapel={papel}
            enabled
            readOnly={readOnly}
            onNavigateToTask={onNavigateToTask}
          />
        </aside>
      </div>

      <ConfirmModal
        isOpen={confirmAddOpen && pendingAddDisciplina != null}
        title={
          pendingAddDisciplina
            ? `Adicionar ${DISCIPLINA_LABELS[pendingAddDisciplina]}`
            : 'Adicionar disciplina'
        }
        message={
          pendingAddDisciplina
            ? `Deseja adicionar ${DISCIPLINA_LABELS[pendingAddDisciplina]} a este projeto? Em seguida você poderá selecionar as tarefas a importar.`
            : ''
        }
        confirmLabel="Continuar"
        onConfirm={handleConfirmAddDisciplina}
        onCancel={() => {
          setConfirmAddOpen(false)
          setPendingAddDisciplina(null)
        }}
      />

      {pendingAddDisciplina ? (
        <AddDisciplinaChecklistModal
          open={checklistModalOpen}
          disciplina={pendingAddDisciplina}
          loading={addLoading}
          error={addError}
          onClose={() => {
            if (addLoading) return
            setChecklistModalOpen(false)
            setPendingAddDisciplina(null)
            setAddError(null)
          }}
          onSubmit={(payload) => void handleSubmitAddDisciplina(payload)}
        />
      ) : null}

      {removeDisciplina ? (
        <RemoveDisciplinaModal
          open
          disciplina={removeDisciplina}
          tarefaCount={countTarefasDaDisciplina(tarefas, removeDisciplina)}
          openRevisoesCount={removeOpenRevisoes}
          loading={removeLoading}
          onArchive={() => void handleConfirmRemoveDisciplina()}
          onCancel={() => {
            if (!removeLoading) setRemoveDisciplina(null)
          }}
        />
      ) : null}

      <ProjectStatusConfirmModal
        isOpen={pendingStatus != null && pendingConfirmKind != null}
        kind={pendingConfirmKind}
        loading={statusChanging}
        onConfirm={handleConfirmStatusChange}
        onCancel={() => {
          if (!statusChanging) setPendingStatus(null)
        }}
      />
    </div>
  )
}

function HomeSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="project-home__section">
      <h2 className="project-home__section-title">{title}</h2>
      {children}
    </section>
  )
}

function ReadonlyRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="project-home__field">
      <span className="project-home__label">{label}</span>
      <span className="project-home__readonly-value">{value?.trim() ? value : '—'}</span>
    </div>
  )
}

interface InlineFieldProps {
  field: FieldConfig
  value: string
  selectOptions?: string[]
  canEdit: boolean
  editing: boolean
  draft: string
  saved: boolean
  fullWidth?: boolean
  onStartEdit: () => void
  onDraftChange: (value: string) => void
  onCommit: (value?: string) => void
  onCancel: () => void
}

function InlineField({
  field,
  value,
  selectOptions,
  canEdit,
  editing,
  draft,
  saved,
  fullWidth = false,
  onStartEdit,
  onDraftChange,
  onCommit,
  onCancel,
}: InlineFieldProps) {
  const displayValue = field.type === 'date' && value ? formatDateDisplay(value) : value

  return (
    <div className={`project-home__field${fullWidth ? ' project-home__field--full' : ''}`}>
      <span className="project-home__label">{field.label}</span>

      {editing ? (
        field.type === 'textarea' ? (
          <textarea
            className="project-home__input project-home__textarea"
            value={draft}
            rows={4}
            autoFocus
            placeholder={field.placeholder}
            onChange={(e) => onDraftChange(e.target.value)}
            onBlur={() => onCommit()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                onCancel()
              }
            }}
          />
        ) : field.type === 'select' ? (
          <select
            className="project-home__input project-home__select"
            value={draft}
            autoFocus
            onChange={(e) => {
              const v = e.target.value
              onDraftChange(v)
              onCommit(v)
            }}
          >
            <option value="">Selecione…</option>
            {(selectOptions ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="project-home__input"
            type={field.type}
            value={draft}
            autoFocus
            placeholder={field.placeholder}
            onChange={(e) => onDraftChange(e.target.value)}
            onBlur={() => onCommit()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onCommit()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                onCancel()
              }
            }}
          />
        )
      ) : (
        <button
          type="button"
          className={`project-home__value${!canEdit ? ' project-home__value--readonly' : ''}${!value ? ' project-home__value--empty' : ''}`}
          disabled={!canEdit}
          onClick={onStartEdit}
        >
          {value ? displayValue : canEdit ? 'Clique para adicionar' : '—'}
        </button>
      )}

      {saved ? (
        <span className="project-home__saved" aria-live="polite">
          salvo ✓
        </span>
      ) : null}
    </div>
  )
}

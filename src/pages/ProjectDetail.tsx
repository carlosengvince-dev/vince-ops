import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChecklistPanel } from '../components/projects/ChecklistPanel'
import { ActivityFeedPanel } from '../components/projects/ActivityFeedPanel'
import { PendenciasPanel } from '../components/projects/PendenciasPanel'
import { RevisoesPanel } from '../components/projects/RevisoesPanel'
import { PhaseAdvanceModal } from '../components/projects/PhaseAdvanceModal'
import { PhaseSidebar } from '../components/projects/PhaseSidebar'
import { PreInfoPanel } from '../components/projects/PreInfoPanel'
import { ProjectDetailTabs } from '../components/projects/ProjectDetailTabs'
import { ProjectFechamentoCard } from '../components/projects/ProjectFechamentoCard'
import { ProjectHomePanel } from '../components/projects/ProjectHomePanel'
import { Button } from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import { useProjectDetail } from '../hooks/useProjectDetail'
import { useProjectDetailNavigation } from '../hooks/useProjectDetailNavigation'
import { useTaskTimerTotals } from '../hooks/useTaskTimerTotals'
import { logActivity } from '../lib/activityLog'
import { DEFAULT_TIPOS_EDIFICACAO, fetchConfiguracaoLista } from '../lib/configuracoes'
import { fetchCamposProjetoCustom, type CampoProjetoCustom } from '../lib/camposProjetoConfig'
import {
  createDocumentoAvulso,
  softDeleteDocumento,
  updateDocumentoObservacoes,
  updateDocumentoStatus,
} from '../lib/documentosProjeto'
import { fetchActiveProfiles } from '../lib/profiles'
import {
  addDisciplinaToProjeto,
  removeDisciplinaFromProjeto,
} from '../lib/projetoDisciplinas'
import { fetchProjectRevisoes } from '../lib/revisoes'
import {
  canAdvancePhase,
  DISCIPLINA_LABELS,
  getFaseAtual,
  getNextFase,
  hasPermissao,
  PHASE_LABELS,
  PROJETO_STATUS_LABELS,
  TAREFA_STATUS_LABELS,
} from '../lib/constants'
import {
  advanceProjectPhase,
  liberarFaseBloqueada,
  updateTarefaResponsavel,
  updateTarefaStatus,
} from '../lib/projectTasks'
import {
  updateProjetoColumn,
  updateProjetoMetadataField,
  updateProjetoMetadataKey,
  type ProjetoHomeMetadataField,
} from '../lib/projectHome'
import { supabase } from '../lib/supabase'
import { isProjetoHistoricoReadOnly, reabrirProjetoSuspenso } from '../lib/historico'
import {
  formatSnapshotHoras,
  parseSnapshotFechamento,
  projectStatusLabel,
  updateProjetoStatus,
} from '../lib/projectStatus'
import type { Disciplina, DocumentoStatus, Fase, Metodologia, ProjetoStatus, Revisao, Tarefa, TarefaStatus } from '../types'
import type { RevisaoPrefill } from '../lib/revisoes'
import './ProjectDetail.css'

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data, loading, error, refresh, patchTarefa, patchFasesAtuais, appendTarefas, appendTarefa, removeTarefa, patchTarefasOrdem, patchProjetoMetadata, patchProjeto, removeTarefasByIds, patchDocumento, appendDocumento, removeDocumento } =
    useProjectDetail(id)
  const { totals: taskTimerTotals } = useTaskTimerTotals(id)

  const projeto = data?.projeto
  const readOnly = projeto ? isProjetoHistoricoReadOnly(projeto) : false
  const fechamentoSnapshot = useMemo(
    () => parseSnapshotFechamento(projeto?.snapshot_fechamento),
    [projeto?.snapshot_fechamento],
  )
  const canReabrir =
    readOnly &&
    projeto?.status === 'suspenso' &&
    projeto.modo_criacao !== 'historico' &&
    profile != null &&
    hasPermissao(profile.papel, 'editar_projeto')

  const {
    mainTab,
    disciplinaAtiva,
    faseAtiva,
    expandedRevisaoId,
    expandedPendenciaId,
    expandedTarefaId,
    setMainTab,
    setDisciplinaAtiva,
    setFaseAtiva,
    setExpandedRevisaoId,
    setExpandedPendenciaId,
    navigateToRevisoes,
    navigateToChecklist,
  } = useProjectDetailNavigation(projeto)

  const [advanceModal, setAdvanceModal] = useState<{
    mode: 'confirm' | 'liberacao'
  } | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [activityRefreshToken, setActivityRefreshToken] = useState(0)
  const [revisaoPrefill, setRevisaoPrefill] = useState<RevisaoPrefill | null>(null)
  const [tiposEdificacao, setTiposEdificacao] = useState<string[]>([...DEFAULT_TIPOS_EDIFICACAO])
  const [camposCustom, setCamposCustom] = useState<CampoProjetoCustom[]>([])
  const [reabrindo, setReabrindo] = useState(false)

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      fetchConfiguracaoLista('tipos_edificacao', DEFAULT_TIPOS_EDIFICACAO),
      fetchCamposProjetoCustom(),
    ]).then(([tipos, campos]) => {
      if (!cancelled) {
        setTiposEdificacao(tipos)
        setCamposCustom(campos)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const bumpActivityFeed = useCallback(() => {
    setActivityRefreshToken((v) => v + 1)
  }, [])

  const tarefas = data?.tarefas ?? []
  const documentos = data?.documentos ?? []

  const faseOficial = useMemo(() => {
    if (!projeto || !disciplinaAtiva) return null
    return getFaseAtual(projeto.fases_atuais as Record<string, unknown>, disciplinaAtiva)
  }, [projeto, disciplinaAtiva])


  const handleRevisaoCreated = useCallback(
    (_revisao: Revisao, newTarefas: Tarefa[]) => {
      appendTarefas(newTarefas)
      bumpActivityFeed()
    },
    [appendTarefas, bumpActivityFeed],
  )

  const handleGerarRevisaoFromPendencia = useCallback((prefill: RevisaoPrefill) => {
    setRevisaoPrefill({
      ...prefill,
      disciplina:
        disciplinaAtiva && (disciplinaAtiva === 'HID' || disciplinaAtiva === 'PPCI')
          ? disciplinaAtiva
          : prefill.disciplina,
    })
    navigateToRevisoes()
  }, [disciplinaAtiva, navigateToRevisoes])

  const handleNavigateToTask = useCallback(
    (disciplina: Disciplina, fase: Fase, tarefaId?: string) => {
      navigateToChecklist(disciplina, fase, tarefaId ? { tarefaId } : undefined)
    },
    [navigateToChecklist],
  )

  const handleNavigateToPreInfo = useCallback(() => {
    if (!disciplinaAtiva) return
    navigateToChecklist(disciplinaAtiva, 'PRE_INFO')
  }, [disciplinaAtiva, navigateToChecklist])

  const handleDocumentoStatusChange = useCallback(
    async (docId: string, status: DocumentoStatus, dataRecebimento?: string | null) => {
      if (!projeto) return
      setActionError(null)
      try {
        await updateDocumentoStatus(docId, status, dataRecebimento)
        patchDocumento(docId, {
          status,
          data_recebimento: status === 'recebido' ? (dataRecebimento ?? null) : null,
        })
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Erro ao atualizar documento')
        throw err
      }
    },
    [patchDocumento, projeto],
  )

  const handleDocumentoObservacoesChange = useCallback(
    async (docId: string, observacoes: string | null) => {
      setActionError(null)
      try {
        await updateDocumentoObservacoes(docId, observacoes)
        patchDocumento(docId, { observacoes })
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Erro ao salvar observações')
        throw err
      }
    },
    [patchDocumento],
  )

  const handleAddDocumento = useCallback(
    async (nome: string, tipo: string) => {
      if (!projeto) return
      setActionError(null)
      try {
        const created = await createDocumentoAvulso(projeto.id, nome, tipo)
        appendDocumento(created)
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Erro ao adicionar documento')
        throw err
      }
    },
    [appendDocumento, projeto],
  )

  const handleRemoveDocumento = useCallback(
    async (docId: string) => {
      setActionError(null)
      try {
        await softDeleteDocumento(docId)
        removeDocumento(docId)
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Erro ao remover documento')
        throw err
      }
    },
    [removeDocumento],
  )

  const handleCustomFieldSave = useCallback(
    async (key: string, value: string) => {
      if (!projeto) return
      setActionError(null)
      const next = await updateProjetoMetadataKey(projeto.id, projeto.metadata ?? {}, key, value)
      patchProjetoMetadata(next)
    },
    [patchProjetoMetadata, projeto],
  )

  const handleMetadataFieldSave = useCallback(
    async (field: ProjetoHomeMetadataField, value: string) => {
      if (!projeto) return
      setActionError(null)
      try {
        const next = await updateProjetoMetadataField(
          projeto.id,
          projeto.metadata ?? {},
          field,
          value,
        )
        patchProjetoMetadata(next)
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Erro ao salvar dados do projeto')
        throw err
      }
    },
    [projeto, patchProjetoMetadata],
  )

  const handleEnderecoSave = useCallback(
    async (value: string) => {
      if (!projeto) return
      setActionError(null)
      try {
        const trimmed = value.trim()
        await updateProjetoColumn(projeto.id, 'endereco', trimmed || null)
        patchProjeto({ endereco: trimmed || null })
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Erro ao salvar endereço')
        throw err
      }
    },
    [projeto, patchProjeto],
  )

  const handleTipoEdificacaoSave = useCallback(
    async (value: string) => {
      if (!projeto) return
      setActionError(null)
      try {
        const trimmed = value.trim()
        await updateProjetoColumn(projeto.id, 'tipo_edificacao', trimmed || null)
        patchProjeto({ tipo_edificacao: trimmed || null })
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Erro ao salvar finalidade')
        throw err
      }
    },
    [projeto, patchProjeto],
  )

  const handleClienteIdSave = useCallback(
    async (clienteId: string | null) => {
      if (!projeto) return
      setActionError(null)
      try {
        await updateProjetoColumn(projeto.id, 'cliente_id', clienteId)

        if (!clienteId) {
          patchProjeto({ cliente_id: null, cliente_nome: null, cliente: null })
          return
        }

        const { data: clienteRow, error: clienteError } = await supabase
          .from('clientes')
          .select('nome, cnpj_cpf, contato, email')
          .eq('id', clienteId)
          .maybeSingle()

        if (clienteError) throw new Error(clienteError.message)

        patchProjeto({
          cliente_id: clienteId,
          cliente_nome: clienteRow?.nome ?? null,
          cliente: clienteRow
            ? {
                nome: clienteRow.nome,
                cnpj_cpf: clienteRow.cnpj_cpf,
                contato: clienteRow.contato,
                email: clienteRow.email,
              }
            : null,
        })
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Erro ao vincular cliente')
        throw err
      }
    },
    [projeto, patchProjeto],
  )

  const handleAddDisciplina = useCallback(
    async (
      disciplina: Disciplina,
      metodologiaDisc: Metodologia,
      selectedTemplateIds: Set<string>,
    ) => {
      if (!profile || !projeto) return
      setActionError(null)
      try {
        const result = await addDisciplinaToProjeto({
          projetoId: projeto.id,
          disciplina,
          metodologia: metodologiaDisc,
          currentDisciplinas: projeto.disciplinas,
          currentMetodologia: projeto.metodologia,
          currentFasesAtuais: projeto.fases_atuais,
          selectedTemplateIds,
        })

        patchProjeto({
          disciplinas: result.disciplinas,
          metodologia: result.metodologia,
          fases_atuais: result.fases_atuais,
        })
        appendTarefas(result.tarefas)

        void logActivity({
          projetoId: projeto.id,
          usuarioId: profile.id,
          tipo: 'projeto_status_alterado',
          descricao: `${profile.nome} adicionou disciplina ${DISCIPLINA_LABELS[disciplina]} ao projeto`,
          metadata: { disciplina, acao: 'disciplina_adicionada' },
        })
        bumpActivityFeed()
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Erro ao adicionar disciplina')
        throw err
      }
    },
    [profile, projeto, patchProjeto, appendTarefas, bumpActivityFeed],
  )

  const handlePrepareRemoveDisciplina = useCallback(
    async (disciplina: Disciplina) => {
      if (!projeto) return { openRevisoesCount: 0 }
      const revisoes = await fetchProjectRevisoes(projeto.id, disciplina)
      const openRevisoesCount = revisoes.filter((r) => r.status === 'aberta').length
      return { openRevisoesCount }
    },
    [projeto],
  )

  const handleRemoveDisciplina = useCallback(
    async (disciplina: Disciplina, archiveTasks: boolean) => {
      if (!profile || !projeto) return
      setActionError(null)
      try {
        const result = await removeDisciplinaFromProjeto({
          projetoId: projeto.id,
          disciplina,
          currentDisciplinas: projeto.disciplinas,
          currentMetodologia: projeto.metodologia,
          currentFasesAtuais: projeto.fases_atuais,
          archiveTasks,
          userId: profile.id,
        })

        patchProjeto({
          disciplinas: result.disciplinas,
          metodologia: result.metodologia,
          fases_atuais: result.fases_atuais,
        })

        if (result.archivedTaskIds.length > 0) {
          removeTarefasByIds(result.archivedTaskIds)
        }

        const archivedSuffix =
          result.archivedTaskIds.length > 0
            ? ` (${result.archivedTaskIds.length} tarefas arquivadas)`
            : ''

        void logActivity({
          projetoId: projeto.id,
          usuarioId: profile.id,
          tipo: 'projeto_status_alterado',
          descricao: `${profile.nome} removeu disciplina ${DISCIPLINA_LABELS[disciplina]} do projeto${archivedSuffix}`,
          metadata: {
            disciplina,
            acao: 'disciplina_removida',
            tarefas_arquivadas: result.archivedTaskIds.length,
          },
        })
        bumpActivityFeed()
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Erro ao remover disciplina')
        throw err
      }
    },
    [profile, projeto, patchProjeto, removeTarefasByIds, bumpActivityFeed],
  )

  const handleProjetoStatusChange = useCallback(
    async (newStatus: ProjetoStatus, justificativa?: string) => {
      if (!profile || !projeto) return
      setActionError(null)
      try {
        const result = await updateProjetoStatus(projeto.id, newStatus, {
          justificativa,
          currentDataConclusaoReal: projeto.data_conclusao_real,
          currentSnapshotFechamento: projeto.snapshot_fechamento,
          dataEntregaPrevista: projeto.data_entrega_prevista,
        })

        patchProjeto({
          status: result.status,
          data_conclusao_real: result.data_conclusao_real,
          justificativa_cancelamento: result.justificativa_cancelamento,
          snapshot_fechamento: result.snapshot_fechamento,
        })

        void logActivity({
          projetoId: projeto.id,
          usuarioId: profile.id,
          tipo: 'projeto_status_alterado',
          descricao: `${profile.nome} alterou status para ${projectStatusLabel(newStatus)}`,
          metadata: {
            status_anterior: projeto.status,
            status_novo: newStatus,
            acao: 'status_alterado',
          },
        })

        if (newStatus === 'concluido') {
          const snapshot = parseSnapshotFechamento(result.snapshot_fechamento)
          const totalHoras = snapshot?.horas_totais.total ?? 0
          void logActivity({
            projetoId: projeto.id,
            usuarioId: profile.id,
            tipo: 'projeto_concluido',
            descricao: `${profile.nome} concluiu o projeto — ${formatSnapshotHoras(totalHoras)} registradas`,
            metadata: {
              acao: 'projeto_concluido',
              horas_totais: totalHoras,
            },
          })
        }
        bumpActivityFeed()

        if (newStatus === 'cancelado' || newStatus === 'concluido') {
          navigate('/historico')
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Erro ao alterar status do projeto')
        throw err
      }
    },
    [profile, projeto, patchProjeto, bumpActivityFeed, navigate],
  )

  const handleTarefaCreated = useCallback(
    (tarefa: Tarefa) => {
      appendTarefa(tarefa)
      bumpActivityFeed()
    },
    [appendTarefa, bumpActivityFeed],
  )

  const handleTarefaUpdated = useCallback(
    (tarefa: Tarefa) => {
      patchTarefa(tarefa.id, tarefa)
      bumpActivityFeed()
    },
    [patchTarefa, bumpActivityFeed],
  )

  const handleTarefaMoved = useCallback(
    (tarefa: Tarefa) => {
      patchTarefa(tarefa.id, tarefa)
      bumpActivityFeed()
    },
    [patchTarefa, bumpActivityFeed],
  )

  const handleTarefaDeleted = useCallback(
    (tarefaId: string) => {
      removeTarefa(tarefaId)
      bumpActivityFeed()
    },
    [removeTarefa, bumpActivityFeed],
  )

  const handleTarefasReordered = useCallback(
    (updates: { id: string; ordem: number }[]) => {
      patchTarefasOrdem(updates)
    },
    [patchTarefasOrdem],
  )

  const advanceCheck = useMemo(() => {
    if (!disciplinaAtiva || !faseOficial) return null
    return canAdvancePhase(disciplinaAtiva, faseOficial, tarefas)
  }, [disciplinaAtiva, faseOficial, tarefas])

  const canShowAdvance =
    !readOnly &&
    profile &&
    faseOficial &&
    faseAtiva === faseOficial &&
    advanceCheck?.nextFase != null &&
    (hasPermissao(profile.papel, 'avancar_fase') ||
      hasPermissao(profile.papel, 'liberar_fase_bloqueada'))

  const handleStatusChange = useCallback(
    async (tarefaId: string, status: TarefaStatus, motivo?: string) => {
      if (!profile || !projeto) return
      const tarefa = tarefas.find((t) => t.id === tarefaId)
      if (!tarefa || tarefa.status === status) return

      const statusAnterior = tarefa.status
      setActionError(null)
      try {
        await updateTarefaStatus(tarefaId, status, profile.id, motivo)
        patchTarefa(tarefaId, {
          status,
          motivo_bloqueio: status === 'bloqueado' ? (motivo ?? null) : null,
          data_conclusao: status === 'concluido' ? new Date().toISOString() : null,
          updated_by: profile.id,
        })

        void logActivity({
          projetoId: projeto.id,
          usuarioId: profile.id,
          tipo: 'tarefa_status_alterado',
          descricao: `${profile.nome} alterou '${tarefa.nome}' de '${TAREFA_STATUS_LABELS[statusAnterior]}' para '${TAREFA_STATUS_LABELS[status]}'`,
          metadata: {
            tarefa_id: tarefaId,
            tarefa_nome: tarefa.nome,
            status_anterior: statusAnterior,
            status_novo: status,
          },
        })
        bumpActivityFeed()
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Erro ao atualizar tarefa')
      }
    },
    [profile, projeto, tarefas, patchTarefa, bumpActivityFeed],
  )

  const handleAssigneeChange = useCallback(
    async (tarefaId: string, responsavelId: string | null) => {
      if (!profile || !projeto) return
      const tarefa = tarefas.find((t) => t.id === tarefaId)
      if (!tarefa) return

      setActionError(null)
      try {
        await updateTarefaResponsavel(tarefaId, responsavelId, profile.id)

        const allProfiles = await fetchActiveProfiles()
        const selected = responsavelId
          ? allProfiles.find((p) => p.id === responsavelId)
          : null

        patchTarefa(tarefaId, {
          responsavel_id: responsavelId,
          responsavel_nome: selected?.nome ?? null,
          responsavel_papel: selected?.papel ?? null,
        })

        void logActivity({
          projetoId: projeto.id,
          usuarioId: profile.id,
          tipo: 'tarefa_status_alterado',
          descricao: responsavelId
            ? `${profile.nome} atribuiu '${tarefa.nome}' para ${selected?.nome ?? 'usuário'}`
            : `${profile.nome} removeu responsável de '${tarefa.nome}'`,
          metadata: {
            tarefa_id: tarefaId,
            tarefa_nome: tarefa.nome,
            responsavel_id: responsavelId,
            acao: 'atribuicao_responsavel',
          },
        })
        bumpActivityFeed()
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Erro ao atribuir responsável')
        throw err
      }
    },
    [profile, projeto, tarefas, patchTarefa, bumpActivityFeed],
  )

  function handleTryAdvance() {
    if (!profile || !projeto || !disciplinaAtiva || !faseOficial || !advanceCheck?.nextFase) return

    if (advanceCheck.ok && hasPermissao(profile.papel, 'avancar_fase')) {
      setAdvanceModal({ mode: 'confirm' })
      return
    }

    if (
      !advanceCheck.ok &&
      hasPermissao(profile.papel, 'liberar_fase_bloqueada')
    ) {
      setAdvanceModal({ mode: 'liberacao' })
      return
    }

    setActionError('Não é possível avançar: existem tarefas críticas pendentes.')
  }

  async function handleConfirmAdvance(justificativa?: string) {
    if (!profile || !projeto || !disciplinaAtiva || !faseOficial || !advanceCheck?.nextFase) return

    setAdvancing(true)
    setActionError(null)

    try {
      if (advanceModal?.mode === 'liberacao' && justificativa) {
        const updated = await liberarFaseBloqueada(
          projeto.id,
          disciplinaAtiva,
          faseOficial,
          advanceCheck.nextFase,
          projeto.fases_atuais,
          profile.id,
          justificativa,
          advanceCheck.pendentes.map((t) => t.id),
        )
        patchFasesAtuais(updated)
        setFaseAtiva(advanceCheck.nextFase)

        void logActivity({
          projetoId: projeto.id,
          usuarioId: profile.id,
          tipo: 'fase_liberada',
          descricao: `${profile.nome} liberou ${PHASE_LABELS[faseOficial]} com justificativa: '${justificativa}'`,
          metadata: {
            disciplina: disciplinaAtiva,
            fase_liberada: faseOficial,
            fase_destino: advanceCheck.nextFase,
            justificativa,
          },
        })
        bumpActivityFeed()
      } else if (advanceCheck.ok) {
        const updated = await advanceProjectPhase(
          projeto.id,
          disciplinaAtiva,
          advanceCheck.nextFase,
          projeto.fases_atuais,
        )
        patchFasesAtuais(updated)
        setFaseAtiva(advanceCheck.nextFase)

        void logActivity({
          projetoId: projeto.id,
          usuarioId: profile.id,
          tipo: 'fase_avancada',
          descricao: `${profile.nome} avançou ${DISCIPLINA_LABELS[disciplinaAtiva]} para ${PHASE_LABELS[advanceCheck.nextFase]}`,
          metadata: {
            disciplina: disciplinaAtiva,
            fase_anterior: faseOficial,
            fase_nova: advanceCheck.nextFase,
          },
        })
        bumpActivityFeed()
      }
      setAdvanceModal(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao avançar fase')
    } finally {
      setAdvancing(false)
    }
  }

  async function handleReabrirProjeto() {
    if (!projeto || !canReabrir || reabrindo) return
    setReabrindo(true)
    setActionError(null)
    try {
      await reabrirProjetoSuspenso(projeto.id)
      await refresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao reabrir projeto')
    } finally {
      setReabrindo(false)
    }
  }

  if (loading) {
    return (
      <div className="project-detail project-detail--center">
        <p className="project-detail__status">Carregando projeto…</p>
      </div>
    )
  }

  if (error || !projeto || !disciplinaAtiva || !faseAtiva || !faseOficial) {
    return (
      <div className="project-detail project-detail--center">
        <p className="project-detail__error">{error ?? 'Projeto não encontrado'}</p>
        <Link to="/projetos">← Voltar aos projetos</Link>
      </div>
    )
  }

  const isLastPhase = getNextFase(disciplinaAtiva, faseOficial) === null
  const viewingOther = faseAtiva !== faseOficial

  return (
    <div className="project-detail">
      <div className="project-detail__layout">
        <PhaseSidebar
          disciplinas={projeto.disciplinas}
          disciplinaAtiva={disciplinaAtiva}
          faseAtiva={faseAtiva}
          fasesAtuais={projeto.fases_atuais}
          tarefas={tarefas}
          onDisciplinaChange={setDisciplinaAtiva}
          onFaseChange={setFaseAtiva}
        />

        <div className="project-detail__main">
          {readOnly ? (
            <div className="project-detail__readonly-banner" role="status">
              <span>
                Projeto {PROJETO_STATUS_LABELS[projeto.status]} — somente leitura
              </span>
              {canReabrir ? (
                <Button variant="secondary" loading={reabrindo} onClick={() => void handleReabrirProjeto()}>
                  Reabrir projeto
                </Button>
              ) : null}
            </div>
          ) : null}

          {fechamentoSnapshot ? <ProjectFechamentoCard snapshot={fechamentoSnapshot} /> : null}

          <header className="project-detail__header">
            <div>
              <h1 className="project-detail__title">{projeto.nome}</h1>
              <p className="project-detail__subtitle">{projeto.cliente_nome ?? 'Sem cliente'}</p>
            </div>
            <span
              className={`project-detail__status project-detail__status--${projeto.status.replace('_', '')}`}
            >
              {PROJETO_STATUS_LABELS[projeto.status as keyof typeof PROJETO_STATUS_LABELS] ??
                projeto.status}
            </span>
          </header>

          <ProjectDetailTabs value={mainTab} onChange={setMainTab} />

          {mainTab === 'home' ? (
            <ProjectHomePanel
              projetoId={projeto.id}
              codigo={projeto.codigo}
              numeroSequencial={projeto.numero_sequencial}
              disciplinas={projeto.disciplinas}
              metodologia={projeto.metodologia}
              endereco={projeto.endereco}
              tipoEdificacao={projeto.tipo_edificacao}
              clienteId={projeto.cliente_id}
              cliente={projeto.cliente}
              metadata={projeto.metadata ?? {}}
              tiposEdificacao={tiposEdificacao}
              tarefas={tarefas}
              usuarioId={profile!.id}
              papel={profile!.papel}
              onSaveMetadata={handleMetadataFieldSave}
              onSaveEndereco={handleEnderecoSave}
              onSaveTipoEdificacao={handleTipoEdificacaoSave}
              onSaveClienteId={handleClienteIdSave}
              onAddDisciplina={handleAddDisciplina}
              onPrepareRemoveDisciplina={handlePrepareRemoveDisciplina}
              onRemoveDisciplina={handleRemoveDisciplina}
              onNavigateToTask={handleNavigateToTask}
              readOnly={readOnly}
              status={projeto.status}
              onStatusChange={handleProjetoStatusChange}
              horasEstimadasHid={projeto.horas_estimadas_hid}
              horasEstimadasPpci={projeto.horas_estimadas_ppci}
              camposCustom={camposCustom}
              onSaveCustomField={handleCustomFieldSave}
            />
          ) : mainTab === 'atividade' ? (
            <ActivityFeedPanel
              projetoId={projeto.id}
              nome={projeto.nome}
              clienteNome={projeto.cliente_nome}
              enabled={mainTab === 'atividade'}
              refreshToken={activityRefreshToken}
            />
          ) : mainTab === 'pendencias' ? (
            <PendenciasPanel
              projetoId={projeto.id}
              nome={projeto.nome}
              clienteNome={projeto.cliente_nome}
              disciplinas={projeto.disciplinas}
              papel={profile!.papel}
              usuarioId={profile!.id}
              usuarioNome={profile!.nome}
              tarefas={tarefas}
              enabled={mainTab === 'pendencias'}
              refreshToken={activityRefreshToken}
              expandedPendenciaId={expandedPendenciaId}
              onExpandedPendenciaChange={setExpandedPendenciaId}
              onActivityLogged={bumpActivityFeed}
              onGerarRevisao={handleGerarRevisaoFromPendencia}
              onNavigateToTask={handleNavigateToTask}
            />
          ) : mainTab === 'revisoes' ? (
            <RevisoesPanel
              projetoId={projeto.id}
              nome={projeto.nome}
              clienteNome={projeto.cliente_nome}
              disciplinaAtiva={disciplinaAtiva}
              metodologia={projeto.metodologia}
              fasesAtuais={projeto.fases_atuais as Record<string, unknown>}
              papel={profile!.papel}
              usuarioId={profile!.id}
              usuarioNome={profile!.nome}
              tarefas={tarefas}
              taskTimerTotals={taskTimerTotals}
              enabled={mainTab === 'revisoes'}
              refreshToken={activityRefreshToken}
              expandedRevisaoId={expandedRevisaoId}
              onExpandedRevisaoChange={setExpandedRevisaoId}
              revisaoPrefill={revisaoPrefill}
              onPrefillConsumed={() => setRevisaoPrefill(null)}
              onRevisaoCreated={handleRevisaoCreated}
              onRevisaoCompleted={bumpActivityFeed}
              onActivityLogged={bumpActivityFeed}
              onStatusChange={handleStatusChange}
              onAssigneeChange={handleAssigneeChange}
            />
          ) : mainTab === 'checklist' && faseAtiva === 'PRE_INFO' ? (
            <PreInfoPanel
              nome={projeto.nome}
              clienteNome={projeto.cliente_nome}
              documentos={documentos}
              readOnly={readOnly}
              onStatusChange={handleDocumentoStatusChange}
              onObservacoesChange={handleDocumentoObservacoesChange}
              onAddDocumento={handleAddDocumento}
              onRemoveDocumento={handleRemoveDocumento}
            />
          ) : (
            <ChecklistPanel
              projetoId={projeto.id}
              usuarioId={profile!.id}
              usuarioNome={profile!.nome}
              nome={projeto.nome}
              clienteNome={projeto.cliente_nome}
              status={projeto.status}
              disciplina={disciplinaAtiva}
              fase={faseAtiva}
              faseOficial={faseOficial}
              tarefas={tarefas}
              allTarefas={tarefas}
              papel={profile!.papel}
              taskTimerTotals={taskTimerTotals}
              onStatusChange={handleStatusChange}
              onAssigneeChange={handleAssigneeChange}
              onTarefaCreated={handleTarefaCreated}
              onTarefaUpdated={handleTarefaUpdated}
              onTarefaMoved={handleTarefaMoved}
              onTarefaDeleted={handleTarefaDeleted}
              onTarefasReordered={handleTarefasReordered}
              onActivityLogged={bumpActivityFeed}
              expandedTarefaId={expandedTarefaId}
              readOnly={readOnly}
              documentos={documentos}
              onNavigateToPreInfo={handleNavigateToPreInfo}
            />
          )}
        </div>
      </div>

      {actionError ? (
        <div className="project-detail__toast project-detail__toast--error" role="alert">
          {actionError}
        </div>
      ) : null}

      <footer className="project-detail__footer">
        <Link to={readOnly ? '/historico' : '/projetos'} className="project-detail__back">
          {readOnly ? '← Histórico' : '← Projetos'}
        </Link>
        <div className="project-detail__footer-actions">
          {viewingOther && !isLastPhase ? (
            <Button variant="secondary" onClick={() => setFaseAtiva(faseOficial)}>
              Ir para fase atual
            </Button>
          ) : null}
          {canShowAdvance && !isLastPhase && mainTab === 'checklist' ? (
            <Button variant="primary" onClick={handleTryAdvance}>
              Avançar fase →
            </Button>
          ) : null}
        </div>
      </footer>

      {advanceModal && advanceCheck?.nextFase ? (
        <PhaseAdvanceModal
          open
          disciplina={disciplinaAtiva}
          faseAtual={faseOficial}
          nextFase={advanceCheck.nextFase}
          pendentes={advanceCheck.pendentes}
          mode={advanceModal.mode}
          loading={advancing}
          onClose={() => setAdvanceModal(null)}
          onConfirm={(j) => void handleConfirmAdvance(j)}
        />
      ) : null}
    </div>
  )
}

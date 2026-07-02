import { supabase } from './supabase'
import { projectRowToRpcParams, upsertProjetoRpc } from './projetoRpc'
import { insertTarefasRpc, type TarefaInsertRow } from './tarefaRpc'
import { FASES_COM_CHECKLIST, PHASE_SEQUENCES } from './constants'
import { fetchDefaultDocumentosPadrao } from './documentosProjeto'
import type {
  ChecklistSelectionState,
  CreateProjectPayload,
  ProjectFormData,
} from '../types/project-create'
import type {
  Disciplina,
  Fase,
  FasesAtuais,
  Metodologia,
  Projeto,
  Tarefa,
  TemplateChecklist,
} from '../types'

const METODOLOGIA_RANK: Record<Metodologia, number> = { '2D': 1, '3D': 2, BIM: 3 }

export function normalizeCodigo(codigo: string): string {
  return codigo.trim().toUpperCase()
}

export function templateAppliesToMetodologia(
  template: TemplateChecklist,
  metodologia: Metodologia,
): boolean {
  if (!template.metodologia_minima) return true
  return METODOLOGIA_RANK[metodologia] >= METODOLOGIA_RANK[template.metodologia_minima]
}

export function getFasesAnteriores(disciplina: Disciplina, faseEntrada: Fase): Fase[] {
  const sequencia: readonly Fase[] = PHASE_SEQUENCES[disciplina]
  const idx = sequencia.indexOf(faseEntrada)
  if (idx <= 0) return []
  return sequencia.slice(0, idx) as Fase[]
}

export function buildFasesAtuais(
  modo: CreateProjectPayload['modo'],
  disciplinas: Disciplina[],
  checklist: ChecklistSelectionState,
): FasesAtuais {
  const fasesAtuais: FasesAtuais = {}

  for (const disciplina of disciplinas) {
    if (modo === 'novo') {
      fasesAtuais[disciplina] = 'PRE_INFO'
      continue
    }

    if (modo === 'em_andamento') {
      const faseEntrada = checklist.faseEntrada[disciplina] ?? 'INFO_GERAL'
      fasesAtuais[disciplina] = faseEntrada
      const anteriores = getFasesAnteriores(disciplina, faseEntrada)
      if (anteriores.length > 0) {
        fasesAtuais[`${disciplina}_concluidas_ext`] = anteriores
      }
    }
  }

  return fasesAtuais
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function projectRowFromForm(
  payload: CreateProjectPayload,
): Record<string, unknown> {
  const { modo, form, checklist, createdBy } = payload
  const disciplinas = form.disciplinas
  const metodologia: Partial<Record<Disciplina, Metodologia>> = {}

  for (const d of disciplinas) {
    metodologia[d] = form.metodologia[d] ?? '2D'
  }

  const base: Record<string, unknown> = {
    codigo: normalizeCodigo(form.codigo),
    nome: form.nome.trim(),
    cliente_id: form.cliente_id,
    endereco: form.endereco.trim() || null,
    tipo_edificacao: form.tipo_edificacao.trim() || null,
    area_m2: parseOptionalNumber(form.area_m2),
    disciplinas,
    metodologia,
    modo_criacao: modo,
    fases_atuais: buildFasesAtuais(modo, disciplinas, checklist),
    data_inicio: form.data_inicio || null,
    data_protocolo_prevista: form.data_protocolo_prevista || null,
    data_entrega_prevista: form.data_entrega_prevista || null,
    horas_estimadas_hid: parseOptionalNumber(form.horas_estimadas_hid),
    horas_estimadas_ppci: parseOptionalNumber(form.horas_estimadas_ppci),
    created_by: createdBy,
  }

  if (modo === 'historico') {
    base.status = form.status
    base.data_conclusao_real = form.data_conclusao_real || null
    base.justificativa_cancelamento =
      form.status === 'cancelado' ? form.justificativa_cancelamento.trim() || null : null
  } else {
    base.status = 'ativo'
  }

  return base
}

export async function fetchActiveTemplates(
  disciplinas: Disciplina[],
): Promise<TemplateChecklist[]> {
  const { data, error } = await supabase
    .from('templates_checklist')
    .select('*')
    .in('disciplina', disciplinas)
    .eq('ativo', true)
    .is('deleted_at', null)
    .order('ordem', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as TemplateChecklist[]
}

export function filterTemplatesForMode(
  templates: TemplateChecklist[],
  modo: CreateProjectPayload['modo'],
  form: ProjectFormData,
  checklist: ChecklistSelectionState,
): TemplateChecklist[] {
  return templates.filter((template) => {
    if (!FASES_COM_CHECKLIST.includes(template.fase as Fase)) return false
    if (!form.disciplinas.includes(template.disciplina)) return false

    const metodologia = form.metodologia[template.disciplina] ?? '2D'
    if (!templateAppliesToMetodologia(template, metodologia)) return false

    if (modo === 'novo') {
      return !checklist.disabledTemplateIds.has(template.id)
    }

    if (modo === 'em_andamento') {
      return checklist.selectedTemplateIds.has(template.id)
    }

    return false
  })
}

function templateToTarefaRow(template: TemplateChecklist, projetoId: string): TarefaInsertRow {
  return {
    projeto_id: projetoId,
    template_id: template.id,
    disciplina: template.disciplina,
    fase: template.fase,
    categoria: template.categoria,
    nome: template.nome,
    descricao: template.descricao,
    criticidade: template.criticidade,
    origem: template.origem,
    referencia_normativa: template.referencia_normativa,
    metodologia_minima: template.metodologia_minima,
    ordem: template.ordem,
    status: 'pendente',
  }
}

async function insertDefaultDocumentos(projetoId: string) {
  const defaults = await fetchDefaultDocumentosPadrao()
  const rows = defaults.map((doc) => ({
    projeto_id: projetoId,
    disciplina: null,
    nome: doc.nome,
    tipo: doc.tipo,
    critico: doc.critico,
    status: 'aguardando' as const,
  }))

  const { error } = await supabase.from('documentos_projeto').insert(rows)
  if (error) throw new Error(error.message)
}

async function copyTemplatesToTarefas(
  projetoId: string,
  templates: TemplateChecklist[],
): Promise<Tarefa[]> {
  if (templates.length === 0) return []

  const rows = templates.map((t) => templateToTarefaRow(t, projetoId))
  return insertTarefasRpc(rows)
}

export { copyTemplatesToTarefas }

export async function createProject(payload: CreateProjectPayload): Promise<Projeto> {
  const { modo, form } = payload

  if (!form.nome.trim()) throw new Error('Nome do projeto é obrigatório.')
  if (!form.codigo.trim()) throw new Error('Código do projeto é obrigatório.')
  if (form.disciplinas.length === 0) throw new Error('Selecione ao menos uma disciplina.')

  if (modo === 'historico' && form.status === 'cancelado' && !form.justificativa_cancelamento.trim()) {
    throw new Error('Justificativa de cancelamento é obrigatória.')
  }

  const { data: existing } = await supabase
    .from('projetos')
    .select('id')
    .eq('codigo', normalizeCodigo(form.codigo))
    .is('deleted_at', null)
    .limit(1)

  if (existing && existing.length > 0) {
    throw new Error('Código já utilizado em outro projeto')
  }

  const projetoId = await upsertProjetoRpc(projectRowToRpcParams(projectRowFromForm(payload)))

  const { data: projeto, error: fetchError } = await supabase
    .from('projetos')
    .select('*')
    .eq('id', projetoId)
    .single()

  if (fetchError) throw new Error(fetchError.message)

  if (modo === 'novo' || modo === 'em_andamento') {
    await insertDefaultDocumentos(projetoId)

    const allTemplates = await fetchActiveTemplates(form.disciplinas)
    const selected = filterTemplatesForMode(allTemplates, modo, form, payload.checklist)
    await copyTemplatesToTarefas(projetoId, selected)
  }

  return projeto as Projeto
}

export async function checkCodigoDisponivel(
  codigo: string,
  excludeProjectId?: string,
): Promise<boolean> {
  const normalized = normalizeCodigo(codigo)
  if (!normalized) return true

  let query = supabase
    .from('projetos')
    .select('id')
    .eq('codigo', normalized)
    .is('deleted_at', null)
    .limit(1)

  if (excludeProjectId) {
    query = query.neq('id', excludeProjectId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data?.length ?? 0) === 0
}

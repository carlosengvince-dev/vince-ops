import type {
  Disciplina,
  Fase,
  FasesAtuais,
  Metodologia,
  ModoCriacao,
  ProjetoStatus,
  TemplateChecklist,
} from './index'

export interface ProjectFormData {
  codigo: string
  nome: string
  cliente_id: string | null
  endereco: string
  tipo_edificacao: string
  area_m2: string
  disciplinas: Disciplina[]
  metodologia: Partial<Record<Disciplina, Metodologia>>
  data_inicio: string
  data_protocolo_prevista: string
  data_entrega_prevista: string
  horas_estimadas_hid: string
  horas_estimadas_ppci: string
  /** Modo historico */
  status: ProjetoStatus
  data_conclusao_real: string
  justificativa_cancelamento: string
}

export const EMPTY_PROJECT_FORM: ProjectFormData = {
  codigo: '',
  nome: '',
  cliente_id: null,
  endereco: '',
  tipo_edificacao: '',
  area_m2: '',
  disciplinas: [],
  metodologia: {},
  data_inicio: '',
  data_protocolo_prevista: '',
  data_entrega_prevista: '',
  horas_estimadas_hid: '',
  horas_estimadas_ppci: '',
  status: 'concluido',
  data_conclusao_real: '',
  justificativa_cancelamento: '',
}

export interface ChecklistSelectionState {
  /** Fase de entrada por disciplina (modo em_andamento) */
  faseEntrada: Partial<Record<Disciplina, Fase>>
  /** IDs de templates ativos para copiar (em_andamento) */
  selectedTemplateIds: Set<string>
  /** IDs desmarcados no modo novo (todas ativas por padrão) */
  disabledTemplateIds: Set<string>
}

export const EMPTY_CHECKLIST_SELECTION: ChecklistSelectionState = {
  faseEntrada: {},
  selectedTemplateIds: new Set(),
  disabledTemplateIds: new Set(),
}

export interface CreateProjectPayload {
  modo: ModoCriacao
  form: ProjectFormData
  checklist: ChecklistSelectionState
  createdBy: string
}

export interface ProjetoListItem {
  id: string
  codigo: string
  numero_sequencial: number
  nome: string
  status: ProjetoStatus
  disciplinas: Disciplina[]
  metodologia: Partial<Record<Disciplina, Metodologia>>
  fases_atuais: FasesAtuais
  cliente_id: string | null
  cliente_nome: string | null
  data_inicio: string | null
  data_entrega_prevista: string | null
  created_at: string
}

export interface DashboardMetrics {
  projetosAtivos: number
  tarefasAbertas: number
  horasMesSegundos: number
  projetosConcluidos: number
}

export interface HorasPorMesItem {
  label: string
  key: string
  segundos: number
}

export interface TarefasPorStatusCounts {
  concluido: number
  em_elaboracao: number
  em_revisao: number
  bloqueado: number
  pendente: number
  nao_aplica: number
}

export interface TarefaHojeItem {
  id: string
  nome: string
  projeto_codigo: string
  responsavel_id: string | null
  responsavel_nome: string | null
  status: 'em_elaboracao' | 'em_revisao'
}

export function sortTarefasHojeForUser(
  items: TarefaHojeItem[],
  userId: string | undefined,
  limit = 5,
): TarefaHojeItem[] {
  if (!userId) return items.slice(0, limit)

  const mine = items.filter((t) => t.responsavel_id === userId)
  const others = items.filter((t) => t.responsavel_id !== userId)
  return [...mine, ...others].slice(0, limit)
}

export interface CalendarProjectDates {
  data_inicio: string | null
  data_entrega_prevista: string | null
}

export type TemplateGrouped = Record<string, Record<string, TemplateChecklist[]>>

export type Papel =
  | 'diretor_executivo'
  | 'gestor'
  | 'projetista'
  | 'administrador'
  | 'proprietario'

export type Disciplina = string

export type Metodologia = '2D' | '3D' | 'BIM'

export type ProjetoStatus =
  | 'ativo'
  | 'em_revisao'
  | 'suspenso'
  | 'cancelado'
  | 'concluido'

export type ModoCriacao = 'novo' | 'em_andamento' | 'historico'

export type TarefaStatus =
  | 'pendente'
  | 'em_elaboracao'
  | 'em_revisao'
  | 'bloqueado'
  | 'concluido'
  | 'nao_aplica'

export type Criticidade = 'critico' | 'normal'

export type OrigemNormativa = 'EMASA' | 'CBMSC' | 'NBR' | 'Prefeitura' | 'interno'

export type ExecutorPadrao = 'gestor' | 'projetista' | 'ambos'

export type RevisaoStatus = 'aberta' | 'concluida'

export type RevisaoOrigem =
  | 'Exigência CBMSC'
  | 'Exigência EMASA'
  | 'Solicitação cliente'
  | 'Interno'

export type PendenciaStatus = 'aberta' | 'respondida' | 'cancelada'

export type PendenciaOrgao = 'CBMSC' | 'EMASA' | 'Cliente' | 'Outro'

export type PendenciaTipo = 'Comunique-se' | 'Exigência' | 'Solicitação' | 'Dúvida'

export type DocumentoStatus = 'aguardando' | 'recebido' | 'nao_receberemos'

export type ActivityLogTipo =
  | 'projeto_criado'
  | 'fase_avancada'
  | 'fase_liberada'
  | 'tarefa_status_alterado'
  | 'tarefa_concluida'
  | 'tarefa_bloqueada'
  | 'revisao_criada'
  | 'pendencia_criada'
  | 'projeto_suspenso'
  | 'projeto_cancelado'
  | 'projeto_concluido'
  | 'projeto_status_alterado'
  | 'comentario_adicionado'
  | 'timer_iniciado'
  | 'timer_parado'

export type Fase =
  | 'PRE_INFO'
  | 'INFO_GERAL'
  | 'EP'
  | 'PP'
  | 'AP'
  | 'PROTOCOLO_EMASA'
  | 'PROTOCOLO_CBMSC'
  | 'EX'
  | 'EX_APRESENTACAO'
  | 'ENTREGA'

export interface Profile {
  id: string
  nome: string
  papel: Papel
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Organizacao {
  id: string
  nome: string
  slug: string | null
  metadata: Record<string, unknown>
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface Cliente {
  id: string
  nome: string
  contato: string | null
  email: string | null
  telefone: string | null
  cnpj_cpf: string | null
  observacoes: string | null
  metadata: Record<string, unknown>
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface Projeto {
  id: string
  codigo: string
  numero_sequencial: number
  nome: string
  cliente_id: string | null
  endereco: string | null
  tipo_edificacao: string | null
  area_m2: number | null
  disciplinas: Disciplina[]
  metodologia: Partial<Record<Disciplina, Metodologia>>
  status: ProjetoStatus
  justificativa_cancelamento: string | null
  modo_criacao: ModoCriacao
  fases_atuais: FasesAtuais
  data_inicio: string | null
  data_protocolo_prevista: string | null
  data_entrega_prevista: string | null
  data_conclusao_real: string | null
  horas_estimadas_hid: number | null
  horas_estimadas_ppci: number | null
  responsaveis: Partial<Record<Disciplina, string[]>>
  snapshot_fechamento: Record<string, unknown> | null
  metadata: Record<string, unknown>
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

/** Fase atual por disciplina + fases concluídas externamente (modo em_andamento). */
export type FasesAtuais = Partial<Record<Disciplina | `${Disciplina}_concluidas_ext`, Fase | Fase[]>>

export interface Revisao {
  id: string
  projeto_id: string
  numero: string
  disciplina: Disciplina
  origem: RevisaoOrigem
  descricao: string | null
  status: RevisaoStatus
  data_abertura: string
  data_conclusao: string | null
  criado_por: string | null
  criado_por_nome?: string | null
  deleted_at: string | null
  created_at: string
}

export interface PendenciaExterna {
  id: string
  projeto_id: string
  orgao: PendenciaOrgao
  tipo: PendenciaTipo
  descricao: string
  prazo: string | null
  status: PendenciaStatus
  revisao_gerada_id: string | null
  data_recebimento: string | null
  tarefas_vinculadas: string[]
  criado_por: string | null
  criado_por_nome?: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface DocumentoProjeto {
  id: string
  projeto_id: string
  disciplina: Disciplina | null
  nome: string
  tipo: string
  status: DocumentoStatus
  critico: boolean
  observacoes: string | null
  data_recebimento: string | null
  deleted_at: string | null
  created_at: string
}

export interface TemplateChecklist {
  id: string
  disciplina: Disciplina
  fase: Fase
  categoria: string
  nome: string
  descricao: string | null
  criticidade: Criticidade
  origem: OrigemNormativa
  referencia_normativa: string | null
  executor_padrao: ExecutorPadrao
  metodologia_minima: Metodologia | null
  ordem: number
  ativo: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface Tarefa {
  id: string
  projeto_id: string
  revisao_id: string | null
  template_id: string | null
  disciplina: Disciplina
  fase: Fase
  categoria: string
  nome: string
  descricao: string | null
  criticidade: Criticidade
  origem: OrigemNormativa
  referencia_normativa: string | null
  metodologia_minima: Metodologia | null
  ordem: number
  status: TarefaStatus
  motivo_bloqueio: string | null
  responsavel_id: string | null
  responsavel_nome?: string | null
  responsavel_papel?: Papel | null
  data_conclusao: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  updated_by: string | null
}

export interface Comentario {
  id: string
  tarefa_id: string
  autor_id: string
  texto: string
  deleted_at: string | null
  created_at: string
}

export type RegistroTempoOrigem = 'timer' | 'manual'

export interface RegistroTempo {
  id: string
  tarefa_id: string
  projeto_id: string
  disciplina: Disciplina
  usuario_id: string
  inicio: string
  fim: string | null
  duracao_segundos: number | null
  origem: RegistroTempoOrigem
  descricao: string | null
  deleted_at: string | null
  created_at: string
}

export interface LiberacaoFase {
  id: string
  projeto_id: string
  disciplina: Disciplina
  fase_liberada: Fase
  liberado_por: string
  justificativa: string
  tarefas_pendentes_ids: string[] | null
  created_at: string
}

export interface ActivityLogEntry {
  id: string
  projeto_id: string | null
  usuario_id: string
  tipo: ActivityLogTipo
  descricao: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface CanAdvancePhaseResult {
  ok: boolean
  pendentes: Tarefa[]
  faseAtual?: Fase
  nextFase?: Fase
  reason?: string
}

/** Tipagem mínima do Supabase client (expandir conforme necessário). */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'> & {
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Profile>
      }
      clientes: {
        Row: Cliente
        Insert: Partial<Cliente> & Pick<Cliente, 'nome'>
        Update: Partial<Cliente>
      }
      projetos: {
        Row: Projeto
        Insert: Partial<Projeto> & Pick<Projeto, 'codigo' | 'nome'>
        Update: Partial<Projeto>
      }
      tarefas: {
        Row: Tarefa
        Insert: Partial<Tarefa> & Pick<Tarefa, 'projeto_id' | 'disciplina' | 'fase' | 'categoria' | 'nome'>
        Update: Partial<Tarefa>
      }
    }
  }
}

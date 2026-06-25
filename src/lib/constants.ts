import type {
  CanAdvancePhaseResult,
  Disciplina,
  Fase,
  Papel,
  Tarefa,
} from '../types'

export const PHASE_SEQUENCES = {
  HID: ['PRE_INFO', 'INFO_GERAL', 'EP', 'PP', 'AP', 'PROTOCOLO_EMASA', 'EX', 'ENTREGA'],
  PPCI: ['PRE_INFO', 'INFO_GERAL', 'EP', 'AP', 'PROTOCOLO_CBMSC', 'EX_APRESENTACAO', 'ENTREGA'],
  SPK: ['PRE_INFO', 'INFO_GERAL', 'EP', 'AP', 'ENTREGA'],
} as const satisfies Record<Disciplina, readonly Fase[]>

export const PHASE_LABELS: Record<Fase, string> = {
  PRE_INFO: 'Recebimento',
  INFO_GERAL: 'Informações gerais',
  EP: 'Estudo preliminar',
  PP: 'Projeto preliminar',
  AP: 'Anteprojeto',
  PROTOCOLO_EMASA: 'Protocolo EMASA',
  PROTOCOLO_CBMSC: 'Protocolo CBMSC',
  EX: 'Executivo',
  EX_APRESENTACAO: 'Executivo / Apresentação',
  ENTREGA: 'Entrega',
}

export const DISCIPLINA_LABELS: Record<Disciplina, string> = {
  HID: 'Hidrossanitário',
  PPCI: 'PPCI',
  SPK: 'SPK',
}

export const PROJETO_STATUS_LABELS = {
  ativo: 'Ativo',
  em_revisao: 'Em revisão',
  suspenso: 'Suspenso',
  cancelado: 'Cancelado',
  concluido: 'Concluído',
} as const

export const TAREFA_STATUS_LABELS = {
  pendente: 'Pendente',
  em_elaboracao: 'Em elaboração',
  em_revisao: 'Em revisão',
  bloqueado: 'Bloqueado',
  concluido: 'Concluído',
  nao_aplica: 'Não aplica',
} as const

export const PAPEL_LABELS: Record<Papel, string> = {
  diretor_executivo: 'Diretor Executivo',
  gestor: 'Gestor',
  projetista: 'Projetista',
  administrador: 'Administrador',
  proprietario: 'Proprietário',
}

const GESTOR_PERMISSOES = {
  criar_projeto: true,
  editar_projeto: true,
  deletar_projeto: true,
  avancar_fase: true,
  liberar_fase_bloqueada: true,
  acessar_configuracoes: true,
  convidar_usuarios: true,
  ver_todos_projetos: true,
  editar_tarefas: true,
  iniciar_timer: true,
  criar_revisao: true,
  cancelar_projeto: true,
  gerenciar_gestores: false,
  gerenciar_papeis: false,
  alterar_proprio_email: false,
  imortal: false,
} as const

const SEM_ACESSO_EXTRA = {
  gerenciar_gestores: false,
  gerenciar_papeis: false,
  alterar_proprio_email: false,
  imortal: false,
} as const

export const PERMISSOES = {
  diretor_executivo: {
    ...GESTOR_PERMISSOES,
    gerenciar_gestores: true,
    gerenciar_papeis: true,
    alterar_proprio_email: true,
    imortal: true,
  },
  gestor: {
    ...GESTOR_PERMISSOES,
  },
  projetista: {
    criar_projeto: false,
    editar_projeto: false,
    deletar_projeto: false,
    avancar_fase: false,
    liberar_fase_bloqueada: false,
    acessar_configuracoes: false,
    convidar_usuarios: false,
    ver_todos_projetos: true,
    editar_tarefas: true,
    iniciar_timer: true,
    criar_revisao: false,
    cancelar_projeto: false,
    ...SEM_ACESSO_EXTRA,
  },
  administrador: {
    criar_projeto: false,
    editar_projeto: false,
    deletar_projeto: false,
    avancar_fase: false,
    liberar_fase_bloqueada: false,
    acessar_configuracoes: false,
    convidar_usuarios: false,
    ver_todos_projetos: true,
    editar_tarefas: false,
    iniciar_timer: false,
    criar_revisao: false,
    cancelar_projeto: false,
    ...SEM_ACESSO_EXTRA,
  },
  proprietario: {
    criar_projeto: false,
    editar_projeto: false,
    deletar_projeto: false,
    avancar_fase: false,
    liberar_fase_bloqueada: false,
    acessar_configuracoes: false,
    convidar_usuarios: false,
    ver_todos_projetos: true,
    editar_tarefas: false,
    iniciar_timer: false,
    criar_revisao: false,
    cancelar_projeto: false,
    ...SEM_ACESSO_EXTRA,
  },
} as const

export type Permissao = keyof (typeof PERMISSOES)['gestor']

export function hasPermissao(papel: Papel, permissao: Permissao): boolean {
  return PERMISSOES[papel][permissao]
}

/** Fases que possuem checklist de tarefas (PRE_INFO é só documentos). */
export const FASES_COM_CHECKLIST: Fase[] = [
  'INFO_GERAL',
  'EP',
  'PP',
  'AP',
  'PROTOCOLO_EMASA',
  'PROTOCOLO_CBMSC',
  'EX',
  'EX_APRESENTACAO',
  'ENTREGA',
]

export const DEFAULT_DOCUMENTOS_PADRAO = [
  { nome: 'Planta de situação', tipo: 'Planta', critico: true },
  { nome: 'ART do responsável técnico', tipo: 'ART', critico: true },
  { nome: 'Memorial descritivo do cliente', tipo: 'Memorial', critico: false },
  { nome: 'Planta baixa arquitetônica', tipo: 'Planta', critico: false },
  { nome: 'Cortes e fachadas', tipo: 'Planta', critico: false },
  { nome: 'Planta de cobertura', tipo: 'Planta', critico: false },
] as const

export function formatNumeroProjeto(numeroSequencial: number, ano = new Date().getFullYear()): string {
  return `VNC-${ano}-${numeroSequencial.toString().padStart(3, '0')}`
}

export function getFaseIndex(disciplina: Disciplina, fase: Fase): number {
  const sequencia: readonly Fase[] = PHASE_SEQUENCES[disciplina]
  return sequencia.indexOf(fase)
}

export function getFaseAtual(fasesAtuais: Record<string, unknown>, disciplina: Disciplina): Fase {
  const fase = fasesAtuais[disciplina]
  if (typeof fase === 'string') {
    return fase as Fase
  }
  const sequencia = PHASE_SEQUENCES[disciplina]
  return sequencia[0]
}

export function getNextFase(disciplina: Disciplina, faseAtual: Fase): Fase | null {
  const fases: readonly Fase[] = PHASE_SEQUENCES[disciplina]
  const idx = fases.indexOf(faseAtual)
  if (idx < 0 || idx >= fases.length - 1) {
    return null
  }
  return fases[idx + 1]
}

export function canAdvancePhase(
  disciplina: Disciplina,
  faseAtual: Fase,
  tarefas: Tarefa[],
): CanAdvancePhaseResult {
  const fases: readonly Fase[] = PHASE_SEQUENCES[disciplina]
  const idx = fases.indexOf(faseAtual)

  if (idx < 0) {
    return { ok: false, pendentes: [], reason: 'Fase inválida' }
  }

  if (idx >= fases.length - 1) {
    return { ok: false, pendentes: [], faseAtual, reason: 'Última fase' }
  }

  const criticas = tarefas.filter(
    (t) =>
      t.disciplina === disciplina &&
      t.fase === faseAtual &&
      t.revisao_id == null &&
      t.criticidade === 'critico' &&
      t.deleted_at === null,
  )

  let pendentes: Tarefa[]

  if (faseAtual === 'PROTOCOLO_EMASA') {
    pendentes = criticas.filter(
      (t) =>
        t.origem === 'EMASA' &&
        t.status !== 'concluido' &&
        t.status !== 'nao_aplica',
    )
  } else if (faseAtual === 'PROTOCOLO_CBMSC') {
    pendentes = criticas.filter((t) => t.status !== 'concluido')
  } else {
    pendentes = criticas.filter(
      (t) => t.status !== 'concluido' && t.status !== 'nao_aplica',
    )
  }

  return {
    ok: pendentes.length === 0,
    pendentes,
    faseAtual,
    nextFase: fases[idx + 1],
  }
}

import { TAREFA_STATUS_LABELS } from './constants'
import type { Tarefa, TarefaStatus } from '../types'

export type ChecklistGroupBy =
  | 'categoria'
  | 'status'
  | 'responsavel'
  | 'criticidade'
  | 'nenhum'

export type ChecklistSortBy =
  | 'padrao'
  | 'nome_asc'
  | 'nome_desc'
  | 'status'
  | 'criticidade'
  | 'responsavel'
  | 'horas_desc'

export const STATUS_FLOW: TarefaStatus[] = [
  'pendente',
  'em_elaboracao',
  'em_revisao',
  'bloqueado',
  'concluido',
  'nao_aplica',
]

const STATUS_RANK = Object.fromEntries(STATUS_FLOW.map((s, i) => [s, i])) as Record<
  TarefaStatus,
  number
>

export interface ChecklistViewSection {
  id: string
  title: string
  items: Tarefa[]
}

export function filterChecklistTarefas(
  tarefas: Tarefa[],
  opts: {
    nome: string
    status: TarefaStatus | ''
    categoria: string
    soMeus: boolean
    usuarioId: string
    ocultarConcluidos: boolean
  },
): Tarefa[] {
  const q = opts.nome.trim().toLowerCase()
  return tarefas.filter((t) => {
    if (opts.status && t.status !== opts.status) return false
    if (opts.categoria && t.categoria !== opts.categoria) return false
    if (q && !t.nome.toLowerCase().includes(q)) return false
    if (opts.soMeus && t.responsavel_id !== opts.usuarioId) return false
    if (opts.ocultarConcluidos && (t.status === 'concluido' || t.status === 'nao_aplica')) {
      return false
    }
    return true
  })
}

function compareNome(a: Tarefa, b: Tarefa): number {
  return a.nome.localeCompare(b.nome, 'pt-BR')
}

export function sortChecklistTarefas(
  tarefas: Tarefa[],
  sortBy: ChecklistSortBy,
  taskTimerTotals: Record<string, number>,
  criticosNoTopo: boolean,
): Tarefa[] {
  const list = [...tarefas]

  const secondary = (a: Tarefa, b: Tarefa): number => {
    if (criticosNoTopo) {
      const ac = a.criticidade === 'critico' ? 0 : 1
      const bc = b.criticidade === 'critico' ? 0 : 1
      if (ac !== bc) return ac - bc
    }
    if (sortBy === 'padrao') return a.ordem - b.ordem || compareNome(a, b)
    return compareNome(a, b)
  }

  list.sort((a, b) => {
    let primary = 0
    switch (sortBy) {
      case 'padrao':
        primary = a.ordem - b.ordem
        break
      case 'nome_asc':
        primary = compareNome(a, b)
        break
      case 'nome_desc':
        primary = compareNome(b, a)
        break
      case 'status':
        primary = STATUS_RANK[a.status] - STATUS_RANK[b.status]
        break
      case 'criticidade': {
        const ac = a.criticidade === 'critico' ? 0 : 1
        const bc = b.criticidade === 'critico' ? 0 : 1
        primary = ac - bc
        break
      }
      case 'responsavel': {
        const an = a.responsavel_nome?.trim() || '\uffff'
        const bn = b.responsavel_nome?.trim() || '\uffff'
        primary = an.localeCompare(bn, 'pt-BR')
        break
      }
      case 'horas_desc':
        primary = (taskTimerTotals[b.id] ?? 0) - (taskTimerTotals[a.id] ?? 0)
        break
      default:
        primary = 0
    }

    if (primary !== 0) {
      if (criticosNoTopo && sortBy !== 'criticidade') {
        const ac = a.criticidade === 'critico' ? 0 : 1
        const bc = b.criticidade === 'critico' ? 0 : 1
        if (ac !== bc) return ac - bc
      }
      return primary
    }
    return secondary(a, b)
  })

  return list
}

export function groupChecklistTarefas(
  tarefas: Tarefa[],
  groupBy: ChecklistGroupBy,
  orderedCategoriaNames: string[],
): ChecklistViewSection[] {
  if (groupBy === 'nenhum') {
    return [{ id: '__flat__', title: 'Todas as tarefas', items: tarefas }]
  }

  if (groupBy === 'categoria') {
    const map = new Map<string, Tarefa[]>()
    for (const t of tarefas) {
      const list = map.get(t.categoria) ?? []
      list.push(t)
      map.set(t.categoria, list)
    }
    const keys =
      orderedCategoriaNames.length > 0
        ? orderedCategoriaNames.filter((k) => map.has(k))
        : Array.from(map.keys())
    for (const k of map.keys()) {
      if (!keys.includes(k)) keys.push(k)
    }
    return keys.map((k) => ({ id: k, title: k, items: map.get(k)! }))
  }

  if (groupBy === 'status') {
    const map = new Map<TarefaStatus, Tarefa[]>()
    for (const t of tarefas) {
      const list = map.get(t.status) ?? []
      list.push(t)
      map.set(t.status, list)
    }
    return STATUS_FLOW.filter((s) => map.has(s)).map((s) => ({
      id: s,
      title: TAREFA_STATUS_LABELS[s],
      items: map.get(s)!,
    }))
  }

  if (groupBy === 'criticidade') {
    const critico = tarefas.filter((t) => t.criticidade === 'critico')
    const normal = tarefas.filter((t) => t.criticidade !== 'critico')
    const sections: ChecklistViewSection[] = []
    if (critico.length) sections.push({ id: 'critico', title: 'Crítico', items: critico })
    if (normal.length) sections.push({ id: 'normal', title: 'Normal', items: normal })
    return sections
  }

  // responsavel
  const map = new Map<string, { title: string; items: Tarefa[] }>()
  for (const t of tarefas) {
    const id = t.responsavel_id ?? '__none__'
    const title = t.responsavel_nome?.trim() || 'Sem responsável'
    const entry = map.get(id) ?? { title, items: [] }
    entry.items.push(t)
    map.set(id, entry)
  }
  const entries = Array.from(map.entries())
  entries.sort(([idA, a], [idB, b]) => {
    if (idA === '__none__') return 1
    if (idB === '__none__') return -1
    return a.title.localeCompare(b.title, 'pt-BR')
  })
  return entries.map(([id, entry]) => ({ id, title: entry.title, items: entry.items }))
}

export function buildChecklistView(
  tarefas: Tarefa[],
  opts: {
    groupBy: ChecklistGroupBy
    sortBy: ChecklistSortBy
    orderedCategoriaNames: string[]
    taskTimerTotals: Record<string, number>
    criticosNoTopo: boolean
  },
): ChecklistViewSection[] {
  const sections = groupChecklistTarefas(tarefas, opts.groupBy, opts.orderedCategoriaNames)
  return sections.map((section) => ({
    ...section,
    items: sortChecklistTarefas(
      section.items,
      opts.sortBy,
      opts.taskTimerTotals,
      opts.criticosNoTopo,
    ),
  }))
}

export function isStructuralChecklistView(opts: {
  groupBy: ChecklistGroupBy
  sortBy: ChecklistSortBy
  filterNome: string
  filterStatus: string
  filterCategoria: string
  soMeus: boolean
  ocultarConcluidos: boolean
  criticosNoTopo?: boolean
}): boolean {
  return (
    opts.groupBy === 'categoria' &&
    opts.sortBy === 'padrao' &&
    !opts.filterNome.trim() &&
    !opts.filterStatus &&
    !opts.filterCategoria &&
    !opts.soMeus &&
    !opts.ocultarConcluidos &&
    !opts.criticosNoTopo
  )
}

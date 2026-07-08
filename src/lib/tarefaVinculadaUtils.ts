import { getDisciplinaLabel } from './disciplinaConfig'
import { getPhaseLabel, getPhaseSequence } from './faseConfig'
import type { Disciplina, Fase, Tarefa } from '../types'

export interface TarefaVinculadaOption {
  id: string
  nome: string
  categoria: string
  fase: Fase
  disciplina: Disciplina
}

export interface TarefaVinculadaGroup {
  disciplina: Disciplina
  fase: Fase
  categoria: string
  tarefas: TarefaVinculadaOption[]
}

export function getLinkableTarefas(tarefas: Tarefa[]): TarefaVinculadaOption[] {
  return tarefas
    .filter((t) => t.revisao_id == null && t.deleted_at === null)
    .map((t) => ({
      id: t.id,
      nome: t.nome,
      categoria: t.categoria,
      fase: t.fase,
      disciplina: t.disciplina,
    }))
}

export function groupTarefasForVinculacao(tarefas: Tarefa[]): TarefaVinculadaGroup[] {
  const linkable = getLinkableTarefas(tarefas)
  const map = new Map<string, TarefaVinculadaGroup>()

  for (const t of linkable) {
    const key = `${t.disciplina}|${t.fase}|${t.categoria}`
    const existing = map.get(key)
    if (existing) {
      existing.tarefas.push(t)
    } else {
      map.set(key, {
        disciplina: t.disciplina,
        fase: t.fase,
        categoria: t.categoria,
        tarefas: [t],
      })
    }
  }

  const groups = Array.from(map.values())

  groups.sort((a, b) => {
    const discOrder = (a.disciplina as string).localeCompare(b.disciplina as string)
    if (discOrder !== 0) return discOrder
    const fasesA = getPhaseSequence(a.disciplina)
    const fasesB = getPhaseSequence(b.disciplina)
    const faseOrder = fasesA.indexOf(a.fase) - fasesB.indexOf(b.fase)
    if (faseOrder !== 0) return faseOrder
    return a.categoria.localeCompare(b.categoria)
  })

  for (const g of groups) {
    g.tarefas.sort((a, b) => a.nome.localeCompare(b.nome))
  }

  return groups
}

export function shortTarefaNome(nome: string, max = 36): string {
  if (nome.length <= max) return nome
  return `${nome.slice(0, max - 1)}…`
}

export function tarefaVinculadaLabel(t: TarefaVinculadaOption): string {
  return `${t.nome} · ${getPhaseLabel(t.fase, t.disciplina)} · ${getDisciplinaLabel(t.disciplina)}`
}

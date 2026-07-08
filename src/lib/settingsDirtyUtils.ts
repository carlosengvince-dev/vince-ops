import type { FaseConfig } from './faseConfig'
import type { DisciplinaConfig } from './disciplinaConfig'
import type { Disciplina } from '../types'

export function countStringListDirty(
  saved: string[] | null | undefined,
  current: string[] | null | undefined,
): number {
  const baseline = saved ?? []
  const draft = current ?? []
  if (JSON.stringify(baseline) === JSON.stringify(draft)) return 0

  let count = 0
  const max = Math.max(baseline.length, draft.length)
  for (let i = 0; i < max; i += 1) {
    if (baseline[i] !== draft[i]) count += 1
  }
  return count
}

export function countJsonDirty<T>(saved: T | null | undefined, current: T | null | undefined): number {
  const baseline = saved ?? null
  const draft = current ?? null
  return JSON.stringify(baseline) === JSON.stringify(draft) ? 0 : 1
}

function faseConfigSnapshot(fases: FaseConfig[]): string {
  return JSON.stringify(
    [...fases]
      .sort((a, b) => a.ordem - b.ordem)
      .map((f) => ({
        id: f.id,
        label: f.label.trim(),
        ordem: f.ordem,
        ativo: f.ativo,
      })),
  )
}

export function countFasesConfigDirty(baseline: FaseConfig[], draft: FaseConfig[]): number {
  if (faseConfigSnapshot(baseline) === faseConfigSnapshot(draft)) return 0

  let count = 0
  const baselineById = new Map(baseline.map((f) => [f.id, f]))

  for (const fase of draft) {
    const base = baselineById.get(fase.id)
    if (!base) {
      count += 1
      continue
    }
    if (
      base.label.trim() !== fase.label.trim() ||
      base.ordem !== fase.ordem ||
      base.ativo !== fase.ativo
    ) {
      count += 1
    }
  }

  return count
}

export function countFasesConfigDirtyForDisciplina(
  disciplina: Disciplina,
  baseline: FaseConfig[],
  draft: FaseConfig[],
): number {
  const baseDisc = baseline.filter((f) => f.disciplina === disciplina)
  const draftDisc = draft.filter((f) => f.disciplina === disciplina)
  return countFasesConfigDirty(baseDisc, draftDisc)
}

export function isFaseConfigRowDirty(fase: FaseConfig, baseline: FaseConfig | undefined): boolean {
  if (!baseline) return true
  return (
    baseline.label.trim() !== fase.label.trim() ||
    baseline.ordem !== fase.ordem ||
    baseline.ativo !== fase.ativo
  )
}

function disciplinaConfigSnapshot(rows: DisciplinaConfig[]): string {
  return JSON.stringify(
    [...rows]
      .sort((a, b) => a.ordem - b.ordem)
      .map((d) => ({
        id: d.id,
        nome: d.nome.trim(),
        cor_bg: d.cor_bg,
        cor_texto: d.cor_texto,
        ordem: d.ordem,
        ativo: d.ativo,
      })),
  )
}

export function countDisciplinasConfigDirty(
  baseline: DisciplinaConfig[],
  draft: DisciplinaConfig[],
): number {
  if (disciplinaConfigSnapshot(baseline) === disciplinaConfigSnapshot(draft)) return 0

  let count = 0
  const baselineById = new Map(baseline.map((d) => [d.id, d]))

  for (const row of draft) {
    const base = baselineById.get(row.id)
    if (!base) {
      count += 1
      continue
    }
    if (isDisciplinaConfigRowDirty(row, base)) count += 1
  }

  return count
}

export function isDisciplinaConfigRowDirty(
  row: DisciplinaConfig,
  baseline: DisciplinaConfig | undefined,
): boolean {
  if (!baseline) return true
  return (
    baseline.nome.trim() !== row.nome.trim() ||
    baseline.cor_bg !== row.cor_bg ||
    baseline.cor_texto !== row.cor_texto ||
    baseline.ordem !== row.ordem ||
    baseline.ativo !== row.ativo
  )
}

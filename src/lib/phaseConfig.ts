import type { Disciplina, Fase } from '../types'
import { PHASE_LABELS, PHASE_SEQUENCES } from './constants'
import { fetchConfiguracaoJson, saveConfiguracao } from './configuracoes'

export type PhaseLabelsMap = Partial<Record<Fase, string>>
export type PhaseOrderMap = Partial<Record<Disciplina, Fase[]>>

const LABELS_KEY = 'phase_labels'
const ORDER_KEY = 'phase_order'

export function getDefaultPhaseOrder(disciplina: Disciplina): Fase[] {
  return [...PHASE_SEQUENCES[disciplina]]
}

export async function fetchPhaseLabels(): Promise<PhaseLabelsMap> {
  return fetchConfiguracaoJson<PhaseLabelsMap>(LABELS_KEY, {})
}

export async function savePhaseLabels(
  labels: PhaseLabelsMap,
  userId?: string,
): Promise<void> {
  await saveConfiguracao(LABELS_KEY, labels, userId)
}

export async function fetchPhaseOrder(): Promise<PhaseOrderMap> {
  return fetchConfiguracaoJson<PhaseOrderMap>(ORDER_KEY, {})
}

export async function savePhaseOrder(order: PhaseOrderMap, userId?: string): Promise<void> {
  await saveConfiguracao(ORDER_KEY, order, userId)
}

export function resolvePhaseLabel(fase: Fase, custom: PhaseLabelsMap): string {
  return custom[fase] ?? PHASE_LABELS[fase]
}

export function resolvePhaseSequence(
  disciplina: Disciplina,
  customOrder: PhaseOrderMap,
): Fase[] {
  const custom = customOrder[disciplina]
  if (custom && custom.length > 0) return custom
  return getDefaultPhaseOrder(disciplina)
}

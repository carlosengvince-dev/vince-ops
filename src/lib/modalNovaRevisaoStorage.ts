import type { CustomRevisionTask } from './revisoes'
import type { CreateRevisaoFormData } from '../components/projects/CreateRevisaoModal'
import type { Disciplina } from '../types'
import { isNovaRevisaoDraftMeaningful, loadMeaningfulModalState } from './modalDraftUtils'
import { clearModalState, loadModalState, saveModalState } from './modalStorage'

export interface NovaRevisaoDraft {
  step: 1 | 2
  disciplina: Disciplina
  form: CreateRevisaoFormData
  selectedTemplateIds: string[]
  customTasks: CustomRevisionTask[]
}

function storageKey(projetoId: string): string {
  return `modal_nova_revisao_${projetoId}`
}

export function loadNovaRevisaoDraft(projetoId: string): NovaRevisaoDraft | null {
  return loadMeaningfulModalState(storageKey(projetoId), isNovaRevisaoDraftMeaningful)
}

export function saveNovaRevisaoDraft(projetoId: string, draft: NovaRevisaoDraft): void {
  saveModalState(storageKey(projetoId), draft)
}

export function clearNovaRevisaoDraft(projetoId: string): void {
  clearModalState(storageKey(projetoId))
}

export function hasNovaRevisaoDraft(projetoId: string): boolean {
  return loadNovaRevisaoDraft(projetoId) != null
}

// Legacy direct load (sem filtro de conteúdo)
export function loadNovaRevisaoDraftRaw(projetoId: string): NovaRevisaoDraft | null {
  return loadModalState<NovaRevisaoDraft>(storageKey(projetoId))
}

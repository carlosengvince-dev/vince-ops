import type { NovaRevisaoDraft } from './modalNovaRevisaoStorage'
import type { TaskFormValues } from './tarefaManagement'
import type { PendenciaFormData } from '../components/projects/PendenciaFormModal'
import { clearModalState, hasModalState, loadModalState } from './modalStorage'

export function isTaskDraftMeaningful(draft: TaskFormValues): boolean {
  return Boolean(
    draft.nome.trim() ||
      draft.descricao.trim() ||
      draft.novaCategoriaText.trim() ||
      draft.referencia_normativa.trim() ||
      draft.responsavelId,
  )
}

export function isNovaRevisaoDraftMeaningful(draft: NovaRevisaoDraft): boolean {
  return Boolean(
    draft.step > 1 ||
      draft.form.descricao.trim() ||
      draft.form.pendenciaId ||
      draft.selectedTemplateIds.length > 0 ||
      draft.customTasks.length > 0,
  )
}

export interface CreateProjectDraftShape {
  step: number
  modo: string | null
  form: { nome: string; codigo: string }
}

export function isCreateProjectDraftMeaningful(draft: CreateProjectDraftShape): boolean {
  if (draft.step > 1) return true
  if (draft.modo != null) return true
  return Boolean(draft.form.nome.trim() || draft.form.codigo.trim())
}

export function isPendenciaDraftMeaningful(draft: PendenciaFormData): boolean {
  return Boolean(
    draft.descricao.trim() ||
      draft.prazo ||
      draft.dataRecebimento ||
      draft.tarefasVinculadas.length > 0,
  )
}

export function loadMeaningfulModalState<T>(
  key: string,
  isMeaningful: (draft: T) => boolean,
): T | null {
  if (!hasModalState(key)) return null
  const draft = loadModalState<T>(key)
  if (!draft || !isMeaningful(draft)) {
    clearModalState(key)
    return null
  }
  return draft
}

export function hasMeaningfulModalState<T>(
  key: string,
  isMeaningful: (draft: T) => boolean,
): boolean {
  return loadMeaningfulModalState(key, isMeaningful) != null
}

import { supabase } from './supabase'
import {
  copyTemplatesToTarefas,
  fetchActiveTemplates,
  filterTemplatesForMode,
  templateAppliesToMetodologia,
} from './projects'
import { FASES_COM_CHECKLIST, PHASE_SEQUENCES } from './constants'
import type { ChecklistSelectionState, ProjectFormData } from '../types/project-create'
import { EMPTY_PROJECT_FORM } from '../types/project-create'
import type { Disciplina, Fase, FasesAtuais, Metodologia, Tarefa, TemplateChecklist } from '../types'

export const ALL_DISCIPLINAS: Disciplina[] = ['HID', 'PPCI', 'SPK']

export function getDisciplinasDisponiveis(current: Disciplina[]): Disciplina[] {
  return ALL_DISCIPLINAS.filter((d) => !current.includes(d))
}

export function countTarefasDaDisciplina(tarefas: Tarefa[], disciplina: Disciplina): number {
  return tarefas.filter((t) => t.disciplina === disciplina && t.deleted_at === null).length
}

export function buildFasesAtuaisComNovaDisciplina(
  current: FasesAtuais,
  disciplina: Disciplina,
): FasesAtuais {
  return {
    ...current,
    [disciplina]: 'PRE_INFO',
  }
}

export function buildFasesAtuaisSemDisciplina(
  current: FasesAtuais,
  disciplina: Disciplina,
): FasesAtuais {
  const next = { ...current }
  delete next[disciplina]
  delete next[`${disciplina}_concluidas_ext` as keyof FasesAtuais]
  return next
}

export function buildMetodologiaComNovaDisciplina(
  current: Partial<Record<Disciplina, Metodologia>>,
  disciplina: Disciplina,
  metodologia: Metodologia = '2D',
): Partial<Record<Disciplina, Metodologia>> {
  return { ...current, [disciplina]: metodologia }
}

export function buildMetodologiaSemDisciplina(
  current: Partial<Record<Disciplina, Metodologia>>,
  disciplina: Disciplina,
): Partial<Record<Disciplina, Metodologia>> {
  const next = { ...current }
  delete next[disciplina]
  return next
}

export function filterTemplatesForNovaDisciplina(
  templates: TemplateChecklist[],
  disciplina: Disciplina,
  metodologia: Metodologia,
  selectedTemplateIds: Set<string>,
): TemplateChecklist[] {
  const form: ProjectFormData = {
    ...EMPTY_PROJECT_FORM,
    disciplinas: [disciplina],
    metodologia: { [disciplina]: metodologia },
  }
  const checklist: ChecklistSelectionState = {
    faseEntrada: {},
    selectedTemplateIds,
    disabledTemplateIds: new Set(),
  }
  return filterTemplatesForMode(templates, 'em_andamento', form, checklist)
}

export function getSelectablePhases(disciplina: Disciplina): Fase[] {
  return PHASE_SEQUENCES[disciplina].filter((f) => FASES_COM_CHECKLIST.includes(f))
}

export function filterTemplatesForDisciplinaMetodologia(
  templates: TemplateChecklist[],
  disciplina: Disciplina,
  metodologia: Metodologia,
): TemplateChecklist[] {
  return templates.filter(
    (t) =>
      t.disciplina === disciplina &&
      FASES_COM_CHECKLIST.includes(t.fase as Fase) &&
      templateAppliesToMetodologia(t, metodologia),
  )
}

export interface AddDisciplinaInput {
  projetoId: string
  disciplina: Disciplina
  metodologia: Metodologia
  currentDisciplinas: Disciplina[]
  currentMetodologia: Partial<Record<Disciplina, Metodologia>>
  currentFasesAtuais: FasesAtuais
  selectedTemplateIds: Set<string>
}

export async function addDisciplinaToProjeto(
  input: AddDisciplinaInput,
): Promise<{
  disciplinas: Disciplina[]
  metodologia: Partial<Record<Disciplina, Metodologia>>
  fases_atuais: FasesAtuais
  tarefas: Tarefa[]
}> {
  const disciplinas = [...input.currentDisciplinas, input.disciplina]
  const metodologia = buildMetodologiaComNovaDisciplina(
    input.currentMetodologia,
    input.disciplina,
    input.metodologia,
  )
  const fases_atuais = buildFasesAtuaisComNovaDisciplina(
    input.currentFasesAtuais,
    input.disciplina,
  )

  const allTemplates = await fetchActiveTemplates([input.disciplina])
  const selected = filterTemplatesForNovaDisciplina(
    allTemplates,
    input.disciplina,
    input.metodologia,
    input.selectedTemplateIds,
  )

  const { error } = await supabase
    .from('projetos')
    .update({
      disciplinas,
      metodologia,
      fases_atuais,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.projetoId)

  if (error) throw new Error(error.message)

  const tarefas = await copyTemplatesToTarefas(input.projetoId, selected)

  return { disciplinas, metodologia, fases_atuais, tarefas }
}

export interface RemoveDisciplinaInput {
  projetoId: string
  disciplina: Disciplina
  currentDisciplinas: Disciplina[]
  currentMetodologia: Partial<Record<Disciplina, Metodologia>>
  currentFasesAtuais: FasesAtuais
  archiveTasks: boolean
  userId: string
}

export async function removeDisciplinaFromProjeto(
  input: RemoveDisciplinaInput,
): Promise<{
  disciplinas: Disciplina[]
  metodologia: Partial<Record<Disciplina, Metodologia>>
  fases_atuais: FasesAtuais
  archivedTaskIds: string[]
}> {
  if (input.currentDisciplinas.length <= 1) {
    throw new Error('O projeto precisa ter pelo menos uma disciplina.')
  }

  const disciplinas = input.currentDisciplinas.filter((d) => d !== input.disciplina)
  const metodologia = buildMetodologiaSemDisciplina(input.currentMetodologia, input.disciplina)
  const fases_atuais = buildFasesAtuaisSemDisciplina(input.currentFasesAtuais, input.disciplina)

  let archivedTaskIds: string[] = []

  if (input.archiveTasks) {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('tarefas')
      .update({
        deleted_at: now,
        updated_at: now,
        updated_by: input.userId,
      })
      .eq('projeto_id', input.projetoId)
      .eq('disciplina', input.disciplina)
      .is('deleted_at', null)
      .select('id')

    if (error) throw new Error(error.message)
    archivedTaskIds = (data ?? []).map((r) => r.id as string)
  }

  const { error: projetoError } = await supabase
    .from('projetos')
    .update({
      disciplinas,
      metodologia,
      fases_atuais,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.projetoId)

  if (projetoError) throw new Error(projetoError.message)

  return { disciplinas, metodologia, fases_atuais, archivedTaskIds }
}

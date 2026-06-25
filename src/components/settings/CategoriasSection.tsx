import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  fetchCategoriasDisciplina,
  saveCategoriasDisciplina,
} from '../../lib/configuracoes'
import {
  countTarefasAtivasInCategoria,
  countTemplatesInCategoria,
  renameCategoriaInTarefasAtivas,
  renameCategoriaInTemplates,
} from '../../lib/templatesChecklist'
import type { Disciplina } from '../../types'
import { ConfirmModal } from '../ui/ConfirmModal'
import { DisciplinaTabs } from '../ui/DisciplinaTabs'
import { SortableStringList } from './SortableStringList'
import './SettingsSubsection.css'

interface RenamePrompt {
  oldName: string
  newName: string
  templateCount: number
  tarefaCount: number
}

export function CategoriasSection() {
  const { profile } = useAuth()
  const [disciplina, setDisciplina] = useState<Disciplina>('HID')
  const [items, setItems] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [renamePrompt, setRenamePrompt] = useState<RenamePrompt | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await fetchCategoriasDisciplina(disciplina))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar categorias')
    } finally {
      setLoading(false)
    }
  }, [disciplina])

  useEffect(() => {
    void load()
  }, [load])

  async function persist(next: string[]) {
    setSaving(true)
    setError(null)
    try {
      await saveCategoriasDisciplina(disciplina, next, profile?.id)
      setItems(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleRename(oldName: string, newName: string) {
    if (oldName === newName) return
    try {
      const [templateCount, tarefaCount] = await Promise.all([
        countTemplatesInCategoria(disciplina, oldName),
        countTarefasAtivasInCategoria(disciplina, oldName),
      ])
      if (templateCount > 0 || tarefaCount > 0) {
        setRenamePrompt({ oldName, newName, templateCount, tarefaCount })
        return
      }
      const next = items.map((c) => (c === oldName ? newName : c))
      await persist(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao renomear')
    }
  }

  async function applyRename(updateProjects: boolean) {
    if (!renamePrompt) return
    const { oldName, newName } = renamePrompt
    setSaving(true)
    try {
      await renameCategoriaInTemplates(disciplina, oldName, newName)
      if (updateProjects) {
        await renameCategoriaInTarefasAtivas(disciplina, oldName, newName)
      }
      const next = items.map((c) => (c === oldName ? newName : c))
      await persist(next)
      setRenamePrompt(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao renomear categoria')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="settings-subsection">
      <header className="settings-subsection__head">
        <div>
          <h2 className="settings-subsection__title">Categorias</h2>
          <p className="settings-subsection__hint">
            Lista de categorias por disciplina, usadas nos templates e checklists.
          </p>
        </div>
      </header>

      <DisciplinaTabs value={disciplina} onChange={setDisciplina} />

      {error ? <p className="settings-subsection__error">{error}</p> : null}
      {loading ? <p className="settings-subsection__status">Carregando…</p> : null}

      {!loading ? (
        <SortableStringList
          items={items}
          onChange={(next) => void persist(next)}
          onRename={(oldValue, newValue) => void handleRename(oldValue, newValue)}
          addLabel="Nova categoria"
        />
      ) : null}
      {saving ? <p className="settings-subsection__status">Salvando…</p> : null}

      <ConfirmModal
        isOpen={renamePrompt != null}
        title="Renomear categoria"
        message={
          renamePrompt
            ? `${renamePrompt.templateCount} tarefa(s) de template serão afetadas${renamePrompt.tarefaCount > 0 ? ` e ${renamePrompt.tarefaCount} tarefa(s) em projetos ativos` : ''}. Deseja atualizar também as tarefas de projetos em andamento?`
            : ''
        }
        confirmLabel="Template + projetos"
        cancelLabel="Só o template"
        loading={saving}
        onConfirm={() => void applyRename(true)}
        onCancel={() => void applyRename(false)}
      />
    </section>
  )
}

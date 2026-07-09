import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import {
  createCategoria,
  deleteCategoria,
  fetchCategoriasConfig,
  renameCategoria,
  upsertCategoriaConfig,
  type CategoriaConfig,
  type RenameCategoriaEscopo,
} from '../../lib/categoriaConfig'
import {
  countTarefasAtivasInCategoria,
  countTemplatesInCategoria,
} from '../../lib/templatesChecklist'
import { getActiveDisciplinaCodigos } from '../../lib/disciplinaConfig'
import type { Disciplina } from '../../types'
import { Button } from '../ui/Button'
import { DisciplinaTabs } from '../ui/DisciplinaTabs'
import { Input } from '../ui/Input'
import { CategoriaManagementModals } from './CategoriaManagementModals'
import { RestoreScopeAction } from './RestoreScopeAction'
import './CategoriasSection.css'
import './SettingsSubsection.css'

function cloneCategorias(rows: CategoriaConfig[]): CategoriaConfig[] {
  return rows.map((c) => ({ ...c }))
}

function reorderCategorias(
  rows: CategoriaConfig[],
  from: number,
  to: number,
): CategoriaConfig[] {
  if (to < 0 || to >= rows.length || from === to) return rows
  const next = [...rows]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next.map((c, idx) => ({ ...c, ordem: idx }))
}

export function CategoriasSection() {
  const { showToast } = useToast()
  const [disciplina, setDisciplina] = useState<Disciplina>(
    () => getActiveDisciplinaCodigos()[0] ?? 'HID',
  )
  const [categorias, setCategorias] = useState<CategoriaConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [novaNome, setNovaNome] = useState('')
  const [adding, setAdding] = useState(false)
  const [reordering, setReordering] = useState(false)

  const [renameTarget, setRenameTarget] = useState<CategoriaConfig | null>(null)
  const [renameNome, setRenameNome] = useState('')
  const [renameEscopo, setRenameEscopo] = useState<RenameCategoriaEscopo>('config_templates')
  const [renamePreview, setRenamePreview] = useState<{ templates: number; tarefas: number } | null>(
    null,
  )
  const [renaming, setRenaming] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<CategoriaConfig | null>(null)
  const [deleteTemplateCount, setDeleteTemplateCount] = useState(0)
  const [deleteCascadeTemplates, setDeleteCascadeTemplates] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchCategoriasConfig(disciplina, { skipCache: true })
      setCategorias(cloneCategorias(rows))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar categorias')
    } finally {
      setLoading(false)
    }
  }, [disciplina])

  useEffect(() => {
    void load()
  }, [load])

  const sorted = useMemo(
    () => [...categorias].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR')),
    [categorias],
  )

  async function handleAdd() {
    const nome = novaNome.trim()
    if (!nome) {
      showToast('Informe o nome da categoria', 'error')
      return
    }
    setAdding(true)
    setError(null)
    try {
      await createCategoria(disciplina, nome)
      setNovaNome('')
      await load()
      showToast('Categoria criada')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao criar categoria'
      setError(message)
      showToast(message, 'error')
    } finally {
      setAdding(false)
    }
  }

  async function handleMove(id: string, direction: 'up' | 'down') {
    const index = sorted.findIndex((c) => c.id === id)
    if (index < 0) return
    const nextIndex = direction === 'up' ? index - 1 : index + 1
    if (nextIndex < 0 || nextIndex >= sorted.length) return

    const reordered = reorderCategorias(sorted, index, nextIndex)
    setCategorias(reordered)
    setReordering(true)
    setError(null)
    try {
      const previousOrdem = new Map(sorted.map((c) => [c.id, c.ordem]))
      await Promise.all(
        reordered
          .filter((c) => previousOrdem.get(c.id) !== c.ordem)
          .map((c) =>
            upsertCategoriaConfig({
              p_id: c.id,
              p_disciplina: c.disciplina,
              p_nome: c.nome,
              p_ordem: c.ordem,
              p_ativo: c.ativo,
            }),
          ),
      )
      await load()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao reordenar'
      setError(message)
      showToast(message, 'error')
      await load()
    } finally {
      setReordering(false)
    }
  }

  async function openRename(cat: CategoriaConfig) {
    setRenameTarget(cat)
    setRenameNome(cat.nome)
    setRenameEscopo('config_templates')
    setRenamePreview(null)
    try {
      const [templates, tarefas] = await Promise.all([
        countTemplatesInCategoria(disciplina, cat.nome),
        countTarefasAtivasInCategoria(disciplina, cat.nome),
      ])
      setRenamePreview({ templates, tarefas })
    } catch {
      setRenamePreview({ templates: 0, tarefas: 0 })
    }
  }

  async function handleRenameConfirm() {
    if (!renameTarget) return
    const nome = renameNome.trim()
    if (!nome) {
      showToast('Informe o novo nome', 'error')
      return
    }
    if (nome === renameTarget.nome) {
      setRenameTarget(null)
      return
    }

    setRenaming(true)
    setError(null)
    try {
      const result = await renameCategoria(renameTarget.id, nome, renameEscopo)
      setRenameTarget(null)
      await load()
      showToast(
        `Renomeada. ${result.templates_afetados} templates e ${result.tarefas_afetadas} tarefas atualizados.`,
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao renomear'
      setError(message)
      showToast(message, 'error')
    } finally {
      setRenaming(false)
    }
  }

  async function openDelete(cat: CategoriaConfig) {
    setDeleteTarget(cat)
    setDeleteCascadeTemplates(true)
    try {
      const count = await countTemplatesInCategoria(disciplina, cat.nome)
      setDeleteTemplateCount(count)
    } catch {
      setDeleteTemplateCount(0)
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setDeleting(true)
    setError(null)
    try {
      const result = await deleteCategoria(deleteTarget.id, deleteCascadeTemplates, disciplina)
      setDeleteTarget(null)
      await load()
      showToast(`Categoria removida. ${result.templates_excluidos} tarefas de template excluídas.`)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao excluir'
      setError(message)
      showToast(message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="settings-subsection">
      <header className="settings-subsection__head">
        <div>
          <h2 className="settings-subsection__title">Categorias</h2>
          <p className="settings-subsection__hint">
            Fonte de verdade dos nomes usados em templates e checklists. Cada alteração é salva na
            hora.
          </p>
        </div>
        <RestoreScopeAction escopo="categorias" onRestored={load} />
      </header>

      <DisciplinaTabs value={disciplina} onChange={setDisciplina} />

      {error ? <p className="settings-subsection__error">{error}</p> : null}
      {loading ? <p className="settings-subsection__status">Carregando…</p> : null}

      {!loading ? (
        <>
          <ul className="categorias-section__list">
            {sorted.map((cat, index) => (
              <li key={cat.id} className="categorias-section__row">
                <div className="categorias-section__order">
                  <button
                    type="button"
                    className="categorias-section__order-btn"
                    aria-label="Mover para cima"
                    disabled={reordering || index === 0}
                    onClick={() => void handleMove(cat.id, 'up')}
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    className="categorias-section__order-btn"
                    aria-label="Mover para baixo"
                    disabled={reordering || index >= sorted.length - 1}
                    onClick={() => void handleMove(cat.id, 'down')}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>

                <span className="categorias-section__nome">{cat.nome}</span>

                {cat.sistema ? (
                  <span className="categorias-section__badge">Padrão</span>
                ) : (
                  <span className="categorias-section__badge-spacer" />
                )}

                <button
                  type="button"
                  className="categorias-section__icon-btn"
                  aria-label={`Renomear ${cat.nome}`}
                  onClick={() => void openRename(cat)}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="categorias-section__icon-btn categorias-section__icon-btn--danger"
                  aria-label={`Excluir ${cat.nome}`}
                  onClick={() => void openDelete(cat)}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>

          {sorted.length === 0 ? (
            <p className="settings-subsection__status">Nenhuma categoria nesta disciplina.</p>
          ) : null}

          <div className="categorias-section__add">
            <Input
              label="Nova categoria"
              value={novaNome}
              onChange={(e) => setNovaNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleAdd()
                }
              }}
              placeholder="Nome da categoria"
            />
            <Button type="button" disabled={adding || !novaNome.trim()} onClick={() => void handleAdd()}>
              <Plus size={16} />
              {adding ? 'Adicionando…' : 'Adicionar'}
            </Button>
          </div>
        </>
      ) : null}

      <CategoriaManagementModals
        renameTarget={renameTarget}
        renameNome={renameNome}
        renameEscopo={renameEscopo}
        renamePreview={renamePreview}
        renaming={renaming}
        onRenameNomeChange={setRenameNome}
        onRenameEscopoChange={setRenameEscopo}
        onCloseRename={() => setRenameTarget(null)}
        onConfirmRename={() => void handleRenameConfirm()}
        deleteTarget={deleteTarget}
        deleteTemplateCount={deleteTemplateCount}
        deleteCascadeTemplates={deleteCascadeTemplates}
        deleting={deleting}
        onDeleteCascadeChange={setDeleteCascadeTemplates}
        onConfirmDelete={() => void handleDeleteConfirm()}
        onCloseDelete={() => {
          if (!deleting) setDeleteTarget(null)
        }}
      />
    </section>
  )
}

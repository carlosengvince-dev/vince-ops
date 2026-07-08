import { useCallback, useEffect, useRef, useState } from 'react'
import type { Disciplina, Fase, Tarefa } from '../../types'
import { fetchCategoriaNomes } from '../../lib/categoriaConfig'
import { getPhaseLabel, getPhaseSequence } from '../../lib/faseConfig'
import { NOVA_CATEGORIA_VALUE } from '../../lib/tarefaManagement'
import { clearModalState, loadModalState } from '../../lib/modalStorage'
import { useDebouncedModalPersistence } from '../../hooks/useDebouncedModalPersistence'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import './MoveTarefaModal.css'

interface MoveTarefaDraft {
  faseDestino: Fase | ''
  categoriaDestino: string
  categoriaIsNew: boolean
  novaCategoriaText: string
}

interface MoveTarefaModalProps {
  open: boolean
  loading?: boolean
  error?: string | null
  tarefa: Tarefa | null
  disciplina: Disciplina
  allTarefas: Tarefa[]
  onClose: () => void
  onConfirm: (fase: Fase, categoria: string) => void
}

function storageKeyFor(tarefaId: string): string {
  return `modal_mover_tarefa_${tarefaId}`
}

function defaultDraft(configCats: string[], fasesDisponiveis: Fase[]): MoveTarefaDraft {
  const firstFase = fasesDisponiveis[0] ?? ''
  if (!firstFase) {
    return {
      faseDestino: '',
      categoriaDestino: '',
      categoriaIsNew: true,
      novaCategoriaText: '',
    }
  }
  return {
    faseDestino: firstFase,
    categoriaDestino: configCats[0] ?? '',
    categoriaIsNew: configCats.length === 0,
    novaCategoriaText: '',
  }
}

export function MoveTarefaModal({
  open,
  loading = false,
  error = null,
  tarefa,
  disciplina,
  onClose,
  onConfirm,
}: MoveTarefaModalProps) {
  const [faseDestino, setFaseDestino] = useState<Fase | ''>('')
  const [categoriaDestino, setCategoriaDestino] = useState('')
  const [categoriaIsNew, setCategoriaIsNew] = useState(false)
  const [novaCategoriaText, setNovaCategoriaText] = useState('')
  const [categoriaError, setCategoriaError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [configCategorias, setConfigCategorias] = useState<string[]>([])
  const initializedRef = useRef(false)

  const fasesDisponiveis =
    tarefa != null
      ? getPhaseSequence(disciplina).filter((f) => f !== tarefa.fase)
      : []

  const categoriasDestino = configCategorias

  const storageKey = tarefa ? storageKeyFor(tarefa.id) : null

  const categoriaSelectValue = categoriaIsNew
    ? NOVA_CATEGORIA_VALUE
    : categoriaDestino && categoriasDestino.includes(categoriaDestino)
      ? categoriaDestino
      : categoriasDestino[0] ?? NOVA_CATEGORIA_VALUE

  const persistState: MoveTarefaDraft = {
    faseDestino,
    categoriaDestino,
    categoriaIsNew,
    novaCategoriaText,
  }

  useDebouncedModalPersistence(storageKey, persistState, open && tarefa != null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void fetchCategoriaNomes(disciplina)
      .then((names) => {
        if (!cancelled) setConfigCategorias(names)
      })
      .catch(() => {
        if (!cancelled) setConfigCategorias([])
      })
    return () => {
      cancelled = true
    }
  }, [open, disciplina])

  useEffect(() => {
    if (!open || !tarefa) {
      initializedRef.current = false
      return
    }
    if (initializedRef.current) return

    const key = storageKeyFor(tarefa.id)
    const saved = loadModalState<MoveTarefaDraft>(key)

    if (saved?.faseDestino) {
      setFaseDestino(saved.faseDestino)
      setCategoriaDestino(saved.categoriaDestino)
      setCategoriaIsNew(saved.categoriaIsNew)
      setNovaCategoriaText(saved.novaCategoriaText ?? '')
    } else {
      const draft = defaultDraft(configCategorias, fasesDisponiveis)
      setFaseDestino(draft.faseDestino)
      setCategoriaDestino(draft.categoriaDestino)
      setCategoriaIsNew(draft.categoriaIsNew)
      setNovaCategoriaText(draft.novaCategoriaText)
    }
    setCategoriaError(null)
    setConfirmOpen(false)
    initializedRef.current = true
  }, [open, tarefa, disciplina, configCategorias, fasesDisponiveis])

  const handleFaseChange = useCallback(
    (nextFase: Fase) => {
      setFaseDestino(nextFase)
      if (configCategorias.length > 0) {
        setCategoriaIsNew(false)
        setCategoriaDestino(configCategorias[0])
      } else {
        setCategoriaIsNew(true)
        setCategoriaDestino('')
      }
      setNovaCategoriaText('')
      setCategoriaError(null)
    },
    [configCategorias],
  )

  function handleClose() {
    if (tarefa) clearModalState(storageKeyFor(tarefa.id))
    setConfirmOpen(false)
    initializedRef.current = false
    onClose()
  }

  function resolveCategoria(): string | null {
    if (categoriaIsNew || categoriaSelectValue === NOVA_CATEGORIA_VALUE) {
      const trimmed = novaCategoriaText.trim()
      if (!trimmed) {
        setCategoriaError('Informe o nome da categoria')
        return null
      }
      return trimmed
    }
    return categoriaDestino.trim() || categoriasDestino[0] || null
  }

  function handleProceed() {
    if (!tarefa || !faseDestino) return
    const cat = resolveCategoria()
    if (!cat) return
    setConfirmOpen(true)
  }

  function handleConfirmMove() {
    if (!tarefa || !faseDestino) return
    const cat = resolveCategoria()
    if (!cat) return
    clearModalState(storageKeyFor(tarefa.id))
    setConfirmOpen(false)
    initializedRef.current = false
    onConfirm(faseDestino, cat)
  }

  if (!tarefa) return null

  const previewOrigem = getPhaseLabel(tarefa.fase, disciplina)
  const previewDestino = faseDestino ? getPhaseLabel(faseDestino, disciplina) : '—'

  return (
    <>
      <Modal
        open={open && !confirmOpen}
        onClose={handleClose}
        title="Mover para outra fase"
        width="md"
        footer={
          <div className="move-tarefa-modal__footer">
            <Button variant="secondary" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              loading={loading}
              disabled={!faseDestino}
              onClick={handleProceed}
            >
              Continuar
            </Button>
          </div>
        }
      >
        <div className="move-tarefa-modal">
          {error ? (
            <p className="move-tarefa-modal__error" role="alert">
              {error}
            </p>
          ) : null}

          <p className="move-tarefa-modal__task-name">{tarefa.nome}</p>

          <label className="move-tarefa-modal__field">
            <span className="move-tarefa-modal__label">Fase destino</span>
            <select
              className="move-tarefa-modal__select"
              value={faseDestino}
              onChange={(e) => handleFaseChange(e.target.value as Fase)}
            >
              {fasesDisponiveis.map((f) => (
                <option key={f} value={f}>
                  {getPhaseLabel(f, disciplina)}
                </option>
              ))}
            </select>
          </label>

          <label className="move-tarefa-modal__field">
            <span className="move-tarefa-modal__label">Categoria destino</span>
            <select
              className="move-tarefa-modal__select"
              value={categoriaSelectValue}
              onChange={(e) => {
                const val = e.target.value
                if (val === NOVA_CATEGORIA_VALUE) {
                  setCategoriaIsNew(true)
                } else {
                  setCategoriaIsNew(false)
                  setCategoriaDestino(val)
                }
                if (categoriaError) setCategoriaError(null)
              }}
            >
              {categoriasDestino.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={NOVA_CATEGORIA_VALUE}>Nova categoria…</option>
            </select>
          </label>

          <div
            className="move-tarefa-modal__nova-categoria"
            style={{ display: categoriaIsNew ? 'block' : 'none' }}
          >
            <Input
              label="Nome da nova categoria"
              name="novaCategoria"
              value={novaCategoriaText}
              error={categoriaError}
              onChange={(e) => {
                setNovaCategoriaText(e.target.value)
                if (categoriaError) setCategoriaError(null)
              }}
            />
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={confirmOpen}
        title="Confirmar movimentação"
        message={`Mover "${tarefa.nome}" de ${previewOrigem} para ${previewDestino}?`}
        confirmLabel="Mover"
        cancelLabel="Voltar"
        loading={loading}
        onConfirm={handleConfirmMove}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}

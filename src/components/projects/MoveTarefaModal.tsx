import { useCallback, useEffect, useRef, useState } from 'react'
import type { Disciplina, Fase, Tarefa } from '../../types'
import { PHASE_LABELS, PHASE_SEQUENCES } from '../../lib/constants'
import { getCategoriasForPhase, NOVA_CATEGORIA_VALUE } from '../../lib/tarefaManagement'
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

function defaultDraft(
  _tarefa: Tarefa,
  disciplina: Disciplina,
  allTarefas: Tarefa[],
  fasesDisponiveis: Fase[],
): MoveTarefaDraft {
  const firstFase = fasesDisponiveis[0] ?? ''
  if (!firstFase) {
    return {
      faseDestino: '',
      categoriaDestino: '',
      categoriaIsNew: true,
      novaCategoriaText: '',
    }
  }
  const cats = getCategoriasForPhase(allTarefas, disciplina, firstFase)
  return {
    faseDestino: firstFase,
    categoriaDestino: cats[0] ?? '',
    categoriaIsNew: cats.length === 0,
    novaCategoriaText: '',
  }
}

export function MoveTarefaModal({
  open,
  loading = false,
  error = null,
  tarefa,
  disciplina,
  allTarefas,
  onClose,
  onConfirm,
}: MoveTarefaModalProps) {
  const [faseDestino, setFaseDestino] = useState<Fase | ''>('')
  const [categoriaDestino, setCategoriaDestino] = useState('')
  const [categoriaIsNew, setCategoriaIsNew] = useState(false)
  const [novaCategoriaText, setNovaCategoriaText] = useState('')
  const [categoriaError, setCategoriaError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const initializedRef = useRef(false)

  const fasesDisponiveis =
    tarefa != null
      ? (PHASE_SEQUENCES[disciplina] as readonly Fase[]).filter((f) => f !== tarefa.fase)
      : []

  const categoriasDestino =
    faseDestino != null && faseDestino !== ''
      ? getCategoriasForPhase(allTarefas, disciplina, faseDestino)
      : []

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
      const draft = defaultDraft(tarefa, disciplina, allTarefas, fasesDisponiveis)
      setFaseDestino(draft.faseDestino)
      setCategoriaDestino(draft.categoriaDestino)
      setCategoriaIsNew(draft.categoriaIsNew)
      setNovaCategoriaText(draft.novaCategoriaText)
    }
    setCategoriaError(null)
    setConfirmOpen(false)
    initializedRef.current = true
  }, [open, tarefa, disciplina, allTarefas, fasesDisponiveis])

  const handleFaseChange = useCallback(
    (nextFase: Fase) => {
      setFaseDestino(nextFase)
      const cats = getCategoriasForPhase(allTarefas, disciplina, nextFase)
      if (cats.length > 0) {
        setCategoriaIsNew(false)
        setCategoriaDestino(cats[0])
      } else {
        setCategoriaIsNew(true)
        setCategoriaDestino('')
      }
      setNovaCategoriaText('')
      setCategoriaError(null)
    },
    [allTarefas, disciplina],
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

  const previewOrigem = PHASE_LABELS[tarefa.fase]
  const previewDestino = faseDestino ? PHASE_LABELS[faseDestino] : '—'

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
                  {PHASE_LABELS[f]}
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

          {faseDestino ? (
            <p className="move-tarefa-modal__preview">
              A tarefa será movida de <strong>{previewOrigem}</strong> para{' '}
              <strong>{previewDestino}</strong>
            </p>
          ) : null}
        </div>
      </Modal>

      <ConfirmModal
        isOpen={confirmOpen}
        title="Confirmar movimentação"
        message={`A tarefa "${tarefa.nome}" será movida de ${previewOrigem} para ${previewDestino}. Deseja continuar?`}
        confirmLabel="Mover tarefa"
        cancelLabel="Voltar"
        variant="default"
        loading={loading}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmMove}
      />
    </>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useDebouncedModalPersistence } from '../../hooks/useDebouncedModalPersistence'
import { useTimer } from '../../hooks/useTimer'
import { logActivity } from '../../lib/activityLog'
import { bumpHorasChartVersion } from '../../lib/horasChartVersion'
import { clearModalState, loadModalState } from '../../lib/modalStorage'
import {
  calcDurationSeconds,
  formatManualHorasActivityDuration,
  formatRegistroDuration,
  insertManualRegistroTempo,
  modalHorasManuaisKey,
  todayIsoDate,
  validateManualHorasInput,
} from '../../lib/registrosTempo'
import { notifyRegistrosTempoChanged } from '../../lib/timerEvents'
import type { Tarefa } from '../../types'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import './ManualHorasModal.css'

interface ManualHorasDraft {
  data: string
  horaInicio: string
  horaFim: string
  descricao: string
}

interface ManualHorasModalProps {
  open: boolean
  tarefa: Pick<Tarefa, 'id' | 'projeto_id' | 'disciplina' | 'nome'>
  onClose: () => void
}

function defaultDraft(): ManualHorasDraft {
  return {
    data: todayIsoDate(),
    horaInicio: '',
    horaFim: '',
    descricao: '',
  }
}

export function ManualHorasModal({ open, tarefa, onClose }: ManualHorasModalProps) {
  const { profile } = useAuth()
  const { isTimerActiveOnTarefa } = useTimer()
  const [data, setData] = useState(todayIsoDate())
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFim, setHoraFim] = useState('')
  const [descricao, setDescricao] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const initializedRef = useRef(false)

  const storageKey = modalHorasManuaisKey(tarefa.id)
  const hasActiveTimer = isTimerActiveOnTarefa(tarefa.id)

  const draft = useMemo(
    () => ({ data, horaInicio, horaFim, descricao }),
    [data, horaInicio, horaFim, descricao],
  )

  useDebouncedModalPersistence(storageKey, draft, open)

  useEffect(() => {
    if (!open) {
      initializedRef.current = false
      return
    }

    if (initializedRef.current) return
    initializedRef.current = true

    const saved = loadModalState<ManualHorasDraft>(storageKey)
    if (saved) {
      setData(saved.data || todayIsoDate())
      setHoraInicio(saved.horaInicio ?? '')
      setHoraFim(saved.horaFim ?? '')
      setDescricao(saved.descricao ?? '')
    } else {
      const initial = defaultDraft()
      setData(initial.data)
      setHoraInicio(initial.horaInicio)
      setHoraFim(initial.horaFim)
      setDescricao(initial.descricao)
    }
    setError(null)
  }, [open, storageKey])

  const durationSeconds = calcDurationSeconds(data, horaInicio, horaFim)
  const durationLabel =
    durationSeconds != null && durationSeconds >= 60
      ? formatRegistroDuration(durationSeconds)
      : durationSeconds != null && durationSeconds > 0
        ? 'Menos de 1 minuto'
        : '—'

  const handleClose = useCallback(() => {
    if (saving) return
    onClose()
  }, [onClose, saving])

  async function handleSubmit() {
    if (!profile || saving) return

    const validationError = validateManualHorasInput(
      { data, horaInicio, horaFim, descricao },
      hasActiveTimer,
    )
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const { duracaoSegundos } = await insertManualRegistroTempo(
        tarefa,
        profile.id,
        { data, horaInicio, horaFim, descricao },
      )

      void logActivity({
        projetoId: tarefa.projeto_id,
        usuarioId: profile.id,
        tipo: 'tarefa_status_alterado',
        descricao: `${profile.nome} lançou ${formatManualHorasActivityDuration(duracaoSegundos)} manualmente em '${tarefa.nome}'`,
        metadata: {
          acao: 'horas_manuais',
          tarefa_id: tarefa.id,
          duracao_segundos: duracaoSegundos,
        },
      })

      clearModalState(storageKey)
      notifyRegistrosTempoChanged()
      bumpHorasChartVersion()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar horas')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Registrar horas"
      onClose={handleClose}
      width="sm"
      footer={
        <>
          <Button variant="secondary" disabled={saving} onClick={handleClose}>
            Cancelar
          </Button>
          <Button loading={saving} disabled={hasActiveTimer} onClick={() => void handleSubmit()}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="manual-horas-modal">
        {hasActiveTimer ? (
          <p className="manual-horas-modal__alert" role="alert">
            Pare o timer antes de lançar horas manualmente
          </p>
        ) : null}

        <Input
          label="Data"
          type="date"
          name="data"
          value={data}
          max={todayIsoDate()}
          disabled={saving}
          onChange={(e) => setData(e.target.value)}
        />

        <div className="manual-horas-modal__time-row">
          <Input
            label="Hora início"
            type="time"
            name="hora_inicio"
            value={horaInicio}
            disabled={saving}
            onChange={(e) => setHoraInicio(e.target.value)}
          />
          <Input
            label="Hora fim"
            type="time"
            name="hora_fim"
            value={horaFim}
            disabled={saving}
            onChange={(e) => setHoraFim(e.target.value)}
          />
        </div>

        <p className="manual-horas-modal__duration">
          Duração: <strong>{durationLabel}</strong>
        </p>

        <Input
          label="Descrição (opcional)"
          name="descricao"
          value={descricao}
          disabled={saving}
          placeholder="Ex: Revisão de plantas"
          onChange={(e) => setDescricao(e.target.value)}
        />

        {error ? (
          <p className="manual-horas-modal__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}

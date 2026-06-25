import { useState } from 'react'
import { Play, Square } from 'lucide-react'
import { hasPermissao } from '../../lib/constants'
import { useTimer } from '../../hooks/useTimer'
import type { Papel } from '../../types'
import type { Tarefa } from '../../types'
import './TimerButton.css'

interface TimerButtonProps {
  tarefa: Pick<Tarefa, 'id' | 'projeto_id' | 'disciplina'>
  papel: Papel
  readOnly?: boolean
}

export function TimerButton({ tarefa, papel, readOnly = false }: TimerButtonProps) {
  const { myActiveTimer, operating, startTimer, stopMyTimer, isTimerActiveOnTarefa } =
    useTimer()
  const [error, setError] = useState<string | null>(null)

  const canUse = hasPermissao(papel, 'iniciar_timer') && !readOnly
  const isActive = isTimerActiveOnTarefa(tarefa.id)
  const disabled = !canUse || operating

  async function handleClick() {
    if (!canUse || operating) return

    setError(null)
    try {
      if (isActive && myActiveTimer) {
        await stopMyTimer()
      } else {
        await startTimer(tarefa)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao controlar timer')
    }
  }

  if (!canUse) return null

  return (
    <div className="timer-button-wrap">
      <button
        type="button"
        className={`timer-button${isActive ? ' timer-button--active' : ''}`}
        disabled={disabled}
        aria-label={isActive ? 'Parar timer' : 'Iniciar timer'}
        title={isActive ? 'Parar timer' : 'Iniciar timer'}
        onClick={() => void handleClick()}
      >
        {operating ? (
          <span className="timer-button__loading" aria-hidden />
        ) : isActive ? (
          <Square size={16} fill="currentColor" />
        ) : (
          <Play size={16} fill="currentColor" />
        )}
      </button>
      {error ? (
        <span className="timer-button__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  )
}

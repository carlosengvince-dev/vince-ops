import type { ModoCriacao } from '../../types'

interface StepIndicatorProps {
  currentStep: number
  totalSteps: number
  labels: string[]
}

export function StepIndicator({ currentStep, totalSteps, labels }: StepIndicatorProps) {
  return (
    <ol className="step-indicator" aria-label="Progresso da criação">
      {Array.from({ length: totalSteps }, (_, index) => {
        const step = index + 1
        const isActive = step === currentStep
        const isDone = step < currentStep

        return (
          <li
            key={step}
            className={[
              'step-indicator__item',
              isActive ? 'step-indicator__item--active' : '',
              isDone ? 'step-indicator__item--done' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="step-indicator__number">{step}</span>
            <span className="step-indicator__label">{labels[index] ?? `Etapa ${step}`}</span>
          </li>
        )
      })}
    </ol>
  )
}

export interface ModeOption {
  modo: ModoCriacao
  title: string
  description: string
}

export const MODE_OPTIONS: ModeOption[] = [
  {
    modo: 'novo',
    title: 'Projeto novo',
    description:
      'Checklist completo a partir do recebimento (PRÉ-INFO). Ideal para obras que ainda vão começar no escritório.',
  },
  {
    modo: 'em_andamento',
    title: 'Em andamento ou ajuste',
    description:
      'Informe a fase atual de cada disciplina e escolha quais categorias e tarefas importar do template.',
  },
  {
    modo: 'historico',
    title: 'Registro histórico',
    description:
      'Cadastro simplificado de projetos já concluídos, cancelados ou suspensos — sem checklist de tarefas.',
  },
]

interface StepModeSelectProps {
  selected: ModoCriacao | null
  onSelect: (modo: ModoCriacao) => void
}

export function StepModeSelect({ selected, onSelect }: StepModeSelectProps) {
  return (
    <div className="step-mode-select">
      <p className="step-mode-select__intro">
        Como este projeto entra no sistema? Escolha o modo que melhor descreve a situação atual.
      </p>
      <div className="step-mode-select__grid">
        {MODE_OPTIONS.map((option) => {
          const isSelected = selected === option.modo
          return (
            <button
              key={option.modo}
              type="button"
              className={`step-mode-select__card${isSelected ? ' step-mode-select__card--selected' : ''}`}
              onClick={() => onSelect(option.modo)}
              aria-pressed={isSelected}
            >
              <span className="step-mode-select__card-title">{option.title}</span>
              <span className="step-mode-select__card-desc">{option.description}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

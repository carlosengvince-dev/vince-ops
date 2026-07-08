import { getDisciplinaLabel } from '../../lib/disciplinaConfig'
import { getPhaseLabel } from '../../lib/faseConfig'
import {
  groupTarefasForVinculacao,
  type TarefaVinculadaOption,
} from '../../lib/tarefaVinculadaUtils'
import { discToneClasses, discToneStyle } from '../../lib/disciplinaTokens'
import type { Tarefa } from '../../types'
import './TarefaVinculadaSelect.css'

interface TarefaVinculadaSelectProps {
  tarefas: Tarefa[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export function TarefaVinculadaSelect({
  tarefas,
  selectedIds,
  onChange,
}: TarefaVinculadaSelectProps) {
  const groups = groupTarefasForVinculacao(tarefas)

  function toggle(id: string, checked: boolean) {
    onChange(
      checked ? [...selectedIds, id] : selectedIds.filter((x) => x !== id),
    )
  }

  if (groups.length === 0) {
    return (
      <p className="tarefa-vinculada-select__empty">Nenhuma tarefa disponível no projeto.</p>
    )
  }

  return (
    <fieldset className="tarefa-vinculada-select">
      <legend className="tarefa-vinculada-select__legend">Tarefas relacionadas</legend>
      <div className="tarefa-vinculada-select__groups">
        {groups.map((group) => (
          <section
            key={`${group.disciplina}-${group.fase}-${group.categoria}`}
            className="tarefa-vinculada-select__group"
          >
            <h4 className="tarefa-vinculada-select__group-title">
              {getPhaseLabel(group.fase, group.disciplina)} · {group.categoria}
            </h4>
            <ul className="tarefa-vinculada-select__list">
              {group.tarefas.map((t) => (
                <TarefaVinculadaOptionRow
                  key={t.id}
                  tarefa={t}
                  checked={selectedIds.includes(t.id)}
                  onToggle={toggle}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </fieldset>
  )
}

function TarefaVinculadaOptionRow({
  tarefa,
  checked,
  onToggle,
}: {
  tarefa: TarefaVinculadaOption
  checked: boolean
  onToggle: (id: string, checked: boolean) => void
}) {
  return (
    <li>
      <label className="tarefa-vinculada-select__option">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(tarefa.id, e.target.checked)}
        />
        <span className="tarefa-vinculada-select__option-body">
          <span className="tarefa-vinculada-select__nome">{tarefa.nome}</span>
          <span className="tarefa-vinculada-select__meta">
            <span
              className={`tarefa-vinculada-select__disc ${discToneClasses(tarefa.disciplina)}`}
              style={discToneStyle(tarefa.disciplina)}
            >
              {getDisciplinaLabel(tarefa.disciplina)}
            </span>
            <span>{getPhaseLabel(tarefa.fase, tarefa.disciplina)}</span>
            <span>{getDisciplinaLabel(tarefa.disciplina)}</span>
          </span>
        </span>
      </label>
    </li>
  )
}

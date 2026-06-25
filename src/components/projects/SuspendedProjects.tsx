import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { formatNumeroProjeto } from '../../lib/constants'
import type { ProjetoListItem } from '../../types/project-create'
import { Button } from '../ui/Button'
import './SuspendedProjects.css'

interface SuspendedProjectsProps {
  projetos: ProjetoListItem[]
  onReactivate: (id: string) => Promise<void>
  canReactivate: boolean
}

export function SuspendedProjects({
  projetos,
  onReactivate,
  canReactivate,
}: SuspendedProjectsProps) {
  const [open, setOpen] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  if (projetos.length === 0) return null

  async function handleReactivate(id: string) {
    setLoadingId(id)
    try {
      await onReactivate(id)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <section className="suspended-projects">
      <button
        type="button"
        className="suspended-projects__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>
          Projetos suspensos <em>({projetos.length})</em>
        </span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {open ? (
        <ul className="suspended-projects__list">
          {projetos.map((p) => (
            <li key={p.id} className="suspended-projects__item">
              <div>
                <strong>{p.codigo}</strong>
                <span className="suspended-projects__numero">
                  {formatNumeroProjeto(p.numero_sequencial)}
                </span>
                <span className="suspended-projects__nome">{p.nome}</span>
                {p.cliente_nome ? (
                  <span className="suspended-projects__cliente">{p.cliente_nome}</span>
                ) : null}
              </div>
              {canReactivate ? (
                <Button
                  type="button"
                  variant="secondary"
                  loading={loadingId === p.id}
                  onClick={() => void handleReactivate(p.id)}
                >
                  Reativar
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

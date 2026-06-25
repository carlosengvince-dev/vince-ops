import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { disciplinaTabClass } from '../components/ui/DisciplinaTabs'
import { discToneClasses } from '../lib/disciplinaTokens'
import {
  formatHistoricoDate,
  formatHistoricoHoras,
  type HistoricoProjetoRow,
} from '../lib/historico'
import { PROJETO_STATUS_LABELS } from '../lib/constants'
import { useHistoricoProjects } from '../hooks/useProjects'
import type { Disciplina, ProjetoStatus } from '../types'
import './History.css'

type StatusFilter = 'todos' | ProjetoStatus
type DisciplinaFilter = 'todos' | Disciplina
type SortKey = 'nome' | 'data_inicio' | 'data_conclusao' | 'horas'
type SortDir = 'asc' | 'desc'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'concluido', label: 'Concluídos' },
  { value: 'cancelado', label: 'Cancelados' },
  { value: 'suspenso', label: 'Suspensos' },
]

const DISCIPLINA_FILTERS: { value: DisciplinaFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'HID', label: 'HID' },
  { value: 'PPCI', label: 'PPCI' },
  { value: 'SPK', label: 'SPK' },
]

function matchesSearch(projeto: HistoricoProjetoRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    projeto.nome.toLowerCase().includes(q) ||
    projeto.codigo.toLowerCase().includes(q) ||
    (projeto.cliente_nome?.toLowerCase().includes(q) ?? false)
  )
}

function compareRows(a: HistoricoProjetoRow, b: HistoricoProjetoRow, key: SortKey): number {
  switch (key) {
    case 'nome':
      return a.nome.localeCompare(b.nome, 'pt-BR')
    case 'data_inicio':
      return (a.data_inicio ?? '').localeCompare(b.data_inicio ?? '')
    case 'data_conclusao':
      return (a.data_conclusao_real ?? '').localeCompare(b.data_conclusao_real ?? '')
    case 'horas':
      return a.horas_totais_segundos - b.horas_totais_segundos
    default:
      return 0
  }
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  sortDir,
  onSort,
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
}) {
  const active = activeKey === sortKey
  return (
    <th scope="col">
      <button
        type="button"
        className={`history__sort${active ? ' history__sort--active' : ''}`}
        onClick={() => onSort(sortKey)}
      >
        {label}
        {active ? <span aria-hidden>{sortDir === 'asc' ? ' ↑' : ' ↓'}</span> : null}
      </button>
    </th>
  )
}

export default function History() {
  const { projetos, loading, error } = useHistoricoProjects()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [disciplinaFilter, setDisciplinaFilter] = useState<DisciplinaFilter>('todos')
  const [sortKey, setSortKey] = useState<SortKey>('data_conclusao')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const hasActiveFilter =
    search.trim().length > 0 || statusFilter !== 'todos' || disciplinaFilter !== 'todos'

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'nome' ? 'asc' : 'desc')
  }

  const filtered = useMemo(() => {
    let rows = projetos.filter((p) => {
      if (statusFilter !== 'todos' && p.status !== statusFilter) return false
      if (disciplinaFilter !== 'todos' && !p.disciplinas.includes(disciplinaFilter)) return false
      return matchesSearch(p, search)
    })

    rows = [...rows].sort((a, b) => {
      const cmp = compareRows(a, b, sortKey)
      return sortDir === 'asc' ? cmp : -cmp
    })

    return rows
  }, [projetos, search, statusFilter, disciplinaFilter, sortKey, sortDir])

  return (
    <PageWrapper>
      <div className="history-page">
        <div className="history-page__toolbar">
          <div className="history-page__toolbar-left">
            <h1 className="history-page__title">Histórico</h1>
            <label className="history-page__search">
              <Search size={16} aria-hidden />
              <input
                type="search"
                placeholder="Buscar por nome, código ou cliente…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div className="history-page__filters" role="group" aria-label="Filtrar por status">
              {STATUS_FILTERS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`history-page__filter${statusFilter === opt.value ? ' history-page__filter--active' : ''}`}
                  onClick={() => setStatusFilter(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="history-page__filters" role="group" aria-label="Filtrar por disciplina">
              {DISCIPLINA_FILTERS.map((opt) => {
                const active = disciplinaFilter === opt.value
                const className =
                  opt.value === 'todos'
                    ? `history-page__filter${active ? ' history-page__filter--active' : ''}`
                    : disciplinaTabClass(opt.value, active)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={className}
                    onClick={() => setDisciplinaFilter(opt.value)}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
          <span className="history-page__export-wrap" title="Em breve">
            <button type="button" className="history-page__export" disabled>
              Exportar CSV
            </button>
          </span>
        </div>

        {error ? <p className="history__error">{error}</p> : null}

        {loading ? (
          <p className="history__status">Carregando…</p>
        ) : filtered.length === 0 ? (
          <p className="history__status">
            {hasActiveFilter
              ? 'Nenhum projeto encontrado com os filtros selecionados.'
              : 'Nenhum projeto no histórico ainda.'}
          </p>
        ) : (
          <div className="history__table-wrap">
            <table className="history__table">
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <SortHeader
                    label="Nome do projeto"
                    sortKey="nome"
                    activeKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <th scope="col">Cliente</th>
                  <th scope="col">Disciplinas</th>
                  <th scope="col">Status</th>
                  <SortHeader
                    label="Data início"
                    sortKey="data_inicio"
                    activeKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Data conclusão"
                    sortKey="data_conclusao"
                    activeKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Horas totais"
                    sortKey="horas"
                    activeKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>{p.codigo}</td>
                    <td>{p.nome}</td>
                    <td>{p.cliente_nome ?? '—'}</td>
                    <td>
                      <div className="history__disciplinas">
                        {p.disciplinas.map((d) => (
                          <span
                            key={d}
                            className={`history__disc-badge ${discToneClasses(d)} disc-tone--on`}
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`history__status-badge history__status-badge--${p.status.replace('_', '')}`}
                      >
                        {PROJETO_STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td>{formatHistoricoDate(p.data_inicio)}</td>
                    <td>{formatHistoricoDate(p.data_conclusao_real)}</td>
                    <td>{formatHistoricoHoras(p.horas_totais_segundos)}</td>
                    <td>
                      <Link className="history__view-link" to={`/projetos/${p.id}`}>
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageWrapper>
  )
}

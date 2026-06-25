import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { formatOrganizacaoCreatedAt, useOrganizacao } from '../../hooks/useOrganizacao'
import './DashboardOrgHeader.css'

export function DashboardOrgHeader() {
  const { profile } = useAuth()
  const { organizacao, loading } = useOrganizacao()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const orgName = organizacao?.nome ?? 'VINCE Engenharia'
  const createdLabel = formatOrganizacaoCreatedAt(organizacao?.created_at)

  useEffect(() => {
    if (!open) return

    function handleMouseDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [open])

  return (
    <header className="dashboard-org-header">
      <div className="dashboard-org-header__top" ref={rootRef}>
        <button
          type="button"
          className="dashboard-org-header__trigger"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="dashboard-org-header__name">
            {loading ? 'Carregando…' : orgName}
          </span>
          <ChevronDown
            size={20}
            className={`dashboard-org-header__chevron${open ? ' dashboard-org-header__chevron--open' : ''}`}
            aria-hidden
          />
        </button>

        {open ? (
          <div className="dashboard-org-header__popover" role="dialog" aria-label="Informações da organização">
            <dl className="dashboard-org-header__details">
              <div>
                <dt>Nome</dt>
                <dd>{orgName}</dd>
              </div>
              <div>
                <dt>Responsável</dt>
                <dd>{profile?.nome ?? '—'}</dd>
              </div>
              <div>
                <dt>Criada em</dt>
                <dd>{createdLabel}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </div>
      <p className="dashboard-org-header__subtitle">Painel de controle</p>
    </header>
  )
}

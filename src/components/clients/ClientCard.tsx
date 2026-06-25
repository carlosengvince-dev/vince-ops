import { Building2, Mail, Phone, User } from 'lucide-react'
import type { ClienteWithStats } from '../../hooks/useClients'
import './ClientCard.css'

interface ClientCardProps {
  cliente: ClienteWithStats
  onOpen: (cliente: ClienteWithStats) => void
}

export function ClientCard({ cliente, onOpen }: ClientCardProps) {
  return (
    <button type="button" className="client-card" onClick={() => onOpen(cliente)}>
      <div className="client-card__header">
        <span className="client-card__icon" aria-hidden="true">
          <Building2 size={18} />
        </span>
        <h3 className="client-card__name">{cliente.nome}</h3>
      </div>

      <div className="client-card__stats">
        <span className="client-card__stat client-card__stat--active">
          {cliente.projetosAtivos} ativo{cliente.projetosAtivos !== 1 ? 's' : ''}
        </span>
        <span className="client-card__stat">{cliente.projetosTotal} total</span>
      </div>

      <div className="client-card__meta">
        {cliente.contato ? (
          <span>
            <User size={14} /> {cliente.contato}
          </span>
        ) : null}
        {cliente.email ? (
          <span>
            <Mail size={14} /> {cliente.email}
          </span>
        ) : null}
        {cliente.telefone ? (
          <span>
            <Phone size={14} /> {cliente.telefone}
          </span>
        ) : null}
      </div>
    </button>
  )
}

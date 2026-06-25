import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Plus, Search } from 'lucide-react'
import { useClients } from '../../hooks/useClients'
import type { Cliente } from '../../types'
import './ClientSelect.css'

interface ClientSelectProps {
  value: string | null
  onChange: (clienteId: string | null) => void
  onNewClient?: () => void
  disabled?: boolean
  placeholder?: string
  /** Lista externa (opcional). Se omitida, busca via useClients. */
  clientes?: Cliente[]
}

export function ClientSelect({
  value,
  onChange,
  onNewClient,
  disabled = false,
  placeholder = 'Selecione um cliente',
  clientes: clientesProp,
}: ClientSelectProps) {
  const shouldFetch = clientesProp === undefined
  const { clientes: fetchedClientes, loading } = useClients({ enabled: shouldFetch })
  const clientes = clientesProp ?? fetchedClientes

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = clientes.find((c) => c.id === value) ?? null

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return clientes
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.contato?.toLowerCase().includes(term),
    )
  }, [clientes, search])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function handleSelect(clienteId: string) {
    onChange(clienteId)
    setOpen(false)
    setSearch('')
  }

  function handleToggle() {
    if (disabled) return
    setOpen((prev) => !prev)
  }

  return (
    <div
      className={`client-select${disabled ? ' client-select--disabled' : ''}`}
      ref={containerRef}
    >
      <label className="client-select__label">Cliente</label>
      <button
        type="button"
        className="client-select__trigger"
        onClick={handleToggle}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={selected ? 'client-select__value' : 'client-select__placeholder'}>
          {selected ? selected.nome : placeholder}
        </span>
        <ChevronDown size={16} />
      </button>

      {open ? (
        <div className="client-select__dropdown">
          <div className="client-select__search">
            <Search size={16} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente…"
              autoFocus
            />
          </div>

          {onNewClient ? (
            <button type="button" className="client-select__new" onClick={onNewClient}>
              <Plus size={16} />
              Novo cliente
            </button>
          ) : null}

          <ul className="client-select__list" role="listbox">
            {loading && !clientesProp ? (
              <li className="client-select__empty">Carregando…</li>
            ) : filtered.length === 0 ? (
              <li className="client-select__empty">Nenhum cliente encontrado</li>
            ) : (
              filtered.map((cliente) => (
                <li key={cliente.id}>
                  <button
                    type="button"
                    className={`client-select__option${
                      cliente.id === value ? ' client-select__option--selected' : ''
                    }`}
                    onClick={() => handleSelect(cliente.id)}
                    role="option"
                    aria-selected={cliente.id === value}
                  >
                    <span className="client-select__option-name">{cliente.nome}</span>
                    {cliente.email ? (
                      <span className="client-select__option-meta">{cliente.email}</span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

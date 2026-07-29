import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Plus, Search } from 'lucide-react'
import { useResponsaveisTecnicos } from '../../hooks/useResponsaveisTecnicos'
import type { ResponsavelTecnico } from '../../types'
import '../clients/ClientSelect.css'

interface RtSelectProps {
  value: string | null
  onChange: (rtId: string | null) => void
  onNewRt?: () => void
  disabled?: boolean
  placeholder?: string
  label?: string
  allowClear?: boolean
  items?: ResponsavelTecnico[]
}

export function RtSelect({
  value,
  onChange,
  onNewRt,
  disabled = false,
  placeholder = 'Selecione um RT',
  label = 'Responsável técnico',
  allowClear = true,
  items: itemsProp,
}: RtSelectProps) {
  const shouldFetch = itemsProp === undefined
  const { items: fetched, loading } = useResponsaveisTecnicos({ enabled: shouldFetch })
  const items = itemsProp ?? fetched

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = items.find((r) => r.id === value) ?? null

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter(
      (r) =>
        r.nome.toLowerCase().includes(term) ||
        r.documento?.toLowerCase().includes(term) ||
        r.registro?.toLowerCase().includes(term),
    )
  }, [items, search])

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

  function handleSelect(rtId: string) {
    onChange(rtId)
    setOpen(false)
    setSearch('')
  }

  function handleClear() {
    onChange(null)
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
      {label ? <label className="client-select__label">{label}</label> : null}
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
              placeholder="Buscar RT…"
              autoFocus
            />
          </div>

          {onNewRt ? (
            <button type="button" className="client-select__new" onClick={onNewRt}>
              <Plus size={16} />
              Novo RT
            </button>
          ) : null}

          {allowClear && value ? (
            <button type="button" className="client-select__new" onClick={handleClear}>
              Remover vínculo
            </button>
          ) : null}

          <ul className="client-select__list" role="listbox">
            {loading && !itemsProp ? (
              <li className="client-select__empty">Carregando…</li>
            ) : filtered.length === 0 ? (
              <li className="client-select__empty">Nenhum RT encontrado</li>
            ) : (
              filtered.map((rt) => (
                <li key={rt.id}>
                  <button
                    type="button"
                    className={`client-select__option${
                      rt.id === value ? ' client-select__option--selected' : ''
                    }`}
                    onClick={() => handleSelect(rt.id)}
                    role="option"
                    aria-selected={rt.id === value}
                  >
                    <span className="client-select__option-name">{rt.nome}</span>
                    {rt.documento || rt.registro ? (
                      <span className="client-select__option-meta">
                        {[rt.documento, rt.registro].filter(Boolean).join(' · ')}
                      </span>
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

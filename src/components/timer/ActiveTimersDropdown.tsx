import { useEffect, useRef, useState } from 'react'
import { useTimer } from '../../hooks/useTimer'
import { formatElapsedTime } from '../../lib/utils'
import './ActiveTimersDropdown.css'

export function ActiveTimersDropdown() {
  const { activeTimers, activeTimersLoading } = useTimer()
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(Date.now())
  const containerRef = useRef<HTMLDivElement>(null)

  const activeCount = activeTimers.length

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

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

  return (
    <div className="active-timers" ref={containerRef}>
      <button
        type="button"
        className="active-timers__trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {activeCount > 0 ? <span className="active-timers__dot" aria-hidden="true" /> : null}
        <span className="active-timers__label">
          {activeTimersLoading ? '…' : `${activeCount} ${activeCount === 1 ? 'ativo' : 'ativos'}`}
        </span>
      </button>

      {open ? (
        <div className="active-timers__dropdown" role="listbox">
          <p className="active-timers__dropdown-title">Timers ativos</p>
          {activeTimers.length === 0 ? (
            <p className="active-timers__empty">Nenhum timer ativo no momento.</p>
          ) : (
            <ul className="active-timers__list">
              {activeTimers.map((timer) => {
                const elapsed = Math.floor(
                  (now - new Date(timer.inicio).getTime()) / 1000,
                )
                return (
                  <li key={timer.id} className="active-timers__item">
                    <span className="active-timers__item-user">{timer.usuarioNome}</span>
                    <span className="active-timers__item-meta">
                      {formatElapsedTime(elapsed)} · {timer.tarefaNome}
                    </span>
                    <span className="active-timers__item-project">{timer.projetoCodigo}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}

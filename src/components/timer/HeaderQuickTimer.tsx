import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Square } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTimer } from '../../hooks/useTimer'
import { buildTaskTimerNavigateUrl, truncateTaskName } from '../../lib/timer'
import { formatElapsedTime, getInitials } from '../../lib/utils'
import './HeaderQuickTimer.css'

export function HeaderQuickTimer() {
  const { profile } = useAuth()
  const { myActiveTimer, stopMyTimer, operating } = useTimer()
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!myActiveTimer) return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [myActiveTimer])

  if (!profile || !myActiveTimer) return null

  const elapsed = Math.floor((now - new Date(myActiveTimer.inicio).getTime()) / 1000)
  const taskLabel = truncateTaskName(myActiveTimer.tarefaNome)
  const navigateUrl = buildTaskTimerNavigateUrl(myActiveTimer)

  return (
    <div className="header-quick-timer">
      <span className="header-quick-timer__avatar" aria-hidden>
        {getInitials(profile.nome)}
      </span>
      <Link to={navigateUrl} className="header-quick-timer__task" title={myActiveTimer.tarefaNome}>
        {taskLabel}
      </Link>
      <span className="header-quick-timer__clock" aria-live="polite">
        {formatElapsedTime(elapsed)}
      </span>
      <button
        type="button"
        className="header-quick-timer__stop"
        aria-label="Parar timer"
        disabled={operating}
        onClick={() => void stopMyTimer()}
      >
        <Square size={14} fill="currentColor" />
      </button>
    </div>
  )
}

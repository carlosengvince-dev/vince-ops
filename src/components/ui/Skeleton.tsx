import type { CSSProperties } from 'react'
import './Skeleton.css'

interface SkeletonProps {
  className?: string
  style?: CSSProperties
}

export function Skeleton({ className = '', style }: SkeletonProps) {
  return <span className={`skeleton ${className}`.trim()} style={style} aria-hidden="true" />
}

export function SkeletonMetricGrid() {
  return (
    <div className="skeleton-metrics" aria-hidden="true" aria-label="Carregando métricas">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="skeleton-metrics__card">
          <Skeleton className="skeleton-metrics__value" />
          <Skeleton className="skeleton-metrics__label" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonProjectCardGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="skeleton-project-cards" aria-hidden="true" aria-label="Carregando projetos">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-project-cards__card">
          <Skeleton className="skeleton-project-cards__title" />
          <Skeleton className="skeleton-project-cards__meta" />
          <Skeleton className="skeleton-project-cards__bar" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonChecklist({ lines = 5 }: { lines?: number }) {
  return (
    <div className="skeleton-checklist" aria-hidden="true" aria-label="Carregando checklist">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="skeleton-checklist__line" />
      ))}
    </div>
  )
}

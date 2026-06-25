import type { ReactNode } from 'react'
import './PageWrapper.css'

interface PageWrapperProps {
  title?: string
  children: ReactNode
}

export function PageWrapper({ title, children }: PageWrapperProps) {
  return (
    <div className="page-wrapper">
      {title ? <h1 className="page-wrapper__title">{title}</h1> : null}
      <div className="page-wrapper__content">{children}</div>
    </div>
  )
}

import './ProjectDetailTabs.css'

export type ProjectMainTab = 'home' | 'checklist' | 'pendencias' | 'revisoes' | 'atividade'

interface ProjectDetailTabsProps {
  value: ProjectMainTab
  onChange: (tab: ProjectMainTab) => void
}

const TABS: { id: ProjectMainTab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'pendencias', label: 'Pendências' },
  { id: 'revisoes', label: 'Revisões' },
  { id: 'atividade', label: 'Atividade' },
]

export function ProjectDetailTabs({ value, onChange }: ProjectDetailTabsProps) {
  return (
    <div className="project-detail-tabs" role="tablist" aria-label="Seções do projeto">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          className={`project-detail-tabs__tab${value === tab.id ? ' project-detail-tabs__tab--active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

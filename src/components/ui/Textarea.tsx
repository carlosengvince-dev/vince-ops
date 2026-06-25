import type { TextareaHTMLAttributes } from 'react'
import './Textarea.css'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string | null
}

export function Textarea({ label, error, id, className = '', ...props }: TextareaProps) {
  const textareaId = id ?? props.name

  return (
    <div className={`ui-textarea ${error ? 'ui-textarea--error' : ''} ${className}`.trim()}>
      <label htmlFor={textareaId} className="ui-textarea__label">
        {label}
      </label>
      <textarea id={textareaId} className="ui-textarea__field" {...props} />
      {error ? <span className="ui-textarea__error">{error}</span> : null}
    </div>
  )
}

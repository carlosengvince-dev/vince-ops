import type { InputHTMLAttributes } from 'react'
import './Input.css'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string | null
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  const inputId = id ?? props.name

  return (
    <div className={`ui-input ${error ? 'ui-input--error' : ''} ${className}`.trim()}>
      <label htmlFor={inputId} className="ui-input__label">
        {label}
      </label>
      <input id={inputId} className="ui-input__field" {...props} />
      {error ? <span className="ui-input__error">{error}</span> : null}
    </div>
  )
}

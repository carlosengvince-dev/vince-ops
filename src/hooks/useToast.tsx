import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import '../components/ui/Toast.css'

export type ToastVariant = 'success' | 'error'

export interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
  action?: ToastAction
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant, action?: ToastAction) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let toastId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'success', action?: ToastAction) => {
      const id = ++toastId
      setToasts((prev) => [...prev, { id, message, variant, action }])
      window.setTimeout(() => dismiss(id), action ? 8000 : 4000)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast--${toast.variant}`}
            role={toast.variant === 'error' ? 'alert' : 'status'}
          >
            <span className="toast__message">{toast.message}</span>
            {toast.action ? (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  toast.action?.onClick()
                  dismiss(toast.id)
                }}
              >
                {toast.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast deve ser usado dentro de ToastProvider')
  }
  return ctx
}

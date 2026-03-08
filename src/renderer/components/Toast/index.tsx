import React, { useEffect, useCallback } from 'react'
import { XMarkIcon, CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import { useTheme } from '../../hooks/useTheme'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastItemProps {
  toast: Toast
  onRemove: (id: string) => void
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const { isDark } = useTheme()
  const { id, type, message, duration = 3000 } = toast

  const handleRemove = useCallback(() => {
    onRemove(id)
  }, [id, onRemove])

  useEffect(() => {
    const timer = setTimeout(() => {
      handleRemove()
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, handleRemove])

  const icons = {
    success: <CheckCircleIcon className="w-5 h-5 text-green-500" />,
    error: <ExclamationCircleIcon className="w-5 h-5 text-red-500" />,
    info: <InformationCircleIcon className="w-5 h-5 text-blue-500" />,
    warning: <ExclamationCircleIcon className="w-5 h-5 text-yellow-500" />,
  }

  const bgColors = {
    success: isDark ? 'bg-green-900/90 border-green-700' : 'bg-green-50 border-green-200',
    error: isDark ? 'bg-red-900/90 border-red-700' : 'bg-red-50 border-red-200',
    info: isDark ? 'bg-blue-900/90 border-blue-700' : 'bg-blue-50 border-blue-200',
    warning: isDark ? 'bg-yellow-900/90 border-yellow-700' : 'bg-yellow-50 border-yellow-200',
  }

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border
        transform transition-all duration-300 ease-out
        animate-slide-in-right
        ${bgColors[type]}
      `}
      role="alert"
    >
      {icons[type]}
      <span className={`text-sm font-medium flex-1 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
        {message}
      </span>
      <button
        onClick={handleRemove}
        className={`
          p-1 rounded-md transition-colors
          ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}
        `}
        aria-label="关闭提示"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
    </div>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

export default ToastContainer

import { useState, useCallback, useEffect } from 'react'

let _show = null

export function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    _show = (msg, type = 'success') => {
      const id = Date.now()
      setToasts(t => [...t, { id, msg, type }])
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
    }
    return () => { _show = null }
  }, [])

  if (!toasts.length) return null

  return (
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, display:'flex', flexDirection:'column', gap:8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding: '10px 16px',
          borderRadius: 'var(--radius)',
          fontSize: '0.875rem',
          fontWeight: 500,
          animation: 'fadeIn 0.2s ease',
          maxWidth: 320,
          background: t.type === 'error' ? 'var(--red-bg)' : t.type === 'info' ? 'var(--blue-bg)' : 'var(--accent-bg)',
          color: t.type === 'error' ? 'var(--red)' : t.type === 'info' ? 'var(--blue)' : 'var(--accent2)',
          border: `1px solid ${t.type === 'error' ? 'rgba(212,96,96,0.3)' : t.type === 'info' ? 'rgba(96,153,212,0.3)' : 'var(--accent-border)'}`,
        }}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

export const toast = {
  success: (msg) => _show?.(msg, 'success'),
  error:   (msg) => _show?.(msg, 'error'),
  info:    (msg) => _show?.(msg, 'info'),
}

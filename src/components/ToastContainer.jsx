import React, { useEffect, useState } from 'react'
import { toastEvent } from '../utils/toast'

export default function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const handleShow = (e) => {
      const id = Date.now()
      setToasts(prev => [...prev, { id, ...e.detail }])
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 3000)
    }
    
    toastEvent.addEventListener('show', handleShow)
    return () => toastEvent.removeEventListener('show', handleShow)
  }, [])

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' ? '✅' : '❌'}
          <span style={{ fontWeight: 500 }}>{t.message}</span>
        </div>
      ))}
    </div>
  )
}

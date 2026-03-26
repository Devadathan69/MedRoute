import React from 'react'

export default function StatCard({ title, value, icon, color = 'var(--primary)' }) {
  return (
    <div className="stat-card">
      <div className="flex justify-between items-center mb-4">
        <div className="stat-card-title">{title}</div>
        {icon && <div style={{ fontSize: '1.5rem', opacity: 0.8 }}>{icon}</div>}
      </div>
      <div className="stat-card-value" style={{ color }}>{value}</div>
    </div>
  )
}

import React from 'react'
import { format } from 'date-fns'

export default function ExpiryTable({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎉</div>
        <div>No expiring medicines in the next 30 days!</div>
      </div>
    )
  }

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Quantity</th>
            <th>Expiry Date</th>
            <th>Batch No.</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map(r => {
            const days = Math.ceil((new Date(r.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
            const risk = days <= 7 ? 'red' : days <= 30 ? 'amber' : 'green'
            
            return (
              <tr key={r.inventory_id}>
                <td style={{ fontWeight: 500 }}>{r.medicine_name}</td>
                <td>{r.quantity_available} {r.unit}</td>
                <td>{format(new Date(r.expiry_date), 'MMM dd, yyyy')}</td>
                <td>{r.batch_number || 'N/A'}</td>
                <td>
                  <span className={`badge badge-${risk}`}>
                    {days <= 0 ? 'EXPIRED' : `${days} days left`}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

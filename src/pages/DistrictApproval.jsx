import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { toast } from '../utils/toast'
import { format } from 'date-fns'

export default function DistrictApproval({ session }) {
  const [pending, setPending] = useState([])
  const [userCenterId, setUserCenterId] = useState(null)

  useEffect(() => {
    async function load() {
      let query = supabase.from('redistribution_requests')
        .select('*, requesting:requesting_center_id(name, district), supplying:supplying_center_id(name, district), medicine:medicine_id(name, unit)')
        .eq('status', 'pending')
        .order('requested_at', { ascending: false })

      // Identify user constraint
      let role = session?.user?.user_metadata?.role || session?.user?.app_metadata?.role
      let center_id = session?.user?.user_metadata?.center_id || session?.user?.app_metadata?.center_id
      let district = session?.user?.user_metadata?.district || session?.user?.app_metadata?.district

      if (!role) {
         const { data: p } = await supabase.from('user_profiles').select('role, center_id, district').eq('id', session.user.id).single()
         role = p?.role
         center_id = p?.center_id
         district = p?.district
      }
      
      setUserCenterId(center_id || null)

      // If PHC Staff, only show requests sent TO their center (for filtering locally mapped UI)
      // We don't strictly filter if we want them to see their outward ones here too, but realistically 
      // the PHCDashboard handles outward ones now, so this handles inward approvals.
      
      const { data, error } = await query
      if (error) console.error(error)
      setPending(data || [])
    }
    if (session) {
      load()
    }
  }, [session])

  async function updateStatus(id, status) {
    const { error } = await supabase.from('redistribution_requests').update({ status }).eq('id', id)
    if (error) return toast.error(error.message)
    toast.success(`Request marked as ${status.toUpperCase()}`)
    setPending(p => p.filter(r => r.id !== id))
  }

  return (
    <div>
      <div className="mb-6">
        <h1>Transfer Approvals</h1>
        <p style={{ color: 'var(--text-muted)' }}>Review and authorize incoming medicine transfer requests.</p>
      </div>

      <div className="card">
        <h4 className="mb-4">Pending Incoming Requests ({pending.length})</h4>
        
        {pending.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>✓</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--text-main)' }}>All caught up!</div>
            <div>There are no pending requests waiting for your approval.</div>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Requested On</th>
                  <th>Route (Supplying → Requesting)</th>
                  <th>Medicine & Qty</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(r => (
                  <tr key={r.id}>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {format(new Date(r.requested_at), 'MMM dd, yyyy')}<br/>
                      <span style={{ fontSize: '0.75rem' }}>{format(new Date(r.requested_at), 'HH:mm')}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{r.supplying?.name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>→</span>
                        <span style={{ fontWeight: 600 }}>{r.requesting?.name}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {r.supplying?.district} to {r.requesting?.district}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{r.medicine?.name}</div>
                      <div className="badge badge-blue mt-1">{r.quantity} {r.medicine?.unit}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                        {r.requesting_center_id === userCenterId ? (
                           <span style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Awaiting supplier...</span>
                        ) : (
                          <>
                            <button className="btn btn-primary" style={{ padding: '0.4rem 1rem' }} onClick={() => updateStatus(r.id, 'approved')}>Approve</button>
                            <button className="btn btn-secondary" style={{ padding: '0.4rem 1rem', color: 'var(--danger-text)' }} onClick={() => updateStatus(r.id, 'rejected')}>Reject</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

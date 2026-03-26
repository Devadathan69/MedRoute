import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import StatCard from '../components/StatCard'
import ExpiryTable from '../components/ExpiryTable'
import { format } from 'date-fns'

export default function PHCDashboard({ session }) {
  const [stats, setStats] = useState({ total_medicines: 0, expiry_alerts: 0, below_threshold: 0, pending_transfers: 0 })
  const [alerts, setAlerts] = useState([])
  const [myRequests, setMyRequests] = useState([])
  const [centerName, setCenterName] = useState('')

  useEffect(() => {
    async function load() {
      let center_id = session?.user?.user_metadata?.center_id || session?.user?.app_metadata?.center_id
      
      if (!center_id && session?.user?.id) {
        const { data: profile } = await supabase.from('user_profiles').select('center_id').eq('id', session.user.id).single()
        center_id = profile?.center_id
      }
      
      if (!center_id) return

      const { data: pc } = await supabase.from('phc_centers').select('name').eq('id', center_id).single()
      if(pc) setCenterName(pc.name)

      const { data: medRows } = await supabase.from('inventory').select('medicine_id', { count: 'exact' }).eq('center_id', center_id)
      const { data: expView } = await supabase.from('expiring_soon').select('*').eq('center_id', center_id)
      const { data: flags } = await supabase.from('shortage_flags').select('*').eq('center_id', center_id).eq('resolved', false)
      const { data: pending } = await supabase.from('redistribution_requests').select('*').or(`requesting_center_id.eq.${center_id},supplying_center_id.eq.${center_id}`).eq('status', 'pending')
      
      // Fetch user's outgoing requests
      const { data: reqs } = await supabase.from('redistribution_requests')
        .select('*, medicine:medicine_id(name), supplying:supplying_center_id(name)')
        .eq('requesting_center_id', center_id)
        .order('requested_at', { ascending: false })
        .limit(10)

      setStats({
        total_medicines: medRows?.length ?? 0,
        expiry_alerts: expView?.length ?? 0,
        below_threshold: flags?.filter(f => f.flag_type === 'low_stock')?.length ?? 0,
        pending_transfers: pending?.length ?? 0
      })
      setAlerts(expView || [])
      setMyRequests(reqs || [])
    }
    load()
  }, [session])

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1>PHC Dashboard</h1>
          <p style={{ color: 'var(--text-muted)' }}>{centerName ? `Overview for ${centerName}` : 'Overview of your primary health center'}</p>
        </div>
      </div>
      
      <div className="flex gap-4 mb-6">
        <StatCard title="Total Medicines" value={stats.total_medicines} icon="📦" color="var(--primary)" />
        <StatCard title="Expiry Alerts" value={stats.expiry_alerts} icon="⏰" color={stats.expiry_alerts > 0 ? 'var(--danger)' : 'var(--success)'} />
        <StatCard title="Shortage Flags" value={stats.below_threshold} icon="⚠️" color={stats.below_threshold > 0 ? 'var(--warning)' : 'var(--success)'} />
        <StatCard title="Pending Transfers" value={stats.pending_transfers} icon="🔄" color="var(--primary)" />
      </div>

      <div className="grid gap-6">
        <div className="card">
          <h3 className="mb-4">Medicines Expiring Soon (30 Days)</h3>
          <ExpiryTable alerts={alerts} />
        </div>

        <div className="card">
          <h3 className="mb-4">My Outgoing Transfer Requests</h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Requested On</th>
                  <th>Medicine requested</th>
                  <th>Supplying PHC</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {myRequests.map(r => (
                  <tr key={r.id}>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {format(new Date(r.requested_at), 'MMM dd, yyyy')} <br/>
                      <span style={{ fontSize: '0.75rem' }}>{format(new Date(r.requested_at), 'HH:mm')}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{r.medicine?.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Qty: {r.quantity}</div>
                    </td>
                    <td>{r.supplying?.name}</td>
                    <td>
                      {r.status === 'approved' && <span className="badge badge-green">Approved</span>}
                      {r.status === 'pending' && <span className="badge badge-amber">Pending</span>}
                      {r.status === 'rejected' && <span className="badge badge-red">Rejected</span>}
                    </td>
                  </tr>
                ))}
                {myRequests.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      You haven't made any transfer requests yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
